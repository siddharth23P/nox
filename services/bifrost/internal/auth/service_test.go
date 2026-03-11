package auth

import (
	"context"
	"testing"

	pb "github.com/nox-labs/bifrost/pkg/authv1/auth/v1"
)

func TestTokenGenerationAndVerification(t *testing.T) {
	service := &AuthService{
		jwtSecret: []byte("test-secret"),
	}

	userID := "user-123"
	orgID := "org-456"
	role := "admin"

	// 1. Generate token
	token, err := service.generateToken(userID, orgID, role)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	// 2. Verify token
	req := &pb.VerifySessionRequest{Token: token}
	resp, err := service.VerifySession(context.Background(), req)
	if err != nil {
		t.Fatalf("Failed to verify session: %v", err)
	}

	if !resp.Valid {
		t.Errorf("Expected token to be valid")
	}
	if resp.UserId != userID {
		t.Errorf("Expected user ID %s, got %s", userID, resp.UserId)
	}
	if resp.TenantId != orgID {
		t.Errorf("Expected org ID %s, got %s", orgID, resp.TenantId)
	}
	if resp.Role != role {
		t.Errorf("Expected role %s, got %s", role, resp.Role)
	}
}

func TestVerifyInvalidToken(t *testing.T) {
	service := &AuthService{
		jwtSecret: []byte("test-secret"),
	}

	req := &pb.VerifySessionRequest{Token: "invalid-token-string"}
	resp, err := service.VerifySession(context.Background(), req)
	if err != nil {
		// It might not return an error but instead Valid = false
	}
	if resp != nil && resp.Valid {
		t.Errorf("Expected token to be invalid")
	}
}
