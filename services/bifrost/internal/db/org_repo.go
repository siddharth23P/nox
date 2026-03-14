package db

import (
	"context"
	"fmt"
)

// OrgSettings represents the full settings for an organization.
type OrgSettings struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	LogoURL     string `json:"logo_url"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// OrgMember represents a member of an organization with their role info.
type OrgMember struct {
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	FullName    string `json:"full_name"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	JoinedAt    string `json:"joined_at"`
}

// GetOrgSettings returns the full settings for an organization.
func (db *Database) GetOrgSettings(ctx context.Context, orgID string) (*OrgSettings, error) {
	var o OrgSettings
	err := db.Pool.QueryRow(ctx,
		`SELECT id, name, slug, COALESCE(description, ''), COALESCE(logo_url, ''),
		        created_at::text, updated_at::text
		 FROM organizations WHERE id = $1`, orgID).Scan(
		&o.ID, &o.Name, &o.Slug, &o.Description, &o.LogoURL,
		&o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// UpdateOrgSettings updates the name, description for an organization.
func (db *Database) UpdateOrgSettings(ctx context.Context, orgID, name, description string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE organizations SET name = $2, description = $3, updated_at = NOW() WHERE id = $1`,
		orgID, name, description)
	return err
}

// UpdateOrgLogoURL sets the logo_url for an organization.
func (db *Database) UpdateOrgLogoURL(ctx context.Context, orgID, logoURL string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE organizations SET logo_url = $2, updated_at = NOW() WHERE id = $1`,
		orgID, logoURL)
	return err
}

// ListOrgMembers returns members of an organization with their roles.
// Supports search by username/full_name/email and pagination via limit/offset.
func (db *Database) ListOrgMembers(ctx context.Context, orgID, search string, limit, offset int) ([]OrgMember, int, error) {
	// Count total
	countQuery := `SELECT COUNT(*) FROM organization_memberships om
		JOIN users u ON u.id = om.user_id
		WHERE om.org_id = $1`
	args := []interface{}{orgID}

	if search != "" {
		countQuery += ` AND (u.username ILIKE $2 OR u.full_name ILIKE $2 OR u.email ILIKE $2)`
		args = append(args, "%"+search+"%")
	}

	var total int
	err := db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count members: %w", err)
	}

	// Fetch members
	query := `SELECT u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.display_name, ''),
	                  COALESCE(u.avatar_url, ''), u.email, om.role, om.user_id
	           FROM organization_memberships om
	           JOIN users u ON u.id = om.user_id
	           WHERE om.org_id = $1`
	fetchArgs := []interface{}{orgID}

	if search != "" {
		query += ` AND (u.username ILIKE $2 OR u.full_name ILIKE $2 OR u.email ILIKE $2)`
		fetchArgs = append(fetchArgs, "%"+search+"%")
	}

	query += ` ORDER BY om.role ASC, u.username ASC`
	query += fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)

	rows, err := db.Pool.Query(ctx, query, fetchArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list members: %w", err)
	}
	defer rows.Close()

	var members []OrgMember
	for rows.Next() {
		var m OrgMember
		var ignoredUserID string
		if err := rows.Scan(&m.UserID, &m.Username, &m.FullName, &m.DisplayName,
			&m.AvatarURL, &m.Email, &m.Role, &ignoredUserID); err != nil {
			return nil, 0, err
		}
		m.JoinedAt = "" // organization_memberships doesn't have joined_at; could be extended
		members = append(members, m)
	}

	return members, total, nil
}

// UpdateMemberRole updates the role of a member in the organization_memberships table.
func (db *Database) UpdateMemberRole(ctx context.Context, orgID, userID, role string) error {
	tag, err := db.Pool.Exec(ctx,
		`UPDATE organization_memberships SET role = $3 WHERE org_id = $1 AND user_id = $2`,
		orgID, userID, role)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("member not found in organization")
	}
	return nil
}

// RemoveOrgMember removes a member from the organization.
func (db *Database) RemoveOrgMember(ctx context.Context, orgID, userID string) error {
	tag, err := db.Pool.Exec(ctx,
		`DELETE FROM organization_memberships WHERE org_id = $1 AND user_id = $2`,
		orgID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("member not found in organization")
	}
	return nil
}

// GetMemberRole returns the role of a specific member in an org.
func (db *Database) GetMemberRole(ctx context.Context, orgID, userID string) (string, error) {
	var role string
	err := db.Pool.QueryRow(ctx,
		`SELECT role FROM organization_memberships WHERE org_id = $1 AND user_id = $2`,
		orgID, userID).Scan(&role)
	if err != nil {
		return "", err
	}
	return role, nil
}
