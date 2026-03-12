package messaging

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type MessagingHandler struct {
	service *MessagingService
}

func NewMessagingHandler(service *MessagingService) *MessagingHandler {
	return &MessagingHandler{service: service}
}

// Helper to extract org_id and user_id. In a real app this comes from JWT middleware.
// For now, we expect them as headers `X-Org-ID` and `X-User-ID` matching our simplified testing approach.
func getAuthInfo(c *gin.Context) (string, string) {
	orgID := c.GetHeader("X-Org-ID")
	userID := c.GetHeader("X-User-ID")
	return orgID, userID
}

func (h *MessagingHandler) CreateChannel(c *gin.Context) {
	orgID, _ := getAuthInfo(c)
	if orgID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-Org-ID required"})
		return
	}

	var req CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch, err := h.service.CreateChannel(c.Request.Context(), orgID, req.Name, req.Description, req.IsPrivate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ch)
}

func (h *MessagingHandler) GetChannels(c *gin.Context) {
	orgID, _ := getAuthInfo(c)
	if orgID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-Org-ID required"})
		return
	}

	channels, err := h.service.GetChannels(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if channels == nil {
		channels = []Channel{}
	}
	c.JSON(http.StatusOK, channels)
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

	var req CreateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg, err := h.service.CreateMessage(c.Request.Context(), channelID, userID, req.ContentMD, req.ContentHTML, req.ParentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// TODO: Broadcast the new message via WebSockets

	c.JSON(http.StatusCreated, msg)
}

func (h *MessagingHandler) GetMessages(c *gin.Context) {
	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	_, userID := getAuthInfo(c)
	before := c.Query("before")

	messages, err := h.service.GetMessagesByChannel(c.Request.Context(), channelID, before, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if messages == nil {
		messages = []Message{}
	}
	c.JSON(http.StatusOK, messages)
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
