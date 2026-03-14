package auth

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// OrgHandler handles HTTP requests for organization settings and member management.
type OrgHandler struct {
	service *OrgService
}

// NewOrgHandler creates a new OrgHandler.
func NewOrgHandler(service *OrgService) *OrgHandler {
	return &OrgHandler{service: service}
}

// GetOrgSettings returns the full settings for an organization.
// GET /v1/orgs/:orgId/settings
func (h *OrgHandler) GetOrgSettings(c *gin.Context) {
	orgID := c.Param("orgId")
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id required"})
		return
	}

	settings, err := h.service.GetSettings(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateOrgSettings updates the name and description for an organization.
// PATCH /v1/orgs/:orgId
func (h *OrgHandler) UpdateOrgSettings(c *gin.Context) {
	orgID := c.Param("orgId")
	callerID := c.GetString("user_id")
	if orgID == "" || callerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id required"})
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	settings, err := h.service.UpdateSettings(c.Request.Context(), orgID, callerID, req.Name, req.Description)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UploadOrgLogo handles multipart logo file upload for an organization.
// POST /v1/orgs/:orgId/logo
func (h *OrgHandler) UploadOrgLogo(c *gin.Context) {
	orgID := c.Param("orgId")
	callerID := c.GetString("user_id")
	if orgID == "" || callerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id required"})
		return
	}

	file, header, err := c.Request.FormFile("logo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "logo file is required"})
		return
	}
	defer file.Close()

	logoURL, err := h.service.UploadLogo(c.Request.Context(), orgID, callerID, file, header)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"logo_url": logoURL})
}

// ListOrgMembers returns the members of an organization with search and pagination.
// GET /v1/orgs/:orgId/members
func (h *OrgHandler) ListOrgMembers(c *gin.Context) {
	orgID := c.Param("orgId")
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id required"})
		return
	}

	search := c.Query("search")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	members, total, err := h.service.ListMembers(c.Request.Context(), orgID, search, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"members": members,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// ChangeMemberRole changes a member's role in the organization.
// PATCH /v1/orgs/:orgId/members/:userId/role
func (h *OrgHandler) ChangeMemberRole(c *gin.Context) {
	orgID := c.Param("orgId")
	targetUserID := c.Param("userId")
	callerID := c.GetString("user_id")
	if orgID == "" || targetUserID == "" || callerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id and user_id required"})
		return
	}

	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.ChangeMemberRole(c.Request.Context(), orgID, callerID, targetUserID, req.Role); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "role updated"})
}

// RemoveMember removes a member from the organization.
// DELETE /v1/orgs/:orgId/members/:userId
func (h *OrgHandler) RemoveMember(c *gin.Context) {
	orgID := c.Param("orgId")
	targetUserID := c.Param("userId")
	callerID := c.GetString("user_id")
	if orgID == "" || targetUserID == "" || callerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id and user_id required"})
		return
	}

	if err := h.service.RemoveMember(c.Request.Context(), orgID, callerID, targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member removed"})
}
