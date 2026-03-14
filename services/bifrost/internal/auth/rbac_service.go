package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/nox-labs/bifrost/internal/db"
)

// RBACService handles business logic for role and permission management.
type RBACService struct {
	repo *db.Database
}

// NewRBACService creates a new RBAC service.
func NewRBACService(repo *db.Database) *RBACService {
	return &RBACService{repo: repo}
}

// ListRoles returns all roles for an organization.
func (s *RBACService) ListRoles(ctx context.Context, orgID string) ([]db.Role, error) {
	roles, err := s.repo.ListRoles(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to list roles: %w", err)
	}
	if roles == nil {
		roles = []db.Role{}
	}
	return roles, nil
}

// CreateRole creates a new custom role in the org.
// Only users with manage_roles permission (admin+) should call this.
func (s *RBACService) CreateRole(ctx context.Context, orgID, name, color string, position int, permissions map[string]bool) (*db.Role, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("role name is required")
	}
	if DefaultRoleNames[name] {
		return nil, fmt.Errorf("cannot create role with reserved name: %s", name)
	}
	if color == "" {
		color = "#99AAB5"
	}

	role, err := s.repo.CreateRole(ctx, orgID, name, color, position, permissions)
	if err != nil {
		return nil, fmt.Errorf("failed to create role: %w", err)
	}
	return role, nil
}

// UpdateRole updates a role's settings and permissions.
func (s *RBACService) UpdateRole(ctx context.Context, roleID, name, color string, position int, permissions map[string]bool) (*db.Role, error) {
	existing, err := s.repo.GetRole(ctx, roleID)
	if err != nil {
		return nil, fmt.Errorf("role not found: %w", err)
	}

	// For default roles, only allow changing permissions (not name).
	if existing.IsDefault {
		name = existing.Name
	}

	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("role name is required")
	}
	if color == "" {
		color = existing.Color
	}

	role, err := s.repo.UpdateRole(ctx, roleID, name, color, position, permissions)
	if err != nil {
		return nil, fmt.Errorf("failed to update role: %w", err)
	}
	return role, nil
}

// DeleteRole removes a custom role. Default roles cannot be deleted.
func (s *RBACService) DeleteRole(ctx context.Context, roleID string) error {
	existing, err := s.repo.GetRole(ctx, roleID)
	if err != nil {
		return fmt.Errorf("role not found: %w", err)
	}
	if existing.IsDefault {
		return errors.New("cannot delete a default role")
	}
	return s.repo.DeleteRole(ctx, roleID)
}

// AssignRole adds a role to a user.
func (s *RBACService) AssignRole(ctx context.Context, userID, roleID, orgID string) error {
	// Verify role belongs to org
	role, err := s.repo.GetRole(ctx, roleID)
	if err != nil {
		return fmt.Errorf("role not found: %w", err)
	}
	if role.OrgID != orgID {
		return errors.New("role does not belong to this organization")
	}
	return s.repo.AssignUserRole(ctx, userID, roleID, orgID)
}

// RemoveRole removes a role from a user.
func (s *RBACService) RemoveRole(ctx context.Context, userID, roleID, orgID string) error {
	return s.repo.RemoveUserRole(ctx, userID, roleID, orgID)
}

// GetUserRoles returns the roles assigned to a user in an org.
func (s *RBACService) GetUserRoles(ctx context.Context, userID, orgID string) ([]db.UserRole, error) {
	roles, err := s.repo.GetUserRoles(ctx, userID, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}
	if roles == nil {
		roles = []db.UserRole{}
	}
	return roles, nil
}

// GetEffectivePermissions computes the merged permissions for a user.
func (s *RBACService) GetEffectivePermissions(ctx context.Context, userID, orgID string) (map[string]bool, string, error) {
	perms, highestRole, err := s.repo.GetUserEffectivePermissions(ctx, userID, orgID)
	if err != nil {
		return nil, "", fmt.Errorf("failed to compute permissions: %w", err)
	}
	if perms == nil {
		perms = make(map[string]bool)
	}
	return perms, highestRole, nil
}

// HasPermission checks if a user has a specific permission in an org.
func (s *RBACService) HasPermission(ctx context.Context, userID, orgID, permission string) (bool, error) {
	perms, _, err := s.repo.GetUserEffectivePermissions(ctx, userID, orgID)
	if err != nil {
		return false, err
	}
	return perms[permission], nil
}

// GetPermissionSchema returns the full permission category list for the UI.
func (s *RBACService) GetPermissionSchema() []PermissionCategory {
	return AllPermissionCategories()
}
