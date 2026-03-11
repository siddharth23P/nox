package db

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Database struct {
	Pool *pgxpool.Pool
}

func NewDatabase(ctx context.Context) (*Database, error) {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		// Mock default for local dev on macOS
		connStr = "postgres://serpent@localhost:5432/nox?sslmode=disable"
	}
	fmt.Printf("Connecting to database with: %s\n", connStr)

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	return &Database{Pool: pool}, nil
}

func (db *Database) Close() {
	db.Pool.Close()
}
