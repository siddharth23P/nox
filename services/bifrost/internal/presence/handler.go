package presence

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type PresenceHandler struct {
	service *PresenceService
}

func NewPresenceHandler(service *PresenceService) *PresenceHandler {
	return &PresenceHandler{service: service}
}

// Helper to extract user_id. In a real app this comes from JWT middleware.
func getUserID(c *gin.Context) string {
	return c.GetHeader("X-User-ID")
}

type HeartbeatRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *PresenceHandler) Heartbeat(c *gin.Context) {
	userID := getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-User-ID required"})
		return
	}

	var req HeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status := PresenceStatus(req.Status)
	if status != StatusOnline && status != StatusStealth {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}

	h.service.Heartbeat(userID, status)
	c.Status(http.StatusOK)
}

func (h *PresenceHandler) GetActiveUsers(c *gin.Context) {
	// Authentication optional here, but we could enforce org scope.
	// For now, return global active users.
	active := h.service.GetActiveUsers()
	if active == nil {
		active = []string{}
	}
	c.JSON(http.StatusOK, active)
}
