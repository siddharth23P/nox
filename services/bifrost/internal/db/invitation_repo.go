package db

import (
	"context"
	"fmt"
	"time"
)

// Invitation represents an email-based org invitation.
type Invitation struct {
	ID        string     `json:"id"`
	OrgID     string     `json:"org_id"`
	InviterID string     `json:"inviter_id"`
	Email     string     `json:"email,omitempty"`
	Role      string     `json:"role"`
	Token     string     `json:"token"`
	MaxUses   *int       `json:"max_uses,omitempty"`
	UseCount  int        `json:"use_count"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

// InviteLink represents a shareable invite link for an org.
type InviteLink struct {
	ID        string     `json:"id"`
	OrgID     string     `json:"org_id"`
	CreatorID string     `json:"creator_id"`
	Code      string     `json:"code"`
	Role      string     `json:"role"`
	MaxUses   *int       `json:"max_uses,omitempty"`
	UseCount  int        `json:"use_count"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Active    bool       `json:"active"`
	CreatedAt time.Time  `json:"created_at"`
}

// InviteLinkInfo is a public-facing subset of InviteLink with org name.
type InviteLinkInfo struct {
	Code    string `json:"code"`
	OrgName string `json:"org_name"`
	Role    string `json:"role"`
}

// CreateInvitation inserts a new email invitation.
func (db *Database) CreateInvitation(ctx context.Context, inv *Invitation) error {
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO org_invitations (org_id, inviter_id, email, role, token, max_uses, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		inv.OrgID, inv.InviterID, inv.Email, inv.Role, inv.Token, inv.MaxUses, inv.ExpiresAt,
	).Scan(&inv.ID)
	if err != nil {
		return fmt.Errorf("failed to create invitation: %w", err)
	}
	return nil
}

// GetInvitationByToken retrieves an invitation by its token.
func (db *Database) GetInvitationByToken(ctx context.Context, token string) (*Invitation, error) {
	var inv Invitation
	err := db.Pool.QueryRow(ctx,
		`SELECT id, org_id, inviter_id, COALESCE(email, ''), role, token, max_uses, use_count, expires_at, created_at
		 FROM org_invitations WHERE token = $1`, token,
	).Scan(&inv.ID, &inv.OrgID, &inv.InviterID, &inv.Email, &inv.Role, &inv.Token, &inv.MaxUses, &inv.UseCount, &inv.ExpiresAt, &inv.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("invitation not found: %w", err)
	}
	return &inv, nil
}

// IncrementInvitationUseCount bumps the use_count by 1.
func (db *Database) IncrementInvitationUseCount(ctx context.Context, invID string) error {
	_, err := db.Pool.Exec(ctx, "UPDATE org_invitations SET use_count = use_count + 1 WHERE id = $1", invID)
	return err
}

// ListInvitations returns all invitations for an org.
func (db *Database) ListInvitations(ctx context.Context, orgID string) ([]Invitation, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, org_id, inviter_id, COALESCE(email, ''), role, token, max_uses, use_count, expires_at, created_at
		 FROM org_invitations WHERE org_id = $1 ORDER BY created_at DESC`, orgID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invitations []Invitation
	for rows.Next() {
		var inv Invitation
		if err := rows.Scan(&inv.ID, &inv.OrgID, &inv.InviterID, &inv.Email, &inv.Role, &inv.Token, &inv.MaxUses, &inv.UseCount, &inv.ExpiresAt, &inv.CreatedAt); err != nil {
			return nil, err
		}
		invitations = append(invitations, inv)
	}
	return invitations, nil
}

// DeleteInvitation removes an invitation by ID (for revoking).
func (db *Database) DeleteInvitation(ctx context.Context, invID, orgID string) error {
	res, err := db.Pool.Exec(ctx, "DELETE FROM org_invitations WHERE id = $1 AND org_id = $2", invID, orgID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("invitation not found")
	}
	return nil
}

// CreateInviteLink inserts a new invite link.
func (db *Database) CreateInviteLink(ctx context.Context, link *InviteLink) error {
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO org_invite_links (org_id, creator_id, code, role, max_uses, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		link.OrgID, link.CreatorID, link.Code, link.Role, link.MaxUses, link.ExpiresAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create invite link: %w", err)
	}
	return nil
}

// GetInviteLinkByCode retrieves an invite link by its code.
func (db *Database) GetInviteLinkByCode(ctx context.Context, code string) (*InviteLink, error) {
	var link InviteLink
	err := db.Pool.QueryRow(ctx,
		`SELECT id, org_id, creator_id, code, role, max_uses, use_count, expires_at, active, created_at
		 FROM org_invite_links WHERE code = $1`, code,
	).Scan(&link.ID, &link.OrgID, &link.CreatorID, &link.Code, &link.Role, &link.MaxUses, &link.UseCount, &link.ExpiresAt, &link.Active, &link.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("invite link not found: %w", err)
	}
	return &link, nil
}

// GetInviteLinkInfo returns public-facing info for an invite link code.
func (db *Database) GetInviteLinkInfo(ctx context.Context, code string) (*InviteLinkInfo, error) {
	var info InviteLinkInfo
	err := db.Pool.QueryRow(ctx,
		`SELECT l.code, o.name, l.role
		 FROM org_invite_links l
		 JOIN organizations o ON o.id = l.org_id
		 WHERE l.code = $1 AND l.active = true`, code,
	).Scan(&info.Code, &info.OrgName, &info.Role)
	if err != nil {
		return nil, fmt.Errorf("invite link not found or inactive: %w", err)
	}
	return &info, nil
}

// IncrementInviteLinkUseCount bumps the use_count by 1.
func (db *Database) IncrementInviteLinkUseCount(ctx context.Context, linkID string) error {
	_, err := db.Pool.Exec(ctx, "UPDATE org_invite_links SET use_count = use_count + 1 WHERE id = $1", linkID)
	return err
}

// ListInviteLinks returns all invite links for an org.
func (db *Database) ListInviteLinks(ctx context.Context, orgID string) ([]InviteLink, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, org_id, creator_id, code, role, max_uses, use_count, expires_at, active, created_at
		 FROM org_invite_links WHERE org_id = $1 ORDER BY created_at DESC`, orgID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var links []InviteLink
	for rows.Next() {
		var link InviteLink
		if err := rows.Scan(&link.ID, &link.OrgID, &link.CreatorID, &link.Code, &link.Role, &link.MaxUses, &link.UseCount, &link.ExpiresAt, &link.Active, &link.CreatedAt); err != nil {
			return nil, err
		}
		links = append(links, link)
	}
	return links, nil
}

// DeactivateInviteLink sets an invite link to inactive.
func (db *Database) DeactivateInviteLink(ctx context.Context, linkID, orgID string) error {
	res, err := db.Pool.Exec(ctx, "UPDATE org_invite_links SET active = false WHERE id = $1 AND org_id = $2", linkID, orgID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("invite link not found")
	}
	return nil
}

// AddUserToOrg inserts a membership row linking a user to an org with a given role.
func (db *Database) AddUserToOrg(ctx context.Context, userID, orgID, role string) error {
	_, err := db.Pool.Exec(ctx,
		"INSERT INTO organization_memberships (user_id, org_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
		userID, orgID, role,
	)
	return err
}

// GetOrgName returns the name of an organization by ID.
func (db *Database) GetOrgName(ctx context.Context, orgID string) (string, error) {
	var name string
	err := db.Pool.QueryRow(ctx, "SELECT name FROM organizations WHERE id = $1", orgID).Scan(&name)
	return name, err
}

// GetDefaultChannels returns the IDs of non-private channels in an org (for auto-join).
func (db *Database) GetDefaultChannels(ctx context.Context, orgID string) ([]string, error) {
	rows, err := db.Pool.Query(ctx,
		"SELECT id FROM channels WHERE org_id = $1 AND is_private = false", orgID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// IsUserInOrg checks whether a user is already a member of an org.
func (db *Database) IsUserInOrg(ctx context.Context, userID, orgID string) (bool, error) {
	var count int
	err := db.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM organization_memberships WHERE user_id = $1 AND org_id = $2",
		userID, orgID,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
