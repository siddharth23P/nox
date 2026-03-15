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

// BannedMember represents a banned member record.
type BannedMember struct {
	ID        string `json:"id"`
	OrgID     string `json:"org_id"`
	UserID    string `json:"user_id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	BannedBy  string `json:"banned_by"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"created_at"`
}

// BanMember removes a member from the org and inserts a ban record in a transaction.
func (db *Database) BanMember(ctx context.Context, orgID, userID, bannedBy, reason string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Remove from organization_memberships
	_, err = tx.Exec(ctx,
		`DELETE FROM organization_memberships WHERE org_id = $1 AND user_id = $2`,
		orgID, userID)
	if err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}

	// Insert ban record
	_, err = tx.Exec(ctx,
		`INSERT INTO banned_members (org_id, user_id, banned_by, reason)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (org_id, user_id) DO UPDATE SET banned_by = $3, reason = $4, created_at = NOW()`,
		orgID, userID, bannedBy, reason)
	if err != nil {
		return fmt.Errorf("failed to insert ban record: %w", err)
	}

	return tx.Commit(ctx)
}

// UnbanMember removes a ban record for a user in an org.
func (db *Database) UnbanMember(ctx context.Context, orgID, userID string) error {
	tag, err := db.Pool.Exec(ctx,
		`DELETE FROM banned_members WHERE org_id = $1 AND user_id = $2`,
		orgID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("ban record not found")
	}
	return nil
}

// ListBannedMembers returns all banned members for an org.
func (db *Database) ListBannedMembers(ctx context.Context, orgID string) ([]BannedMember, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT bm.id, bm.org_id, bm.user_id, COALESCE(u.username, ''), COALESCE(u.email, ''),
		        bm.banned_by, COALESCE(bm.reason, ''), bm.created_at::text
		 FROM banned_members bm
		 JOIN users u ON u.id = bm.user_id
		 WHERE bm.org_id = $1
		 ORDER BY bm.created_at DESC`, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to list banned members: %w", err)
	}
	defer rows.Close()

	var banned []BannedMember
	for rows.Next() {
		var b BannedMember
		if err := rows.Scan(&b.ID, &b.OrgID, &b.UserID, &b.Username, &b.Email,
			&b.BannedBy, &b.Reason, &b.CreatedAt); err != nil {
			return nil, err
		}
		banned = append(banned, b)
	}
	return banned, nil
}

// TransferOwnership sets the current owner to admin and promotes the target to owner in a transaction.
func (db *Database) TransferOwnership(ctx context.Context, orgID, currentOwnerID, newOwnerID string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Demote current owner to admin
	_, err = tx.Exec(ctx,
		`UPDATE organization_memberships SET role = 'admin' WHERE org_id = $1 AND user_id = $2`,
		orgID, currentOwnerID)
	if err != nil {
		return fmt.Errorf("failed to demote current owner: %w", err)
	}

	// Promote new owner
	tag, err := tx.Exec(ctx,
		`UPDATE organization_memberships SET role = 'owner' WHERE org_id = $1 AND user_id = $2`,
		orgID, newOwnerID)
	if err != nil {
		return fmt.Errorf("failed to promote new owner: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("target user is not a member of this organization")
	}

	return tx.Commit(ctx)
}
