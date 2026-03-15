-- Initial Schema for Project Nox: Authentication & Identity
-- Domain 1: Multi-tenant User/Org isolation via PostgreSQL RLS

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    recovery_questions JSONB,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Organization Memberships (RBAC link)
CREATE TABLE IF NOT EXISTS organization_memberships (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, guest
    PRIMARY KEY (user_id, org_id)
);

-- 4. Enable Row-Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for multi-tenant isolation
-- The Bifrost service sets app.current_org_id and app.current_user_id per-request
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_isolation_policy') THEN
    CREATE POLICY org_isolation_policy ON organizations
      FOR ALL USING (id = current_setting('app.current_org_id', true)::UUID);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'membership_isolation_policy') THEN
    CREATE POLICY membership_isolation_policy ON organization_memberships
      FOR ALL USING (
        user_id = current_setting('app.current_user_id', true)::UUID
        OR org_id = current_setting('app.current_org_id', true)::UUID
      );
  END IF;
END $$;

-- 5. Channels
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5b. Channel CRUD enhancements (Issue #28)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS topic VARCHAR(256);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Unique channel name per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_org_name ON channels (org_id, name);

-- 6. Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    content_md TEXT NOT NULL,
    content_html TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add parent_id to existing table safely
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES messages(id) ON DELETE CASCADE;

-- Add is_edited flag for Issue #16
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;

-- Add reply_to for Contextual Reply (Issue #21)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Add forward_source_id for Message Forwarding (Issue #22)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forward_source_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- 7. Message Edit History (Audit Trail)
CREATE TABLE IF NOT EXISTS message_edits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    old_content_md TEXT NOT NULL,
    old_content_html TEXT NOT NULL,
    new_content_md TEXT NOT NULL,
    new_content_html TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Channel Pins (Global)
CREATE TABLE IF NOT EXISTS channel_pins (
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (channel_id, message_id)
);

-- 9. User Bookmarks (Personal)
CREATE TABLE IF NOT EXISTS user_bookmarks (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, message_id)
);

-- 10. Channel Reads (Per-user Receipts)
CREATE TABLE IF NOT EXISTS channel_reads (
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

-- 11. Password Reset columns on users table (Issue #40)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_request_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_request_window TIMESTAMPTZ;

-- 12. User Profile columns (Issue #26)
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) DEFAULT '';

-- 13. User Preferences (Issue #26)
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(10) DEFAULT 'dark',
    notification_sound BOOLEAN DEFAULT true,
    notification_desktop BOOLEAN DEFAULT true,
    notification_email BOOLEAN DEFAULT false,
    dnd_enabled BOOLEAN DEFAULT false,
    dnd_start TIME,
    dnd_end TIME,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Organization Invitations (Issue #62)
CREATE TABLE IF NOT EXISTS org_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES users(id),
    email VARCHAR(255),
    role VARCHAR(20) DEFAULT 'member',
    token VARCHAR(64) NOT NULL UNIQUE,
    max_uses INT,
    use_count INT DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Organization Invite Links (Issue #62)
CREATE TABLE IF NOT EXISTS org_invite_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id),
    code VARCHAR(20) NOT NULL UNIQUE,
    role VARCHAR(20) DEFAULT 'member',
    max_uses INT,
    use_count INT DEFAULT 0,
    expires_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Roles (Granular RBAC - Issue #64)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#99AAB5',
    position INT NOT NULL DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, name)
);

-- 17. User Roles (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id, org_id)
);

-- 18. Channel Role Overrides (per-channel permission tweaks)
CREATE TABLE IF NOT EXISTS channel_role_overrides (
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    allow_permissions JSONB NOT NULL DEFAULT '{}',
    deny_permissions JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (channel_id, role_id)
);

-- Enable RLS on RBAC tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_role_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'roles_org_isolation') THEN
    CREATE POLICY roles_org_isolation ON roles
      FOR ALL USING (org_id = current_setting('app.current_org_id', true)::UUID);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_roles_org_isolation') THEN
    CREATE POLICY user_roles_org_isolation ON user_roles
      FOR ALL USING (org_id = current_setting('app.current_org_id', true)::UUID);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'channel_overrides_isolation') THEN
    CREATE POLICY channel_overrides_isolation ON channel_role_overrides
      FOR ALL USING (
        channel_id IN (SELECT id FROM channels WHERE org_id = current_setting('app.current_org_id', true)::UUID)
      );
  END IF;
END $$;

-- Function to seed default roles when an organization is created
CREATE OR REPLACE FUNCTION seed_default_roles() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO roles (org_id, name, color, position, is_default, permissions) VALUES
    (NEW.id, 'Owner', '#E74C3C', 100, true, '{
        "manage_org": true, "manage_members": true, "manage_roles": true, "manage_billing": true, "view_analytics": true,
        "create_channels": true, "manage_channels": true, "manage_channel_permissions": true,
        "send_messages": true, "delete_messages": true, "pin_messages": true, "manage_reactions": true,
        "kick_members": true, "ban_members": true, "view_audit_log": true,
        "use_ai": true, "manage_ai_agents": true,
        "upload_files": true, "manage_files": true
    }'),
    (NEW.id, 'Admin', '#3498DB', 80, true, '{
        "manage_members": true, "manage_roles": true, "view_analytics": true,
        "create_channels": true, "manage_channels": true, "manage_channel_permissions": true,
        "send_messages": true, "delete_messages": true, "pin_messages": true, "manage_reactions": true,
        "kick_members": true, "ban_members": true, "view_audit_log": true,
        "use_ai": true, "manage_ai_agents": true,
        "upload_files": true, "manage_files": true
    }'),
    (NEW.id, 'Moderator', '#2ECC71', 60, true, '{
        "send_messages": true, "delete_messages": true, "pin_messages": true, "manage_reactions": true,
        "kick_members": true, "view_audit_log": true,
        "use_ai": true,
        "upload_files": true
    }'),
    (NEW.id, 'Member', '#99AAB5', 40, true, '{
        "send_messages": true, "pin_messages": true, "manage_reactions": true,
        "use_ai": true,
        "upload_files": true
    }'),
    (NEW.id, 'Guest', '#95A5A6', 20, true, '{
    }');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger to avoid duplicates on re-run
DROP TRIGGER IF EXISTS trg_seed_default_roles ON organizations;
CREATE TRIGGER trg_seed_default_roles
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION seed_default_roles();

-- 19. Friendships (Issue #61)
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);

-- 20. Organization Settings columns (Issue #30)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';

-- 21. Channel Members (Private Channel ACL - Issue #120)
CREATE TABLE IF NOT EXISTS channel_members (
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);

-- 22. Direct Messages (Issue #113)
-- DM channels reuse the channels table (with is_dm=true) so messages can
-- leverage the existing foreign key.  A separate dm_channels join table maps
-- exactly two users to a backing channel.
ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_dm BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS dm_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_channels_user1 ON dm_channels(user1_id);
CREATE INDEX IF NOT EXISTS idx_dm_channels_user2 ON dm_channels(user2_id);

-- 23. Banned Members (Issue #63 - Org Member Management)
CREATE TABLE IF NOT EXISTS banned_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by UUID NOT NULL REFERENCES users(id),
    reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- 24. Notifications (Issue #33)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'mention', 'reply', 'reaction', 'channel_invite', 'system'
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;

-- 25. Channel Categories (Issue #65)
CREATE TABLE IF NOT EXISTS channel_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_categories_org ON channel_categories(org_id, position);

ALTER TABLE channels ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES channel_categories(id) ON DELETE SET NULL;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0;

-- 26. Moderation Actions (Issue #66)
CREATE TABLE IF NOT EXISTS moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('timeout', 'channel_mute', 'server_mute', 'warn', 'ban')),
    reason TEXT NOT NULL,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target ON moderation_actions(target_user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_org ON moderation_actions(org_id, created_at DESC);
