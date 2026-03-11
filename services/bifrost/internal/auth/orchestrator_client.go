package auth

import (
	"context"
	"fmt"

	pb "github.com/nox-labs/bifrost/pkg/authv1/auth/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// OrchestratorClient talks to the Rust Orchestrator
type OrchestratorClient struct {
	conn *grpc.ClientConn
}

func NewOrchestratorClient(addr string) (*OrchestratorClient, error) {
	conn, err := grpc.Dial(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &OrchestratorClient{conn: conn}, nil
}

func (c *OrchestratorClient) VerifyZKIdentity(ctx context.Context, userID, orgID, proof string) (bool, error) {
	fmt.Printf("Bifrost: Delegating ZK verification for %s to Orchestrator\n", userID)
	
	client := pb.NewAuthServiceClient(c.conn)
	resp, err := client.VerifySession(ctx, &pb.VerifySessionRequest{
		Token: proof, // Token acts as the ZK proof for now
	})
	if err != nil {
		return false, err
	}
	
	return resp.Valid, nil
}

func (c *OrchestratorClient) Close() {
	c.conn.Close()
}
