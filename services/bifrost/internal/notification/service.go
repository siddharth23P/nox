package notification

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/nox-labs/bifrost/internal/db"
)

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"` // mention, reply, reaction, channel_invite, system
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	ChannelID *string   `json:"channel_id,omitempty"`
	MessageID *string   `json:"message_id,omitempty"`
	ActorID   *string   `json:"actor_id,omitempty"`
	ActorName string    `json:"actor_name,omitempty"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

type Service struct {
	db *db.Database
}

func NewService(database *db.Database) *Service {
	return &Service{db: database}
}

// Create inserts a new notification for the target user.
func (s *Service) Create(ctx context.Context, userID, nType, title, body string, channelID, messageID, actorID *string) (*Notification, error) {
	var n Notification
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO notifications (user_id, type, title, body, channel_id, message_id, actor_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, type, title, body, channel_id, message_id, actor_id, is_read, created_at
	`, userID, nType, title, body, channelID, messageID, actorID).Scan(
		&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body,
		&n.ChannelID, &n.MessageID, &n.ActorID, &n.IsRead, &n.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Resolve actor name if present
	if actorID != nil {
		_ = s.db.Pool.QueryRow(ctx, `SELECT username FROM users WHERE id = $1`, *actorID).Scan(&n.ActorName)
	}

	return &n, nil
}

// List returns notifications for a user, newest first.
func (s *Service) List(ctx context.Context, userID string, limit, offset int) ([]Notification, int, error) {
	// Get total unread count
	var unreadCount int
	err := s.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`, userID,
	).Scan(&unreadCount)
	if err != nil {
		return nil, 0, err
	}

	rows, err := s.db.Pool.Query(ctx, `
		SELECT n.id, n.user_id, n.type, n.title, n.body, n.channel_id, n.message_id,
			n.actor_id, COALESCE(u.username, '') as actor_name, n.is_read, n.created_at
		FROM notifications n
		LEFT JOIN users u ON n.actor_id = u.id
		WHERE n.user_id = $1
		ORDER BY n.created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	if err != nil {
		if err == pgx.ErrNoRows {
			return []Notification{}, unreadCount, nil
		}
		return nil, 0, err
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body,
			&n.ChannelID, &n.MessageID, &n.ActorID, &n.ActorName, &n.IsRead, &n.CreatedAt); err != nil {
			return nil, 0, err
		}
		notifications = append(notifications, n)
	}

	if notifications == nil {
		notifications = []Notification{}
	}

	return notifications, unreadCount, nil
}

// MarkRead marks a single notification as read.
func (s *Service) MarkRead(ctx context.Context, notificationID, userID string) error {
	tag, err := s.db.Pool.Exec(ctx,
		`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`, notificationID, userID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// MarkAllRead marks all notifications as read for a user.
func (s *Service) MarkAllRead(ctx context.Context, userID string) error {
	_, err := s.db.Pool.Exec(ctx,
		`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`, userID,
	)
	return err
}

// UnreadCount returns the number of unread notifications for a user.
func (s *Service) UnreadCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := s.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`, userID,
	).Scan(&count)
	return count, err
}
