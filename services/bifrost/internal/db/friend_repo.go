package db

import (
	"context"
	"fmt"
	"time"
)

// Friendship represents a friendship record between two users.
type Friendship struct {
	ID          string    `json:"id"`
	RequesterID string    `json:"requester_id"`
	AddresseeID string    `json:"addressee_id"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// FriendUser represents a user in a friend list with profile info.
type FriendUser struct {
	FriendshipID string `json:"friendship_id"`
	UserID       string `json:"user_id"`
	Username     string `json:"username"`
	FullName     string `json:"full_name"`
	AvatarURL    string `json:"avatar_url"`
	Status       string `json:"status"`
	Direction    string `json:"direction"` // "sent" or "received" for pending
}

// MutualOrg represents an organization shared between two users.
type MutualOrg struct {
	OrgID   string `json:"org_id"`
	OrgName string `json:"org_name"`
}

// CreateFriendRequest inserts a pending friend request.
func (db *Database) CreateFriendRequest(ctx context.Context, requesterID, addresseeID string) (*Friendship, error) {
	var f Friendship
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO friendships (requester_id, addressee_id, status)
		 VALUES ($1, $2, 'pending')
		 RETURNING id, requester_id, addressee_id, status, created_at, updated_at`,
		requesterID, addresseeID,
	).Scan(&f.ID, &f.RequesterID, &f.AddresseeID, &f.Status, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create friend request: %w", err)
	}
	return &f, nil
}

// GetFriendshipByID retrieves a friendship by its ID.
func (db *Database) GetFriendshipByID(ctx context.Context, id string) (*Friendship, error) {
	var f Friendship
	err := db.Pool.QueryRow(ctx,
		`SELECT id, requester_id, addressee_id, status, created_at, updated_at
		 FROM friendships WHERE id = $1`, id,
	).Scan(&f.ID, &f.RequesterID, &f.AddresseeID, &f.Status, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("friendship not found: %w", err)
	}
	return &f, nil
}

// GetFriendshipBetween checks if a friendship exists between two users (in either direction).
func (db *Database) GetFriendshipBetween(ctx context.Context, userA, userB string) (*Friendship, error) {
	var f Friendship
	err := db.Pool.QueryRow(ctx,
		`SELECT id, requester_id, addressee_id, status, created_at, updated_at
		 FROM friendships
		 WHERE (requester_id = $1 AND addressee_id = $2)
		    OR (requester_id = $2 AND addressee_id = $1)`, userA, userB,
	).Scan(&f.ID, &f.RequesterID, &f.AddresseeID, &f.Status, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// AcceptFriendship updates a pending friendship to accepted.
func (db *Database) AcceptFriendship(ctx context.Context, id string) error {
	res, err := db.Pool.Exec(ctx,
		`UPDATE friendships SET status = 'accepted', updated_at = NOW()
		 WHERE id = $1 AND status = 'pending'`, id,
	)
	if err != nil {
		return fmt.Errorf("failed to accept friendship: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("friendship not found or not pending")
	}
	return nil
}

// DeclineFriendship deletes a pending friendship (decline).
func (db *Database) DeclineFriendship(ctx context.Context, id string) error {
	res, err := db.Pool.Exec(ctx,
		`DELETE FROM friendships WHERE id = $1 AND status = 'pending'`, id,
	)
	if err != nil {
		return fmt.Errorf("failed to decline friendship: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("friendship not found or not pending")
	}
	return nil
}

// RemoveFriendship deletes an accepted friendship.
func (db *Database) RemoveFriendship(ctx context.Context, id string) error {
	res, err := db.Pool.Exec(ctx,
		`DELETE FROM friendships WHERE id = $1`, id,
	)
	if err != nil {
		return fmt.Errorf("failed to remove friendship: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("friendship not found")
	}
	return nil
}

// BlockUser creates or updates a friendship to blocked status.
func (db *Database) BlockUser(ctx context.Context, blockerID, blockedID string) error {
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO friendships (requester_id, addressee_id, status)
		 VALUES ($1, $2, 'blocked')
		 ON CONFLICT (requester_id, addressee_id)
		 DO UPDATE SET status = 'blocked', updated_at = NOW()`,
		blockerID, blockedID,
	)
	if err != nil {
		return fmt.Errorf("failed to block user: %w", err)
	}
	// Also remove any reverse friendship
	_, _ = db.Pool.Exec(ctx,
		`DELETE FROM friendships WHERE requester_id = $1 AND addressee_id = $2 AND status != 'blocked'`,
		blockedID, blockerID,
	)
	return nil
}

// UnblockUser removes a block.
func (db *Database) UnblockUser(ctx context.Context, blockerID, blockedID string) error {
	res, err := db.Pool.Exec(ctx,
		`DELETE FROM friendships WHERE requester_id = $1 AND addressee_id = $2 AND status = 'blocked'`,
		blockerID, blockedID,
	)
	if err != nil {
		return fmt.Errorf("failed to unblock user: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("block not found")
	}
	return nil
}

// ListFriends returns friends for a user filtered by status.
func (db *Database) ListFriends(ctx context.Context, userID, status string) ([]FriendUser, error) {
	var query string
	var args []interface{}

	switch status {
	case "pending":
		query = `SELECT f.id, u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.avatar_url, ''), f.status,
		         CASE WHEN f.requester_id = $1 THEN 'sent' ELSE 'received' END
		         FROM friendships f
		         JOIN users u ON (CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END) = u.id
		         WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'pending'
		         ORDER BY f.updated_at DESC`
		args = []interface{}{userID}
	case "blocked":
		query = `SELECT f.id, u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.avatar_url, ''), f.status, 'sent'
		         FROM friendships f
		         JOIN users u ON f.addressee_id = u.id
		         WHERE f.requester_id = $1 AND f.status = 'blocked'
		         ORDER BY f.updated_at DESC`
		args = []interface{}{userID}
	case "accepted":
		query = `SELECT f.id, u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.avatar_url, ''), f.status, ''
		         FROM friendships f
		         JOIN users u ON (CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END) = u.id
		         WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
		         ORDER BY f.updated_at DESC`
		args = []interface{}{userID}
	default: // "all"
		query = `SELECT f.id, u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.avatar_url, ''), f.status,
		         CASE WHEN f.status = 'pending' AND f.requester_id = $1 THEN 'sent'
		              WHEN f.status = 'pending' AND f.addressee_id = $1 THEN 'received'
		              ELSE '' END
		         FROM friendships f
		         JOIN users u ON (CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END) = u.id
		         WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status IN ('pending', 'accepted')
		         ORDER BY f.updated_at DESC`
		args = []interface{}{userID}
	}

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list friends: %w", err)
	}
	defer rows.Close()

	var friends []FriendUser
	for rows.Next() {
		var f FriendUser
		if err := rows.Scan(&f.FriendshipID, &f.UserID, &f.Username, &f.FullName, &f.AvatarURL, &f.Status, &f.Direction); err != nil {
			return nil, err
		}
		friends = append(friends, f)
	}
	return friends, nil
}

// GetMutualOrgs returns organizations that both users are members of.
func (db *Database) GetMutualOrgs(ctx context.Context, userA, userB string) ([]MutualOrg, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT o.id, o.name
		 FROM organizations o
		 JOIN organization_memberships m1 ON m1.org_id = o.id AND m1.user_id = $1
		 JOIN organization_memberships m2 ON m2.org_id = o.id AND m2.user_id = $2
		 ORDER BY o.name`, userA, userB,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get mutual orgs: %w", err)
	}
	defer rows.Close()

	var orgs []MutualOrg
	for rows.Next() {
		var o MutualOrg
		if err := rows.Scan(&o.OrgID, &o.OrgName); err != nil {
			return nil, err
		}
		orgs = append(orgs, o)
	}
	return orgs, nil
}

// SearchUsersByUsername searches for users by username prefix (for adding friends).
func (db *Database) SearchUsersByUsername(ctx context.Context, query string, excludeUserID string) ([]FriendUser, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, username, COALESCE(full_name, ''), COALESCE(avatar_url, '')
		 FROM users
		 WHERE username ILIKE $1 AND id != $2
		 LIMIT 20`,
		query+"%", excludeUserID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}
	defer rows.Close()

	var users []FriendUser
	for rows.Next() {
		var u FriendUser
		if err := rows.Scan(&u.UserID, &u.Username, &u.FullName, &u.AvatarURL); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}
