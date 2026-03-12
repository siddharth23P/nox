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

	// Tables to truncate in order to respect foreign keys
	tables := []string{
		"channel_reads",
		"user_bookmarks",
		"channel_pins",
		"message_edits",
		"messages",
		"channels",
		"organization_memberships",
		"users",
		"organizations",
	}

	for _, table := range tables {
		fmt.Printf("Truncating table: %s\n", table)
		_, err := conn.Exec(ctx, fmt.Sprintf("TRUNCATE TABLE %s RESTART IDENTITY CASCADE", table))
		if err != nil {
			fmt.Printf("Warning: failed to truncate %s: %v\n", table, err)
		}
	}

	fmt.Println("Database cleanup complete.")
}
