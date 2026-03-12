package messaging

import (
	"time"
)

type Channel struct {
	ID          string    `json:"id"`
	OrgID       string    `json:"org_id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	IsPrivate   bool      `json:"is_private"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Message struct {
	ID          string    `json:"id"`
	ChannelID   string    `json:"channel_id"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username,omitempty"`
	ParentID    *string   `json:"parent_id,omitempty"`
	ContentMD   string    `json:"content_md"`
	ContentHTML string    `json:"content_html"`
	ReplyCount  int       `json:"reply_count,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateChannelRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	IsPrivate   bool   `json:"is_private"`
}

type CreateMessageRequest struct {
	ContentMD   string  `json:"content_md" binding:"required"`
	ContentHTML string  `json:"content_html"`
	ParentID    *string `json:"parent_id"`
}
