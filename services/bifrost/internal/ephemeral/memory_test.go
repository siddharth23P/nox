package ephemeral

import (
	"context"
	"testing"
	"time"
)

func TestPresence(t *testing.T) {
	s := NewMemoryStore()
	defer s.Stop()
	ctx := context.Background()

	// Empty org returns empty map
	m, err := s.GetPresence(ctx, "org1")
	if err != nil {
		t.Fatal(err)
	}
	if len(m) != 0 {
		t.Fatalf("expected empty map, got %v", m)
	}

	// Set and get
	if err := s.SetPresence(ctx, "org1", "u1", "online"); err != nil {
		t.Fatal(err)
	}
	if err := s.SetPresence(ctx, "org1", "u2", "stealth"); err != nil {
		t.Fatal(err)
	}

	m, err = s.GetPresence(ctx, "org1")
	if err != nil {
		t.Fatal(err)
	}
	if len(m) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(m))
	}
	if m["u1"].Status != "online" {
		t.Fatalf("expected online, got %s", m["u1"].Status)
	}
	if m["u2"].Status != "stealth" {
		t.Fatalf("expected stealth, got %s", m["u2"].Status)
	}

	// Remove
	if err := s.RemovePresence(ctx, "org1", "u1"); err != nil {
		t.Fatal(err)
	}
	m, err = s.GetPresence(ctx, "org1")
	if err != nil {
		t.Fatal(err)
	}
	if len(m) != 1 {
		t.Fatalf("expected 1 entry after remove, got %d", len(m))
	}

	// Remove last entry cleans up org key
	if err := s.RemovePresence(ctx, "org1", "u2"); err != nil {
		t.Fatal(err)
	}
	m, err = s.GetPresence(ctx, "org1")
	if err != nil {
		t.Fatal(err)
	}
	if len(m) != 0 {
		t.Fatalf("expected empty map after removing all, got %d", len(m))
	}
}

func TestTyping(t *testing.T) {
	s := NewMemoryStore()
	defer s.Stop()
	ctx := context.Background()

	// Empty channel returns empty slice
	users, err := s.GetTyping(ctx, "ch1")
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 0 {
		t.Fatalf("expected empty, got %v", users)
	}

	// Set typing with short TTL
	if err := s.SetTyping(ctx, "ch1", "u1", 5*time.Second); err != nil {
		t.Fatal(err)
	}
	users, err = s.GetTyping(ctx, "ch1")
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 1 || users[0] != "u1" {
		t.Fatalf("expected [u1], got %v", users)
	}

	// Expired typing not returned
	if err := s.SetTyping(ctx, "ch1", "u2", 1*time.Millisecond); err != nil {
		t.Fatal(err)
	}
	time.Sleep(5 * time.Millisecond)
	users, err = s.GetTyping(ctx, "ch1")
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 1 || users[0] != "u1" {
		t.Fatalf("expected [u1] after expiry, got %v", users)
	}
}

func TestMessageCache(t *testing.T) {
	s := NewMemoryStore()
	defer s.Stop()
	ctx := context.Background()

	// Cache miss returns nil
	msgs, err := s.GetCachedMessages(ctx, "ch1", 50)
	if err != nil {
		t.Fatal(err)
	}
	if msgs != nil {
		t.Fatalf("expected nil for cache miss, got %v", msgs)
	}

	// Cache and retrieve
	input := []CachedMessage{
		{ID: "1", ChannelID: "ch1", UserID: "u1", ContentMD: "hello", CreatedAt: "2026-01-01T00:00:00Z"},
		{ID: "2", ChannelID: "ch1", UserID: "u2", ContentMD: "world", CreatedAt: "2026-01-01T00:00:01Z"},
	}
	if err := s.CacheMessages(ctx, "ch1", input); err != nil {
		t.Fatal(err)
	}

	msgs, err = s.GetCachedMessages(ctx, "ch1", 50)
	if err != nil {
		t.Fatal(err)
	}
	if len(msgs) != 2 {
		t.Fatalf("expected 2 cached messages, got %d", len(msgs))
	}
	if msgs[0].ID != "1" || msgs[1].ID != "2" {
		t.Fatalf("unexpected message order: %v", msgs)
	}

	// Limit parameter
	msgs, err = s.GetCachedMessages(ctx, "ch1", 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(msgs) != 1 || msgs[0].ID != "2" {
		t.Fatalf("expected most recent message, got %v", msgs)
	}

	// Invalidate
	if err := s.InvalidateMessageCache(ctx, "ch1"); err != nil {
		t.Fatal(err)
	}
	msgs, err = s.GetCachedMessages(ctx, "ch1", 50)
	if err != nil {
		t.Fatal(err)
	}
	if msgs != nil {
		t.Fatalf("expected nil after invalidation, got %v", msgs)
	}
}

func TestMessageCacheLimit(t *testing.T) {
	s := NewMemoryStore()
	defer s.Stop()
	ctx := context.Background()

	// Create more than maxCachedMessagesPerChannel messages
	var msgs []CachedMessage
	for i := 0; i < 150; i++ {
		msgs = append(msgs, CachedMessage{
			ID:        string(rune('A' + i%26)),
			ChannelID: "ch1",
		})
	}
	if err := s.CacheMessages(ctx, "ch1", msgs); err != nil {
		t.Fatal(err)
	}

	cached, err := s.GetCachedMessages(ctx, "ch1", 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(cached) != maxCachedMessagesPerChannel {
		t.Fatalf("expected %d messages, got %d", maxCachedMessagesPerChannel, len(cached))
	}
}

// Verify the Store interface is satisfied.
var _ Store = (*MemoryStore)(nil)
