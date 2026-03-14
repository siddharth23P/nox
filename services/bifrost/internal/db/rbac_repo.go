package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// Role represents a row in the roles table.
type Role struct {
	ID          string            `json:"id"`
	OrgID       string            `json:"org_id"`
	Name        string            `json:"name"`
	Color       string            `json:"color"`
	Position    int               `json:"position"`
	IsDefault   bool              `json:"is_default"`
	Permissions map[string]bool   `json:"permissions"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// UserRole represents a row in the user_roles table.
type UserRole struct {
	UserID     string    `json:"user_id"`
	RoleID     string    `json:"role_id"`
	OrgID      string    `json:"org_id"`
	RoleName   string    `json:"role_name"`
	RoleColor  string    `json:"role_color"`
	AssignedAt time.Time `json:"assigned_at"`
}

// ChannelOverride represents a row in the channel_role_overrides table.
type ChannelOverride struct {
	ChannelID        string          `json:"channel_id"`
	RoleID           string          `json:"role_id"`
	AllowPermissions map[string]bool `json:"allow_permissions"`
	DenyPermissions  map[string]bool `json:"deny_permissions"`
}

// ListRoles returns all roles for an organization ordered by position descending.
func (db *Database) ListRoles(ctx context.Context, orgID string) ([]Role, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, org_id, name, color, position, is_default, permissions, created_at, updated_at
		 FROM roles WHERE org_id = $1 ORDER BY position DESC`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []Role
	for rows.Next() {
		var r Role
		var permJSON []byte
		if err := rows.Scan(&r.ID, &r.OrgID, &r.Name, &r.Color, &r.Position, &r.IsDefault, &permJSON, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		r.Permissions = make(map[string]bool)
		if len(permJSON) > 0 {
			_ = json.Unmarshal(permJSON, &r.Permissions)
		}
		roles = append(roles, r)
	}
	return roles, nil
}

// GetRole returns a single role by ID.
func (db *Database) GetRole(ctx context.Context, roleID string) (*Role, error) {
	var r Role
	var permJSON []byte
	err := db.Pool.QueryRow(ctx,
		`SELECT id, org_id, name, color, position, is_default, permissions, created_at, updated_at
		 FROM roles WHERE id = $1`, roleID).
		Scan(&r.ID, &r.OrgID, &r.Name, &r.Color, &r.Position, &r.IsDefault, &permJSON, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, err
	}
	r.Permissions = make(map[string]bool)
	if len(permJSON) > 0 {
		_ = json.Unmarshal(permJSON, &r.Permissions)
	}
	return &r, nil
}

// CreateRole inserts a new custom role.
func (db *Database) CreateRole(ctx context.Context, orgID, name, color string, position int, permissions map[string]bool) (*Role, error) {
	permJSON, err := json.Marshal(permissions)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal permissions: %w", err)
	}

	var r Role
	var returnedPermJSON []byte
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO roles (org_id, name, color, position, is_default, permissions)
		 VALUES ($1, $2, $3, $4, false, $5)
		 RETURNING id, org_id, name, color, position, is_default, permissions, created_at, updated_at`,
		orgID, name, color, position, permJSON).
		Scan(&r.ID, &r.OrgID, &r.Name, &r.Color, &r.Position, &r.IsDefault, &returnedPermJSON, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create role: %w", err)
	}
	r.Permissions = permissions
	return &r, nil
}

// UpdateRole updates an existing role's name, color, position, and permissions.
func (db *Database) UpdateRole(ctx context.Context, roleID, name, color string, position int, permissions map[string]bool) (*Role, error) {
	permJSON, err := json.Marshal(permissions)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal permissions: %w", err)
	}

	var r Role
	var returnedPermJSON []byte
	err = db.Pool.QueryRow(ctx,
		`UPDATE roles SET name = $1, color = $2, position = $3, permissions = $4, updated_at = NOW()
		 WHERE id = $5
		 RETURNING id, org_id, name, color, position, is_default, permissions, created_at, updated_at`,
		name, color, position, permJSON, roleID).
		Scan(&r.ID, &r.OrgID, &r.Name, &r.Color, &r.Position, &r.IsDefault, &returnedPermJSON, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to update role: %w", err)
	}
	r.Permissions = permissions
	return &r, nil
}

// DeleteRole removes a role by ID.
func (db *Database) DeleteRole(ctx context.Context, roleID string) error {
	_, err := db.Pool.Exec(ctx, "DELETE FROM roles WHERE id = $1", roleID)
	return err
}

// AssignUserRole adds a role to a user in an org.
func (db *Database) AssignUserRole(ctx context.Context, userID, roleID, orgID string) error {
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO user_roles (user_id, role_id, org_id) VALUES ($1, $2, $3)
		 ON CONFLICT DO NOTHING`, userID, roleID, orgID)
	return err
}

// RemoveUserRole removes a role from a user in an org.
func (db *Database) RemoveUserRole(ctx context.Context, userID, roleID, orgID string) error {
	_, err := db.Pool.Exec(ctx,
		"DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 AND org_id = $3",
		userID, roleID, orgID)
	return err
}

// GetUserRoles returns all roles assigned to a user in an org.
func (db *Database) GetUserRoles(ctx context.Context, userID, orgID string) ([]UserRole, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT ur.user_id, ur.role_id, ur.org_id, r.name, r.color, ur.assigned_at
		 FROM user_roles ur
		 JOIN roles r ON r.id = ur.role_id
		 WHERE ur.user_id = $1 AND ur.org_id = $2
		 ORDER BY r.position DESC`, userID, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []UserRole
	for rows.Next() {
		var ur UserRole
		if err := rows.Scan(&ur.UserID, &ur.RoleID, &ur.OrgID, &ur.RoleName, &ur.RoleColor, &ur.AssignedAt); err != nil {
			return nil, err
		}
		roles = append(roles, ur)
	}
	return roles, nil
}

// GetUserEffectivePermissions computes the merged permission set for a user in an org.
// It unions all permissions from all assigned roles (the highest role wins).
func (db *Database) GetUserEffectivePermissions(ctx context.Context, userID, orgID string) (map[string]bool, string, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT r.permissions, r.name, r.position
		 FROM user_roles ur
		 JOIN roles r ON r.id = ur.role_id
		 WHERE ur.user_id = $1 AND ur.org_id = $2
		 ORDER BY r.position DESC`, userID, orgID)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	merged := make(map[string]bool)
	highestRole := ""
	highestPos := -1

	for rows.Next() {
		var permJSON []byte
		var roleName string
		var position int
		if err := rows.Scan(&permJSON, &roleName, &position); err != nil {
			return nil, "", err
		}
		if position > highestPos {
			highestPos = position
			highestRole = roleName
		}
		var perms map[string]bool
		if err := json.Unmarshal(permJSON, &perms); err != nil {
			continue
		}
		for k, v := range perms {
			if v {
				merged[k] = true
			}
		}
	}

	// Fallback: if user has no roles assigned, check legacy organization_memberships
	if highestRole == "" {
		var legacyRole string
		err := db.Pool.QueryRow(ctx,
			"SELECT role FROM organization_memberships WHERE user_id = $1 AND org_id = $2",
			userID, orgID).Scan(&legacyRole)
		if err == nil {
			highestRole = legacyRole
		}
	}

	return merged, highestRole, nil
}

// GetChannelOverrides returns permission overrides for a specific channel and role.
func (db *Database) GetChannelOverrides(ctx context.Context, channelID, roleID string) (*ChannelOverride, error) {
	var co ChannelOverride
	var allowJSON, denyJSON []byte
	err := db.Pool.QueryRow(ctx,
		`SELECT channel_id, role_id, allow_permissions, deny_permissions
		 FROM channel_role_overrides WHERE channel_id = $1 AND role_id = $2`,
		channelID, roleID).Scan(&co.ChannelID, &co.RoleID, &allowJSON, &denyJSON)
	if err != nil {
		return nil, err
	}
	co.AllowPermissions = make(map[string]bool)
	co.DenyPermissions = make(map[string]bool)
	_ = json.Unmarshal(allowJSON, &co.AllowPermissions)
	_ = json.Unmarshal(denyJSON, &co.DenyPermissions)
	return &co, nil
}

// GetRoleByName returns a role by org and name.
func (db *Database) GetRoleByName(ctx context.Context, orgID, name string) (*Role, error) {
	var r Role
	var permJSON []byte
	err := db.Pool.QueryRow(ctx,
		`SELECT id, org_id, name, color, position, is_default, permissions, created_at, updated_at
		 FROM roles WHERE org_id = $1 AND name = $2`, orgID, name).
		Scan(&r.ID, &r.OrgID, &r.Name, &r.Color, &r.Position, &r.IsDefault, &permJSON, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, err
	}
	r.Permissions = make(map[string]bool)
	if len(permJSON) > 0 {
		_ = json.Unmarshal(permJSON, &r.Permissions)
	}
	return &r, nil
}
