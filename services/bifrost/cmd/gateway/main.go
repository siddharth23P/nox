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
	r.Use(cors.Default())
	
	authHandler := auth.NewAuthHandler(authService)
	v1 := r.Group("/v1")
	{
		v1.POST("/auth/register", authHandler.Register)
		v1.POST("/auth/login", authHandler.Login)
		v1.GET("/auth/google", authHandler.GoogleLogin)
		v1.GET("/auth/google/callback", authHandler.GoogleCallback)
		v1.GET("/auth/github", authHandler.GithubLogin)
		v1.GET("/auth/github/callback", authHandler.GithubCallback)
		v1.GET("/auth/verify", authHandler.VerifyEmail)
	}

	log.Printf("Bifrost REST Gateway starting on port %s", httpPort)
	r.Run(fmt.Sprintf(":%s", httpPort))
}
