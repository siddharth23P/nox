package main

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	connStr := "postgres://serpent@localhost:5432/nox?sslmode=disable"
	conn, err := pgx.Connect(context.Background(), connStr)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer conn.Close(context.Background())

	email := "test@nox.io"
	username := "test_user"
	password := "password123"
	fullName := "Test User"

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	userId := "00000000-0000-0000-0000-000000000001"
	orgId := "00000000-0000-0000-0000-000000000002"

	// Create User
	_, err = conn.Exec(context.Background(), `
		INSERT INTO users (id, email, username, password_hash, full_name, is_email_verified)
		VALUES ($1, $2, $3, $4, $5, TRUE)
		ON CONFLICT (email) DO UPDATE 
		SET password_hash = EXCLUDED.password_hash, 
		    is_email_verified = TRUE,
		    username = EXCLUDED.username;
	`, userId, email, username, string(hashedPassword), fullName)
	if err != nil {
		log.Fatalf("Failed to seed user: %v", err)
	}

	// Create Organization
	_, err = conn.Exec(context.Background(), `
		INSERT INTO organizations (id, name, slug)
		VALUES ($1, 'Test Organization', 'test-org')
		ON CONFLICT DO NOTHING;
	`, orgId)
	if err != nil {
		log.Fatalf("Failed to seed organization: %v", err)
	}

	// Add Membership
	_, err = conn.Exec(context.Background(), `
		INSERT INTO organization_memberships (user_id, org_id, role)
		VALUES ($1, $2, 'admin')
		ON CONFLICT DO NOTHING;
	`, userId, orgId)
	if err != nil {
		log.Fatalf("Failed to seed membership: %v", err)
	}

	fmt.Printf("Successfully seeded test user: %s (password: %s)\n", email, password)
}
