package db

import (
	"context"
	"time"
)

// UserProfile represents the public profile fields of a user.
type UserProfile struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	Username    string  `json:"username"`
	FullName    string  `json:"full_name"`
	DisplayName string  `json:"display_name"`
	Bio         string  `json:"bio"`
	AvatarURL   string  `json:"avatar_url"`
	CreatedAt   string  `json:"created_at"`
}

// UserPreferences represents the user's app preferences.
type UserPreferences struct {
	UserID              string     `json:"user_id"`
	Theme               string     `json:"theme"`
	NotificationSound   bool       `json:"notification_sound"`
	NotificationDesktop bool       `json:"notification_desktop"`
	NotificationEmail   bool       `json:"notification_email"`
	DNDEnabled          bool       `json:"dnd_enabled"`
	DNDStart            *time.Time `json:"dnd_start,omitempty"`
	DNDEnd              *time.Time `json:"dnd_end,omitempty"`
	UpdatedAt           string     `json:"updated_at"`
}

// GetUserProfile returns the profile for the given user ID.
func (db *Database) GetUserProfile(ctx context.Context, userID string) (*UserProfile, error) {
	var p UserProfile
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, username, COALESCE(full_name, ''), COALESCE(display_name, ''),
		        COALESCE(bio, ''), COALESCE(avatar_url, ''), created_at::text
		 FROM users WHERE id = $1`, userID).Scan(
		&p.ID, &p.Email, &p.Username, &p.FullName, &p.DisplayName,
		&p.Bio, &p.AvatarURL, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// UpdateUserProfile updates display_name and bio for a user.
func (db *Database) UpdateUserProfile(ctx context.Context, userID, displayName, bio string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users SET display_name = $2, bio = $3, updated_at = NOW() WHERE id = $1`,
		userID, displayName, bio)
	return err
}

// UpdateUserAvatarURL sets the avatar_url for a user.
func (db *Database) UpdateUserAvatarURL(ctx context.Context, userID, avatarURL string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users SET avatar_url = $2, updated_at = NOW() WHERE id = $1`,
		userID, avatarURL)
	return err
}

// GetUserPreferences returns preferences for a user, creating defaults if none exist.
func (db *Database) GetUserPreferences(ctx context.Context, userID string) (*UserPreferences, error) {
	// Upsert default preferences if they don't exist
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
		userID)
	if err != nil {
		return nil, err
	}

	var p UserPreferences
	var dndStart, dndEnd *string
	err = db.Pool.QueryRow(ctx,
		`SELECT user_id, theme, notification_sound, notification_desktop, notification_email,
		        dnd_enabled, dnd_start::text, dnd_end::text, updated_at::text
		 FROM user_preferences WHERE user_id = $1`, userID).Scan(
		&p.UserID, &p.Theme, &p.NotificationSound, &p.NotificationDesktop, &p.NotificationEmail,
		&p.DNDEnabled, &dndStart, &dndEnd, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// UpdateUserPreferences updates the user's preferences.
func (db *Database) UpdateUserPreferences(ctx context.Context, userID string, prefs map[string]interface{}) error {
	// Upsert default row first
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
		userID)
	if err != nil {
		return err
	}

	// Build dynamic update based on provided fields
	if theme, ok := prefs["theme"].(string); ok {
		if theme != "dark" && theme != "light" && theme != "system" {
			theme = "dark"
		}
		_, err = db.Pool.Exec(ctx,
			`UPDATE user_preferences SET theme = $2, updated_at = NOW() WHERE user_id = $1`,
			userID, theme)
		if err != nil {
			return err
		}
	}

	if v, ok := prefs["notification_sound"]; ok {
		if b, ok := v.(bool); ok {
			_, err = db.Pool.Exec(ctx,
				`UPDATE user_preferences SET notification_sound = $2, updated_at = NOW() WHERE user_id = $1`,
				userID, b)
			if err != nil {
				return err
			}
		}
	}

	if v, ok := prefs["notification_desktop"]; ok {
		if b, ok := v.(bool); ok {
			_, err = db.Pool.Exec(ctx,
				`UPDATE user_preferences SET notification_desktop = $2, updated_at = NOW() WHERE user_id = $1`,
				userID, b)
			if err != nil {
				return err
			}
		}
	}

	if v, ok := prefs["notification_email"]; ok {
		if b, ok := v.(bool); ok {
			_, err = db.Pool.Exec(ctx,
				`UPDATE user_preferences SET notification_email = $2, updated_at = NOW() WHERE user_id = $1`,
				userID, b)
			if err != nil {
				return err
			}
		}
	}

	if v, ok := prefs["dnd_enabled"]; ok {
		if b, ok := v.(bool); ok {
			_, err = db.Pool.Exec(ctx,
				`UPDATE user_preferences SET dnd_enabled = $2, updated_at = NOW() WHERE user_id = $1`,
				userID, b)
			if err != nil {
				return err
			}
		}
	}

	if v, ok := prefs["dnd_start"]; ok {
		if s, ok := v.(string); ok && s != "" {
			_, err = db.Pool.Exec(ctx,
				`UPDATE user_preferences SET dnd_start = $2::time, updated_at = NOW() WHERE user_id = $1`,
				userID, s)
			if err != nil {
				return err
			}
		}
	}

	if v, ok := prefs["dnd_end"]; ok {
		if s, ok := v.(string); ok && s != "" {
			_, err = db.Pool.Exec(ctx,
				`UPDATE user_preferences SET dnd_end = $2::time, updated_at = NOW() WHERE user_id = $1`,
				userID, s)
			if err != nil {
				return err
			}
		}
	}

	return nil
}
