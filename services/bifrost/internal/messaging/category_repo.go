package messaging

import (
	"context"
	"fmt"
	"time"

	"github.com/nox-labs/bifrost/internal/db"
)

// Category represents a channel category within an organization.
type Category struct {
	ID        string    `json:"id"`
	OrgID     string    `json:"org_id"`
	Name      string    `json:"name"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"created_at"`
}

// CategoryOrder is used to reorder categories.
type CategoryOrder struct {
	ID       string `json:"id"`
	Position int    `json:"position"`
}

// ChannelOrder is used to reorder channels within a category.
type ChannelOrder struct {
	ID       string `json:"id"`
	Position int    `json:"position"`
}

// CategoryWithChannels extends Category with its channels for the list endpoint.
type CategoryWithChannels struct {
	Category
	Channels []Channel `json:"channels"`
}

// CategoryRepo handles database operations for channel categories.
type CategoryRepo struct {
	db *db.Database
}

// NewCategoryRepo creates a new CategoryRepo.
func NewCategoryRepo(database *db.Database) *CategoryRepo {
	return &CategoryRepo{db: database}
}

// CreateCategory inserts a new category with position set to max+1 for the org.
func (r *CategoryRepo) CreateCategory(ctx context.Context, orgID, name string) (*Category, error) {
	query := `
		INSERT INTO channel_categories (org_id, name, position)
		VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM channel_categories WHERE org_id = $1), 0))
		RETURNING id, org_id, name, position, created_at
	`
	var cat Category
	err := r.db.Pool.QueryRow(ctx, query, orgID, name).Scan(
		&cat.ID, &cat.OrgID, &cat.Name, &cat.Position, &cat.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create category: %w", err)
	}
	return &cat, nil
}

// ListCategories returns all categories for an org ordered by position,
// along with their channels.
func (r *CategoryRepo) ListCategories(ctx context.Context, orgID, userID string) ([]CategoryWithChannels, error) {
	// 1. Fetch categories
	catRows, err := r.db.Pool.Query(ctx, `
		SELECT id, org_id, name, position, created_at
		FROM channel_categories
		WHERE org_id = $1
		ORDER BY position ASC, created_at ASC
	`, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to list categories: %w", err)
	}
	defer catRows.Close()

	var categories []CategoryWithChannels
	catMap := make(map[string]int) // category ID -> index in categories slice

	for catRows.Next() {
		var cat Category
		if err := catRows.Scan(&cat.ID, &cat.OrgID, &cat.Name, &cat.Position, &cat.CreatedAt); err != nil {
			return nil, err
		}
		catMap[cat.ID] = len(categories)
		categories = append(categories, CategoryWithChannels{
			Category: cat,
			Channels: []Channel{},
		})
	}

	// 2. Fetch channels that belong to categories in this org
	chRows, err := r.db.Pool.Query(ctx, `
		SELECT id, org_id, name, description, topic, is_private, created_by, archived_at, created_at, updated_at, category_id, position
		FROM channels
		WHERE org_id = $1
		  AND category_id IS NOT NULL
		  AND archived_at IS NULL
		  AND (is_dm = FALSE OR is_dm IS NULL)
		  AND (is_private = FALSE OR EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id = channels.id AND cm.user_id = $2))
		ORDER BY position ASC, name ASC
	`, orgID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list categorized channels: %w", err)
	}
	defer chRows.Close()

	for chRows.Next() {
		var ch Channel
		var categoryID *string
		var position int
		if err := chRows.Scan(&ch.ID, &ch.OrgID, &ch.Name, &ch.Description, &ch.Topic, &ch.IsPrivate, &ch.CreatedBy, &ch.ArchivedAt, &ch.CreatedAt, &ch.UpdatedAt, &categoryID, &position); err != nil {
			return nil, err
		}
		if categoryID != nil {
			if idx, ok := catMap[*categoryID]; ok {
				categories[idx].Channels = append(categories[idx].Channels, ch)
			}
		}
	}

	return categories, nil
}

// UpdateCategory updates the name of a category.
func (r *CategoryRepo) UpdateCategory(ctx context.Context, categoryID, name string) error {
	tag, err := r.db.Pool.Exec(ctx, `
		UPDATE channel_categories SET name = $1 WHERE id = $2
	`, name, categoryID)
	if err != nil {
		return fmt.Errorf("failed to update category: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("category not found")
	}
	return nil
}

// DeleteCategory deletes a category. Channels in this category get category_id set to NULL via ON DELETE SET NULL.
func (r *CategoryRepo) DeleteCategory(ctx context.Context, categoryID string) error {
	tag, err := r.db.Pool.Exec(ctx, `DELETE FROM channel_categories WHERE id = $1`, categoryID)
	if err != nil {
		return fmt.Errorf("failed to delete category: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("category not found")
	}
	return nil
}

// ReorderCategories batch-updates category positions.
func (r *CategoryRepo) ReorderCategories(ctx context.Context, orgID string, order []CategoryOrder) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, o := range order {
		_, err := tx.Exec(ctx, `
			UPDATE channel_categories SET position = $1 WHERE id = $2 AND org_id = $3
		`, o.Position, o.ID, orgID)
		if err != nil {
			return fmt.Errorf("failed to reorder category %s: %w", o.ID, err)
		}
	}

	return tx.Commit(ctx)
}

// SetChannelCategory assigns a channel to a category (or removes it if categoryID is empty).
func (r *CategoryRepo) SetChannelCategory(ctx context.Context, channelID, categoryID string) error {
	var query string
	var args []interface{}

	if categoryID == "" {
		query = `UPDATE channels SET category_id = NULL WHERE id = $1`
		args = []interface{}{channelID}
	} else {
		query = `UPDATE channels SET category_id = $1 WHERE id = $2`
		args = []interface{}{categoryID, channelID}
	}

	tag, err := r.db.Pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to set channel category: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("channel not found")
	}
	return nil
}

// ReorderChannels batch-updates channel positions within a category.
func (r *CategoryRepo) ReorderChannels(ctx context.Context, categoryID string, order []ChannelOrder) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, o := range order {
		_, err := tx.Exec(ctx, `
			UPDATE channels SET position = $1 WHERE id = $2 AND category_id = $3
		`, o.Position, o.ID, categoryID)
		if err != nil {
			return fmt.Errorf("failed to reorder channel %s: %w", o.ID, err)
		}
	}

	return tx.Commit(ctx)
}
