package auth

// Permission constants for the granular RBAC system.
// These map 1:1 with the JSONB keys stored in the roles.permissions column.

// Organization permissions
const (
	PermManageOrg        = "manage_org"
	PermManageMembers    = "manage_members"
	PermManageRoles      = "manage_roles"
	PermManageBilling    = "manage_billing"
	PermViewAnalytics    = "view_analytics"
)

// Channel permissions
const (
	PermCreateChannels          = "create_channels"
	PermManageChannels          = "manage_channels"
	PermManageChannelPermissions = "manage_channel_permissions"
)

// Message permissions
const (
	PermSendMessages    = "send_messages"
	PermDeleteMessages  = "delete_messages"
	PermPinMessages     = "pin_messages"
	PermManageReactions = "manage_reactions"
)

// Moderation permissions
const (
	PermKickMembers  = "kick_members"
	PermBanMembers   = "ban_members"
	PermViewAuditLog = "view_audit_log"
)

// AI permissions
const (
	PermUseAI          = "use_ai"
	PermManageAIAgents = "manage_ai_agents"
)

// File permissions
const (
	PermUploadFiles = "upload_files"
	PermManageFiles = "manage_files"
)

// PermissionCategory groups permissions for the UI toggle grid.
type PermissionCategory struct {
	Name        string   `json:"name"`
	Permissions []string `json:"permissions"`
}

// AllPermissionCategories returns the full permission schema for the frontend editor.
func AllPermissionCategories() []PermissionCategory {
	return []PermissionCategory{
		{
			Name: "Organization",
			Permissions: []string{
				PermManageOrg, PermManageMembers, PermManageRoles, PermManageBilling, PermViewAnalytics,
			},
		},
		{
			Name: "Channels",
			Permissions: []string{
				PermCreateChannels, PermManageChannels, PermManageChannelPermissions,
			},
		},
		{
			Name: "Messages",
			Permissions: []string{
				PermSendMessages, PermDeleteMessages, PermPinMessages, PermManageReactions,
			},
		},
		{
			Name: "Moderation",
			Permissions: []string{
				PermKickMembers, PermBanMembers, PermViewAuditLog,
			},
		},
		{
			Name: "AI",
			Permissions: []string{
				PermUseAI, PermManageAIAgents,
			},
		},
		{
			Name: "Files",
			Permissions: []string{
				PermUploadFiles, PermManageFiles,
			},
		},
	}
}

// DefaultRoleNames are the built-in roles that cannot be deleted.
var DefaultRoleNames = map[string]bool{
	"Owner":     true,
	"Admin":     true,
	"Moderator": true,
	"Member":    true,
	"Guest":     true,
}

// RoleHierarchy maps default role names to their position level.
// Higher position = more authority.
var RoleHierarchy = map[string]int{
	"Owner":     100,
	"Admin":     80,
	"Moderator": 60,
	"Member":    40,
	"Guest":     20,
}
