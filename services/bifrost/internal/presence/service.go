package presence

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/nox-labs/bifrost/internal/ephemeral"
)

type PresenceStatus string

const (
	StatusOnline  PresenceStatus = "online"
	StatusStealth PresenceStatus = "stealth"
)

type UserPresence struct {
	UserID   string
	LastSeen time.Time
	Status   PresenceStatus
}

type PresenceService struct {
	// Active users mapped by UserID (local fast-path)
	users sync.Map
	// Ephemeral store for cross-cutting presence, typing, and cache state.
	// May be nil for backward compatibility; when set, presence writes are
	// mirrored to the store so that other subsystems can query it.
	store ephemeral.Store
}

// NewPresenceService creates a PresenceService without an ephemeral store.
func NewPresenceService() *PresenceService {
	s := &PresenceService{}

	// Start background cleanup ticker (prune users inactive for > 30s)
	go s.cleanupRoutine()

	return s
}

// NewPresenceServiceWithStore creates a PresenceService backed by an ephemeral store.
func NewPresenceServiceWithStore(store ephemeral.Store) *PresenceService {
	s := &PresenceService{store: store}

	go s.cleanupRoutine()

	return s
}

// Store returns the ephemeral store, or nil if not configured.
func (s *PresenceService) Store() ephemeral.Store {
	return s.store
}

// Heartbeat updates the last seen time and status for a user.
func (s *PresenceService) Heartbeat(userID string, status PresenceStatus) {
	s.users.Store(userID, UserPresence{
		UserID:   userID,
		LastSeen: time.Now(),
		Status:   status,
	})

	// Mirror to ephemeral store (global org key "default" since the
	// heartbeat handler does not currently carry org context).
	if s.store != nil {
		if err := s.store.SetPresence(context.Background(), "default", userID, string(status)); err != nil {
			log.Printf("ephemeral.SetPresence error: %v", err)
		}
	}
}

// HeartbeatWithOrg updates presence scoped to a specific organization.
func (s *PresenceService) HeartbeatWithOrg(orgID, userID string, status PresenceStatus) {
	s.users.Store(userID, UserPresence{
		UserID:   userID,
		LastSeen: time.Now(),
		Status:   status,
	})

	if s.store != nil {
		if err := s.store.SetPresence(context.Background(), orgID, userID, string(status)); err != nil {
			log.Printf("ephemeral.SetPresence error: %v", err)
		}
	}
}

// GetActiveUsers returns all users who pinged within the last 30s and are not in stealth mode.
func (s *PresenceService) GetActiveUsers() []string {
	var activeUsers []string
	now := time.Now()

	s.users.Range(func(key, value interface{}) bool {
		presence := value.(UserPresence)
		// Active means pinged within 30s and not stealth
		if now.Sub(presence.LastSeen) <= 30*time.Second && presence.Status != StatusStealth {
			activeUsers = append(activeUsers, presence.UserID)
		}
		return true // continue iteration
	})

	return activeUsers
}

// RemoveUser immediately removes a user from the active presence map.
// This is called when a WebSocket connection disconnects so that the user
// appears offline without waiting for the heartbeat timeout.
func (s *PresenceService) RemoveUser(userID string) {
	s.users.Delete(userID)

	if s.store != nil {
		// Remove from default org scope; if org-scoped presence is used
		// the caller should use RemoveUserFromOrg instead.
		if err := s.store.RemovePresence(context.Background(), "default", userID); err != nil {
			log.Printf("ephemeral.RemovePresence error: %v", err)
		}
	}
}

// RemoveUserFromOrg removes a user's presence for a specific org.
func (s *PresenceService) RemoveUserFromOrg(orgID, userID string) {
	s.users.Delete(userID)

	if s.store != nil {
		if err := s.store.RemovePresence(context.Background(), orgID, userID); err != nil {
			log.Printf("ephemeral.RemovePresence error: %v", err)
		}
	}
}

// SetTyping records a typing indicator for a user in a channel.
func (s *PresenceService) SetTyping(channelID, userID string, ttl time.Duration) error {
	if s.store == nil {
		return nil
	}
	return s.store.SetTyping(context.Background(), channelID, userID, ttl)
}

// GetTyping returns the list of user IDs currently typing in a channel.
func (s *PresenceService) GetTyping(channelID string) ([]string, error) {
	if s.store == nil {
		return []string{}, nil
	}
	return s.store.GetTyping(context.Background(), channelID)
}

func (s *PresenceService) cleanupRoutine() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		s.users.Range(func(key, value interface{}) bool {
			// Remove users who haven't pinged in 30 seconds
			presence := value.(UserPresence)
			if now.Sub(presence.LastSeen) > 30*time.Second {
				s.users.Delete(key)
			}
			return true
		})
	}
}
