package messaging

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/nox-labs/bifrost/internal/ephemeral"
)

// Client represents a single WebSocket connection
type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan []byte
	UserID string
}

// Event represents a WebSocket message type
type Event struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// ClientMessage represents an incoming message from the client
type ClientMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type TypingPayload struct {
	ChannelID string `json:"channel_id"`
	UserID    string `json:"user_id"`
	Username  string `json:"username"`
	IsTyping  bool   `json:"is_typing"`
}

// OnDisconnectFunc is called when a client disconnects from the hub.
type OnDisconnectFunc func(userID string)

// Hub manages all active WebSocket connections
type Hub struct {
	clients      map[*Client]bool
	broadcast    chan []byte
	register     chan *Client
	unregister   chan *Client
	mu           sync.Mutex
	OnDisconnect OnDisconnectFunc
	// Ephemeral is an optional ephemeral store for typing indicator state.
	Ephemeral ephemeral.Store
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				if client.UserID != "" && h.OnDisconnect != nil {
					go h.OnDisconnect(client.UserID)
				}
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

// BroadcastEvent marshals and sends an event to all clients
func (h *Hub) BroadcastEvent(eventType string, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Error marshaling payload: %v", err)
		return
	}

	event := Event{
		Type:    eventType,
		Payload: data,
	}

	eventData, err := json.Marshal(event)
	if err != nil {
		log.Printf("Error marshaling event: %v", err)
		return
	}

	h.broadcast <- eventData
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		
		var msg ClientMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshaling client message: %v", err)
			continue
		}

		if msg.Type == "TYPING" {
			var payload TypingPayload
			if err := json.Unmarshal(msg.Payload, &payload); err != nil {
				log.Printf("Error unmarshaling typing payload: %v", err)
				continue
			}
			// Persist typing state in ephemeral store (5s TTL).
			if c.Hub.Ephemeral != nil && payload.IsTyping {
				if err := c.Hub.Ephemeral.SetTyping(context.Background(), payload.ChannelID, payload.UserID, 5*time.Second); err != nil {
					log.Printf("ephemeral.SetTyping error: %v", err)
				}
			}
			// Broadcast the typing indicator to all clients
			c.Hub.BroadcastEvent("TYPING_INDICATOR", payload)
		}
	}
}

func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
	}()

	for message := range c.Send {
		w, err := c.Conn.NextWriter(websocket.TextMessage)
		if err != nil {
			return
		}
		w.Write(message)

		if err := w.Close(); err != nil {
			return
		}
	}
}
