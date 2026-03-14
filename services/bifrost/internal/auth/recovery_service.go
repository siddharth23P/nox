package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/nox-labs/bifrost/internal/db"
	"golang.org/x/crypto/bcrypt"
)

type RecoveryService struct {
	repo *db.Database
}

func NewRecoveryService(repo *db.Database) *RecoveryService {
	return &RecoveryService{repo: repo}
}

// ForgotPassword generates a reset token and logs it (mock email).
// Rate limited to 3 requests per hour per email.
func (s *RecoveryService) ForgotPassword(ctx context.Context, email string) error {
	// Always return success to prevent email enumeration
	if !s.repo.EmailExists(ctx, email) {
		return nil
	}

	// Check rate limit
	count, err := s.repo.CheckResetRateLimit(ctx, email)
	if err != nil {
		return errors.New("internal error")
	}
	if count >= 3 {
		return errors.New("too many reset requests, please try again later")
	}

	// Generate secure token
	rawToken := generateSecureToken(32)
	tokenHash := hashToken(rawToken)

	// Store hashed token in DB
	if err := s.repo.StorePasswordResetToken(ctx, email, tokenHash); err != nil {
		return errors.New("internal error")
	}

	// Increment rate limit counter
	if err := s.repo.IncrementResetRequestCount(ctx, email); err != nil {
		return errors.New("internal error")
	}

	// Mock email — log the reset link
	fmt.Printf("\n[EMAIL MOCK] Password reset link for %s: http://localhost:5173/reset-password?token=%s\n\n", email, rawToken)

	return nil
}

// ResetPassword validates the token and sets the new password.
func (s *RecoveryService) ResetPassword(ctx context.Context, token, newPassword string) error {
	if token == "" || newPassword == "" {
		return errors.New("token and new password are required")
	}

	if len(newPassword) < 8 {
		return errors.New("password must be at least 8 characters")
	}

	tokenHash := hashToken(token)

	userID, err := s.repo.ValidateResetToken(ctx, tokenHash)
	if err != nil {
		return errors.New("invalid or expired reset token")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("internal error")
	}

	if err := s.repo.UpdatePasswordAndClearToken(ctx, userID, string(hashedPassword)); err != nil {
		return errors.New("internal error")
	}

	return nil
}

type RecoveryQuestion struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// Recover validates security question answers and generates a reset token.
func (s *RecoveryService) Recover(ctx context.Context, email string, answers []RecoveryQuestion) (string, error) {
	if email == "" || len(answers) == 0 {
		return "", errors.New("email and answers are required")
	}

	userID, rqJSON, err := s.repo.GetRecoveryQuestions(ctx, email)
	if err != nil {
		return "", errors.New("invalid email")
	}

	var storedQuestions []RecoveryQuestion
	if err := json.Unmarshal([]byte(rqJSON), &storedQuestions); err != nil {
		return "", errors.New("account recovery not configured")
	}

	if len(storedQuestions) == 0 {
		return "", errors.New("account recovery not configured")
	}

	// Validate answers (case-insensitive)
	for _, answer := range answers {
		matched := false
		for _, stored := range storedQuestions {
			if stored.Question == answer.Question &&
				strings.EqualFold(strings.TrimSpace(stored.Answer), strings.TrimSpace(answer.Answer)) {
				matched = true
				break
			}
		}
		if !matched {
			return "", errors.New("incorrect recovery answers")
		}
	}

	// Generate reset token
	rawToken := generateSecureToken(32)
	tokenHash := hashToken(rawToken)

	if err := s.repo.StorePasswordResetToken(ctx, email, tokenHash); err != nil {
		return "", errors.New("internal error")
	}

	_ = userID // validated user exists

	fmt.Printf("\n[RECOVERY] Reset token generated for %s via security questions\n\n", email)

	return rawToken, nil
}

// hashToken returns a SHA-256 hex digest of the raw token.
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
