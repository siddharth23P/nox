package messaging

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// CategoryHandler handles HTTP requests for channel categories.
type CategoryHandler struct {
	repo *CategoryRepo
}

// NewCategoryHandler creates a new CategoryHandler.
func NewCategoryHandler(repo *CategoryRepo) *CategoryHandler {
	return &CategoryHandler{repo: repo}
}

// CreateCategory handles POST /categories
func (h *CategoryHandler) CreateCategory(c *gin.Context) {
	orgID, _ := getAuthInfo(c)
	if orgID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization ID required"})
		return
	}

	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cat, err := h.repo.CreateCategory(c.Request.Context(), orgID, req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, cat)
}

// ListCategories handles GET /categories
func (h *CategoryHandler) ListCategories(c *gin.Context) {
	orgID, userID := getAuthInfo(c)
	if orgID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization ID required"})
		return
	}

	categories, err := h.repo.ListCategories(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if categories == nil {
		categories = []CategoryWithChannels{}
	}
	c.JSON(http.StatusOK, categories)
}

// UpdateCategory handles PATCH /categories/:categoryId
func (h *CategoryHandler) UpdateCategory(c *gin.Context) {
	orgID, _ := getAuthInfo(c)
	if orgID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization ID required"})
		return
	}

	categoryID := c.Param("categoryId")
	if categoryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category ID required"})
		return
	}

	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.UpdateCategory(c.Request.Context(), categoryID, req.Name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated", "category_id": categoryID})
}

// DeleteCategory handles DELETE /categories/:categoryId
func (h *CategoryHandler) DeleteCategory(c *gin.Context) {
	orgID, _ := getAuthInfo(c)
	if orgID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization ID required"})
		return
	}

	categoryID := c.Param("categoryId")
	if categoryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category ID required"})
		return
	}

	if err := h.repo.DeleteCategory(c.Request.Context(), categoryID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted", "category_id": categoryID})
}

// ReorderCategories handles PATCH /categories/reorder
func (h *CategoryHandler) ReorderCategories(c *gin.Context) {
	orgID, _ := getAuthInfo(c)
	if orgID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization ID required"})
		return
	}

	var req struct {
		Categories []CategoryOrder `json:"categories" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.ReorderCategories(c.Request.Context(), orgID, req.Categories); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "reordered"})
}

// SetChannelCategory handles PATCH /channels/:id/category
func (h *CategoryHandler) SetChannelCategory(c *gin.Context) {
	orgID, _ := getAuthInfo(c)
	if orgID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization ID required"})
		return
	}

	channelID := c.Param("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	var req struct {
		CategoryID *string `json:"category_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	categoryID := ""
	if req.CategoryID != nil {
		categoryID = *req.CategoryID
	}

	if err := h.repo.SetChannelCategory(c.Request.Context(), channelID, categoryID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated", "channel_id": channelID, "category_id": req.CategoryID})
}

// ReorderChannels handles PATCH /categories/:categoryId/channels/reorder
func (h *CategoryHandler) ReorderChannels(c *gin.Context) {
	orgID, _ := getAuthInfo(c)
	if orgID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization ID required"})
		return
	}

	categoryID := c.Param("categoryId")
	if categoryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category ID required"})
		return
	}

	var req struct {
		Channels []ChannelOrder `json:"channels" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.ReorderChannels(c.Request.Context(), categoryID, req.Channels); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "reordered"})
}
