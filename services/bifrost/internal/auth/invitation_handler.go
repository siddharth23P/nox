package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// InvitationHandler handles HTTP requests for org invitations.
type InvitationHandler struct {
	service *InvitationService
}

// NewInvitationHandler creates a new InvitationHandler.
func NewInvitationHandler(service *InvitationService) *InvitationHandler {
	return &InvitationHandler{service: service}
}

// CreateInvitation handles POST /v1/orgs/:orgId/invitations
func (h *InvitationHandler) CreateInvitation(c *gin.Context) {
	orgID := c.Param("orgId")
	userID := c.GetString("user_id")
	role := c.GetString("role")

	if role != "owner" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can create invitations"})
		return
	}

	var req struct {
		Email     string  `json:"email" binding:"required"`
		Role      string  `json:"role"`
		MaxUses   *int    `json:"max_uses"`
		ExpiresIn *int    `json:"expires_in_hours"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
		return
	}

	inviteRole := "member"
	if req.Role != "" {
		inviteRole = req.Role
	}

	var expiresAt *time.Time
	if req.ExpiresIn != nil {
		t := time.Now().Add(time.Duration(*req.ExpiresIn) * time.Hour)
		expiresAt = &t
	}

	inv, err := h.service.CreateEmailInvitation(c.Request.Context(), orgID, userID, req.Email, inviteRole, req.MaxUses, expiresAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"invitation": inv,
		"invite_url": "http://localhost:5173/join/accept?token=" + inv.Token,
	})
}

// CreateInviteLink handles POST /v1/orgs/:orgId/invite-links
func (h *InvitationHandler) CreateInviteLink(c *gin.Context) {
	orgID := c.Param("orgId")
	userID := c.GetString("user_id")
	role := c.GetString("role")

	if role != "owner" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can create invite links"})
		return
	}

	var req struct {
		Role      string `json:"role"`
		MaxUses   *int   `json:"max_uses"`
		ExpiresIn *int   `json:"expires_in_hours"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		// Not required — defaults are fine
		_ = err
	}

	linkRole := "member"
	if req.Role != "" {
		linkRole = req.Role
	}

	var expiresAt *time.Time
	if req.ExpiresIn != nil {
		t := time.Now().Add(time.Duration(*req.ExpiresIn) * time.Hour)
		expiresAt = &t
	}

	link, err := h.service.CreateInviteLink(c.Request.Context(), orgID, userID, linkRole, req.MaxUses, expiresAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"invite_link": link,
		"join_url":    "http://localhost:5173/join/" + link.Code,
	})
}

// ListInvitations handles GET /v1/orgs/:orgId/invitations
func (h *InvitationHandler) ListInvitations(c *gin.Context) {
	orgID := c.Param("orgId")
	role := c.GetString("role")

	if role != "owner" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can view invitations"})
		return
	}

	invitations, err := h.service.ListInvitations(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	links, err := h.service.ListInviteLinks(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"invitations":  invitations,
		"invite_links": links,
	})
}

// RevokeInvitation handles DELETE /v1/orgs/:orgId/invitations/:inviteId
func (h *InvitationHandler) RevokeInvitation(c *gin.Context) {
	orgID := c.Param("orgId")
	inviteID := c.Param("inviteId")
	role := c.GetString("role")

	if role != "owner" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can revoke invitations"})
		return
	}

	err := h.service.RevokeInvitation(c.Request.Context(), inviteID, orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// RevokeInviteLink handles DELETE /v1/orgs/:orgId/invite-links/:linkId
func (h *InvitationHandler) RevokeInviteLink(c *gin.Context) {
	orgID := c.Param("orgId")
	linkID := c.Param("linkId")
	role := c.GetString("role")

	if role != "owner" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can revoke invite links"})
		return
	}

	err := h.service.RevokeInviteLink(c.Request.Context(), linkID, orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// AcceptInvitation handles POST /v1/invitations/:token/accept
func (h *InvitationHandler) AcceptInvitation(c *gin.Context) {
	token := c.Param("token")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	orgID, role, err := h.service.AcceptEmailInvitation(c.Request.Context(), token, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"org_id":  orgID,
		"role":    role,
		"message": "Successfully joined the organization",
	})
}

// JoinViaLink handles POST /v1/join/:code
func (h *InvitationHandler) JoinViaLink(c *gin.Context) {
	code := c.Param("code")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	orgID, role, err := h.service.JoinViaLink(c.Request.Context(), code, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"org_id":  orgID,
		"role":    role,
		"message": "Successfully joined the organization",
	})
}

// GetInviteLinkInfo handles GET /v1/join/:code (public)
func (h *InvitationHandler) GetInviteLinkInfo(c *gin.Context) {
	code := c.Param("code")

	info, err := h.service.GetInviteLinkInfo(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invite link not found or expired"})
		return
	}

	c.JSON(http.StatusOK, info)
}
