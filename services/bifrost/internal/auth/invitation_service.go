package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/nox-labs/bifrost/internal/db"
)

// InvitationService handles business logic for org invitations and invite links.
type InvitationService struct {
	repo *db.Database
}

// NewInvitationService creates a new InvitationService.
func NewInvitationService(repo *db.Database) *InvitationService {
	return &InvitationService{repo: repo}
}

// CreateEmailInvitation creates an email-based invitation and logs the token (dev mock).
func (s *InvitationService) CreateEmailInvitation(ctx context.Context, orgID, inviterID, email, role string, maxUses *int, expiresAt *time.Time) (*db.Invitation, error) {
	if role != "member" && role != "guest" {
		return nil, errors.New("role must be 'member' or 'guest'")
	}

	token := generateInviteToken(32)
	inv := &db.Invitation{
		OrgID:     orgID,
		InviterID: inviterID,
		Email:     email,
		Role:      role,
		Token:     token,
		MaxUses:   maxUses,
		ExpiresAt: expiresAt,
	}

	if err := s.repo.CreateInvitation(ctx, inv); err != nil {
		return nil, err
	}

	// Mock email — log the invite link
	fmt.Printf("\n[EMAIL MOCK] Invitation for %s to join org %s: http://localhost:5173/join/accept?token=%s\n\n", email, orgID, token)

	inv.Token = token
	return inv, nil
}

// AcceptEmailInvitation accepts an email invitation and adds the user to the org.
func (s *InvitationService) AcceptEmailInvitation(ctx context.Context, token, userID string) (string, string, error) {
	inv, err := s.repo.GetInvitationByToken(ctx, token)
	if err != nil {
		return "", "", errors.New("invalid invitation token")
	}

	// Check expiry
	if inv.ExpiresAt != nil && time.Now().After(*inv.ExpiresAt) {
		return "", "", errors.New("invitation has expired")
	}

	// Check max uses
	if inv.MaxUses != nil && inv.UseCount >= *inv.MaxUses {
		return "", "", errors.New("invitation has reached its maximum uses")
	}

	// Check if already a member
	isMember, err := s.repo.IsUserInOrg(ctx, userID, inv.OrgID)
	if err != nil {
		return "", "", fmt.Errorf("failed to check membership: %w", err)
	}
	if isMember {
		return inv.OrgID, inv.Role, nil
	}

	// Add user to org
	if err := s.repo.AddUserToOrg(ctx, userID, inv.OrgID, inv.Role); err != nil {
		return "", "", fmt.Errorf("failed to join org: %w", err)
	}

	// Increment use count
	if err := s.repo.IncrementInvitationUseCount(ctx, inv.ID); err != nil {
		fmt.Printf("[WARN] Failed to increment invitation use count: %v\n", err)
	}

	return inv.OrgID, inv.Role, nil
}

// CreateInviteLink generates a shareable invite link.
func (s *InvitationService) CreateInviteLink(ctx context.Context, orgID, creatorID, role string, maxUses *int, expiresAt *time.Time) (*db.InviteLink, error) {
	if role != "member" && role != "guest" {
		return nil, errors.New("role must be 'member' or 'guest'")
	}

	code := generateInviteCode(8)
	link := &db.InviteLink{
		OrgID:     orgID,
		CreatorID: creatorID,
		Code:      code,
		Role:      role,
		MaxUses:   maxUses,
		ExpiresAt: expiresAt,
		Active:    true,
	}

	if err := s.repo.CreateInviteLink(ctx, link); err != nil {
		return nil, err
	}

	link.Code = code
	return link, nil
}

// GetInviteLinkInfo returns public info about an invite link.
func (s *InvitationService) GetInviteLinkInfo(ctx context.Context, code string) (*db.InviteLinkInfo, error) {
	return s.repo.GetInviteLinkInfo(ctx, code)
}

// JoinViaLink accepts an invite link and adds the user to the org.
func (s *InvitationService) JoinViaLink(ctx context.Context, code, userID string) (string, string, error) {
	link, err := s.repo.GetInviteLinkByCode(ctx, code)
	if err != nil {
		return "", "", errors.New("invalid invite code")
	}

	if !link.Active {
		return "", "", errors.New("invite link is no longer active")
	}

	// Check expiry
	if link.ExpiresAt != nil && time.Now().After(*link.ExpiresAt) {
		return "", "", errors.New("invite link has expired")
	}

	// Check max uses
	if link.MaxUses != nil && link.UseCount >= *link.MaxUses {
		return "", "", errors.New("invite link has reached its maximum uses")
	}

	// Check if already a member
	isMember, err := s.repo.IsUserInOrg(ctx, userID, link.OrgID)
	if err != nil {
		return "", "", fmt.Errorf("failed to check membership: %w", err)
	}
	if isMember {
		return link.OrgID, link.Role, nil
	}

	// Add user to org
	if err := s.repo.AddUserToOrg(ctx, userID, link.OrgID, link.Role); err != nil {
		return "", "", fmt.Errorf("failed to join org: %w", err)
	}

	// Increment use count
	if err := s.repo.IncrementInviteLinkUseCount(ctx, link.ID); err != nil {
		fmt.Printf("[WARN] Failed to increment invite link use count: %v\n", err)
	}

	return link.OrgID, link.Role, nil
}

// ListInvitations returns all invitations for an org.
func (s *InvitationService) ListInvitations(ctx context.Context, orgID string) ([]db.Invitation, error) {
	return s.repo.ListInvitations(ctx, orgID)
}

// ListInviteLinks returns all invite links for an org.
func (s *InvitationService) ListInviteLinks(ctx context.Context, orgID string) ([]db.InviteLink, error) {
	return s.repo.ListInviteLinks(ctx, orgID)
}

// RevokeInvitation deletes an email invitation.
func (s *InvitationService) RevokeInvitation(ctx context.Context, invID, orgID string) error {
	return s.repo.DeleteInvitation(ctx, invID, orgID)
}

// RevokeInviteLink deactivates an invite link.
func (s *InvitationService) RevokeInviteLink(ctx context.Context, linkID, orgID string) error {
	return s.repo.DeactivateInviteLink(ctx, linkID, orgID)
}

// generateInviteToken generates a cryptographically secure hex token.
func generateInviteToken(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

// generateInviteCode generates a short alphanumeric invite code.
func generateInviteCode(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, length)
	for i := range result {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return ""
		}
		result[i] = charset[n.Int64()]
	}
	return string(result)
}
