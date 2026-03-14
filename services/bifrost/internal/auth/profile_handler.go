package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ProfileHandler handles HTTP requests for user profiles and preferences.
type ProfileHandler struct {
	service *ProfileService
}

// NewProfileHandler creates a new ProfileHandler.
func NewProfileHandler(service *ProfileService) *ProfileHandler {
	return &ProfileHandler{service: service}
}

// GetMyProfile returns the current authenticated user's profile.
func (h *ProfileHandler) GetMyProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	profile, err := h.service.GetProfile(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get profile"})
		return
	}

	c.JSON(http.StatusOK, profile)
}

// UpdateMyProfile updates the current user's display_name and bio.
func (h *ProfileHandler) UpdateMyProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req struct {
		DisplayName string `json:"display_name"`
		Bio         string `json:"bio"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	profile, err := h.service.UpdateProfile(c.Request.Context(), userID, req.DisplayName, req.Bio)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, profile)
}

// UploadAvatar handles multipart avatar file upload.
func (h *ProfileHandler) UploadAvatar(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	file, header, err := c.Request.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "avatar file is required"})
		return
	}
	defer file.Close()

	avatarURL, err := h.service.UploadAvatar(c.Request.Context(), userID, file, header)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"avatar_url": avatarURL})
}

// GetUserProfile returns a public profile for any user by ID.
func (h *ProfileHandler) GetUserProfile(c *gin.Context) {
	userID := c.Param("userId")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user ID required"})
		return
	}

	profile, err := h.service.GetProfile(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Return public fields only (omit email)
	c.JSON(http.StatusOK, gin.H{
		"id":           profile.ID,
		"username":     profile.Username,
		"full_name":    profile.FullName,
		"display_name": profile.DisplayName,
		"bio":          profile.Bio,
		"avatar_url":   profile.AvatarURL,
		"created_at":   profile.CreatedAt,
	})
}

// GetMyPreferences returns the current user's preferences.
func (h *ProfileHandler) GetMyPreferences(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	prefs, err := h.service.GetPreferences(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get preferences"})
		return
	}

	c.JSON(http.StatusOK, prefs)
}

// UpdateMyPreferences updates the current user's preferences.
func (h *ProfileHandler) UpdateMyPreferences(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	prefs, err := h.service.UpdatePreferences(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, prefs)
}
