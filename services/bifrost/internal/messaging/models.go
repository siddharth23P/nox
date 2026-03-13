package messaging

import (
	"time"
)

type Channel struct {
	ID          string    `json:"id"`
	OrgID       string    `json:"org_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	IsPrivate   bool      `json:"is_private"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
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
	IsPrivate   bool   `json:"is_private"`
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
