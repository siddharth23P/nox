package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type RecoveryHandler struct {
	service *RecoveryService
}

func NewRecoveryHandler(service *RecoveryService) *RecoveryHandler {
	return &RecoveryHandler{service: service}
}

func (h *RecoveryHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
		return
	}

	err := h.service.ForgotPassword(c.Request.Context(), req.Email)
	if err != nil {
		// Rate limit error
		if err.Error() == "too many reset requests, please try again later" {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Always return success to prevent email enumeration
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "If an account exists with that email, a reset link has been sent.",
	})
}

func (h *RecoveryHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token and new_password are required"})
		return
	}

	err := h.service.ResetPassword(c.Request.Context(), req.Token, req.NewPassword)
	if err != nil {
		status := http.StatusBadRequest
		if err.Error() == "invalid or expired reset token" {
			status = http.StatusUnauthorized
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Password has been reset successfully.",
	})
}

func (h *RecoveryHandler) Recover(c *gin.Context) {
	var req struct {
		Email   string             `json:"email" binding:"required"`
		Answers []RecoveryQuestion `json:"answers" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and answers are required"})
		return
	}

	token, err := h.service.Recover(c.Request.Context(), req.Email, req.Answers)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"reset_token": token,
		"message":     "Security questions verified. Use the reset_token to set a new password.",
	})
}
