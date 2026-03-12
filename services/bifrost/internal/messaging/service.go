package messaging

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/nox-labs/bifrost/internal/db"
)

type MessagingService struct {
	db *db.Database
}

func NewMessagingService(database *db.Database) *MessagingService {
	return &MessagingService{db: database}
}

func (s *MessagingService) CreateChannel(ctx context.Context, orgID, name, description string, isPrivate bool) (*Channel, error) {
	query := `
		INSERT INTO channels (org_id, name, description, is_private)
		VALUES ($1, $2, $3, $4)
		RETURNING id, org_id, name, description, is_private, created_at, updated_at
	`
	row := s.db.Pool.QueryRow(ctx, query, orgID, name, description, isPrivate)

	var ch Channel
	err := row.Scan(&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.IsPrivate, &ch.CreatedAt, &ch.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &ch, nil
}

func (s *MessagingService) GetChannels(ctx context.Context, orgID string) ([]Channel, error) {
	query := `SELECT id, org_id, name, description, is_private, created_at, updated_at FROM channels WHERE org_id = $1 ORDER BY name ASC`
	rows, err := s.db.Pool.Query(ctx, query, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []Channel
	for rows.Next() {
		var ch Channel
		if err := rows.Scan(&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.IsPrivate, &ch.CreatedAt, &ch.UpdatedAt); err != nil {
			return nil, err
		}
		channels = append(channels, ch)
	}
	return channels, nil
}

func (s *MessagingService) CreateMessage(ctx context.Context, channelID, userID, contentMD, contentHTML string) (*Message, error) {
	// Fallback to simple HTML if not provided
	if contentHTML == "" {
		contentHTML = "<p>" + contentMD + "</p>"
	}

	query := `
		INSERT INTO messages (channel_id, user_id, content_md, content_html)
		VALUES ($1, $2, $3, $4)
		RETURNING id, channel_id, user_id, content_md, content_html, created_at, updated_at
	`
	row := s.db.Pool.QueryRow(ctx, query, channelID, userID, contentMD, contentHTML)

	var msg Message
	err := row.Scan(&msg.ID, &msg.ChannelID, &msg.UserID, &msg.ContentMD, &msg.ContentHTML, &msg.CreatedAt, &msg.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

func (s *MessagingService) GetMessagesByChannel(ctx context.Context, channelID string) ([]Message, error) {
	query := `
		SELECT id, channel_id, user_id, content_md, content_html, created_at, updated_at 
		FROM messages 
		WHERE channel_id = $1 
		ORDER BY created_at ASC
	`
	rows, err := s.db.Pool.Query(ctx, query, channelID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return []Message{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		if err := rows.Scan(&msg.ID, &msg.ChannelID, &msg.UserID, &msg.ContentMD, &msg.ContentHTML, &msg.CreatedAt, &msg.UpdatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}
	return messages, nil
}
