package db

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
)

type User struct {
	ID                string
	Email             string
	Username          string
	PasswordHash      string
	FullName          string
	IsEmailVerified   bool
	VerificationToken string
	RecoveryQuestions string // Store as JSON string in Go, JSONB in DB
}

type Organization struct {
	ID   string
	Name string
	Slug string
}

func (db *Database) CreateUserAndOrg(ctx context.Context, email, username, passwordHash, fullName, orgName, verificationToken string, recoveryQuestions interface{}) (string, string, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback(ctx)

	userID := uuid.New().String()
	orgID := uuid.New().String()
	orgSlug := uuid.New().String()

	// 1. Create Organization
	_, err = tx.Exec(ctx, 
		"INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)", 
		orgID, orgName, orgSlug)
	if err != nil {
		return "", "", fmt.Errorf("failed to create org: %w", err)
	}

	// Prepare recovery questions JSON
	rqJSON, err := json.Marshal(recoveryQuestions)
	if err != nil {
		return "", "", fmt.Errorf("failed to marshal recovery questions: %w", err)
	}

	// 2. Create User
	_, err = tx.Exec(ctx, 
		"INSERT INTO users (id, email, username, password_hash, full_name, verification_token, recovery_questions) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		userID, email, username, passwordHash, fullName, verificationToken, rqJSON)
	if err != nil {
		return "", "", fmt.Errorf("failed to create user: %w", err)
	}

	// 3. Link User to Org
	_, err = tx.Exec(ctx, 
		"INSERT INTO organization_memberships (user_id, org_id, role) VALUES ($1, $2, $3)",
		userID, orgID, "owner")
	if err != nil {
		return "", "", fmt.Errorf("failed to link user to org: %w", err)
	}

	err = tx.Commit(ctx)
	if err != nil {
		return "", "", err
	}

	return userID, orgID, nil
}

func (db *Database) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	var user User
	err := db.Pool.QueryRow(ctx, 
		"SELECT id, email, username, password_hash, COALESCE(full_name, ''), is_email_verified FROM users WHERE email = $1", 
		email).Scan(&user.ID, &user.Email, &user.Username, &user.PasswordHash, &user.FullName, &user.IsEmailVerified)
	
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (db *Database) VerifyEmailToken(ctx context.Context, token string) (bool, error) {
	res, err := db.Pool.Exec(ctx, "UPDATE users SET is_email_verified = TRUE, verification_token = NULL WHERE verification_token = $1", token)
	if err != nil {
		return false, err
	}
	return res.RowsAffected() > 0, nil
}
