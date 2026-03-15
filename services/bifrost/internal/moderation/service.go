package moderation

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/nox-labs/bifrost/internal/db"
)

// Service provides moderation operations backed by the database.
type Service struct {
	db *db.Database
}

// NewService creates a new moderation service.
func NewService(database *db.Database) *Service {
	return &Service{db: database}
}

// parseDuration converts a human-friendly duration string to time.Duration.
// Supported suffixes: m (minutes), h (hours), d (days), w (weeks).
func parseDuration(s string) (time.Duration, error) {
	s = strings.TrimSpace(s)
	if len(s) < 2 {
		return 0, fmt.Errorf("invalid duration: %s", s)
	}

	suffix := s[len(s)-1:]
	valueStr := s[:len(s)-1]
	value, err := strconv.Atoi(valueStr)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("invalid duration value: %s", s)
	}

	switch suffix {
	case "m":
		return time.Duration(value) * time.Minute, nil
	case "h":
		return time.Duration(value) * time.Hour, nil
	case "d":
		return time.Duration(value) * 24 * time.Hour, nil
	case "w":
		return time.Duration(value) * 7 * 24 * time.Hour, nil
	default:
		return 0, fmt.Errorf("unsupported duration suffix: %s (use m, h, d, or w)", suffix)
	}
}

// TimeoutUser creates a timeout action with an expiry based on the requested duration.
func (s *Service) TimeoutUser(ctx context.Context, orgID, moderatorID string, req TimeoutRequest) (*ModerationAction, error) {
	dur, err := parseDuration(req.Duration)
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(dur)

	var channelID *string
	if req.ChannelID != "" {
		channelID = &req.ChannelID
	}

	query := `
		INSERT INTO moderation_actions (org_id, target_user_id, moderator_id, action_type, reason, channel_id, expires_at)
		VALUES ($1, $2, $3, 'timeout', $4, $5, $6)
		RETURNING id, org_id, target_user_id, moderator_id, action_type, reason, channel_id, expires_at, revoked_at, revoked_by, created_at
	`
	row := s.db.Pool.QueryRow(ctx, query, orgID, req.UserID, moderatorID, req.Reason, channelID, expiresAt)
	return scanAction(row)
}

// MuteUser creates a channel_mute or server_mute action.
func (s *Service) MuteUser(ctx context.Context, orgID, moderatorID string, req MuteRequest) (*ModerationAction, error) {
	actionType := "server_mute"
	var channelID *string
	if req.ChannelID != "" {
		actionType = "channel_mute"
		channelID = &req.ChannelID
	}

	query := `
		INSERT INTO moderation_actions (org_id, target_user_id, moderator_id, action_type, reason, channel_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, org_id, target_user_id, moderator_id, action_type, reason, channel_id, expires_at, revoked_at, revoked_by, created_at
	`
	row := s.db.Pool.QueryRow(ctx, query, orgID, req.UserID, moderatorID, actionType, req.Reason, channelID)
	return scanAction(row)
}

// WarnUser creates a warn action (informational, no restrictions).
func (s *Service) WarnUser(ctx context.Context, orgID, moderatorID string, req WarnRequest) (*ModerationAction, error) {
	query := `
		INSERT INTO moderation_actions (org_id, target_user_id, moderator_id, action_type, reason)
		VALUES ($1, $2, $3, 'warn', $4)
		RETURNING id, org_id, target_user_id, moderator_id, action_type, reason, channel_id, expires_at, revoked_at, revoked_by, created_at
	`
	row := s.db.Pool.QueryRow(ctx, query, orgID, req.UserID, moderatorID, req.Reason)
	return scanAction(row)
}

// BanUser creates a ban action.
func (s *Service) BanUser(ctx context.Context, orgID, moderatorID string, req BanRequest) (*ModerationAction, error) {
	query := `
		INSERT INTO moderation_actions (org_id, target_user_id, moderator_id, action_type, reason)
		VALUES ($1, $2, $3, 'ban', $4)
		RETURNING id, org_id, target_user_id, moderator_id, action_type, reason, channel_id, expires_at, revoked_at, revoked_by, created_at
	`
	row := s.db.Pool.QueryRow(ctx, query, orgID, req.UserID, moderatorID, req.Reason)
	return scanAction(row)
}

// RevokeAction sets revoked_at on an existing action.
func (s *Service) RevokeAction(ctx context.Context, actionID, revokedBy string) error {
	query := `UPDATE moderation_actions SET revoked_at = NOW(), revoked_by = $2 WHERE id = $1 AND revoked_at IS NULL`
	tag, err := s.db.Pool.Exec(ctx, query, actionID, revokedBy)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("action not found or already revoked")
	}
	return nil
}

// ListActions returns a paginated audit log of moderation actions for an org.
func (s *Service) ListActions(ctx context.Context, orgID string, limit, offset int) ([]ModerationAction, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT ma.id, ma.org_id, ma.target_user_id, ma.moderator_id, ma.action_type, ma.reason,
		       ma.channel_id, ma.expires_at, ma.revoked_at, ma.revoked_by, ma.created_at,
		       COALESCE(tu.username, '') AS target_username,
		       COALESCE(mu.username, '') AS moderator_username
		FROM moderation_actions ma
		LEFT JOIN users tu ON tu.id = ma.target_user_id
		LEFT JOIN users mu ON mu.id = ma.moderator_id
		WHERE ma.org_id = $1
		ORDER BY ma.created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := s.db.Pool.Query(ctx, query, orgID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var actions []ModerationAction
	for rows.Next() {
		var a ModerationAction
		if err := rows.Scan(
			&a.ID, &a.OrgID, &a.TargetUserID, &a.ModeratorID, &a.ActionType, &a.Reason,
			&a.ChannelID, &a.ExpiresAt, &a.RevokedAt, &a.RevokedBy, &a.CreatedAt,
			&a.TargetUsername, &a.ModeratorUsername,
		); err != nil {
			return nil, err
		}
		actions = append(actions, a)
	}
	return actions, rows.Err()
}

// GetActiveActions returns all active (non-expired, non-revoked) actions for a user in an org.
func (s *Service) GetActiveActions(ctx context.Context, orgID, userID string) ([]ModerationAction, error) {
	query := `
		SELECT id, org_id, target_user_id, moderator_id, action_type, reason,
		       channel_id, expires_at, revoked_at, revoked_by, created_at
		FROM moderation_actions
		WHERE org_id = $1
		  AND target_user_id = $2
		  AND revoked_at IS NULL
		  AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY created_at DESC
	`
	rows, err := s.db.Pool.Query(ctx, query, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var actions []ModerationAction
	for rows.Next() {
		var a ModerationAction
		if err := rows.Scan(
			&a.ID, &a.OrgID, &a.TargetUserID, &a.ModeratorID, &a.ActionType, &a.Reason,
			&a.ChannelID, &a.ExpiresAt, &a.RevokedAt, &a.RevokedBy, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		actions = append(actions, a)
	}
	return actions, rows.Err()
}

// IsUserRestricted checks if a user is currently timed out, muted, or banned in the given org/channel.
// Returns a non-empty reason string if restricted, or empty string if the user can act freely.
func (s *Service) IsUserRestricted(ctx context.Context, orgID, userID, channelID string) (string, error) {
	query := `
		SELECT action_type, reason, channel_id
		FROM moderation_actions
		WHERE org_id = $1
		  AND target_user_id = $2
		  AND revoked_at IS NULL
		  AND (expires_at IS NULL OR expires_at > NOW())
		  AND action_type IN ('timeout', 'channel_mute', 'server_mute', 'ban')
		ORDER BY
		  CASE action_type
		    WHEN 'ban' THEN 1
		    WHEN 'server_mute' THEN 2
		    WHEN 'timeout' THEN 3
		    WHEN 'channel_mute' THEN 4
		  END
		LIMIT 10
	`
	rows, err := s.db.Pool.Query(ctx, query, orgID, userID)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	for rows.Next() {
		var actionType, reason string
		var chID *string
		if err := rows.Scan(&actionType, &reason, &chID); err != nil {
			return "", err
		}

		switch actionType {
		case "ban":
			return fmt.Sprintf("You are banned from this server: %s", reason), nil
		case "server_mute":
			return fmt.Sprintf("You are muted in this server: %s", reason), nil
		case "timeout":
			// Timeouts may be scoped to a channel
			if chID == nil || *chID == channelID {
				return fmt.Sprintf("You are timed out: %s", reason), nil
			}
		case "channel_mute":
			if chID != nil && *chID == channelID {
				return fmt.Sprintf("You are muted in this channel: %s", reason), nil
			}
		}
	}
	return "", rows.Err()
}

// scanAction scans a single row into a ModerationAction.
func scanAction(row interface{ Scan(dest ...any) error }) (*ModerationAction, error) {
	var a ModerationAction
	err := row.Scan(
		&a.ID, &a.OrgID, &a.TargetUserID, &a.ModeratorID, &a.ActionType, &a.Reason,
		&a.ChannelID, &a.ExpiresAt, &a.RevokedAt, &a.RevokedBy, &a.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}
