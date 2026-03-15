package main

import (
	"fmt"
	"log"
	"net"
	"os"

	"github.com/joho/godotenv"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/nox-labs/bifrost/internal/auth"
	"github.com/nox-labs/bifrost/internal/db"
	"github.com/nox-labs/bifrost/internal/ephemeral"
	"github.com/nox-labs/bifrost/internal/messaging"
	"github.com/nox-labs/bifrost/internal/notification"
	"github.com/nox-labs/bifrost/internal/presence"
	pb "github.com/nox-labs/bifrost/pkg/authv1/auth/v1"
	"google.golang.org/grpc"
	"context"
)

func main() {
	// Try loading from multiple possible locations
	godotenv.Load(".env")
	godotenv.Load("../.env")
	godotenv.Load("../../.env")
	godotenv.Load("/Users/serpent/Workspace/nox/.env")

	port := os.Getenv("PORT")
	if port == "" {
		port = "50051"
	}

	httpPort := os.Getenv("HTTP_PORT")
	if httpPort == "" {
		httpPort = "8080"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "nox_default_secret_2026"
	}

	ctx := context.Background()
	database, err := db.NewDatabase(ctx)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer database.Close()

	// 1. Initialize Auth Service
	authService := auth.NewAuthService(jwtSecret, database)
	
	// Initialize ephemeral state store (in-memory; swap for Redis later).
	ephemeralStore := ephemeral.NewMemoryStore()

	// Initialize Presence Service backed by ephemeral store (must be created
	// before the hub so we can wire the disconnect callback).
	presenceService := presence.NewPresenceServiceWithStore(ephemeralStore)

	// Initialize WebSocket Hub with ephemeral store for typing indicators.
	hub := messaging.NewHub()
	hub.Ephemeral = ephemeralStore
	hub.OnDisconnect = func(userID string) {
		presenceService.RemoveUser(userID)
	}
	go hub.Run()

	// Initialize Messaging & Reaction Service (with ephemeral message cache)
	reactionService := messaging.NewReactionService(hub)
	messagingService := messaging.NewMessagingServiceWithCache(database, reactionService, hub, ephemeralStore)

	// 2. Start gRPC Server
	go func() {
		lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
		if err != nil {
			log.Fatalf("failed to listen: %v", err)
		}
		s := grpc.NewServer()
		pb.RegisterAuthServiceServer(s, authService)
		log.Printf("Bifrost gRPC starting on port %s", port)
		if err := s.Serve(lis); err != nil {
			log.Fatalf("failed to serve: %v", err)
		}
	}()

	// 3. Start Gin REST Gateway
	r := gin.Default()
	
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = append(config.AllowHeaders, "X-Org-ID", "X-User-ID", "Authorization")
	r.Use(cors.New(config))
	
	authHandler := auth.NewAuthHandler(authService)
	recoveryService := auth.NewRecoveryService(database)
	recoveryHandler := auth.NewRecoveryHandler(recoveryService)
	profileService := auth.NewProfileService(database)
	profileHandler := auth.NewProfileHandler(profileService)
	invitationService := auth.NewInvitationService(database)
	invitationHandler := auth.NewInvitationHandler(invitationService)
	rbacService := auth.NewRBACService(database)
	rbacHandler := auth.NewRBACHandler(rbacService)
	friendService := auth.NewFriendService(database)
	friendHandler := auth.NewFriendHandler(friendService)
	orgService := auth.NewOrgService(database)
	orgHandler := auth.NewOrgHandler(orgService)
	messagingHandler := messaging.NewMessagingHandler(messagingService, hub)
	categoryRepo := messaging.NewCategoryRepo(database)
	categoryHandler := messaging.NewCategoryHandler(categoryRepo)
	presenceHandler := presence.NewPresenceHandler(presenceService)
	notificationService := notification.NewService(database)
	notificationHandler := notification.NewHandler(notificationService)

	// Serve uploaded avatars as static files
	r.Static("/uploads", "./uploads")

	v1 := r.Group("/v1")
	{
		// Auth Routes
		v1.POST("/auth/register", authHandler.Register)
		v1.POST("/auth/login", authHandler.Login)
		v1.GET("/auth/google", authHandler.GoogleLogin)
		v1.GET("/auth/google/callback", authHandler.GoogleCallback)
		v1.GET("/auth/github", authHandler.GithubLogin)
		v1.GET("/auth/github/callback", authHandler.GithubCallback)
		v1.GET("/auth/verify", authHandler.VerifyEmail)
		v1.POST("/auth/forgot-password", recoveryHandler.ForgotPassword)
		v1.POST("/auth/reset-password", recoveryHandler.ResetPassword)
		v1.POST("/auth/recover", recoveryHandler.Recover)
		v1.POST("/zk/verify", authHandler.VerifyZKProof)

		// Public invitation routes (no auth for viewing link info)
		v1.GET("/join/:code", invitationHandler.GetInviteLinkInfo)

		// Authenticated routes (require JWT)
		authenticated := v1.Group("")
		authenticated.Use(auth.AuthMiddleware(authService, ""))
		{
			// Organization Routes
			authenticated.GET("/orgs", authHandler.ListOrganizations)
			authenticated.POST("/orgs", orgHandler.CreateOrganization)
			authenticated.POST("/orgs/:orgId/switch", authHandler.SwitchOrganization)

			// Profile Routes (Issue #26)
			authenticated.GET("/users/me", profileHandler.GetMyProfile)
			authenticated.PATCH("/users/me", profileHandler.UpdateMyProfile)
			authenticated.POST("/users/me/avatar", profileHandler.UploadAvatar)
			authenticated.GET("/users/:userId", profileHandler.GetUserProfile)
			authenticated.GET("/users/me/preferences", profileHandler.GetMyPreferences)
			authenticated.PATCH("/users/me/preferences", profileHandler.UpdateMyPreferences)

			// Invitation Routes (admin+)
			authenticated.POST("/orgs/:orgId/invitations", invitationHandler.CreateInvitation)
			authenticated.POST("/orgs/:orgId/invite-links", invitationHandler.CreateInviteLink)
			authenticated.GET("/orgs/:orgId/invitations", invitationHandler.ListInvitations)
			authenticated.DELETE("/orgs/:orgId/invitations/:inviteId", invitationHandler.RevokeInvitation)
			authenticated.DELETE("/orgs/:orgId/invite-links/:linkId", invitationHandler.RevokeInviteLink)

			// Accept invitations (auth required — user must be logged in)
			authenticated.POST("/invitations/:token/accept", invitationHandler.AcceptInvitation)
			authenticated.POST("/join/:code", invitationHandler.JoinViaLink)

			// RBAC Routes (Issue #64)
			authenticated.GET("/orgs/:orgId/roles", rbacHandler.ListRoles)
			authenticated.POST("/orgs/:orgId/roles", rbacHandler.CreateRole)
			authenticated.PATCH("/orgs/:orgId/roles/:roleId", rbacHandler.UpdateRole)
			authenticated.DELETE("/orgs/:orgId/roles/:roleId", rbacHandler.DeleteRole)
			authenticated.POST("/orgs/:orgId/members/:userId/roles", rbacHandler.AssignRole)
			authenticated.DELETE("/orgs/:orgId/members/:userId/roles/:roleId", rbacHandler.RemoveRole)
			authenticated.GET("/orgs/:orgId/members/:userId/permissions", rbacHandler.GetEffectivePermissions)
			authenticated.GET("/permissions/schema", rbacHandler.GetPermissionSchema)

			// Friend System Routes (Issue #61)
			authenticated.POST("/friends/request", friendHandler.SendFriendRequest)
			authenticated.POST("/friends/:id/accept", friendHandler.AcceptFriendRequest)
			authenticated.POST("/friends/:id/decline", friendHandler.DeclineFriendRequest)
			authenticated.DELETE("/friends/:id", friendHandler.RemoveFriend)
			authenticated.POST("/users/:userId/block", friendHandler.BlockUser)
			authenticated.DELETE("/users/:userId/block", friendHandler.UnblockUser)
			authenticated.GET("/friends", friendHandler.ListFriends)
			authenticated.GET("/friends/mutual/:userId", friendHandler.MutualOrgs)
			authenticated.GET("/users/search", friendHandler.SearchUsers)

			// Organization Settings & Member Management (Issue #30)
			authenticated.GET("/orgs/:orgId/settings", orgHandler.GetOrgSettings)
			authenticated.PATCH("/orgs/:orgId", orgHandler.UpdateOrgSettings)
			authenticated.POST("/orgs/:orgId/logo", orgHandler.UploadOrgLogo)
			authenticated.GET("/orgs/:orgId/members", orgHandler.ListOrgMembers)
			authenticated.PATCH("/orgs/:orgId/members/:userId/role", orgHandler.ChangeMemberRole)
			authenticated.DELETE("/orgs/:orgId/members/:userId", orgHandler.RemoveMember)
			authenticated.POST("/orgs/:orgId/members/:userId/ban", orgHandler.BanMember)
			authenticated.DELETE("/orgs/:orgId/members/:userId/ban", orgHandler.UnbanMember)
			authenticated.GET("/orgs/:orgId/bans", orgHandler.ListBannedMembers)
			authenticated.POST("/orgs/:orgId/transfer-ownership", orgHandler.TransferOwnership)
			// Channel Categories (Issue #65)
			authenticated.POST("/categories", categoryHandler.CreateCategory)
			authenticated.GET("/categories", categoryHandler.ListCategories)
			authenticated.PATCH("/categories/:categoryId", categoryHandler.UpdateCategory)
			authenticated.DELETE("/categories/:categoryId", categoryHandler.DeleteCategory)
			authenticated.PATCH("/categories/reorder", categoryHandler.ReorderCategories)
			authenticated.PATCH("/channels/:id/category", categoryHandler.SetChannelCategory)
			authenticated.PATCH("/categories/:categoryId/channels/reorder", categoryHandler.ReorderChannels)

			// Channel CRUD Routes
			authenticated.POST("/channels", messagingHandler.CreateChannel)
			authenticated.GET("/channels", messagingHandler.GetChannels)
			authenticated.GET("/channels/browse", messagingHandler.BrowseChannels)
			authenticated.GET("/channels/joined", messagingHandler.GetJoinedChannels)
			authenticated.GET("/channels/:id", messagingHandler.GetChannel)
			authenticated.PATCH("/channels/:id", messagingHandler.UpdateChannel)
			authenticated.POST("/channels/:id/archive", messagingHandler.ArchiveChannel)
			authenticated.POST("/channels/:id/unarchive", messagingHandler.UnarchiveChannel)
			authenticated.POST("/channels/:id/join", messagingHandler.JoinChannel)
			authenticated.POST("/channels/:id/leave", messagingHandler.LeaveChannel)
			authenticated.DELETE("/channels/:id", messagingHandler.DeleteChannel)

			// Messaging Routes
			authenticated.POST("/channels/:id/messages", messagingHandler.CreateMessage)
			authenticated.GET("/channels/:id/messages", messagingHandler.GetMessages)
			authenticated.GET("/channels/:id/messages/:messageId/replies", messagingHandler.GetThreadReplies)
			authenticated.PATCH("/channels/:id/messages/:messageId", messagingHandler.EditMessage)
			authenticated.DELETE("/channels/:id/messages/:messageId", messagingHandler.DeleteMessage)
			authenticated.GET("/channels/:id/messages/:messageId/history", messagingHandler.GetMessageEditHistory)
			authenticated.POST("/channels/:id/messages/:messageId/react", messagingHandler.ReactToMessage)
			authenticated.POST("/channels/:id/messages/:messageId/pin", messagingHandler.TogglePin)
			authenticated.POST("/channels/:id/messages/:messageId/bookmark", messagingHandler.ToggleBookmark)
			authenticated.POST("/channels/:id/messages/:messageId/forward", messagingHandler.ForwardMessage)
			authenticated.PATCH("/channels/:id/read", messagingHandler.UpdateLastRead)
			authenticated.GET("/channels/:id/reads", messagingHandler.GetChannelReadReceipts)

			// Channel Member Routes (Private Channel ACL - Issue #120)
			authenticated.POST("/channels/:id/members", messagingHandler.AddChannelMember)
			authenticated.DELETE("/channels/:id/members/:userId", messagingHandler.RemoveChannelMember)
			authenticated.GET("/channels/:id/members", messagingHandler.ListChannelMembers)

			// Direct Message Routes (Issue #113)
			authenticated.GET("/dm", messagingHandler.ListDMs)
			authenticated.POST("/dm", messagingHandler.CreateOrGetDM)
			authenticated.POST("/dm/:dmId/convert", messagingHandler.ConvertDMToChannel)

			// Notification Routes (Issue #33)
			authenticated.GET("/notifications", notificationHandler.ListNotifications)
			authenticated.GET("/notifications/unread-count", notificationHandler.UnreadCount)
			authenticated.PATCH("/notifications/:notificationId/read", notificationHandler.MarkRead)
			authenticated.POST("/notifications/read-all", notificationHandler.MarkAllRead)

			// Presence Routes
			authenticated.POST("/presence/heartbeat", presenceHandler.Heartbeat)
			authenticated.GET("/presence/active", presenceHandler.GetActiveUsers)
		}

		// WebSocket Route (auth handled at connection level)
		r.GET("/ws", messagingHandler.HandleWS)
	}

	log.Printf("Bifrost REST Gateway starting on port %s", httpPort)
	r.Run(fmt.Sprintf(":%s", httpPort))
}
