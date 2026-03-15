package email

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/nox-labs/bifrost/internal/db"
)

// Service handles email preference management and the email queue.
type Service struct {
	db     *db.Database
	sender Sender
}

// NewService creates an EmailService backed by the given database and sender.
func NewService(database *db.Database, sender Sender) *Service {
	return &Service{db: database, sender: sender}
}

// GetPreferences returns the email preferences for a user, inserting default
// values if none exist yet.
func (s *Service) GetPreferences(ctx context.Context, userID string) (*EmailPreference, error) {
	var p EmailPreference
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO email_preferences (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE SET user_id = email_preferences.user_id
		RETURNING user_id, dm_emails, mention_emails, digest_enabled, digest_frequency, unsubscribed, updated_at
	`, userID).Scan(
		&p.UserID, &p.DMEmails, &p.MentionEmails,
		&p.DigestEnabled, &p.DigestFrequency, &p.Unsubscribed, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get email preferences: %w", err)
	}
	return &p, nil
}

// UpdatePreferences applies partial updates to a user's email preferences.
func (s *Service) UpdatePreferences(ctx context.Context, userID string, req UpdatePreferencesRequest) (*EmailPreference, error) {
	// Ensure the row exists first.
	if _, err := s.GetPreferences(ctx, userID); err != nil {
		return nil, err
	}

	// Build SET clause dynamically.
	sets := "updated_at = NOW()"
	args := []interface{}{userID}
	idx := 2

	if req.DMEmails != nil {
		sets += fmt.Sprintf(", dm_emails = $%d", idx)
		args = append(args, *req.DMEmails)
		idx++
	}
	if req.MentionEmails != nil {
		sets += fmt.Sprintf(", mention_emails = $%d", idx)
		args = append(args, *req.MentionEmails)
		idx++
	}
	if req.DigestEnabled != nil {
		sets += fmt.Sprintf(", digest_enabled = $%d", idx)
		args = append(args, *req.DigestEnabled)
		idx++
	}
	if req.DigestFrequency != nil {
		sets += fmt.Sprintf(", digest_frequency = $%d", idx)
		args = append(args, *req.DigestFrequency)
		idx++
	}
	if req.Unsubscribed != nil {
		sets += fmt.Sprintf(", unsubscribed = $%d", idx)
		args = append(args, *req.Unsubscribed)
		idx++
	}

	var p EmailPreference
	query := fmt.Sprintf(`UPDATE email_preferences SET %s WHERE user_id = $1
		RETURNING user_id, dm_emails, mention_emails, digest_enabled, digest_frequency, unsubscribed, updated_at`, sets)
	err := s.db.Pool.QueryRow(ctx, query, args...).Scan(
		&p.UserID, &p.DMEmails, &p.MentionEmails,
		&p.DigestEnabled, &p.DigestFrequency, &p.Unsubscribed, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update email preferences: %w", err)
	}
	return &p, nil
}

// QueueEmail inserts a new email into the queue for later processing.
func (s *Service) QueueEmail(ctx context.Context, userID, emailType, subject, bodyHTML, bodyText string) (*QueuedEmail, error) {
	var e QueuedEmail
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO email_queue (user_id, email_type, subject, body_html, body_text)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, email_type, subject, body_html, body_text, status, attempts, last_error, created_at, sent_at
	`, userID, emailType, subject, bodyHTML, bodyText).Scan(
		&e.ID, &e.UserID, &e.EmailType, &e.Subject,
		&e.BodyHTML, &e.BodyText, &e.Status, &e.Attempts,
		&e.LastError, &e.CreatedAt, &e.SentAt,
	)
	if err != nil {
		return nil, fmt.Errorf("queue email: %w", err)
	}
	return &e, nil
}

// ProcessQueue picks up pending emails and attempts to send them via the
// configured Sender. Each email is retried up to 3 times before being
// marked as failed.
func (s *Service) ProcessQueue(ctx context.Context) (sent int, failed int, err error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, user_id, email_type, subject, body_html, body_text, attempts
		FROM email_queue
		WHERE status = 'pending' AND attempts < 3
		ORDER BY created_at ASC
		LIMIT 50
	`)
	if err != nil {
		return 0, 0, fmt.Errorf("process queue query: %w", err)
	}
	defer rows.Close()

	type pending struct {
		id, userID, emailType, subject, bodyHTML, bodyText string
		attempts                                           int
	}
	var items []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.id, &p.userID, &p.emailType, &p.subject, &p.bodyHTML, &p.bodyText, &p.attempts); err != nil {
			return sent, failed, fmt.Errorf("scan queue row: %w", err)
		}
		items = append(items, p)
	}

	for _, item := range items {
		// Look up the user's email address.
		var userEmail string
		err := s.db.Pool.QueryRow(ctx, `SELECT email FROM users WHERE id = $1`, item.userID).Scan(&userEmail)
		if err != nil {
			if err == pgx.ErrNoRows {
				// User deleted; mark as failed.
				_, _ = s.db.Pool.Exec(ctx, `UPDATE email_queue SET status = 'failed', last_error = 'user not found' WHERE id = $1`, item.id)
				failed++
				continue
			}
			return sent, failed, fmt.Errorf("lookup user email: %w", err)
		}

		sendErr := s.sender.Send(ctx, userEmail, item.subject, item.bodyHTML, item.bodyText)
		if sendErr != nil {
			newAttempts := item.attempts + 1
			newStatus := "pending"
			if newAttempts >= 3 {
				newStatus = "failed"
				failed++
			}
			_, _ = s.db.Pool.Exec(ctx,
				`UPDATE email_queue SET attempts = $1, status = $2, last_error = $3 WHERE id = $4`,
				newAttempts, newStatus, sendErr.Error(), item.id,
			)
			continue
		}

		now := time.Now()
		_, _ = s.db.Pool.Exec(ctx,
			`UPDATE email_queue SET status = 'sent', attempts = attempts + 1, sent_at = $1 WHERE id = $2`,
			now, item.id,
		)
		sent++
	}

	return sent, failed, nil
}

// Unsubscribe globally unsubscribes a user from all email notifications.
func (s *Service) Unsubscribe(ctx context.Context, userID string) error {
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO email_preferences (user_id, unsubscribed, updated_at)
		VALUES ($1, TRUE, NOW())
		ON CONFLICT (user_id) DO UPDATE SET unsubscribed = TRUE, updated_at = NOW()
	`, userID)
	if err != nil {
		return fmt.Errorf("unsubscribe: %w", err)
	}
	return nil
}
