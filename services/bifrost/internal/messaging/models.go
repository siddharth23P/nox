package messaging

import (
	"time"
)

type Channel struct {
	ID          string     `json:"id"`
	OrgID       string     `json:"org_id"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	Topic       *string    `json:"topic,omitempty"`
	IsPrivate   bool       `json:"is_private"`
	CreatedBy   *string    `json:"created_by,omitempty"`
	ArchivedAt  *time.Time `json:"archived_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type Message struct {
	ID          string    `json:"id"`
	ChannelID   string    `json:"channel_id"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username,omitempty"`
	ParentID        *string   `json:"parent_id,omitempty"`
	ReplyTo         *string   `json:"reply_to,omitempty"`
	ForwardSourceID       *string        `json:"forward_source_id,omitempty"`
	ForwardSourceUsername *string        `json:"forward_source_username,omitempty"`
	ContentMD             string         `json:"content_md"`
	ContentHTML string    `json:"content_html"`
	ReplyCount    int            `json:"reply_count,omitempty"`
	IsEdited      bool           `json:"is_edited"`
	Reactions     map[string]int `json:"reactions,omitempty"`
	UserReactions []string       `json:"user_reactions,omitempty"`
	IsPinned      bool           `json:"is_pinned"`
	IsBookmarked  bool           `json:"is_bookmarked"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

type MessageEdit struct {
	ID             string    `json:"id"`
	MessageID      string    `json:"message_id"`
	OldContentMD   string    `json:"old_content_md"`
	OldContentHTML string    `json:"old_content_html"`
	NewContentMD   string    `json:"new_content_md"`
	NewContentHTML string    `json:"new_content_html"`
	CreatedAt      time.Time `json:"created_at"`
}

type CreateChannelRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Topic       string `json:"topic"`
	IsPrivate   bool   `json:"is_private"`
}

type UpdateChannelRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Topic       *string `json:"topic"`
}

type CreateMessageRequest struct {
	ContentMD   string  `json:"content_md" binding:"required"`
	ContentHTML string  `json:"content_html"`
	ParentID        *string `json:"parent_id"`
	ReplyTo         *string `json:"reply_to"`
	ForwardSourceID       *string `json:"forward_source_id"`
	ForwardSourceUsername *string `json:"forward_source_username"`
}

type EditMessageRequest struct {
	ContentMD   string `json:"content_md" binding:"required"`
	ContentHTML string `json:"content_html"`
}

type ReactionRequest struct {
	Emoji  string `json:"emoji" binding:"required"`
	Action string `json:"action" binding:"required"` // "add" or "remove"
}

type ChannelRead struct {
	ChannelID         string    `json:"channel_id"`
	UserID            string    `json:"user_id"`
	LastReadMessageID string    `json:"last_read_message_id"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type UpdateReadRequest struct {
	MessageID string `json:"message_id" binding:"required"`
}

// Channel Members (Private Channel ACL - Issue #120)

type ChannelMember struct {
	ChannelID string    `json:"channel_id"`
	UserID    string    `json:"user_id"`
	Username  string    `json:"username,omitempty"`
	AddedAt   time.Time `json:"added_at"`
	AddedBy   *string   `json:"added_by,omitempty"`
}

type AddMemberRequest struct {
	UserID string `json:"user_id" binding:"required"`
}

// DM models (Issue #113)

type DMChannel struct {
	ID        string    `json:"id"`
	ChannelID string    `json:"channel_id"`
	UserID    string    `json:"user_id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateDMRequest struct {
	UserID string `json:"user_id" binding:"required"`
}

type ConvertDMRequest struct {
	Name      string `json:"name" binding:"required"`
	IsPrivate *bool  `json:"is_private"`
}

// UnreadCount represents the number of unread messages for a channel.
type UnreadCount struct {
	ChannelID string `json:"channel_id"`
	Count     int    `json:"count"`
}

// BrowsableChannel extends Channel with member count and join status for the browse endpoint (Issue #121).
type BrowsableChannel struct {
	ID          string     `json:"id"`
	OrgID       string     `json:"org_id"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	Topic       *string    `json:"topic,omitempty"`
	IsPrivate   bool       `json:"is_private"`
	CreatedBy   *string    `json:"created_by,omitempty"`
	ArchivedAt  *time.Time `json:"archived_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	MemberCount int        `json:"member_count"`
	IsJoined    bool       `json:"is_joined"`
}
