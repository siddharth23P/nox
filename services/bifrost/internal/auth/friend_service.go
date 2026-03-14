package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/nox-labs/bifrost/internal/db"
)

// FriendService handles business logic for friendships.
type FriendService struct {
	repo *db.Database
}

// NewFriendService creates a new FriendService.
func NewFriendService(repo *db.Database) *FriendService {
	return &FriendService{repo: repo}
}

// SendFriendRequest creates a pending friend request.
func (s *FriendService) SendFriendRequest(ctx context.Context, requesterID, addresseeID string) (*db.Friendship, error) {
	if requesterID == addresseeID {
		return nil, errors.New("cannot send friend request to yourself")
	}

	// Check if a friendship already exists
	existing, err := s.repo.GetFriendshipBetween(ctx, requesterID, addresseeID)
	if err == nil && existing != nil {
		switch existing.Status {
		case "accepted":
			return nil, errors.New("already friends")
		case "pending":
			return nil, errors.New("friend request already pending")
		case "blocked":
			return nil, errors.New("cannot send friend request")
		}
	}

	return s.repo.CreateFriendRequest(ctx, requesterID, addresseeID)
}

// AcceptFriendRequest accepts a pending friend request.
func (s *FriendService) AcceptFriendRequest(ctx context.Context, friendshipID, userID string) error {
	f, err := s.repo.GetFriendshipByID(ctx, friendshipID)
	if err != nil {
		return errors.New("friend request not found")
	}

	// Only the addressee can accept the request
	if f.AddresseeID != userID {
		return errors.New("only the recipient can accept a friend request")
	}

	if f.Status != "pending" {
		return errors.New("friend request is not pending")
	}

	return s.repo.AcceptFriendship(ctx, friendshipID)
}

// DeclineFriendRequest declines a pending friend request.
func (s *FriendService) DeclineFriendRequest(ctx context.Context, friendshipID, userID string) error {
	f, err := s.repo.GetFriendshipByID(ctx, friendshipID)
	if err != nil {
		return errors.New("friend request not found")
	}

	// Either party can decline/cancel a pending request
	if f.RequesterID != userID && f.AddresseeID != userID {
		return errors.New("not authorized to decline this request")
	}

	if f.Status != "pending" {
		return errors.New("friend request is not pending")
	}

	return s.repo.DeclineFriendship(ctx, friendshipID)
}

// RemoveFriend removes an existing friendship.
func (s *FriendService) RemoveFriend(ctx context.Context, friendshipID, userID string) error {
	f, err := s.repo.GetFriendshipByID(ctx, friendshipID)
	if err != nil {
		return errors.New("friendship not found")
	}

	// Either party can remove the friendship
	if f.RequesterID != userID && f.AddresseeID != userID {
		return errors.New("not authorized to remove this friendship")
	}

	return s.repo.RemoveFriendship(ctx, friendshipID)
}

// BlockUser blocks another user.
func (s *FriendService) BlockUser(ctx context.Context, blockerID, blockedID string) error {
	if blockerID == blockedID {
		return errors.New("cannot block yourself")
	}

	return s.repo.BlockUser(ctx, blockerID, blockedID)
}

// UnblockUser unblocks a user.
func (s *FriendService) UnblockUser(ctx context.Context, blockerID, blockedID string) error {
	return s.repo.UnblockUser(ctx, blockerID, blockedID)
}

// ListFriends returns the user's friend list filtered by status.
func (s *FriendService) ListFriends(ctx context.Context, userID, status string) ([]db.FriendUser, error) {
	return s.repo.ListFriends(ctx, userID, status)
}

// GetMutualOrgs returns organizations shared between two users.
func (s *FriendService) GetMutualOrgs(ctx context.Context, userA, userB string) ([]db.MutualOrg, error) {
	return s.repo.GetMutualOrgs(ctx, userA, userB)
}

// SearchUsers searches for users by username prefix.
func (s *FriendService) SearchUsers(ctx context.Context, query, excludeUserID string) ([]db.FriendUser, error) {
	if len(query) < 1 {
		return nil, fmt.Errorf("search query must be at least 1 character")
	}
	return s.repo.SearchUsersByUsername(ctx, query, excludeUserID)
}
