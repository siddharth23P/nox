package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RBACHandler handles HTTP requests for role and permission management.
type RBACHandler struct {
	service *RBACService
}

// NewRBACHandler creates a new RBAC handler.
func NewRBACHandler(service *RBACService) *RBACHandler {
	return &RBACHandler{service: service}
}

// ListRoles returns all roles for the organization.
// GET /v1/orgs/:orgId/roles
func (h *RBACHandler) ListRoles(c *gin.Context) {
	orgID := c.Param("orgId")
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id required"})
		return
	}

	roles, err := h.service.ListRoles(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"roles": roles})
}

// CreateRole creates a new custom role.
// POST /v1/orgs/:orgId/roles
func (h *RBACHandler) CreateRole(c *gin.Context) {
	orgID := c.Param("orgId")
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id required"})
		return
	}

	var req struct {
		Name        string          `json:"name" binding:"required"`
		Color       string          `json:"color"`
		Position    int             `json:"position"`
		Permissions map[string]bool `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Permissions == nil {
		req.Permissions = make(map[string]bool)
	}

	role, err := h.service.CreateRole(c.Request.Context(), orgID, req.Name, req.Color, req.Position, req.Permissions)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, role)
}

// UpdateRole edits a role's permissions and settings.
// PATCH /v1/orgs/:orgId/roles/:roleId
func (h *RBACHandler) UpdateRole(c *gin.Context) {
	roleID := c.Param("roleId")
	if roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role_id required"})
		return
	}

	var req struct {
		Name        string          `json:"name"`
		Color       string          `json:"color"`
		Position    int             `json:"position"`
		Permissions map[string]bool `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Permissions == nil {
		req.Permissions = make(map[string]bool)
	}

	role, err := h.service.UpdateRole(c.Request.Context(), roleID, req.Name, req.Color, req.Position, req.Permissions)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, role)
}

// DeleteRole removes a custom role.
// DELETE /v1/orgs/:orgId/roles/:roleId
func (h *RBACHandler) DeleteRole(c *gin.Context) {
	roleID := c.Param("roleId")
	if roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role_id required"})
		return
	}

	if err := h.service.DeleteRole(c.Request.Context(), roleID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "role deleted"})
}

// AssignRole assigns a role to a user.
// POST /v1/orgs/:orgId/members/:userId/roles
func (h *RBACHandler) AssignRole(c *gin.Context) {
	orgID := c.Param("orgId")
	userID := c.Param("userId")
	if orgID == "" || userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id and user_id required"})
		return
	}

	var req struct {
		RoleID string `json:"role_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.AssignRole(c.Request.Context(), userID, req.RoleID, orgID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "role assigned"})
}

// RemoveRole removes a role from a user.
// DELETE /v1/orgs/:orgId/members/:userId/roles/:roleId
func (h *RBACHandler) RemoveRole(c *gin.Context) {
	orgID := c.Param("orgId")
	userID := c.Param("userId")
	roleID := c.Param("roleId")
	if orgID == "" || userID == "" || roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id, user_id, and role_id required"})
		return
	}

	if err := h.service.RemoveRole(c.Request.Context(), userID, roleID, orgID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "role removed"})
}

// GetEffectivePermissions returns the computed permissions for a user.
// GET /v1/orgs/:orgId/members/:userId/permissions
func (h *RBACHandler) GetEffectivePermissions(c *gin.Context) {
	orgID := c.Param("orgId")
	userID := c.Param("userId")
	if orgID == "" || userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id and user_id required"})
		return
	}

	perms, highestRole, err := h.service.GetEffectivePermissions(c.Request.Context(), userID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"permissions":  perms,
		"highest_role": highestRole,
	})
}

// GetPermissionSchema returns the full list of permission categories and keys.
// GET /v1/permissions/schema
func (h *RBACHandler) GetPermissionSchema(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"categories": h.service.GetPermissionSchema()})
}
