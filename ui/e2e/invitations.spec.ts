import { test, expect } from '@playwright/test';
import { Client } from 'pg';

const API_BASE = 'http://localhost:8080/v1';

test.describe('Organization Invitations & Join Flow', () => {
  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000000)}`;
  const adminEmail = `admin-inv-${uniqueId}@example.com`;
  const memberEmail = `member-inv-${uniqueId}@example.com`;
  const testPassword = 'Password123!';
  const adminUsername = `adm_${Math.floor(Math.random() * 1000000000)}`;
  const memberUsername = `mem_${Math.floor(Math.random() * 1000000000)}`;
  const orgName = `InviteTestOrg_${uniqueId}`;

  let adminToken: string;
  let adminOrgId: string;
  let memberToken: string;

  // Helper: register, verify, and login a user via API
  async function registerAndLogin(email: string, username: string, password: string, org: string) {
    // Register
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        username,
        password,
        full_name: username,
        org_name: org,
      }),
    });
    expect(regRes.ok).toBeTruthy();

    // Verify email via DB
    const connectionString = process.env.DATABASE_URL || 'postgres://serpent@localhost:5432/nox?sslmode=disable';
    const client = new Client({ connectionString });
    await client.connect();
    let realToken = null;
    for (let i = 0; i < 15; i++) {
      const res = await client.query('SELECT verification_token FROM users WHERE email = $1', [email]);
      if (res.rows.length > 0 && res.rows[0].verification_token) {
        realToken = res.rows[0].verification_token;
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    expect(realToken).toBeTruthy();

    await fetch(`${API_BASE}/auth/verify?token=${realToken}`);
    await client.end();

    // Login
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.ok).toBeTruthy();
    const loginData = await loginRes.json();
    return { token: loginData.token, orgId: loginData.org_id, userId: loginData.user_id };
  }

  test.beforeAll(async () => {
    // Set up admin user
    const admin = await registerAndLogin(adminEmail, adminUsername, testPassword, orgName);
    adminToken = admin.token;
    adminOrgId = admin.orgId;

    // Set up member user (separate org)
    const member = await registerAndLogin(memberEmail, memberUsername, testPassword, 'MemberOrg');
    memberToken = member.token;
  });

  test('API: Create email invitation (admin)', async () => {
    const res = await fetch(`${API_BASE}/orgs/${adminOrgId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: 'newuser@example.com',
        role: 'member',
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.invitation).toBeTruthy();
    expect(data.invitation.email).toBe('newuser@example.com');
    expect(data.invite_url).toContain('token=');
  });

  test('API: Create invite link (admin)', async () => {
    const res = await fetch(`${API_BASE}/orgs/${adminOrgId}/invite-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'member' }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.invite_link).toBeTruthy();
    expect(data.invite_link.code).toBeTruthy();
    expect(data.join_url).toContain('/join/');
  });

  test('API: List invitations (admin)', async () => {
    const res = await fetch(`${API_BASE}/orgs/${adminOrgId}/invitations`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invitations).toBeDefined();
    expect(data.invite_links).toBeDefined();
  });

  test('API: Non-admin cannot create invitations', async () => {
    const res = await fetch(`${API_BASE}/orgs/${adminOrgId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        email: 'blocked@example.com',
        role: 'member',
      }),
    });

    // Member token is for a different org, so should fail
    expect(res.status).toBe(403);
  });

  test('API: Join via invite link', async () => {
    // Create a link
    const createRes = await fetch(`${API_BASE}/orgs/${adminOrgId}/invite-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'member' }),
    });
    const createData = await createRes.json();
    const code = createData.invite_link.code;

    // Get public info
    const infoRes = await fetch(`${API_BASE}/join/${code}`);
    expect(infoRes.status).toBe(200);
    const info = await infoRes.json();
    expect(info.org_name).toBe(orgName);

    // Join as member
    const joinRes = await fetch(`${API_BASE}/join/${code}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
    });
    expect(joinRes.status).toBe(200);
    const joinData = await joinRes.json();
    expect(joinData.success).toBe(true);
    expect(joinData.org_id).toBe(adminOrgId);
  });

  test('API: Accept email invitation', async () => {
    // Create invitation
    const createRes = await fetch(`${API_BASE}/orgs/${adminOrgId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: memberEmail,
        role: 'guest',
      }),
    });
    const createData = await createRes.json();
    const invToken = createData.invitation.token;

    // Accept the invitation (member already joined via link, so should succeed as already-a-member)
    const acceptRes = await fetch(`${API_BASE}/invitations/${invToken}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
    });
    expect(acceptRes.status).toBe(200);
    const acceptData = await acceptRes.json();
    expect(acceptData.success).toBe(true);
  });

  test('API: Revoke invitation', async () => {
    // Create an invitation to revoke
    const createRes = await fetch(`${API_BASE}/orgs/${adminOrgId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: 'revoke-test@example.com',
        role: 'member',
      }),
    });
    const createData = await createRes.json();
    const invId = createData.invitation.id;

    // Revoke it
    const revokeRes = await fetch(`${API_BASE}/orgs/${adminOrgId}/invitations/${invId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(revokeRes.status).toBe(200);
  });

  test('API: Invalid invite code returns 404', async () => {
    const res = await fetch(`${API_BASE}/join/invalidcode12345`);
    expect(res.status).toBe(404);
  });

  test('UI: Join page renders for valid invite link', async ({ page }) => {
    // First create a link via API
    const createRes = await fetch(`${API_BASE}/orgs/${adminOrgId}/invite-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'member' }),
    });
    const createData = await createRes.json();
    const code = createData.invite_link.code;

    await page.goto(`/join/${code}`);
    await expect(page.getByText(orgName)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Accept & Join').or(page.getByText('Sign in to Join'))).toBeVisible();
  });

  test('UI: Invalid invite link shows error', async ({ page }) => {
    await page.goto('/join/XXXXXXXXXXX');
    await expect(
      page.getByText('invalid').or(page.getByText('expired')).or(page.getByText('Go Home'))
    ).toBeVisible({ timeout: 10000 });
  });
});
