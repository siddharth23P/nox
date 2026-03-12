package messaging

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/nox-labs/bifrost/internal/db"
)

type MessagingService struct {
	db        *db.Database
	Reactions *ReactionService
}

func NewMessagingService(database *db.Database, reactions *ReactionService) *MessagingService {
	return &MessagingService{db: database, Reactions: reactions}
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

func (s *MessagingService) CreateMessage(ctx context.Context, channelID, userID, contentMD, contentHTML string, parentID *string) (*Message, error) {
	// Fallback to simple HTML if not provided
	if contentHTML == "" {
		contentHTML = "<p>" + contentMD + "</p>"
	}

	query := `
		WITH new_message AS (
			INSERT INTO messages (channel_id, user_id, parent_id, content_md, content_html)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, channel_id, user_id, parent_id, content_md, content_html, created_at, updated_at, is_edited
		)
		SELECT m.id, m.channel_id, m.user_id, u.username, m.parent_id, m.content_md, m.content_html, m.created_at, m.updated_at, m.is_edited
		FROM new_message m
		JOIN users u ON m.user_id = u.id
	`
	row := s.db.Pool.QueryRow(ctx, query, channelID, userID, parentID, contentMD, contentHTML)

	var msg Message
	err := row.Scan(&msg.ID, &msg.ChannelID, &msg.UserID, &msg.Username, &msg.ParentID, &msg.ContentMD, &msg.ContentHTML, &msg.CreatedAt, &msg.UpdatedAt, &msg.IsEdited)
	if err != nil {
		return nil, err
	}
	// Initial reply count is 0
	msg.ReplyCount = 0
	msg.Reactions = make(map[string]int)
	return &msg, nil
}

func (s *MessagingService) GetMessagesByChannel(ctx context.Context, channelID string, before string, currentUserID string) ([]Message, error) {
	var query string
	var args []interface{}

	if before != "" {
		query = `
			SELECT 
				m.id, m.channel_id, m.user_id, u.username, m.parent_id, m.content_md, m.content_html, m.created_at, m.updated_at, m.is_edited,
				(SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id) as reply_count
			FROM messages m
			JOIN users u ON m.user_id = u.id
			WHERE m.channel_id = $1 AND m.parent_id IS NULL AND m.created_at < $2::timestamp
			ORDER BY m.created_at DESC
			LIMIT 50
		`
		args = []interface{}{channelID, before}
	} else {
		query = `
			SELECT 
				m.id, m.channel_id, m.user_id, u.username, m.parent_id, m.content_md, m.content_html, m.created_at, m.updated_at, m.is_edited,
				(SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id) as reply_count
			FROM messages m
			JOIN users u ON m.user_id = u.id
			WHERE m.channel_id = $1 AND m.parent_id IS NULL
			ORDER BY m.created_at DESC
			LIMIT 50
		`
		args = []interface{}{channelID}
	}

	rows, err := s.db.Pool.Query(ctx, query, args...)
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
		if err := rows.Scan(&msg.ID, &msg.ChannelID, &msg.UserID, &msg.Username, &msg.ParentID, &msg.ContentMD, &msg.ContentHTML, &msg.CreatedAt, &msg.UpdatedAt, &msg.IsEdited, &msg.ReplyCount); err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	// Reverse messages to return them in chronological order (oldest first)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	messages = s.Reactions.InjectReactionsIntoMessages(messages, currentUserID)

	return messages, nil
}

func (s *MessagingService) GetThreadReplies(ctx context.Context, messageID string, currentUserID string) ([]Message, error) {
	query := `
		SELECT m.id, m.channel_id, m.user_id, u.username, m.parent_id, m.content_md, m.content_html, m.created_at, m.updated_at, m.is_edited 
		FROM messages m
		JOIN users u ON m.user_id = u.id
		WHERE m.parent_id = $1 
		ORDER BY m.created_at ASC
	`
	rows, err := s.db.Pool.Query(ctx, query, messageID)
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
		if err := rows.Scan(&msg.ID, &msg.ChannelID, &msg.UserID, &msg.Username, &msg.ParentID, &msg.ContentMD, &msg.ContentHTML, &msg.CreatedAt, &msg.UpdatedAt, &msg.IsEdited); err != nil {
			return nil, err
		}
		msg.ReplyCount = 0 // Replies don't have replies in this simple 1-level thread model
		messages = append(messages, msg)
	}
	
	messages = s.Reactions.InjectReactionsIntoMessages(messages, currentUserID)
	
	return messages, nil
}

func (s *MessagingService) EditMessage(ctx context.Context, messageID string, userID string, contentMD string, contentHTML string) (*Message, error) {
	if contentHTML == "" {
		contentHTML = "<p>" + contentMD + "</p>"
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Fetch old content and verify author
	var oldMD, oldHTML, authorID string
	err = tx.QueryRow(ctx, "SELECT content_md, content_html, user_id FROM messages WHERE id = $1", messageID).Scan(&oldMD, &oldHTML, &authorID)
	if err != nil {
		return nil, err
	}
	if authorID != userID {
		return nil, pgx.ErrNoRows // Using ErrNoRows to signify unauthorized / not found
	}

	// Insert into history
	_, err = tx.Exec(ctx, `
		INSERT INTO message_edits (message_id, old_content_md, old_content_html, new_content_md, new_content_html)
		VALUES ($1, $2, $3, $4, $5)
	`, messageID, oldMD, oldHTML, contentMD, contentHTML)
	if err != nil {
		return nil, err
	}

	// Update main record
	_, err = tx.Exec(ctx, `
		UPDATE messages 
		SET content_md = $1, content_html = $2, is_edited = TRUE, updated_at = NOW()
		WHERE id = $3
	`, contentMD, contentHTML, messageID)
	if err != nil {
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	// Fetch returning object
	var msg Message
	err = s.db.Pool.QueryRow(ctx, `
		SELECT m.id, m.channel_id, m.user_id, u.username, m.parent_id, m.content_md, m.content_html, m.created_at, m.updated_at, m.is_edited,
			(SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id) as reply_count
		FROM messages m
		JOIN users u ON m.user_id = u.id
		WHERE m.id = $1
	`, messageID).Scan(&msg.ID, &msg.ChannelID, &msg.UserID, &msg.Username, &msg.ParentID, &msg.ContentMD, &msg.ContentHTML, &msg.CreatedAt, &msg.UpdatedAt, &msg.IsEdited, &msg.ReplyCount)

	if err != nil {
		return nil, err
	}
	
	// Inject reactions for the returned edited message
	msgs := s.Reactions.InjectReactionsIntoMessages([]Message{msg}, userID)
	return &msgs[0], nil
}

func (s *MessagingService) GetMessageEditHistory(ctx context.Context, messageID string) ([]MessageEdit, error) {
	query := `
		SELECT id, message_id, old_content_md, old_content_html, new_content_md, new_content_html, created_at
		FROM message_edits
		WHERE message_id = $1
		ORDER BY created_at DESC
	`
	rows, err := s.db.Pool.Query(ctx, query, messageID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return []MessageEdit{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	var edits []MessageEdit
	for rows.Next() {
		var e MessageEdit
		if err := rows.Scan(&e.ID, &e.MessageID, &e.OldContentMD, &e.OldContentHTML, &e.NewContentMD, &e.NewContentHTML, &e.CreatedAt); err != nil {
			return nil, err
		}
		edits = append(edits, e)
	}
	return edits, nil
}
