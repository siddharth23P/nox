package db

import (
	"context"
	"time"
)

// StorePasswordResetToken saves a hashed reset token with 1-hour expiry for the given email.
func (db *Database) StorePasswordResetToken(ctx context.Context, email, tokenHash string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users
		 SET password_reset_token = $2,
		     reset_token_expires_at = NOW() + INTERVAL '1 hour'
		 WHERE email = $1`,
		email, tokenHash)
	return err
}

// CheckResetRateLimit returns the current request count within the rate-limit window.
// If the window has expired (older than 1 hour), it resets and returns 0.
func (db *Database) CheckResetRateLimit(ctx context.Context, email string) (int, error) {
	var count int
	var window *time.Time
	err := db.Pool.QueryRow(ctx,
		`SELECT COALESCE(reset_request_count, 0), reset_request_window
		 FROM users WHERE email = $1`, email).Scan(&count, &window)
	if err != nil {
		return 0, err
	}

	if window == nil || window.Before(time.Now().Add(-1*time.Hour)) {
		// Window expired, reset
		_, _ = db.Pool.Exec(ctx,
			`UPDATE users SET reset_request_count = 0, reset_request_window = NULL WHERE email = $1`, email)
		return 0, nil
	}

	return count, nil
}

// IncrementResetRequestCount bumps the rate-limit counter and sets the window if needed.
func (db *Database) IncrementResetRequestCount(ctx context.Context, email string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users
		 SET reset_request_count = COALESCE(reset_request_count, 0) + 1,
		     reset_request_window = COALESCE(
		         CASE WHEN reset_request_window IS NULL OR reset_request_window < NOW() - INTERVAL '1 hour'
		              THEN NOW()
		              ELSE reset_request_window
		         END, NOW())
		 WHERE email = $1`, email)
	return err
}

// ValidateResetToken checks that the token hash matches and hasn't expired.
func (db *Database) ValidateResetToken(ctx context.Context, tokenHash string) (string, error) {
	var userID string
	err := db.Pool.QueryRow(ctx,
		`SELECT id FROM users
		 WHERE password_reset_token = $1
		   AND reset_token_expires_at > NOW()`, tokenHash).Scan(&userID)
	if err != nil {
		return "", err
	}
	return userID, nil
}

// UpdatePasswordAndClearToken sets a new password hash and clears the reset token.
func (db *Database) UpdatePasswordAndClearToken(ctx context.Context, userID, passwordHash string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users
		 SET password_hash = $2,
		     password_reset_token = NULL,
		     reset_token_expires_at = NULL,
		     reset_request_count = 0,
		     reset_request_window = NULL
		 WHERE id = $1`, userID, passwordHash)
	return err
}

// GetRecoveryQuestions returns the recovery_questions JSONB for a user by email.
func (db *Database) GetRecoveryQuestions(ctx context.Context, email string) (string, string, error) {
	var userID string
	var rq *string
	err := db.Pool.QueryRow(ctx,
		`SELECT id, recovery_questions::text FROM users WHERE email = $1`, email).Scan(&userID, &rq)
	if err != nil {
		return "", "", err
	}
	if rq == nil {
		return userID, "[]", nil
	}
	return userID, *rq, nil
}

// EmailExists checks if a user with the given email exists (used for safe responses).
func (db *Database) EmailExists(ctx context.Context, email string) bool {
	var exists bool
	_ = db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email).Scan(&exists)
	return exists
}
