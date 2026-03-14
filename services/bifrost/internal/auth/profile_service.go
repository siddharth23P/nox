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

// ProfileService handles user profile and preferences business logic.
type ProfileService struct {
	repo *db.Database
}

// NewProfileService creates a new ProfileService.
func NewProfileService(repo *db.Database) *ProfileService {
	return &ProfileService{repo: repo}
}

// GetProfile returns the user's profile.
func (s *ProfileService) GetProfile(ctx context.Context, userID string) (*db.UserProfile, error) {
	return s.repo.GetUserProfile(ctx, userID)
}

// UpdateProfile updates display_name and bio with validation.
func (s *ProfileService) UpdateProfile(ctx context.Context, userID, displayName, bio string) (*db.UserProfile, error) {
	// Validate display_name length
	if len(displayName) > 100 {
		return nil, errors.New("display name must be 100 characters or less")
	}

	// Validate bio length
	if len(bio) > 500 {
		return nil, errors.New("bio must be 500 characters or less")
	}

	err := s.repo.UpdateUserProfile(ctx, userID, displayName, bio)
	if err != nil {
		return nil, err
	}

	return s.repo.GetUserProfile(ctx, userID)
}

// UploadAvatar validates and saves an avatar image, returning the URL.
func (s *ProfileService) UploadAvatar(ctx context.Context, userID string, file multipart.File, header *multipart.FileHeader) (string, error) {
	// Validate file size (max 2MB)
	if header.Size > 2*1024*1024 {
		return "", errors.New("avatar must be 2MB or less")
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
		return "", errors.New("avatar must be JPEG, PNG, or WebP")
	}

	// Also validate by reading magic bytes
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
	uploadDir := "uploads/avatars"
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		return "", fmt.Errorf("failed to create upload directory: %w", err)
	}

	// Generate unique filename
	filename := fmt.Sprintf("%s-%s%s", userID, uuid.New().String()[:8], ext)
	filePath := filepath.Join(uploadDir, filename)

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to save avatar: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", fmt.Errorf("failed to write avatar: %w", err)
	}

	// Build URL (relative path served by static handler)
	avatarURL := fmt.Sprintf("/uploads/avatars/%s", filename)

	// Update DB
	if err := s.repo.UpdateUserAvatarURL(ctx, userID, avatarURL); err != nil {
		return "", err
	}

	return avatarURL, nil
}

// GetPreferences returns the user's preferences.
func (s *ProfileService) GetPreferences(ctx context.Context, userID string) (*db.UserPreferences, error) {
	return s.repo.GetUserPreferences(ctx, userID)
}

// UpdatePreferences updates the user's preferences.
func (s *ProfileService) UpdatePreferences(ctx context.Context, userID string, prefs map[string]interface{}) (*db.UserPreferences, error) {
	err := s.repo.UpdateUserPreferences(ctx, userID, prefs)
	if err != nil {
		return nil, err
	}
	return s.repo.GetUserPreferences(ctx, userID)
}

// isValidImage checks magic bytes for JPEG, PNG, or WebP.
func isValidImage(data []byte) bool {
	if len(data) < 4 {
		return false
	}

	// JPEG: FF D8 FF
	if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return true
	}

	// PNG: 89 50 4E 47
	if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
		return true
	}

	// WebP: RIFF....WEBP
	if len(data) >= 12 && strings.HasPrefix(string(data[:4]), "RIFF") && string(data[8:12]) == "WEBP" {
		return true
	}

	return false
}
