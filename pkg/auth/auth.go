package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"
)

// Config holds authentication configuration
type Config struct {
	JWTSecret      string        `toml:"jwt_secret"`
	JWTExpiryHours int           `toml:"jwt_expiry_hours"`
	Google         OAuthProvider `toml:"google"`
	GitHub         OAuthProvider `toml:"github"`
}

type OAuthProvider struct {
	ClientID     string `toml:"client_id"`
	ClientSecret string `toml:"client_secret"`
	RedirectURL  string `toml:"redirect_url"`
}

func (c *Config) JWTExpiry() time.Duration {
	if c.JWTExpiryHours <= 0 {
		return 24 * time.Hour
	}
	return time.Duration(c.JWTExpiryHours) * time.Hour
}

// User represents an authenticated user
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Provider  string    `json:"provider"`
	CreatedAt time.Time `json:"created_at"`
	LastLogin time.Time `json:"last_login"`
}

// Claims represents JWT token claims
type Claims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	Provider string `json:"provider"`
}

// Provider types
type Provider string

const (
	ProviderGoogle Provider = "google"
	ProviderGitHub Provider = "github"
)

// JWTManager handles JWT token operations
type JWTManager struct {
	secret []byte
	expiry time.Duration
}

func NewJWTManager(secret string, expiry time.Duration) *JWTManager {
	return &JWTManager{
		secret: []byte(secret),
		expiry: expiry,
	}
}

func (jm *JWTManager) Generate(claims *Claims) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":  claims.UserID,
		"email":    claims.Email,
		"provider": claims.Provider,
		"exp":      time.Now().Add(jm.expiry).Unix(),
		"iat":      time.Now().Unix(),
	})
	return token.SignedString(jm.secret)
}

func (jm *JWTManager) Validate(tokenString string) (*Claims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jm.secret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims")
	}

	return &Claims{
		UserID:   claims["user_id"].(string),
		Email:    claims["email"].(string),
		Provider: claims["provider"].(string),
	}, nil
}

// OAuthManager handles OAuth2 flows
type OAuthManager struct {
	configs map[Provider]*oauth2.Config
	states  map[string]Provider
}

func NewOAuthManager(cfg *Config) *OAuthManager {
	om := &OAuthManager{
		configs: make(map[Provider]*oauth2.Config),
		states:  make(map[string]Provider),
	}

	if cfg.Google.ClientID != "" {
		om.configs[ProviderGoogle] = &oauth2.Config{
			ClientID:     cfg.Google.ClientID,
			ClientSecret: cfg.Google.ClientSecret,
			RedirectURL:  cfg.Google.RedirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		}
	}

	if cfg.GitHub.ClientID != "" {
		om.configs[ProviderGitHub] = &oauth2.Config{
			ClientID:     cfg.GitHub.ClientID,
			ClientSecret: cfg.GitHub.ClientSecret,
			RedirectURL:  cfg.GitHub.RedirectURL,
			Scopes:       []string{"user:email"},
			Endpoint:     github.Endpoint,
		}
	}

	return om
}

func (om *OAuthManager) GetAuthURL(provider Provider) (string, error) {
	cfg, ok := om.configs[provider]
	if !ok {
		return "", fmt.Errorf("provider %s not configured", provider)
	}

	state, err := generateState()
	if err != nil {
		return "", err
	}

	om.states[state] = provider
	return cfg.AuthCodeURL(state), nil
}

func (om *OAuthManager) Exchange(ctx context.Context, state, code string) (*oauth2.Token, Provider, error) {
	provider, ok := om.states[state]
	if !ok {
		return nil, "", fmt.Errorf("invalid state")
	}

	cfg := om.configs[provider]
	token, err := cfg.Exchange(ctx, code)
	if err != nil {
		return nil, "", err
	}

	delete(om.states, state)
	return token, provider, nil
}

func generateState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// Middleware provides authentication middleware
type Middleware struct {
	jwt    *JWTManager
	logger *slog.Logger
}

func NewMiddleware(jwt *JWTManager, logger *slog.Logger) *Middleware {
	return &Middleware{
		jwt:    jwt,
		logger: logger,
	}
}

func (m *Middleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := m.extractToken(r)
		if token == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		claims, err := m.jwt.Validate(token)
		if err != nil {
			m.logger.Warn("invalid token", "error", err)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), "claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (m *Middleware) extractToken(r *http.Request) string {
	if cookie, err := r.Cookie("auth_token"); err == nil {
		return cookie.Value
	}

	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}

	return ""
}
