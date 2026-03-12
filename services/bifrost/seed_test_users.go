package main

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
)

func main() {
	connStr := "postgres://serpent@localhost:5432/nox?sslmode=disable"
	ctx := context.Background()

	conn, err := pgx.Connect(ctx, connStr)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer conn.Close(ctx)

	orgID := "00000000-0000-0000-0000-000000000001"
	
	users := []struct {
		ID       string
		Username string
		Email    string
	}{
		{"a1000000-0000-0000-0000-000000000000", "AliceReacts", "alice.reactions@example.com"},
		{"b2000000-0000-0000-0000-000000000000", "BobReacts", "bob.reactions@example.com"},
		{"22222222-2222-2222-2222-222222222222", "TestUser", "test@example.com"},
		{"33333333-3333-3333-3333-333333333333", "ThreadMaster", "threads@example.com"},
		{"a1111111-1111-1111-1111-111111111111", "AliceReads", "alice.reads@example.com"},
		{"b2222222-2222-2222-2222-222222222222", "BobReads", "bob.reads@example.com"},
	}

	_, _ = conn.Exec(ctx, "INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", orgID, "Nexus Inc", "nexus-inc")

	for _, u := range users {
		fmt.Printf("Seeding user: %s (%s)\n", u.Username, u.ID)
		
		_, err = conn.Exec(ctx, `
			INSERT INTO users (id, email, username, password_hash, is_email_verified) 
			VALUES ($1, $2, $3, $4, TRUE)
			ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, username = EXCLUDED.username
		`, u.ID, u.Email, u.Username, "$2a$10$X8Xf7Y7Y7Y7Y7Y7Y7Y7Y7e.O0O0O0O0O0O0O0O0O0O0O0O0O0O0")
		
		if err != nil {
			// If conflict on email, just ignore
			fmt.Printf("Attempting update for %s due to possible email conflict...\n", u.Username)
			_, _ = conn.Exec(ctx, "UPDATE users SET id = $1 WHERE email = $2", u.ID, u.Email)
		}

		_, err = conn.Exec(ctx, `
			INSERT INTO organization_memberships (user_id, org_id, role) 
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, org_id) DO NOTHING
		`, u.ID, orgID, "member")
	}

	_, _ = conn.Exec(ctx, `
		INSERT INTO channels (id, org_id, name)
		VALUES ('00000000-0000-0000-0000-000000000001', $1, 'general')
		ON CONFLICT (id) DO NOTHING
	`, orgID)

	fmt.Println("Seeding complete.")
}
