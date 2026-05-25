package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"golang.org/x/oauth2"
)

type Handlers struct {
	oauth  *OAuthManager
	jwt    *JWTManager
	store  Store
	logger *slog.Logger
}

func NewHandlers(oauth *OAuthManager, jwt *JWTManager, store Store, logger *slog.Logger) *Handlers {
	return &Handlers{
		oauth:  oauth,
		jwt:    jwt,
		store:  store,
		logger: logger,
	}
}

func (h *Handlers) LoginHandler(w http.ResponseWriter, r *http.Request) {
	provider := Provider(r.URL.Query().Get("provider"))
	if provider != ProviderGoogle && provider != ProviderGitHub {
		http.Error(w, "invalid provider", http.StatusBadRequest)
		return
	}

	authURL, err := h.oauth.GetAuthURL(provider)
	if err != nil {
		h.logger.Error("failed to get auth URL", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func (h *Handlers) CallbackHandler(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")

	if state == "" || code == "" {
		http.Error(w, "missing state or code", http.StatusBadRequest)
		return
	}

	token, provider, err := h.oauth.Exchange(r.Context(), state, code)
	if err != nil {
		h.logger.Error("failed to exchange token", "error", err)
		http.Error(w, "authentication failed", http.StatusUnauthorized)
		return
	}

	userInfo, err := h.fetchUserInfo(r.Context(), provider, token)
	if err != nil {
		h.logger.Error("failed to fetch user info", "error", err)
		http.Error(w, "failed to get user info", http.StatusInternalServerError)
		return
	}

	user, err := h.store.GetUser(r.Context(), userInfo.Email)
	if err != nil {
		h.logger.Error("failed to get user", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	now := time.Now()
	if user == nil {
		user = &User{
			ID:        fmt.Sprintf("%s:%s", provider, userInfo.Email),
			Email:     userInfo.Email,
			Name:      userInfo.Name,
			Provider:  string(provider),
			CreatedAt: now,
			LastLogin: now,
		}
		if err := h.store.CreateUser(r.Context(), user); err != nil {
			h.logger.Error("failed to create user", "error", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	} else {
		if err := h.store.UpdateLastLogin(r.Context(), user.Email); err != nil {
			h.logger.Error("failed to update last login", "error", err)
		}
	}

	jwtToken, err := h.jwt.Generate(&Claims{
		UserID:   user.ID,
		Email:    user.Email,
		Provider: user.Provider,
	})
	if err != nil {
		h.logger.Error("failed to generate JWT", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    jwtToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   86400,
	})

	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

func (h *Handlers) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "logged out"})
}

func (h *Handlers) MeHandler(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value("claims").(*Claims)

	user, err := h.store.GetUser(r.Context(), claims.Email)
	if err != nil {
		h.logger.Error("failed to get user", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

type userInfo struct {
	Email string
	Name  string
}

func (h *Handlers) fetchUserInfo(ctx context.Context, provider Provider, token *oauth2.Token) (*userInfo, error) {
	client := oauth2.NewClient(ctx, oauth2.StaticTokenSource(token))

	var url string
	switch provider {
	case ProviderGoogle:
		url = "https://www.googleapis.com/oauth2/v2/userinfo"
	case ProviderGitHub:
		url = "https://api.github.com/user"
	default:
		return nil, fmt.Errorf("unsupported provider: %s", provider)
	}

	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var data map[string]any
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}

	info := &userInfo{}
	switch provider {
	case ProviderGoogle:
		info.Email = data["email"].(string)
		info.Name = data["name"].(string)
	case ProviderGitHub:
		if email, ok := data["email"].(string); ok && email != "" {
			info.Email = email
		} else {
			info.Email, err = h.fetchGitHubEmail(ctx, client)
			if err != nil {
				return nil, err
			}
		}
		info.Name = data["name"].(string)
		if info.Name == "" {
			info.Name = data["login"].(string)
		}
	}

	return info, nil
}

func (h *Handlers) fetchGitHubEmail(ctx context.Context, client *http.Client) (string, error) {
	resp, err := client.Get("https://api.github.com/user/emails")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var emails []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		return "", err
	}

	for _, email := range emails {
		if primary, ok := email["primary"].(bool); ok && primary {
			return email["email"].(string), nil
		}
	}

	if len(emails) > 0 {
		return emails[0]["email"].(string), nil
	}

	return "", fmt.Errorf("no email found")
}
