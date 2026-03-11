package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAuthMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	service := &AuthService{
		jwtSecret: []byte("super-secret-test-key"),
	}

	token, _ := service.generateToken("usr1", "org1", "admin")
	memberToken, _ := service.generateToken("usr2", "org1", "member")

	tests := []struct {
		name         string
		setupHeader  func(req *http.Request)
		requiredRole string
		expectedCode int
	}{
		{
			name: "No Header",
			setupHeader: func(req *http.Request) {},
			requiredRole: "",
			expectedCode: http.StatusUnauthorized,
		},
		{
			name: "Invalid Header Format",
			setupHeader: func(req *http.Request) {
				req.Header.Set("Authorization", "InvalidFormat " + token)
			},
			requiredRole: "",
			expectedCode: http.StatusUnauthorized,
		},
		{
			name: "Valid Token No Role Required",
			setupHeader: func(req *http.Request) {
				req.Header.Set("Authorization", "Bearer " + token)
			},
			requiredRole: "",
			expectedCode: http.StatusOK,
		},
		{
			name: "Valid Token Sufficient Role",
			setupHeader: func(req *http.Request) {
				req.Header.Set("Authorization", "Bearer " + token)
			},
			requiredRole: "admin",
			expectedCode: http.StatusOK,
		},
		{
			name: "Valid Token Insufficient Role",
			setupHeader: func(req *http.Request) {
				req.Header.Set("Authorization", "Bearer " + memberToken)
			},
			requiredRole: "admin",
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			_, engine := gin.CreateTestContext(w)
			
			engine.Use(AuthMiddleware(service, tc.requiredRole))
			engine.GET("/test", func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			tc.setupHeader(req)
			
			engine.ServeHTTP(w, req)

			if w.Code != tc.expectedCode {
				t.Errorf("expected status %d but got %d", tc.expectedCode, w.Code)
			}
		})
	}
}
