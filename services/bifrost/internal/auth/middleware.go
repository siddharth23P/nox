package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	pb "github.com/nox-labs/bifrost/pkg/authv1/auth/v1"
)

// AuthMiddleware creates a gin middleware that authenticates requests and optionally checks for a required role.
func AuthMiddleware(service *AuthService, requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header missing"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization formatting"})
			return
		}

		token := parts[1]
		
		req := &pb.VerifySessionRequest{Token: token}
		resp, err := service.VerifySession(context.Background(), req)
		if err != nil || !resp.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// Inject user and tenant details into context for downstream handlers
		c.Set("user_id", resp.UserId)
		c.Set("tenant_id", resp.TenantId)
		c.Set("role", resp.Role)

		// Enforce RBAC if a specific role is required
		if requiredRole != "" && resp.Role != requiredRole {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			return
		}

		c.Next()
	}
}
