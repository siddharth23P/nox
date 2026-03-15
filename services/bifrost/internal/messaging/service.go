package messaging

import (
	"context"
	"fmt"
	"html"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/microcosm-cc/bluemonday"
	"github.com/nox-labs/bifrost/internal/db"
	"github.com/nox-labs/bifrost/internal/ephemeral"
)

// sanitizer is a shared UGC policy that strips dangerous HTML but allows safe formatting.
var sanitizer = bluemonday.UGCPolicy()
type MessagingService struct {
	db        *db.Database
	Reactions *ReactionService
	Hub       *Hub
	cache     ephemeral.Store
}

func NewMessagingService(database *db.Database, reactions *ReactionService, hub *Hub) *MessagingService {
	return &MessagingService{db: database, Reactions: reactions, Hub: hub}
}

// NewMessagingServiceWithCache creates a MessagingService with ephemeral message caching.
func NewMessagingServiceWithCache(database *db.Database, reactions *ReactionService, hub *Hub, cache ephemeral.Store) *MessagingService {
	return &MessagingService{db: database, Reactions: reactions, Hub: hub, cache: cache}
}

func (s *MessagingService) CreateChannel(ctx context.Context, orgID, name, description, topic string, isPrivate bool, createdBy string) (*Channel, error) {
	query := `
		INSERT INTO channels (org_id, name, description, topic, is_private, created_by)
		VALUES ($1, $2, $3, NULLIF($4, ''), $5, NULLIF($6, '')::UUID)
		RETURNING id, org_id, name, description, topic, is_private, created_by, archived_at, created_at, updated_at
	`
	row := s.db.Pool.QueryRow(ctx, query, orgID, name, description, topic, isPrivate, createdBy)

	var ch Channel
	err := row.Scan(&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.Topic, &ch.IsPrivate, &ch.CreatedBy, &ch.ArchivedAt, &ch.CreatedAt, &ch.UpdatedAt)
	if err != nil {
		return nil, err
	}
	// Auto-add creator as a member for private channels
	if isPrivate && createdBy != "" {
		_, _ = s.db.Pool.Exec(ctx, `INSERT INTO channel_members (channel_id, user_id, added_by) VALUES ($1, $2, $2) ON CONFLICT DO NOTHING`, ch.ID, createdBy)
	}

	return &ch, nil
}

func (s *MessagingService) GetChannels(ctx context.Context, orgID string, userID string, includeArchived bool) ([]Channel, error) {
	var query string
	if includeArchived {
		query = `SELECT id, org_id, name, description, topic, is_private, created_by, archived_at, created_at, updated_at FROM channels WHERE org_id = $1 AND (is_dm = FALSE OR is_dm IS NULL) AND (is_private = FALSE OR EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id = channels.id AND cm.user_id = $2)) ORDER BY name ASC`
	} else {
		query = `SELECT id, org_id, name, description, topic, is_private, created_by, archived_at, created_at, updated_at FROM channels WHERE org_id = $1 AND archived_at IS NULL AND (is_dm = FALSE OR is_dm IS NULL) AND (is_private = FALSE OR EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id = channels.id AND cm.user_id = $2)) ORDER BY name ASC`
	}
	rows, err := s.db.Pool.Query(ctx, query, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []Channel
	for rows.Next() {
		var ch Channel
		if err := rows.Scan(&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.Topic, &ch.IsPrivate, &ch.CreatedBy, &ch.ArchivedAt, &ch.CreatedAt, &ch.UpdatedAt); err != nil {
			return nil, err
		}
		channels = append(channels, ch)
	}
	return channels, nil
}

func (s *MessagingService) GetChannel(ctx context.Context, channelID string) (*Channel, error) {
	query := `SELECT id, org_id, name, description, topic, is_private, created_by, archived_at, created_at, updated_at FROM channels WHERE id = $1`
	row := s.db.Pool.QueryRow(ctx, query, channelID)

	var ch Channel
	err := row.Scan(&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.Topic, &ch.IsPrivate, &ch.CreatedBy, &ch.ArchivedAt, &ch.CreatedAt, &ch.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &ch, nil
}

func (s *MessagingService) UpdateChannel(ctx context.Context, channelID string, name, description, topic *string) (*Channel, error) {
	// Build dynamic update
	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argIdx := 1

	if name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *name)
		argIdx++
	}
	if description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *description)
		argIdx++
	}
	if topic != nil {
		setClauses = append(setClauses, fmt.Sprintf("topic = $%d", argIdx))
		args = append(args, *topic)
		argIdx++
	}

	if len(args) == 0 {
		return s.GetChannel(ctx, channelID)
	}

	query := fmt.Sprintf(`UPDATE channels SET %s WHERE id = $%d RETURNING id, org_id, name, description, topic, is_private, created_by, archived_at, created_at, updated_at`,
		joinStrings(setClauses, ", "), argIdx)
	args = append(args, channelID)

	row := s.db.Pool.QueryRow(ctx, query, args...)

	var ch Channel
	err := row.Scan(&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.Topic, &ch.IsPrivate, &ch.CreatedBy, &ch.ArchivedAt, &ch.CreatedAt, &ch.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &ch, nil
}

func (s *MessagingService) ArchiveChannel(ctx context.Context, channelID string) (*Channel, error) {
	query := `UPDATE channels SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND archived_at IS NULL
		RETURNING id, org_id, name, description, topic, is_private, created_by, archived_at, created_at, updated_at`
	row := s.db.Pool.QueryRow(ctx, query, channelID)

	var ch Channel
	err := row.Scan(&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.Topic, &ch.IsPrivate, &ch.CreatedBy, &ch.ArchivedAt, &ch.CreatedAt, &ch.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &ch, nil
}

func (s *MessagingService) UnarchiveChannel(ctx context.Context, channelID string) (*Channel, error) {
	query := `UPDATE channels SET archived_at = NULL, updated_at = NOW() WHERE id = $1 AND archived_at IS NOT NULL
		RETURNING id, org_id, name, description, topic, is_private, created_by, archived_at, created_at, updated_at`
	row := s.db.Pool.QueryRow(ctx, query, channelID)

	var ch Channel
	err := row.Scan(&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.Topic, &ch.IsPrivate, &ch.CreatedBy, &ch.ArchivedAt, &ch.CreatedAt, &ch.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &ch, nil
}

func (s *MessagingService) DeleteChannel(ctx context.Context, channelID string) error {
	_, err := s.db.Pool.Exec(ctx, `DELETE FROM channels WHERE id = $1`, channelID)
	return err
}

// joinStrings joins string slices with a separator (avoids importing strings package).
func joinStrings(ss []string, sep string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}

func (s *MessagingService) CreateMessage(ctx context.Context, channelID, userID, contentMD, contentHTML string, parentID, replyTo, forwardSourceID, forwardSourceUsername *string) (*Message, error) {
	// Fallback to escaped HTML if not provided
	if contentHTML == "" {
		contentHTML = "<p>" + html.EscapeString(contentMD) + "</p>"
	}
	// Sanitize all HTML to prevent XSS
	contentHTML = sanitizer.Sanitize(contentHTML)

	query := `
		WITH new_message AS (
			INSERT INTO messages (channel_id, user_id, parent_id, reply_to, forward_source_id, content_md, content_html)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id, channel_id, user_id, parent_id, reply_to, forward_source_id, content_md, content_html, created_at, updated_at, is_edited
		)
		SELECT m.id, m.channel_id, m.user_id, u.username, m.parent_id, m.reply_to, m.forward_source_id, m.content_md, m.content_html, m.created_at, m.updated_at, m.is_edited
		FROM new_message m
		JOIN users u ON m.user_id = u.id
	`
	row := s.db.Pool.QueryRow(ctx, query, channelID, userID, parentID, replyTo, forwardSourceID, contentMD, contentHTML)

	var msg Message
	err := row.Scan(&msg.ID, &msg.ChannelID, &msg.UserID, &msg.Username, &msg.ParentID, &msg.ReplyTo, &msg.ForwardSourceID, &msg.ContentMD, &msg.ContentHTML, &msg.CreatedAt, &msg.UpdatedAt, &msg.IsEdited)
	if err != nil {
		return nil, err
	}
	msg.ForwardSourceUsername = forwardSourceUsername
	// Initial state for new message
	msg.ReplyCount = 0
	msg.IsPinned = false
	msg.IsBookmarked = false
	msg.Reactions = make(map[string]int)

	// Invalidate the message cache for this channel so the next fetch is fresh.
	if s.cache != nil {
		if err := s.cache.InvalidateMessageCache(ctx, channelID); err != nil {
			log.Printf("ephemeral.InvalidateMessageCache error: %v", err)
		}
	}

	// Broadcast the new message
	s.Hub.BroadcastEvent("MESSAGE_CREATED", msg)

	return &msg, nil
}

// MessageQueryParams holds pagination parameters for message fetching.
type MessageQueryParams struct {
	Before string // Fetch messages before this timestamp
	After  string // Fetch messages after this timestamp
	Around string // Fetch messages around this message ID
	Limit  int    // Number of messages to fetch (max 100, default 50)
}

func (s *MessagingService) GetMessagesByChannel(ctx context.Context, channelID string, params MessageQueryParams, currentUserID string) ([]Message, bool, error) {
	if params.Limit <= 0 || params.Limit > 100 {
		params.Limit = 50
	}

	// For the default "latest messages" query only, check the ephemeral cache.
	isDefaultQuery := params.Before == "" && params.After == "" && params.Around == ""
	if isDefaultQuery && s.cache != nil {
		cached, err := s.cache.GetCachedMessages(ctx, channelID, params.Limit)
		if err != nil {
			log.Printf("ephemeral.GetCachedMessages error: %v", err)
		}
		if cached != nil {
			// Convert CachedMessage back to Message (lightweight, no reactions/pins/bookmarks).
			msgs := make([]Message, len(cached))
			for i, cm := range cached {
				t, _ := time.Parse(time.RFC3339Nano, cm.CreatedAt)
				msgs[i] = Message{
					ID:        cm.ID,
					ChannelID: cm.ChannelID,
					UserID:    cm.UserID,
					ContentMD: cm.ContentMD,
					CreatedAt: t,
				}
			}
			// Re-inject reactions so cached results include live reaction data.
			msgs = s.Reactions.InjectReactionsIntoMessages(msgs, currentUserID)
			return msgs, false, nil
		}
	}

	var query string
	var args []interface{}

	baseSelect := `
		SELECT
			m.id, m.channel_id, m.user_id, u.username, m.parent_id, m.reply_to, m.forward_source_id,
			fsu.username as forward_source_username,
			m.content_md, m.content_html, m.created_at, m.updated_at, m.is_edited, m.deleted_at,
			(SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id AND r.deleted_at IS NULL) as reply_count,
			EXISTS(SELECT 1 FROM channel_pins cp WHERE cp.message_id = m.id) as is_pinned,
			EXISTS(SELECT 1 FROM user_bookmarks ub WHERE ub.message_id = m.id AND ub.user_id = `

	baseFrom := `
		FROM messages m
		JOIN users u ON m.user_id = u.id
		LEFT JOIN messages fsm ON m.forward_source_id = fsm.id
		LEFT JOIN users fsu ON fsm.user_id = fsu.id
		WHERE m.channel_id = $1 AND m.parent_id IS NULL`

	hiddenFilter := ` AND NOT EXISTS (SELECT 1 FROM user_hidden_messages uhm WHERE uhm.user_id = %s AND uhm.message_id = m.id)`

	switch {
	case params.Around != "":
		// Fetch messages around a specific message ID: half before, half after
		half := params.Limit / 2
		query = `WITH target AS (
			SELECT created_at FROM messages WHERE id = $2 AND channel_id = $1
		)
		(` + baseSelect + `$3) as is_bookmarked` + baseFrom + ` AND m.created_at <= (SELECT created_at FROM target)` + fmt.Sprintf(hiddenFilter, "$3") + `
			ORDER BY m.created_at DESC
			LIMIT $4
		)
		UNION ALL
		(` + baseSelect + `$3) as is_bookmarked` + baseFrom + ` AND m.created_at > (SELECT created_at FROM target)` + fmt.Sprintf(hiddenFilter, "$3") + `
			ORDER BY m.created_at ASC
			LIMIT $5
		)
		ORDER BY created_at ASC`
		args = []interface{}{channelID, params.Around, currentUserID, half + 1, half}

	case params.After != "":
		query = baseSelect + `$3) as is_bookmarked` + baseFrom + ` AND m.created_at > $2::timestamp` + fmt.Sprintf(hiddenFilter, "$3") + `
			ORDER BY m.created_at ASC
			LIMIT $4`
		args = []interface{}{channelID, params.After, currentUserID, params.Limit + 1}

	case params.Before != "":
		query = baseSelect + `$3) as is_bookmarked` + baseFrom + ` AND m.created_at < $2::timestamp` + fmt.Sprintf(hiddenFilter, "$3") + `
			ORDER BY m.created_at DESC
			LIMIT $4`
		args = []interface{}{channelID, params.Before, currentUserID, params.Limit + 1}

	default:
		query = baseSelect + `$2) as is_bookmarked` + baseFrom + fmt.Sprintf(hiddenFilter, "$2") + `
			ORDER BY m.created_at DESC
			LIMIT $3`
		args = []interface{}{channelID, currentUserID, params.Limit + 1}
	}

	rows, err := s.db.Pool.Query(ctx, query, args...)
	if err != nil {
		if err == pgx.ErrNoRows {
			return []Message{}, false, nil
		}
		return nil, false, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		if err := rows.Scan(&msg.ID, &msg.ChannelID, &msg.UserID, &msg.Username, &msg.ParentID, &msg.ReplyTo, &msg.ForwardSourceID, &msg.ForwardSourceUsername, &msg.ContentMD, &msg.ContentHTML, &msg.CreatedAt, &msg.UpdatedAt, &msg.IsEdited, &msg.DeletedAt, &msg.ReplyCount, &msg.IsPinned, &msg.IsBookmarked); err != nil {
			return nil, false, err
		}
		// For deleted messages, clear content and mark as deleted (tombstone)
		if msg.DeletedAt != nil {
			msg.IsDeleted = true
			msg.ContentMD = ""
			msg.ContentHTML = ""
		}
		messages = append(messages, msg)
	}

	// Determine if there are more messages beyond this page
	hasMore := len(messages) > params.Limit
	if hasMore {
		messages = messages[:params.Limit]
	}

	// For "before" and default (latest) queries, results come in DESC order — reverse to chronological
	if params.Around == "" && params.After == "" {
		for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
			messages[i], messages[j] = messages[j], messages[i]
		}
	}

	messages = s.Reactions.InjectReactionsIntoMessages(messages, currentUserID)

	// Populate the cache for default (latest) queries so subsequent fetches
	// can be served without hitting the database.
	if isDefaultQuery && s.cache != nil && len(messages) > 0 {
		cached := make([]ephemeral.CachedMessage, len(messages))
		for i, m := range messages {
			cached[i] = ephemeral.CachedMessage{
				ID:        m.ID,
				ChannelID: m.ChannelID,
				UserID:    m.UserID,
				ContentMD: m.ContentMD,
				CreatedAt: m.CreatedAt.Format(time.RFC3339Nano),
			}
		}
		if err := s.cache.CacheMessages(ctx, channelID, cached); err != nil {
			log.Printf("ephemeral.CacheMessages error: %v", err)
		}
	}

	return messages, hasMore, nil
}

func (s *MessagingService) GetThreadReplies(ctx context.Context, messageID string, currentUserID string) ([]Message, error) {
	query := `
		SELECT m.id, m.channel_id, m.user_id, u.username, m.parent_id, m.reply_to, m.forward_source_id,
			fsu.username as forward_source_username,
			m.content_md, m.content_html, m.created_at, m.updated_at, m.is_edited,
			EXISTS(SELECT 1 FROM channel_pins cp WHERE cp.message_id = m.id) as is_pinned,
			EXISTS(SELECT 1 FROM user_bookmarks ub WHERE ub.message_id = m.id AND ub.user_id = $2) as is_bookmarked 
		FROM messages m
		JOIN users u ON m.user_id = u.id
		LEFT JOIN messages fsm ON m.forward_source_id = fsm.id
		LEFT JOIN users fsu ON fsm.user_id = fsu.id
		WHERE m.parent_id = $1 
		ORDER BY m.created_at ASC
	`
	rows, err := s.db.Pool.Query(ctx, query, messageID, currentUserID)
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
		if err := rows.Scan(&msg.ID, &msg.ChannelID, &msg.UserID, &msg.Username, &msg.ParentID, &msg.ReplyTo, &msg.ForwardSourceID, &msg.ForwardSourceUsername, &msg.ContentMD, &msg.ContentHTML, &msg.CreatedAt, &msg.UpdatedAt, &msg.IsEdited, &msg.IsPinned, &msg.IsBookmarked); err != nil {
			return nil, err
		}
		msg.ReplyCount = 0 // Replies don't have replies in this simple 1-level thread model
		messages = append(messages, msg)
	}
	
	messages = s.Reactions.InjectReactionsIntoMessages(messages, currentUserID)
	
	return messages, nil
}

func (s *MessagingService) ForwardMessage(ctx context.Context, messageID string, targetChannelID string, userID string) (*Message, error) {
	// 1. Fetch the original message and source channel privacy status
	var contentMD, contentHTML, sourceUsername, sourceChannelID string
	var sourceIsPrivate, targetIsPrivate bool

	query := `
		SELECT m.content_md, m.content_html, u.username, m.channel_id, c.is_private
		FROM messages m
		JOIN users u ON m.user_id = u.id
		JOIN channels c ON m.channel_id = c.id
		WHERE m.id = $1
	`
	err := s.db.Pool.QueryRow(ctx, query, messageID).Scan(&contentMD, &contentHTML, &sourceUsername, &sourceChannelID, &sourceIsPrivate)
	if err != nil {
		return nil, err
	}

	// 2. Fetch target channel privacy status
	err = s.db.Pool.QueryRow(ctx, "SELECT is_private FROM channels WHERE id = $1", targetChannelID).Scan(&targetIsPrivate)
	if err != nil {
		return nil, err
	}

	// 3. Permission Check: Prevent forwarding from Private to Public
	if sourceIsPrivate && !targetIsPrivate {
		return nil, fmt.Errorf("security violation: cannot forward from a private channel to a public one")
	}

	// 4. Create the forwarded message
	return s.CreateMessage(ctx, targetChannelID, userID, contentMD, contentHTML, nil, nil, &messageID, &sourceUsername)
}

func (s *MessagingService) EditMessage(ctx context.Context, messageID string, userID string, contentMD string, contentHTML string) (*Message, error) {
	if contentHTML == "" {
		contentHTML = "<p>" + html.EscapeString(contentMD) + "</p>"
	}
	// Sanitize all HTML to prevent XSS
	contentHTML = sanitizer.Sanitize(contentHTML)

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
		SELECT m.id, m.channel_id, m.user_id, u.username, m.parent_id, m.reply_to, m.forward_source_id, m.content_md, m.content_html, m.created_at, m.updated_at, m.is_edited,
			(SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id) as reply_count,
			EXISTS(SELECT 1 FROM channel_pins cp WHERE cp.message_id = m.id) as is_pinned,
			EXISTS(SELECT 1 FROM user_bookmarks ub WHERE ub.message_id = m.id AND ub.user_id = $2) as is_bookmarked
		FROM messages m
		JOIN users u ON m.user_id = u.id
		WHERE m.id = $1
	`, messageID, userID).Scan(&msg.ID, &msg.ChannelID, &msg.UserID, &msg.Username, &msg.ParentID, &msg.ReplyTo, &msg.ForwardSourceID, &msg.ContentMD, &msg.ContentHTML, &msg.CreatedAt, &msg.UpdatedAt, &msg.IsEdited, &msg.ReplyCount, &msg.IsPinned, &msg.IsBookmarked)

	if err != nil {
		return nil, err
	}
	
	// Invalidate the message cache for this channel.
	if s.cache != nil {
		if cacheErr := s.cache.InvalidateMessageCache(ctx, msg.ChannelID); cacheErr != nil {
			log.Printf("ephemeral.InvalidateMessageCache error: %v", cacheErr)
		}
	}

	// Inject reactions for the returned edited message
	msgs := s.Reactions.InjectReactionsIntoMessages([]Message{msg}, userID)

	// Broadcast the edited message
	s.Hub.BroadcastEvent("MESSAGE_EDITED", msgs[0])

	return &msgs[0], nil
}

func (s *MessagingService) DeleteMessage(ctx context.Context, messageID string, userID string) error {
	// Verify author
	var authorID, channelID string
	err := s.db.Pool.QueryRow(ctx, "SELECT user_id, channel_id FROM messages WHERE id = $1 AND deleted_at IS NULL", messageID).Scan(&authorID, &channelID)
	if err != nil {
		return err
	}
	if authorID != userID {
		return pgx.ErrNoRows
	}

	// Soft delete the message
	_, err = s.db.Pool.Exec(ctx, "UPDATE messages SET deleted_at = NOW(), deleted_by = $2 WHERE id = $1", messageID, userID)
	if err != nil {
		return err
	}

	// Invalidate the message cache for this channel.
	if s.cache != nil {
		if cacheErr := s.cache.InvalidateMessageCache(ctx, channelID); cacheErr != nil {
			log.Printf("ephemeral.InvalidateMessageCache error: %v", cacheErr)
		}
	}

	// Broadcast deletion
	s.Hub.BroadcastEvent("MESSAGE_DELETED", map[string]interface{}{
		"message_id": messageID,
		"channel_id": channelID,
	})

	return nil
}

// HideMessage hides a message for the current user only ("Delete for Me").
func (s *MessagingService) HideMessage(ctx context.Context, messageID string, userID string) error {
	_, err := s.db.Pool.Exec(ctx,
		`INSERT INTO user_hidden_messages (user_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, messageID,
	)
	return err
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

func (s *MessagingService) TogglePin(ctx context.Context, messageID string, channelID string, userID string) (bool, error) {
	// First check if already pinned
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM channel_pins WHERE channel_id = $1 AND message_id = $2)`, channelID, messageID).Scan(&exists)
	if err != nil {
		return false, err
	}

	if exists {
		_, err = s.db.Pool.Exec(ctx, `DELETE FROM channel_pins WHERE channel_id = $1 AND message_id = $2`, channelID, messageID)
		if err != nil {
			return false, err
		}
		// Broadcast pin state change
		s.Hub.BroadcastEvent("PIN_UPDATED", map[string]interface{}{
			"message_id": messageID,
			"channel_id": channelID,
			"is_pinned":  false,
		})
		return false, nil
	} else {
		_, err = s.db.Pool.Exec(ctx, `INSERT INTO channel_pins (channel_id, message_id, pinned_by) VALUES ($1, $2, $3)`, channelID, messageID, userID)
		if err != nil {
			return false, err
		}
		// Broadcast pin state change
		s.Hub.BroadcastEvent("PIN_UPDATED", map[string]interface{}{
			"message_id": messageID,
			"channel_id": channelID,
			"is_pinned":  true,
		})
		return true, nil
	}
}

func (s *MessagingService) ToggleBookmark(ctx context.Context, messageID string, userID string) (bool, error) {
	// First check if already bookmarked
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM user_bookmarks WHERE user_id = $1 AND message_id = $2)`, userID, messageID).Scan(&exists)
	if err != nil {
		return false, err
	}

	if exists {
		_, err = s.db.Pool.Exec(ctx, `DELETE FROM user_bookmarks WHERE user_id = $1 AND message_id = $2`, userID, messageID)
		if err != nil {
			return false, err
		}
		return false, nil
	} else {
		_, err = s.db.Pool.Exec(ctx, `INSERT INTO user_bookmarks (user_id, message_id) VALUES ($1, $2)`, userID, messageID)
		if err != nil {
			return false, err
		}
		return true, nil
	}
}

func (s *MessagingService) UpdateLastRead(ctx context.Context, channelID string, userID string, messageID string) error {
	query := `
		INSERT INTO channel_reads (channel_id, user_id, last_read_message_id, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (channel_id, user_id) 
		DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id, updated_at = NOW()
	`
	_, err := s.db.Pool.Exec(ctx, query, channelID, userID, messageID)
	if err == nil {
		// Broadcast read receipt update
		s.Hub.BroadcastEvent("READ_RECEIPT_UPDATED", map[string]interface{}{
			"channel_id":              channelID,
			"user_id":                 userID,
			"last_read_message_id": messageID,
		})
	}
	return err
}

func (s *MessagingService) GetChannelReadReceipts(ctx context.Context, channelID string) ([]ChannelRead, error) {
	query := `
		SELECT channel_id, user_id, last_read_message_id, updated_at
		FROM channel_reads
		WHERE channel_id = $1
	`
	rows, err := s.db.Pool.Query(ctx, query, channelID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return []ChannelRead{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	var reads []ChannelRead
	for rows.Next() {
		var r ChannelRead
		if err := rows.Scan(&r.ChannelID, &r.UserID, &r.LastReadMessageID, &r.UpdatedAt); err != nil {
			return nil, err
		}
		reads = append(reads, r)
	}
	return reads, nil
}

// ---------- Channel Members (Private Channel ACL - Issue #120) ----------

func (s *MessagingService) IsChannelMember(ctx context.Context, channelID, userID string) (bool, error) {
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2)`, channelID, userID).Scan(&exists)
	return exists, err
}

func (s *MessagingService) CheckPrivateAccess(ctx context.Context, channelID, userID string) error {
	ch, err := s.GetChannel(ctx, channelID)
	if err != nil {
		return err
	}
	if !ch.IsPrivate {
		return nil
	}
	isMember, err := s.IsChannelMember(ctx, channelID, userID)
	if err != nil {
		return err
	}
	if !isMember {
		return fmt.Errorf("access denied: you are not a member of this private channel")
	}
	return nil
}

func (s *MessagingService) AddChannelMember(ctx context.Context, channelID, userID, addedBy string) (*ChannelMember, error) {
	var m ChannelMember
	err := s.db.Pool.QueryRow(ctx, `INSERT INTO channel_members (channel_id, user_id, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING channel_id, user_id, added_at, added_by`, channelID, userID, addedBy).Scan(&m.ChannelID, &m.UserID, &m.AddedAt, &m.AddedBy)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("user is already a member of this channel")
		}
		return nil, err
	}
	_ = s.db.Pool.QueryRow(ctx, `SELECT username FROM users WHERE id = $1`, userID).Scan(&m.Username)
	return &m, nil
}

func (s *MessagingService) RemoveChannelMember(ctx context.Context, channelID, userID string) error {
	tag, err := s.db.Pool.Exec(ctx, `DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2`, channelID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("member not found")
	}
	return nil
}

func (s *MessagingService) ListChannelMembers(ctx context.Context, channelID string) ([]ChannelMember, error) {
	rows, err := s.db.Pool.Query(ctx, `SELECT cm.channel_id, cm.user_id, u.username, cm.added_at, cm.added_by FROM channel_members cm JOIN users u ON cm.user_id = u.id WHERE cm.channel_id = $1 ORDER BY cm.added_at ASC`, channelID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return []ChannelMember{}, nil
		}
		return nil, err
	}
	defer rows.Close()
	var members []ChannelMember
	for rows.Next() {
		var m ChannelMember
		if err := rows.Scan(&m.ChannelID, &m.UserID, &m.Username, &m.AddedAt, &m.AddedBy); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, nil
}

// ---------- Channel Discovery (Issue #121) ----------

// BrowseChannels returns all public, non-archived channels in an org with member counts
// and whether the given user has joined each one.
func (s *MessagingService) BrowseChannels(ctx context.Context, orgID string, userID string) ([]BrowsableChannel, error) {
	query := `
		SELECT
			c.id, c.org_id, c.name, c.description, c.topic, c.is_private, c.created_by, c.archived_at, c.created_at, c.updated_at,
			COALESCE(mc.cnt, 0)::int AS member_count,
			EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = $2) AS is_joined
		FROM channels c
		LEFT JOIN (
			SELECT channel_id, COUNT(*) AS cnt FROM channel_members GROUP BY channel_id
		) mc ON mc.channel_id = c.id
		WHERE c.org_id = $1
		  AND c.is_private = FALSE
		  AND c.archived_at IS NULL
		ORDER BY c.name ASC
	`
	rows, err := s.db.Pool.Query(ctx, query, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []BrowsableChannel
	for rows.Next() {
		var ch BrowsableChannel
		if err := rows.Scan(&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.Topic, &ch.IsPrivate, &ch.CreatedBy, &ch.ArchivedAt, &ch.CreatedAt, &ch.UpdatedAt, &ch.MemberCount, &ch.IsJoined); err != nil {
			return nil, err
		}
		channels = append(channels, ch)
	}
	return channels, nil
}

// JoinChannel adds the user as a member of the given public channel.
func (s *MessagingService) JoinChannel(ctx context.Context, channelID string, userID string) error {
	var isPrivate bool
	err := s.db.Pool.QueryRow(ctx, "SELECT is_private FROM channels WHERE id = $1", channelID).Scan(&isPrivate)
	if err != nil {
		return fmt.Errorf("channel not found")
	}
	if isPrivate {
		return fmt.Errorf("cannot join a private channel without an invitation")
	}

	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO channel_members (channel_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (channel_id, user_id) DO NOTHING
	`, channelID, userID)
	return err
}

// LeaveChannel removes the user from the given channel.
func (s *MessagingService) LeaveChannel(ctx context.Context, channelID string, userID string) error {
	_, err := s.db.Pool.Exec(ctx, `DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2`, channelID, userID)
	return err
}

// GetJoinedChannels returns only channels the user has joined.
func (s *MessagingService) GetJoinedChannels(ctx context.Context, orgID string, userID string) ([]Channel, error) {
	query := `
		SELECT c.id, c.org_id, c.name, c.description, c.topic, c.is_private, c.created_by, c.archived_at, c.created_at, c.updated_at
		FROM channels c
		INNER JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = $2
		WHERE c.org_id = $1
		  AND c.archived_at IS NULL
		ORDER BY c.name ASC
	`
	rows, err := s.db.Pool.Query(ctx, query, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []Channel
	for rows.Next() {
		var ch Channel
		if err := rows.Scan(&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.Topic, &ch.IsPrivate, &ch.CreatedBy, &ch.ArchivedAt, &ch.CreatedAt, &ch.UpdatedAt); err != nil {
			return nil, err
		}
		channels = append(channels, ch)
	}
	return channels, nil
}

// ---------- Direct Messages (Issue #113) ----------

// ListDMs returns all DM conversations for the given user, including the other
// participant's username.
func (s *MessagingService) ListDMs(ctx context.Context, userID string) ([]DMChannel, error) {
	query := `
		SELECT dm.id, dm.channel_id,
			CASE WHEN dm.user1_id = $1 THEN dm.user2_id ELSE dm.user1_id END AS other_user_id,
			CASE WHEN dm.user1_id = $1 THEN u2.username ELSE u1.username END AS other_username,
			dm.created_at
		FROM dm_channels dm
		JOIN users u1 ON dm.user1_id = u1.id
		JOIN users u2 ON dm.user2_id = u2.id
		WHERE dm.user1_id = $1 OR dm.user2_id = $1
		ORDER BY dm.created_at DESC
	`
	rows, err := s.db.Pool.Query(ctx, query, userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return []DMChannel{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	var dms []DMChannel
	for rows.Next() {
		var dm DMChannel
		if err := rows.Scan(&dm.ID, &dm.ChannelID, &dm.UserID, &dm.Username, &dm.CreatedAt); err != nil {
			return nil, err
		}
		dms = append(dms, dm)
	}
	return dms, nil
}

// CreateOrGetDM finds an existing DM channel between two users or creates one.
// It stores a canonical pair (smaller UUID first) so that duplicates are impossible.
func (s *MessagingService) CreateOrGetDM(ctx context.Context, orgID, currentUserID, otherUserID string) (*DMChannel, error) {
	// Canonical ordering so user1 < user2
	u1, u2 := currentUserID, otherUserID
	if u1 > u2 {
		u1, u2 = u2, u1
	}

	// Check if a DM already exists
	var dm DMChannel
	err := s.db.Pool.QueryRow(ctx, `
		SELECT dm.id, dm.channel_id,
			CASE WHEN dm.user1_id = $3 THEN dm.user2_id ELSE dm.user1_id END,
			CASE WHEN dm.user1_id = $3 THEN u2.username ELSE u1.username END,
			dm.created_at
		FROM dm_channels dm
		JOIN users u1 ON dm.user1_id = u1.id
		JOIN users u2 ON dm.user2_id = u2.id
		WHERE dm.user1_id = $1 AND dm.user2_id = $2
	`, u1, u2, currentUserID).Scan(&dm.ID, &dm.ChannelID, &dm.UserID, &dm.Username, &dm.CreatedAt)

	if err == nil {
		// Ensure both users are channel members (backfill for DMs created before ACL)
		s.db.Pool.Exec(ctx, `INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, dm.ChannelID, currentUserID)
		s.db.Pool.Exec(ctx, `INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, dm.ChannelID, otherUserID)
		return &dm, nil
	}
	if err != pgx.ErrNoRows {
		return nil, err
	}

	// Fetch the other user's username for the channel name
	var otherUsername string
	err = s.db.Pool.QueryRow(ctx, "SELECT username FROM users WHERE id = $1", otherUserID).Scan(&otherUsername)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	var currentUsername string
	err = s.db.Pool.QueryRow(ctx, "SELECT username FROM users WHERE id = $1", currentUserID).Scan(&currentUsername)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Create backing channel
	channelName := "dm-" + currentUsername + "-" + otherUsername
	var channelID string
	err = tx.QueryRow(ctx, `
		INSERT INTO channels (org_id, name, is_private, is_dm)
		VALUES ($1, $2, TRUE, TRUE)
		RETURNING id
	`, orgID, channelName).Scan(&channelID)
	if err != nil {
		return nil, err
	}

	// Create dm_channels record
	var dmID string
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO dm_channels (channel_id, user1_id, user2_id)
		VALUES ($1, $2, $3)
		RETURNING id, created_at
	`, channelID, u1, u2).Scan(&dmID, &createdAt)
	if err != nil {
		return nil, err
	}

	// Add both users as channel members so private channel ACL allows access
	_, err = tx.Exec(ctx, `INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, channelID, currentUserID)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, channelID, otherUserID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &DMChannel{
		ID:        dmID,
		ChannelID: channelID,
		UserID:    otherUserID,
		Username:  otherUsername,
		CreatedAt: createdAt,
	}, nil
}

// ConvertDMToChannel converts a DM into a regular channel. The backing channel
// is updated (is_dm=false, new name, optional privacy toggle) and the
// dm_channels record is removed. All messages and members are preserved.
func (s *MessagingService) ConvertDMToChannel(ctx context.Context, dmID, userID, newName string, isPrivate bool) (*Channel, error) {
	// Verify the DM exists and the user is a participant
	var channelID, user1ID, user2ID string
	err := s.db.Pool.QueryRow(ctx,
		`SELECT channel_id, user1_id, user2_id FROM dm_channels WHERE id = $1`, dmID,
	).Scan(&channelID, &user1ID, &user2ID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("DM not found")
		}
		return nil, err
	}

	if userID != user1ID && userID != user2ID {
		return nil, fmt.Errorf("unauthorized: not a participant of this DM")
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Update the backing channel: clear is_dm flag and set new name/privacy
	var ch Channel
	err = tx.QueryRow(ctx, `
		UPDATE channels
		SET is_dm = FALSE, name = $1, is_private = $2, updated_at = NOW()
		WHERE id = $3
		RETURNING id, org_id, name, description, topic, is_private, created_by, archived_at, created_at, updated_at
	`, newName, isPrivate, channelID).Scan(
		&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.Topic,
		&ch.IsPrivate, &ch.CreatedBy, &ch.ArchivedAt, &ch.CreatedAt, &ch.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Remove the dm_channels record
	_, err = tx.Exec(ctx, `DELETE FROM dm_channels WHERE id = $1`, dmID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &ch, nil
}
