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
	"github.com/nox-labs/bifrost/internal/messaging"
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
	
	// Initialize WebSocket Hub
	hub := messaging.NewHub()
	go hub.Run()

	// Initialize Messaging & Reaction Service
	reactionService := messaging.NewReactionService(hub)
	messagingService := messaging.NewMessagingService(database, reactionService, hub)

	// Initialize Presence Service
	presenceService := presence.NewPresenceService()

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
	messagingHandler := messaging.NewMessagingHandler(messagingService, hub)
	presenceHandler := presence.NewPresenceHandler(presenceService)

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
		v1.POST("/zk/verify", authHandler.VerifyZKProof)

		// Authenticated routes (require JWT)
		authenticated := v1.Group("")
		authenticated.Use(auth.AuthMiddleware(authService, ""))
		{
			// Organization Routes
			authenticated.GET("/orgs", authHandler.ListOrganizations)
			authenticated.POST("/orgs/:orgId/switch", authHandler.SwitchOrganization)
		}

		// Messaging Routes
		v1.POST("/channels", messagingHandler.CreateChannel)
		v1.GET("/channels", messagingHandler.GetChannels)
		v1.POST("/channels/:id/messages", messagingHandler.CreateMessage)
		v1.GET("/channels/:id/messages", messagingHandler.GetMessages)
		v1.GET("/channels/:id/messages/:messageId/replies", messagingHandler.GetThreadReplies)
		v1.PATCH("/channels/:id/messages/:messageId", messagingHandler.EditMessage)
		v1.GET("/channels/:id/messages/:messageId/history", messagingHandler.GetMessageEditHistory)
		v1.POST("/channels/:id/messages/:messageId/react", messagingHandler.ReactToMessage)
		v1.POST("/channels/:id/messages/:messageId/pin", messagingHandler.TogglePin)
		v1.POST("/channels/:id/messages/:messageId/bookmark", messagingHandler.ToggleBookmark)
		v1.POST("/channels/:id/messages/:messageId/forward", messagingHandler.ForwardMessage)
		v1.PATCH("/channels/:id/read", messagingHandler.UpdateLastRead)
		v1.GET("/channels/:id/reads", messagingHandler.GetChannelReadReceipts)

		// Presence Routes
		v1.POST("/presence/heartbeat", presenceHandler.Heartbeat)
		v1.GET("/presence/active", presenceHandler.GetActiveUsers)

		// WebSocket Route
		r.GET("/ws", messagingHandler.HandleWS)
	}

	log.Printf("Bifrost REST Gateway starting on port %s", httpPort)
	r.Run(fmt.Sprintf(":%s", httpPort))
}
