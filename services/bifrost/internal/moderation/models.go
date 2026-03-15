package moderation

import "time"

// ModerationAction represents a moderation action taken against a user.
type ModerationAction struct {
	ID           string     `json:"id"`
	OrgID        string     `json:"org_id"`
	TargetUserID string     `json:"target_user_id"`
	ModeratorID  string     `json:"moderator_id"`
	ActionType   string     `json:"action_type"`
	Reason       string     `json:"reason"`
	ChannelID    *string    `json:"channel_id,omitempty"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	RevokedAt    *time.Time `json:"revoked_at,omitempty"`
	RevokedBy    *string    `json:"revoked_by,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`

	// Joined fields for display
	TargetUsername    string `json:"target_username,omitempty"`
	ModeratorUsername string `json:"moderator_username,omitempty"`
}

// TimeoutRequest is the payload for timing out a user.
type TimeoutRequest struct {
	UserID    string `json:"user_id" binding:"required"`
	Duration  string `json:"duration" binding:"required"` // e.g. "1h", "1d", "1w"
	Reason    string `json:"reason" binding:"required"`
	ChannelID string `json:"channel_id,omitempty"`
}

// MuteRequest is the payload for muting a user. If ChannelID is empty it is a server mute.
type MuteRequest struct {
	UserID    string `json:"user_id" binding:"required"`
	Reason    string `json:"reason" binding:"required"`
	ChannelID string `json:"channel_id,omitempty"`
}

// WarnRequest is the payload for warning a user.
type WarnRequest struct {
	UserID string `json:"user_id" binding:"required"`
	Reason string `json:"reason" binding:"required"`
}

// BanRequest is the payload for banning a user from the server.
type BanRequest struct {
	UserID string `json:"user_id" binding:"required"`
	Reason string `json:"reason" binding:"required"`
}
