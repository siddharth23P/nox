package presence

import (
	"sync"
	"time"
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
	// Active users mapped by UserID
	users sync.Map
}

func NewPresenceService() *PresenceService {
	s := &PresenceService{}
	
	// Start background cleanup ticker (prune users inactive for > 30s)
	go s.cleanupRoutine()
	
	return s
}

// Heartbeat updates the last seen time and status for a user
func (s *PresenceService) Heartbeat(userID string, status PresenceStatus) {
	s.users.Store(userID, UserPresence{
		UserID:   userID,
		LastSeen: time.Now(),
		Status:   status,
	})
}

// GetActiveUsers returns all users who pinged within the last 30s and are not in stealth mode
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
