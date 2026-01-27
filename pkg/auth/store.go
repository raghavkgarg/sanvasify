package auth

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type Store interface {
	GetUser(ctx context.Context, email string) (*User, error)
	CreateUser(ctx context.Context, user *User) error
	UpdateLastLogin(ctx context.Context, email string) error
}

type DBStore struct {
	db *sql.DB
}

func NewDBStore(db *sql.DB) (*DBStore, error) {
	store := &DBStore{db: db}
	if err := store.init(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *DBStore) init() error {
	query := `
		CREATE TABLE IF NOT EXISTS users (
			id VARCHAR PRIMARY KEY,
			email VARCHAR UNIQUE NOT NULL,
			name VARCHAR,
			provider VARCHAR NOT NULL,
			created_at TIMESTAMP NOT NULL,
			last_login TIMESTAMP NOT NULL
		)
	`
	_, err := s.db.Exec(query)
	return err
}

func (s *DBStore) GetUser(ctx context.Context, email string) (*User, error) {
	var user User
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, name, provider, created_at, last_login
		FROM users WHERE email = ?
	`, email).Scan(&user.ID, &user.Email, &user.Name, &user.Provider, &user.CreatedAt, &user.LastLogin)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *DBStore) CreateUser(ctx context.Context, user *User) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO users (id, email, name, provider, created_at, last_login)
		VALUES (?, ?, ?, ?, ?, ?)
	`, user.ID, user.Email, user.Name, user.Provider, user.CreatedAt, user.LastLogin)
	return err
}

func (s *DBStore) UpdateLastLogin(ctx context.Context, email string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE users SET last_login = ? WHERE email = ?
	`, time.Now(), email)
	return err
}

func generateUserID(email, provider string) string {
	return fmt.Sprintf("%s:%s", provider, email)
}
