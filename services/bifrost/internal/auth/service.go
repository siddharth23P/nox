package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/nox-labs/bifrost/internal/db"
	pb "github.com/nox-labs/bifrost/pkg/authv1/auth/v1"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type AuthService struct {
	pb.UnimplementedAuthServiceServer
	jwtSecret          []byte
	repo               *db.Database
	googleConfig       *oauth2.Config
	githubConfig       *oauth2.Config
	orchestratorClient *OrchestratorClient
}

func NewAuthService(secret string, repo *db.Database) *AuthService {
	// Try to connect to Orchestrator (optional — degrades gracefully)
	orchestratorAddr := os.Getenv("ORCHESTRATOR_ADDR")
	if orchestratorAddr == "" {
		orchestratorAddr = "localhost:50052"
	}
	orchClient, err := NewOrchestratorClient(orchestratorAddr)
	if err != nil {
		fmt.Printf("[WARN] Could not connect to Orchestrator at %s: %v\n", orchestratorAddr, err)
		orchClient = nil
	}

	return &AuthService{
		jwtSecret:          []byte(secret),
		repo:               repo,
		orchestratorClient: orchClient,
		googleConfig: &oauth2.Config{
			ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
			ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
			RedirectURL:  "http://localhost:8080/v1/auth/google/callback",
			Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
			Endpoint:     google.Endpoint,
		},
		githubConfig: &oauth2.Config{
			ClientID:     os.Getenv("GITHUB_CLIENT_ID"),
			ClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
			RedirectURL:  "http://localhost:8080/v1/auth/github/callback",
			Scopes:       []string{"user:email"},
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://github.com/login/oauth/authorize",
				TokenURL: "https://github.com/login/oauth/access_token",
			},
		},
	}
}

func (s *AuthService) Register(ctx context.Context, req *pb.RegisterRequest) (*pb.RegisterResponse, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	verificationToken := generateSecureToken(32)

	userID, orgID, err := s.repo.CreateUserAndOrg(
		ctx, 
		req.Email, 
		req.Username,
		string(hashedPassword), 
		req.FullName, 
		req.OrgName,
		verificationToken,
		req.RecoveryQuestions,
	)
	if err != nil {
		return nil, err
	}

	// Mock Email Sending
	fmt.Printf("\n[EMAIL MOCK] Verification link for %s: http://localhost:5173/verify-email?token=%s\n\n", req.Email, verificationToken)

	// Note: We don't return a session token yet because email must be verified
	return &pb.RegisterResponse{
		UserId: userID,
		OrgId:  orgID,
		Token:  "", // Enforce verification before token issuance
	}, nil
}

func (s *AuthService) Login(ctx context.Context, req *pb.LoginRequest) (*pb.LoginResponse, error) {
	user, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	if !user.IsEmailVerified {
		return nil, errors.New("please verify your email before logging in")
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	var orgID string
	var role string
	err = s.repo.Pool.QueryRow(ctx, "SELECT org_id, role FROM organization_memberships WHERE user_id = $1 LIMIT 1", user.ID).Scan(&orgID, &role)
	if err != nil {
		return nil, errors.New("failed to retrieve organization context")
	}

	token, err := s.generateToken(user.ID, orgID, role)
	if err != nil {
		return nil, err
	}

	return &pb.LoginResponse{
		UserId:   user.ID,
		Token:    token,
		OrgId:    orgID,
		Email:    user.Email,
		FullName: user.FullName,
		Role:     role,
	}, nil
}

func (s *AuthService) VerifyEmail(ctx context.Context, req *pb.VerifyEmailRequest) (*pb.VerifyEmailResponse, error) {
	success, err := s.repo.VerifyEmailToken(ctx, req.Token)
	if err != nil {
		return nil, err
	}

	if !success {
		return &pb.VerifyEmailResponse{Success: false, Message: "Invalid or expired token"}, nil
	}

	return &pb.VerifyEmailResponse{Success: true, Message: "Email verified successfully"}, nil
}

func (s *AuthService) generateToken(userID, orgID, role string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"org_id":  orgID,
		"role":    role,
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *AuthService) VerifySession(ctx context.Context, req *pb.VerifySessionRequest) (*pb.VerifySessionResponse, error) {
	token, err := jwt.Parse(req.Token, func(token *jwt.Token) (interface{}, error) {
		return s.jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return &pb.VerifySessionResponse{Valid: false}, nil
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return &pb.VerifySessionResponse{Valid: false}, nil
	}

	role, _ := claims["role"].(string)

	return &pb.VerifySessionResponse{
		Valid:    true,
		UserId:   claims["user_id"].(string),
		TenantId: claims["org_id"].(string),
		Role:     role,
	}, nil
}

func (s *AuthService) GetGoogleAuthURL() string {
	return s.googleConfig.AuthCodeURL("state")
}

func (s *AuthService) HandleGoogleCallback(ctx context.Context, code string) (*pb.LoginResponse, error) {
	tok, err := s.googleConfig.Exchange(ctx, code)
	if err != nil {
		return nil, err
	}

	client := s.googleConfig.Client(ctx, tok)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var profile struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, err
	}

	// OAuth users are auto-verified
	return s.provisionOAuthUser(ctx, profile.Email, profile.Name)
}

func (s *AuthService) GetGithubAuthURL() string {
	return s.githubConfig.AuthCodeURL("state")
}

func (s *AuthService) HandleGithubCallback(ctx context.Context, code string) (*pb.LoginResponse, error) {
	tok, err := s.githubConfig.Exchange(ctx, code)
	if err != nil {
		return nil, err
	}

	client := s.githubConfig.Client(ctx, tok)
	resp, err := client.Get("https://api.github.com/user")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var profile struct {
		Email string `json:"email"`
		Name  string `json:"name"`
		Login string `json:"login"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, err
	}

	email := profile.Email
	if email == "" {
		email = profile.Login + "@github.com"
	}
	name := profile.Name
	if name == "" {
		name = profile.Login
	}

	return s.provisionOAuthUser(ctx, email, name)
}

func (s *AuthService) provisionOAuthUser(ctx context.Context, email, name string) (*pb.LoginResponse, error) {
	user, err := s.repo.GetUserByEmail(ctx, email)
	var userID, orgID, role string

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// User doesn't exist, create it
			hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("oauth_placeholder"), bcrypt.DefaultCost)
			// OAuth users have verified=true and username=email
			userID, orgID, err = s.repo.CreateUserAndOrg(ctx, email, email, string(hashedPassword), name, "Personal", "", nil)
			if err != nil {
				return nil, err
			}
			// Mark as verified immediately
			_, _ = s.repo.Pool.Exec(ctx, "UPDATE users SET is_email_verified = TRUE WHERE id = $1", userID)
		} else {
			return nil, err
		}
	} else {
		userID = user.ID
		err = s.repo.Pool.QueryRow(ctx, "SELECT org_id, role FROM organization_memberships WHERE user_id = $1 LIMIT 1", user.ID).Scan(&orgID, &role)
		if err != nil {
			return nil, errors.New("failed to retrieve organization context")
		}
	}

	token, err := s.generateToken(userID, orgID, role)
	if err != nil {
		return nil, err
	}

	return &pb.LoginResponse{
		UserId:   userID,
		OrgId:    orgID,
		Token:    token,
		Email:    email,
		FullName: name,
		Role:     role,
	}, nil
}

func (s *AuthService) VerifyZKProof(ctx context.Context, userID, orgID, proof string) (bool, error) {
	if s.orchestratorClient == nil {
		return false, errors.New("orchestrator not available")
	}
	return s.orchestratorClient.VerifyZKIdentity(ctx, userID, orgID, proof)
}

type OrgResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
	Role string `json:"role"`
}

func (s *AuthService) ListOrganizations(ctx context.Context, userID string) ([]OrgResponse, error) {
	memberships, err := s.repo.ListUserOrganizations(ctx, userID)
	if err != nil {
		return nil, err
	}

	orgs := make([]OrgResponse, len(memberships))
	for i, m := range memberships {
		orgs[i] = OrgResponse{
			ID:   m.OrgID,
			Name: m.OrgName,
			Slug: m.OrgSlug,
			Role: m.Role,
		}
	}
	return orgs, nil
}

type SwitchOrgResponse struct {
	Token  string `json:"token"`
	OrgID  string `json:"org_id"`
	Role   string `json:"role"`
}

func (s *AuthService) SwitchOrganization(ctx context.Context, userID, orgID string) (*SwitchOrgResponse, error) {
	role, err := s.repo.GetUserOrgRole(ctx, userID, orgID)
	if err != nil {
		return nil, errors.New("you are not a member of this organization")
	}

	token, err := s.generateToken(userID, orgID, role)
	if err != nil {
		return nil, err
	}

	return &SwitchOrgResponse{
		Token: token,
		OrgID: orgID,
		Role:  role,
	}, nil
}

func generateSecureToken(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}
