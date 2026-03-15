package email

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for email notification preferences.
type Handler struct {
	service *Service
}

// NewHandler creates a new email handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// getUserID extracts the authenticated user ID set by AuthMiddleware.
func getUserID(c *gin.Context) string {
	userID, _ := c.Get("user_id")
	s, _ := userID.(string)
	return s
}

// GetPreferences returns the current user's email notification preferences.
func (h *Handler) GetPreferences(c *gin.Context) {
	userID := getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	prefs, err := h.service.GetPreferences(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, prefs)
}

// UpdatePreferences applies a partial update to the user's email preferences.
func (h *Handler) UpdatePreferences(c *gin.Context) {
	userID := getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req UpdatePreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	prefs, err := h.service.UpdatePreferences(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, prefs)
}

// Unsubscribe handles the one-click unsubscribe link. For now the token is
// the user's UUID; a proper signed token should replace this in production.
func (h *Handler) Unsubscribe(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing token"})
		return
	}

	if err := h.service.Unsubscribe(c.Request.Context(), token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "unsubscribed"})
}
