package moderation

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Handler exposes moderation REST endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new moderation handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// getAuthInfo extracts org_id (tenant_id) and user_id from JWT auth context.
func getAuthInfo(c *gin.Context) (string, string) {
	orgID, _ := c.Get("tenant_id")
	userID, _ := c.Get("user_id")
	orgStr, _ := orgID.(string)
	userStr, _ := userID.(string)
	return orgStr, userStr
}

// requireModeratorRole checks that the current user has admin, owner, or moderator role
// in the org_members table. Returns true if authorized, false (with JSON error written) otherwise.
func (h *Handler) requireModeratorRole(c *gin.Context, orgID, userID string) bool {
	var role string
	err := h.service.db.Pool.QueryRow(c.Request.Context(),
		`SELECT role FROM organization_memberships WHERE user_id = $1 AND org_id = $2`,
		userID, orgID,
	).Scan(&role)
	if err != nil || (role != "owner" && role != "admin" && role != "moderator") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Moderator, admin, or owner role required"})
		return false
	}
	return true
}

// TimeoutUser handles POST /moderation/timeout
func (h *Handler) TimeoutUser(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if !h.requireModeratorRole(c, orgID, userID) {
		return
	}

	var req TimeoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	action, err := h.service.TimeoutUser(c.Request.Context(), orgID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, action)
}

// MuteUser handles POST /moderation/mute
func (h *Handler) MuteUser(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if !h.requireModeratorRole(c, orgID, userID) {
		return
	}

	var req MuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	action, err := h.service.MuteUser(c.Request.Context(), orgID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, action)
}

// WarnUser handles POST /moderation/warn
func (h *Handler) WarnUser(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if !h.requireModeratorRole(c, orgID, userID) {
		return
	}

	var req WarnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	action, err := h.service.WarnUser(c.Request.Context(), orgID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, action)
}

// BanUser handles POST /moderation/ban
func (h *Handler) BanUser(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if !h.requireModeratorRole(c, orgID, userID) {
		return
	}

	var req BanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	action, err := h.service.BanUser(c.Request.Context(), orgID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, action)
}

// RevokeAction handles POST /moderation/actions/:id/revoke
func (h *Handler) RevokeAction(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if !h.requireModeratorRole(c, orgID, userID) {
		return
	}

	actionID := c.Param("id")
	if actionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Action ID required"})
		return
	}

	if err := h.service.RevokeAction(c.Request.Context(), actionID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "revoked", "action_id": actionID})
}

// ListActions handles GET /moderation/actions
func (h *Handler) ListActions(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if !h.requireModeratorRole(c, orgID, userID) {
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	actions, err := h.service.ListActions(c.Request.Context(), orgID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if actions == nil {
		actions = []ModerationAction{}
	}
	c.JSON(http.StatusOK, gin.H{"actions": actions})
}

// GetUserStatus handles GET /moderation/users/:userId/status
func (h *Handler) GetUserStatus(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if !h.requireModeratorRole(c, orgID, userID) {
		return
	}

	targetUserID := c.Param("userId")
	if targetUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID required"})
		return
	}

	actions, err := h.service.GetActiveActions(c.Request.Context(), orgID, targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if actions == nil {
		actions = []ModerationAction{}
	}
	c.JSON(http.StatusOK, gin.H{"actions": actions})
}
