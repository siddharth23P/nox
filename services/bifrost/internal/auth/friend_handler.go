package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nox-labs/bifrost/internal/db"
)

// FriendHandler handles HTTP requests for the friend system.
type FriendHandler struct {
	service *FriendService
}

// NewFriendHandler creates a new FriendHandler.
func NewFriendHandler(service *FriendService) *FriendHandler {
	return &FriendHandler{service: service}
}

// SendFriendRequest handles POST /v1/friends/request
func (h *FriendHandler) SendFriendRequest(c *gin.Context) {
	userID := c.GetString("user_id")

	var req struct {
		AddresseeID string `json:"addressee_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "addressee_id is required"})
		return
	}

	friendship, err := h.service.SendFriendRequest(c.Request.Context(), userID, req.AddresseeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"friendship": friendship})
}

// AcceptFriendRequest handles POST /v1/friends/:id/accept
func (h *FriendHandler) AcceptFriendRequest(c *gin.Context) {
	friendshipID := c.Param("id")
	userID := c.GetString("user_id")

	err := h.service.AcceptFriendRequest(c.Request.Context(), friendshipID, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DeclineFriendRequest handles POST /v1/friends/:id/decline
func (h *FriendHandler) DeclineFriendRequest(c *gin.Context) {
	friendshipID := c.Param("id")
	userID := c.GetString("user_id")

	err := h.service.DeclineFriendRequest(c.Request.Context(), friendshipID, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// RemoveFriend handles DELETE /v1/friends/:id
func (h *FriendHandler) RemoveFriend(c *gin.Context) {
	friendshipID := c.Param("id")
	userID := c.GetString("user_id")

	err := h.service.RemoveFriend(c.Request.Context(), friendshipID, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// BlockUser handles POST /v1/users/:userId/block
func (h *FriendHandler) BlockUser(c *gin.Context) {
	blockedID := c.Param("userId")
	blockerID := c.GetString("user_id")

	err := h.service.BlockUser(c.Request.Context(), blockerID, blockedID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// UnblockUser handles DELETE /v1/users/:userId/block
func (h *FriendHandler) UnblockUser(c *gin.Context) {
	blockedID := c.Param("userId")
	blockerID := c.GetString("user_id")

	err := h.service.UnblockUser(c.Request.Context(), blockerID, blockedID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ListFriends handles GET /v1/friends
func (h *FriendHandler) ListFriends(c *gin.Context) {
	userID := c.GetString("user_id")
	status := c.DefaultQuery("status", "all")

	friends, err := h.service.ListFriends(c.Request.Context(), userID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if friends == nil {
		friends = []db.FriendUser{}
	}

	c.JSON(http.StatusOK, gin.H{"friends": friends})
}

// MutualOrgs handles GET /v1/friends/mutual/:userId
func (h *FriendHandler) MutualOrgs(c *gin.Context) {
	userID := c.GetString("user_id")
	otherUserID := c.Param("userId")

	orgs, err := h.service.GetMutualOrgs(c.Request.Context(), userID, otherUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if orgs == nil {
		orgs = []db.MutualOrg{}
	}

	c.JSON(http.StatusOK, gin.H{"mutual_orgs": orgs})
}

// SearchUsers handles GET /v1/users/search
func (h *FriendHandler) SearchUsers(c *gin.Context) {
	userID := c.GetString("user_id")
	query := c.Query("q")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
		return
	}

	users, err := h.service.SearchUsers(c.Request.Context(), query, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if users == nil {
		users = []db.FriendUser{}
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}
