package ephemeral

import (
	"context"
	"sync"
	"time"
)

const maxCachedMessagesPerChannel = 100

// MemoryStore is an in-memory implementation of Store.
// It is thread-safe and suitable for single-instance deployments.
// For multi-instance deployments, swap this for a Redis-backed implementation.
type MemoryStore struct {
	mu       sync.RWMutex
	presence map[string]map[string]PresenceEntry   // orgID -> userID -> entry
	typing   map[string]map[string]time.Time       // channelID -> userID -> expiresAt
	messages map[string][]CachedMessage             // channelID -> messages
	stopCh   chan struct{}
}

// NewMemoryStore creates a new in-memory ephemeral store and starts the
// background cleanup goroutine for expired typing indicators.
func NewMemoryStore() *MemoryStore {
	s := &MemoryStore{
		presence: make(map[string]map[string]PresenceEntry),
		typing:   make(map[string]map[string]time.Time),
		messages: make(map[string][]CachedMessage),
		stopCh:   make(chan struct{}),
	}
	go s.cleanupLoop()
	return s
}

// Stop terminates the background cleanup goroutine.
func (s *MemoryStore) Stop() {
	close(s.stopCh)
}

// ---------- Presence ----------

func (s *MemoryStore) SetPresence(_ context.Context, orgID, userID string, status string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.presence[orgID] == nil {
		s.presence[orgID] = make(map[string]PresenceEntry)
	}
	s.presence[orgID][userID] = PresenceEntry{
		Status:   status,
		LastSeen: time.Now(),
	}
	return nil
}

func (s *MemoryStore) GetPresence(_ context.Context, orgID string) (map[string]PresenceEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	orgMap := s.presence[orgID]
	if orgMap == nil {
		return map[string]PresenceEntry{}, nil
	}

	// Return a copy so callers cannot mutate the internal map.
	out := make(map[string]PresenceEntry, len(orgMap))
	for k, v := range orgMap {
		out[k] = v
	}
	return out, nil
}

func (s *MemoryStore) RemovePresence(_ context.Context, orgID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if orgMap := s.presence[orgID]; orgMap != nil {
		delete(orgMap, userID)
		if len(orgMap) == 0 {
			delete(s.presence, orgID)
		}
	}
	return nil
}

// ---------- Typing Indicators ----------

func (s *MemoryStore) SetTyping(_ context.Context, channelID, userID string, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.typing[channelID] == nil {
		s.typing[channelID] = make(map[string]time.Time)
	}
	s.typing[channelID][userID] = time.Now().Add(ttl)
	return nil
}

func (s *MemoryStore) GetTyping(_ context.Context, channelID string) ([]string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	chMap := s.typing[channelID]
	if chMap == nil {
		return []string{}, nil
	}

	now := time.Now()
	var users []string
	for userID, expiresAt := range chMap {
		if now.Before(expiresAt) {
			users = append(users, userID)
		}
	}
	if users == nil {
		users = []string{}
	}
	return users, nil
}

// ---------- Message Cache ----------

func (s *MemoryStore) CacheMessages(_ context.Context, channelID string, messages []CachedMessage) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Store up to the limit, taking the most recent messages.
	if len(messages) > maxCachedMessagesPerChannel {
		messages = messages[len(messages)-maxCachedMessagesPerChannel:]
	}

	// Make a defensive copy.
	cached := make([]CachedMessage, len(messages))
	copy(cached, messages)
	s.messages[channelID] = cached
	return nil
}

func (s *MemoryStore) GetCachedMessages(_ context.Context, channelID string, limit int) ([]CachedMessage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	msgs := s.messages[channelID]
	if msgs == nil {
		return nil, nil // nil signals cache miss to callers
	}

	if limit <= 0 || limit > len(msgs) {
		limit = len(msgs)
	}

	// Return the last `limit` messages (most recent).
	start := len(msgs) - limit
	out := make([]CachedMessage, limit)
	copy(out, msgs[start:])
	return out, nil
}

func (s *MemoryStore) InvalidateMessageCache(_ context.Context, channelID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.messages, channelID)
	return nil
}

// ---------- Background cleanup ----------

// cleanupLoop removes expired typing indicators every 5 seconds.
func (s *MemoryStore) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.purgeExpiredTyping()
		}
	}
}

func (s *MemoryStore) purgeExpiredTyping() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for channelID, users := range s.typing {
		for userID, expiresAt := range users {
			if now.After(expiresAt) {
				delete(users, userID)
			}
		}
		if len(users) == 0 {
			delete(s.typing, channelID)
		}
	}
}
