package email

import (
	"context"
	"log"
)

// Sender is the interface for delivering emails. Swap in a real
// implementation (e.g. SES, SendGrid) when the project is ready.
type Sender interface {
	Send(ctx context.Context, to, subject, bodyHTML, bodyText string) error
}

// LogSender logs emails instead of sending them (for development).
type LogSender struct{}

func (s *LogSender) Send(ctx context.Context, to, subject, bodyHTML, bodyText string) error {
	log.Printf("[EMAIL STUB] To: %s, Subject: %s", to, subject)
	return nil
}
