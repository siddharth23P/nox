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

	fmt.Printf("[DEBUG] CreateUserAndOrg: Creating org %s (%s) and user %s\n", orgName, orgID, email)

	// 4. Create default #general channel
	_, err = tx.Exec(ctx,
		"INSERT INTO channels (org_id, name, description, is_private) VALUES ($1, $2, $3, $4)",
		orgID, "general", "Default channel for for everyone", false)
	if err != nil {
		fmt.Printf("[DEBUG] CreateUserAndOrg: Failed to create channel: %v\n", err)
		return "", "", fmt.Errorf("failed to create default channel: %w", err)
	}
	fmt.Printf("[DEBUG] CreateUserAndOrg: Default channel created for org %s\n", orgID)

	err = tx.Commit(ctx)
	if err != nil {
		return "", "", err
	}

	return userID, orgID, nil
}

// CreateOrganization creates a new organization, adds the creator as owner,
// and creates a default #general channel. Returns the new org ID.
func (db *Database) CreateOrganization(ctx context.Context, name, slug, creatorUserID string) (string, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	orgID := uuid.New().String()

	_, err = tx.Exec(ctx,
		"INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)",
		orgID, name, slug)
	if err != nil {
		return "", fmt.Errorf("failed to create org: %w", err)
	}

	_, err = tx.Exec(ctx,
		"INSERT INTO organization_memberships (user_id, org_id, role) VALUES ($1, $2, $3)",
		creatorUserID, orgID, "owner")
	if err != nil {
		return "", fmt.Errorf("failed to add creator as owner: %w", err)
	}

	_, err = tx.Exec(ctx,
		"INSERT INTO channels (org_id, name, description, is_private) VALUES ($1, $2, $3, $4)",
		orgID, "general", "Default channel for everyone", false)
	if err != nil {
		return "", fmt.Errorf("failed to create default channel: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}

	return orgID, nil
}

// OrgSlugExists checks if a slug is already taken.
func (db *Database) OrgSlugExists(ctx context.Context, slug string) (bool, error) {
	var exists bool
	err := db.Pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM organizations WHERE slug = $1)", slug).Scan(&exists)
	return exists, err
}

type OrgMembership struct {
	OrgID   string
	OrgName string
	OrgSlug string
	Role    string
}

func (db *Database) ListUserOrganizations(ctx context.Context, userID string) ([]OrgMembership, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT o.id, o.name, o.slug, om.role
		 FROM organization_memberships om
		 JOIN organizations o ON o.id = om.org_id
		 WHERE om.user_id = $1
		 ORDER BY o.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orgs []OrgMembership
	for rows.Next() {
		var m OrgMembership
		if err := rows.Scan(&m.OrgID, &m.OrgName, &m.OrgSlug, &m.Role); err != nil {
			return nil, err
		}
		orgs = append(orgs, m)
	}
	return orgs, nil
}

func (db *Database) GetUserOrgRole(ctx context.Context, userID, orgID string) (string, error) {
	var role string
	err := db.Pool.QueryRow(ctx,
		"SELECT role FROM organization_memberships WHERE user_id = $1 AND org_id = $2",
		userID, orgID).Scan(&role)
	if err != nil {
		return "", err
	}
	return role, nil
}

func (db *Database) SetRLSContext(ctx context.Context, orgID, userID string) error {
	_, err := db.Pool.Exec(ctx, "SELECT set_config('app.current_org_id', $1, true)", orgID)
	if err != nil {
		return err
	}
	_, err = db.Pool.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true)", userID)
	return err
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
