package email

import "time"

// EmailPreference stores per-user email notification settings.
type EmailPreference struct {
	UserID          string    `json:"user_id"`
	DMEmails        bool      `json:"dm_emails"`
	MentionEmails   bool      `json:"mention_emails"`
	DigestEnabled   bool      `json:"digest_enabled"`
	DigestFrequency string    `json:"digest_frequency"`
	Unsubscribed    bool      `json:"unsubscribed"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// QueuedEmail represents a row in the email_queue table.
type QueuedEmail struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	EmailType string     `json:"email_type"`
	Subject   string     `json:"subject"`
	BodyHTML  string     `json:"body_html"`
	BodyText  string     `json:"body_text"`
	Status    string     `json:"status"`
	Attempts  int        `json:"attempts"`
	LastError *string    `json:"last_error,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	SentAt    *time.Time `json:"sent_at,omitempty"`
}

// UpdatePreferencesRequest is the JSON body for PATCH /email/preferences.
type UpdatePreferencesRequest struct {
	DMEmails        *bool   `json:"dm_emails"`
	MentionEmails   *bool   `json:"mention_emails"`
	DigestEnabled   *bool   `json:"digest_enabled"`
	DigestFrequency *string `json:"digest_frequency"`
	Unsubscribed    *bool   `json:"unsubscribed"`
}
