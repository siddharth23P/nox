package auth

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/nox-labs/bifrost/internal/db"
)

// OrgService handles business logic for organization settings and member management.
type OrgService struct {
	repo *db.Database
}

// NewOrgService creates a new OrgService.
func NewOrgService(repo *db.Database) *OrgService {
	return &OrgService{repo: repo}
}

// GetSettings returns the full org settings.
func (s *OrgService) GetSettings(ctx context.Context, orgID string) (*db.OrgSettings, error) {
	return s.repo.GetOrgSettings(ctx, orgID)
}

// UpdateSettings updates org name and description with validation.
func (s *OrgService) UpdateSettings(ctx context.Context, orgID, callerID, name, description string) (*db.OrgSettings, error) {
	// Check caller is admin or owner
	if err := s.requireAdminOrOwner(ctx, orgID, callerID); err != nil {
		return nil, err
	}

	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("organization name is required")
	}
	if len(name) > 100 {
		return nil, errors.New("organization name must be 100 characters or less")
	}
	if len(description) > 500 {
		return nil, errors.New("description must be 500 characters or less")
	}

	if err := s.repo.UpdateOrgSettings(ctx, orgID, name, description); err != nil {
		return nil, fmt.Errorf("failed to update org settings: %w", err)
	}

	return s.repo.GetOrgSettings(ctx, orgID)
}

// UploadLogo validates and saves an org logo, returning the URL.
func (s *OrgService) UploadLogo(ctx context.Context, orgID, callerID string, file multipart.File, header *multipart.FileHeader) (string, error) {
	// Check caller is admin or owner
	if err := s.requireAdminOrOwner(ctx, orgID, callerID); err != nil {
		return "", err
	}

	// Validate file size (max 2MB)
	if header.Size > 2*1024*1024 {
		return "", errors.New("logo must be 2MB or less")
	}

	// Validate content type
	contentType := header.Header.Get("Content-Type")
	validTypes := map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/webp": ".webp",
	}

	ext, ok := validTypes[contentType]
	if !ok {
		return "", errors.New("logo must be JPEG, PNG, or WebP")
	}

	// Validate magic bytes
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		return "", errors.New("failed to read file")
	}
	buf = buf[:n]

	if !isValidImage(buf) {
		return "", errors.New("file does not appear to be a valid image")
	}

	// Seek back to beginning
	if seeker, ok := file.(io.Seeker); ok {
		if _, err := seeker.Seek(0, io.SeekStart); err != nil {
			return "", errors.New("failed to process file")
		}
	}

	// Create uploads directory
	uploadDir := "uploads/logos"
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		return "", fmt.Errorf("failed to create upload directory: %w", err)
	}

	// Generate unique filename
	filename := fmt.Sprintf("%s-%s%s", orgID, uuid.New().String()[:8], ext)
	filePath := filepath.Join(uploadDir, filename)

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to save logo: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", fmt.Errorf("failed to write logo: %w", err)
	}

	// Build URL
	logoURL := fmt.Sprintf("/uploads/logos/%s", filename)

	// Update DB
	if err := s.repo.UpdateOrgLogoURL(ctx, orgID, logoURL); err != nil {
		return "", err
	}

	return logoURL, nil
}

// ListMembers returns org members with search and pagination.
func (s *OrgService) ListMembers(ctx context.Context, orgID, search string, limit, offset int) ([]db.OrgMember, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	members, total, err := s.repo.ListOrgMembers(ctx, orgID, search, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list members: %w", err)
	}
	if members == nil {
		members = []db.OrgMember{}
	}
	return members, total, nil
}

// ChangeMemberRole changes a member's role in the organization.
func (s *OrgService) ChangeMemberRole(ctx context.Context, orgID, callerID, targetUserID, newRole string) error {
	// Check caller is admin or owner
	if err := s.requireAdminOrOwner(ctx, orgID, callerID); err != nil {
		return err
	}

	// Cannot change own role
	if callerID == targetUserID {
		return errors.New("cannot change your own role")
	}

	// Validate the new role
	validRoles := map[string]bool{
		"owner": true, "admin": true, "member": true, "guest": true,
	}
	if !validRoles[newRole] {
		return fmt.Errorf("invalid role: %s", newRole)
	}

	// Only owners can assign the owner role
	callerRole, err := s.repo.GetMemberRole(ctx, orgID, callerID)
	if err != nil {
		return errors.New("failed to check caller role")
	}
	if newRole == "owner" && callerRole != "owner" {
		return errors.New("only owners can assign the owner role")
	}

	// Admins cannot change owners
	targetRole, err := s.repo.GetMemberRole(ctx, orgID, targetUserID)
	if err != nil {
		return errors.New("target member not found")
	}
	if targetRole == "owner" && callerRole != "owner" {
		return errors.New("cannot change the role of an owner")
	}

	return s.repo.UpdateMemberRole(ctx, orgID, targetUserID, newRole)
}

// RemoveMember removes a member from the organization.
func (s *OrgService) RemoveMember(ctx context.Context, orgID, callerID, targetUserID string) error {
	// Check caller is admin or owner
	if err := s.requireAdminOrOwner(ctx, orgID, callerID); err != nil {
		return err
	}

	// Cannot remove yourself
	if callerID == targetUserID {
		return errors.New("cannot remove yourself from the organization")
	}

	// Check hierarchy: admins cannot remove owners
	callerRole, err := s.repo.GetMemberRole(ctx, orgID, callerID)
	if err != nil {
		return errors.New("failed to check caller role")
	}
	targetRole, err := s.repo.GetMemberRole(ctx, orgID, targetUserID)
	if err != nil {
		return errors.New("target member not found")
	}
	if targetRole == "owner" && callerRole != "owner" {
		return errors.New("cannot remove an owner")
	}

	return s.repo.RemoveOrgMember(ctx, orgID, targetUserID)
}

// requireAdminOrOwner checks that the caller has admin or owner role.
func (s *OrgService) requireAdminOrOwner(ctx context.Context, orgID, userID string) error {
	role, err := s.repo.GetMemberRole(ctx, orgID, userID)
	if err != nil {
		return errors.New("not a member of this organization")
	}
	if role != "owner" && role != "admin" {
		return errors.New("insufficient permissions: admin or owner role required")
	}
	return nil
}
