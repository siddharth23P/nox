package ephemeral

import (
	"context"
	"time"
)

// Store defines the interface for ephemeral state management.
// Currently backed by in-memory maps; designed to be swapped for Redis.
type Store interface {
	// Presence
	SetPresence(ctx context.Context, orgID, userID string, status string) error
	GetPresence(ctx context.Context, orgID string) (map[string]PresenceEntry, error)
	RemovePresence(ctx context.Context, orgID, userID string) error

	// Typing indicators
	SetTyping(ctx context.Context, channelID, userID string, ttl time.Duration) error
	GetTyping(ctx context.Context, channelID string) ([]string, error)

	// Message cache
	CacheMessages(ctx context.Context, channelID string, messages []CachedMessage) error
	GetCachedMessages(ctx context.Context, channelID string, limit int) ([]CachedMessage, error)
	InvalidateMessageCache(ctx context.Context, channelID string) error
}

// PresenceEntry represents a single user's presence state.
type PresenceEntry struct {
	Status   string    `json:"status"`
	LastSeen time.Time `json:"last_seen"`
}

// CachedMessage represents a lightweight cached copy of a message.
type CachedMessage struct {
	ID        string `json:"id"`
	ChannelID string `json:"channel_id"`
	UserID    string `json:"user_id"`
	ContentMD string `json:"content_md"`
	CreatedAt string `json:"created_at"`
}
