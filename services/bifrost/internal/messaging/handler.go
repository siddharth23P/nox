package messaging

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"
)

type MessagingHandler struct {
	service *MessagingService
	hub     *Hub
}

func NewMessagingHandler(service *MessagingService, hub *Hub) *MessagingHandler {
	return &MessagingHandler{service: service, hub: hub}
}

// getAuthInfo extracts org_id (tenant_id) and user_id from JWT auth context,
// set by AuthMiddleware after token verification.
func getAuthInfo(c *gin.Context) (string, string) {
	orgID, _ := c.Get("tenant_id")
	userID, _ := c.Get("user_id")
	orgStr, _ := orgID.(string)
	userStr, _ := userID.(string)
	return orgStr, userStr
}

func (h *MessagingHandler) CreateChannel(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-Org-ID required"})
		return
	}

	var req CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch, err := h.service.CreateChannel(c.Request.Context(), orgID, req.Name, req.Description, req.Topic, req.IsPrivate, userID)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "idx_channels_org_name") {
			c.JSON(http.StatusConflict, gin.H{"error": "A channel with this name already exists in this organization"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ch)
}

func (h *MessagingHandler) GetChannels(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-Org-ID required"})
		return
	}

	includeArchived := c.Query("include_archived") == "true"
	channels, err := h.service.GetChannels(c.Request.Context(), orgID, userID, includeArchived)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if channels == nil {
		channels = []Channel{}
	}
	c.JSON(http.StatusOK, channels)
}

func (h *MessagingHandler) GetChannel(c *gin.Context) {
	_, userID := getAuthInfo(c)
	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	ch, err := h.service.GetChannel(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}

	if ch.IsPrivate && userID != "" {
		if err := h.service.CheckPrivateAccess(c.Request.Context(), channelID, userID); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, ch)
}

func (h *MessagingHandler) UpdateChannel(c *gin.Context) {
	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	var req UpdateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch, err := h.service.UpdateChannel(c.Request.Context(), channelID, req.Name, req.Description, req.Topic)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "idx_channels_org_name") {
			c.JSON(http.StatusConflict, gin.H{"error": "A channel with this name already exists in this organization"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ch)
}

func (h *MessagingHandler) ArchiveChannel(c *gin.Context) {
	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	ch, err := h.service.ArchiveChannel(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ch)
}

func (h *MessagingHandler) UnarchiveChannel(c *gin.Context) {
	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	ch, err := h.service.UnarchiveChannel(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ch)
}

func (h *MessagingHandler) DeleteChannel(c *gin.Context) {
	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	// Check role — only admin/owner can hard-delete
	role, _ := c.Get("role")
	roleStr, _ := role.(string)
	if roleStr != "admin" && roleStr != "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only org admins can delete channels"})
		return
	}

	err := h.service.DeleteChannel(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted", "channel_id": channelID})
}

func (h *MessagingHandler) CreateMessage(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	if err := h.service.CheckPrivateAccess(c.Request.Context(), channelID, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	var req CreateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg, err := h.service.CreateMessage(c.Request.Context(), channelID, userID, req.ContentMD, req.ContentHTML, req.ParentID, req.ReplyTo, req.ForwardSourceID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, msg)
}

func (h *MessagingHandler) GetMessages(c *gin.Context) {
	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	_, userID := getAuthInfo(c)

	if userID != "" {
		if err := h.service.CheckPrivateAccess(c.Request.Context(), channelID, userID); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	params := MessageQueryParams{
		Before: c.Query("before"),
		After:  c.Query("after"),
		Around: c.Query("around"),
		Limit:  limit,
	}

	messages, hasMore, err := h.service.GetMessagesByChannel(c.Request.Context(), channelID, params, userID)
	if err != nil {
		log.Printf("ERROR in GetMessages: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if messages == nil {
		messages = []Message{}
	}
	c.JSON(http.StatusOK, gin.H{
		"messages": messages,
		"has_more": hasMore,
	})
}

func (h *MessagingHandler) GetThreadReplies(c *gin.Context) {
	messageID := c.Param("messageId")
	if messageID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message ID required"})
		return
	}

	_, userID := getAuthInfo(c)

	messages, err := h.service.GetThreadReplies(c.Request.Context(), messageID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if messages == nil {
		messages = []Message{}
	}
	c.JSON(http.StatusOK, messages)
}

func (h *MessagingHandler) EditMessage(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	messageID := c.Param("messageId")
	if messageID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message ID required"})
		return
	}

	var req EditMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg, err := h.service.EditMessage(c.Request.Context(), messageID, userID, req.ContentMD, req.ContentHTML)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: You cannot edit this message."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, msg)
}

func (h *MessagingHandler) DeleteMessage(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	messageID := c.Param("messageId")
	if messageID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message ID required"})
		return
	}

	err := h.service.DeleteMessage(c.Request.Context(), messageID, userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: You cannot delete this message."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted", "message_id": messageID})
}

func (h *MessagingHandler) GetMessageEditHistory(c *gin.Context) {
	messageID := c.Param("messageId")
	if messageID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message ID required"})
		return
	}

	edits, err := h.service.GetMessageEditHistory(c.Request.Context(), messageID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if edits == nil {
		edits = []MessageEdit{}
	}
	c.JSON(http.StatusOK, edits)
}

func (h *MessagingHandler) ReactToMessage(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	messageID := c.Param("messageId")
	if messageID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message ID required"})
		return
	}

	var req ReactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.service.Reactions.ToggleReaction(messageID, userID, req.Emoji, req.Action)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Fetch updated counts
	counts, userReacted := h.service.Reactions.GetReactionsForMessage(messageID, userID)

	c.JSON(http.StatusOK, gin.H{
		"message_id":     messageID,
		"reactions":      counts,
		"user_reactions": userReacted,
	})
}

func (h *MessagingHandler) TogglePin(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	messageID := c.Param("messageId")
	if messageID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message ID required"})
		return
	}

	pinned, err := h.service.TogglePin(c.Request.Context(), messageID, channelID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message_id": messageID,
		"is_pinned":  pinned,
	})
}

func (h *MessagingHandler) ToggleBookmark(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	messageID := c.Param("messageId")
	if messageID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message ID required"})
		return
	}

	bookmarked, err := h.service.ToggleBookmark(c.Request.Context(), messageID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message_id":    messageID,
		"is_bookmarked": bookmarked,
	})
}

func (h *MessagingHandler) UpdateLastRead(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	var req UpdateReadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.service.UpdateLastRead(c.Request.Context(), channelID, userID, req.MessageID)
	if err != nil {
		log.Printf("ERROR in UpdateLastRead: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *MessagingHandler) GetChannelReadReceipts(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	reads, err := h.service.GetChannelReadReceipts(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if reads == nil {
		reads = []ChannelRead{}
	}
	c.JSON(http.StatusOK, reads)
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for simplicity in this project
	},
}

func (h *MessagingHandler) HandleWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set websocket upgrade"})
		return
	}

	// Extract user_id from query string so the hub can notify the presence
	// service when this connection drops.
	userID := c.Query("user_id")

	client := &Client{
		Hub:    h.hub,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		UserID: userID,
	}
	client.Hub.register <- client

	// Allow collection of memory referenced by the caller by doing all work in
	// new goroutines.
	go client.WritePump()
	go client.ReadPump()
}

func (h *MessagingHandler) ForwardMessage(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	messageID := c.Param("messageId")
	if messageID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message ID required"})
		return
	}

	var req struct {
		TargetChannelID string `json:"target_channel_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg, err := h.service.ForwardMessage(c.Request.Context(), messageID, req.TargetChannelID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, msg)
}

// ---------- Channel Discovery (Issue #121) ----------

// BrowseChannels lists all public channels in the org with member counts.
func (h *MessagingHandler) BrowseChannels(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-Org-ID and X-User-ID required"})
		return
	}

	channels, err := h.service.BrowseChannels(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if channels == nil {
		channels = []BrowsableChannel{}
	}
	c.JSON(http.StatusOK, channels)
}

// JoinChannel adds the current user to a public channel.
func (h *MessagingHandler) JoinChannel(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	err := h.service.JoinChannel(c.Request.Context(), channelID, userID)
	if err != nil {
		if strings.Contains(err.Error(), "private") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "joined", "channel_id": channelID})
}

// LeaveChannel removes the current user from a channel.
func (h *MessagingHandler) LeaveChannel(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	err := h.service.LeaveChannel(c.Request.Context(), channelID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "left", "channel_id": channelID})
}

// GetJoinedChannels returns only channels the user has joined.
func (h *MessagingHandler) GetJoinedChannels(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-Org-ID and X-User-ID required"})
		return
	}

	channels, err := h.service.GetJoinedChannels(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if channels == nil {
		channels = []Channel{}
	}
	c.JSON(http.StatusOK, channels)
}

// ---------- Channel Members (Private Channel ACL - Issue #120) ----------

func (h *MessagingHandler) AddChannelMember(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}
	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}
	if err := h.service.CheckPrivateAccess(c.Request.Context(), channelID, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	var req AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	member, err := h.service.AddChannelMember(c.Request.Context(), channelID, req.UserID, userID)
	if err != nil {
		if strings.Contains(err.Error(), "already a member") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, member)
}

func (h *MessagingHandler) RemoveChannelMember(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}
	channelID := c.Param("id")
	targetUserID := c.Param("userId")
	if channelID == "" || targetUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID and User ID required"})
		return
	}
	if err := h.service.CheckPrivateAccess(c.Request.Context(), channelID, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	err := h.service.RemoveChannelMember(c.Request.Context(), channelID, targetUserID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed", "channel_id": channelID, "user_id": targetUserID})
}

func (h *MessagingHandler) ListChannelMembers(c *gin.Context) {
	_, userID := getAuthInfo(c)
	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}
	if userID != "" {
		if err := h.service.CheckPrivateAccess(c.Request.Context(), channelID, userID); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
	}
	members, err := h.service.ListChannelMembers(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if members == nil {
		members = []ChannelMember{}
	}
	c.JSON(http.StatusOK, members)
}

// ---------- Direct Messages (Issue #113) ----------

func (h *MessagingHandler) ListDMs(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	dms, err := h.service.ListDMs(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if dms == nil {
		dms = []DMChannel{}
	}
	c.JSON(http.StatusOK, dms)
}

func (h *MessagingHandler) CreateOrGetDM(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Org-ID required"})
		return
	}

	var req CreateDMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.UserID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot create a DM with yourself"})
		return
	}

	dm, err := h.service.CreateOrGetDM(c.Request.Context(), orgID, userID, req.UserID)
	if err != nil {
		if strings.Contains(err.Error(), "user not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, dm)
}

func (h *MessagingHandler) ConvertDMToChannel(c *gin.Context) {
	_, userID := getAuthInfo(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	dmID := c.Param("dmId")
	if dmID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "DM ID required"})
		return
	}

	var req ConvertDMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isPrivate := true
	if req.IsPrivate != nil {
		isPrivate = *req.IsPrivate
	}

	channel, err := h.service.ConvertDMToChannel(c.Request.Context(), dmID, userID, req.Name, isPrivate)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "unauthorized") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, channel)
}
