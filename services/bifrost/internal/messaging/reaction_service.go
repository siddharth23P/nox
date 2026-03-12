package messaging

import (
	"sync"
)

// ReactionService provides an in-memory, thread-safe implementation of reaction counting.
// In a full production cluster, this would be backed by Redis Sets.
type ReactionService struct {
	// structured as: messageID -> emoji -> userID -> hasReacted
	state map[string]map[string]map[string]bool
	mu    sync.RWMutex
}

func NewReactionService() *ReactionService {
	return &ReactionService{
		state: make(map[string]map[string]map[string]bool),
	}
}

// ToggleReaction safely adds or removes a user's reaction from a message
func (s *ReactionService) ToggleReaction(messageID, userID, emoji, action string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Initialize nested maps if they don't exist
	if _, ok := s.state[messageID]; !ok {
		s.state[messageID] = make(map[string]map[string]bool)
	}
	if _, ok := s.state[messageID][emoji]; !ok {
		s.state[messageID][emoji] = make(map[string]bool)
	}

	if action == "add" {
		s.state[messageID][emoji][userID] = true
	} else if action == "remove" {
		delete(s.state[messageID][emoji], userID)
		
		// Cleanup empty maps to prevent memory bloat over time
		if len(s.state[messageID][emoji]) == 0 {
			delete(s.state[messageID], emoji)
		}
		if len(s.state[messageID]) == 0 {
			delete(s.state, messageID)
		}
	}

	return nil
}

// GetReactionsForMessage returns the aggregated counts and the current user's specific reactions
func (s *ReactionService) GetReactionsForMessage(messageID, currentUserID string) (map[string]int, []string) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	counts := make(map[string]int)
	var userReacted []string

	msgReactions, exists := s.state[messageID]
	if !exists {
		return counts, userReacted
	}

	for emoji, users := range msgReactions {
		count := len(users)
		if count > 0 {
			counts[emoji] = count
			if currentUserID != "" && users[currentUserID] {
				userReacted = append(userReacted, emoji)
			}
		}
	}

	return counts, userReacted
}

// InjectReactionsIntoMessages is a helper to hydrate database models with ephemeral reaction state
func (s *ReactionService) InjectReactionsIntoMessages(messages []Message, currentUserID string) []Message {
	for i := range messages {
		counts, userReacted := s.GetReactionsForMessage(messages[i].ID, currentUserID)
		if len(counts) > 0 {
			messages[i].Reactions = counts
		}
		if len(userReacted) > 0 {
			messages[i].UserReactions = userReacted
		}
	}
	return messages
}
