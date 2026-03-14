import { test, expect } from '@playwright/test';
import { Client } from 'pg';

const API_BASE = 'http://localhost:8080/v1';

test.describe('Organization Settings & Member Management', () => {
  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000000)}`;
  const ownerEmail = `owner-org-${uniqueId}@example.com`;
  const memberEmail = `member-org-${uniqueId}@example.com`;
  const testPassword = 'Password123!';
  const ownerUsername = `own_${Math.floor(Math.random() * 1000000000)}`;
  const memberUsername = `mem_${Math.floor(Math.random() * 1000000000)}`;
  const orgName = `OrgSettingsTest_${uniqueId}`;

  let ownerToken: string;
  let ownerOrgId: string;
  let memberToken: string;
  let memberUserId: string;

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
    return loginData;
  }

  test.beforeAll(async () => {
    // Register owner
    const ownerData = await registerAndLogin(ownerEmail, ownerUsername, testPassword, orgName);
    ownerToken = ownerData.token;
    ownerOrgId = ownerData.org_id;

    // Register member (creates their own org)
    const memberData = await registerAndLogin(memberEmail, memberUsername, testPassword, `MemberOrg_${uniqueId}`);
    memberToken = memberData.token;
    memberUserId = memberData.user_id;

    // Add member to owner's org via invitation
    const inviteRes = await fetch(`${API_BASE}/orgs/${ownerOrgId}/invite-links`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'member' }),
    });
    expect(inviteRes.ok).toBeTruthy();
    const inviteData = await inviteRes.json();

    // Member joins via link
    const joinRes = await fetch(`${API_BASE}/join/${inviteData.code}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(joinRes.ok).toBeTruthy();
  });

  test('GET /v1/orgs/:orgId/settings - returns org settings', async () => {
    const res = await fetch(`${API_BASE}/orgs/${ownerOrgId}/settings`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.name).toBe(orgName);
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('logo_url');
    expect(data).toHaveProperty('slug');
  });

  test('PATCH /v1/orgs/:orgId - update org settings (owner)', async () => {
    const newDescription = 'Updated org description for testing';
    const res = await fetch(`${API_BASE}/orgs/${ownerOrgId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName, description: newDescription }),
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.description).toBe(newDescription);
  });

  test('PATCH /v1/orgs/:orgId - denied for members', async () => {
    // Switch member to owner's org first
    const switchRes = await fetch(`${API_BASE}/orgs/${ownerOrgId}/switch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(switchRes.ok).toBeTruthy();
    const switchData = await switchRes.json();
    const memberOrgToken = switchData.token;

    const res = await fetch(`${API_BASE}/orgs/${ownerOrgId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${memberOrgToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Name', description: 'Hacked' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('insufficient permissions');
  });

  test('GET /v1/orgs/:orgId/members - lists members', async () => {
    const res = await fetch(`${API_BASE}/orgs/${ownerOrgId}/members`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.members.length).toBeGreaterThanOrEqual(2);
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('limit');
    expect(data).toHaveProperty('offset');
  });

  test('GET /v1/orgs/:orgId/members?search= - search members', async () => {
    const res = await fetch(`${API_BASE}/orgs/${ownerOrgId}/members?search=${memberUsername}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.members.length).toBe(1);
    expect(data.members[0].username).toBe(memberUsername);
  });

  test('PATCH /v1/orgs/:orgId/members/:userId/role - change member role', async () => {
    const res = await fetch(`${API_BASE}/orgs/${ownerOrgId}/members/${memberUserId}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.ok).toBeTruthy();

    // Verify the change
    const membersRes = await fetch(`${API_BASE}/orgs/${ownerOrgId}/members?search=${memberUsername}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const membersData = await membersRes.json();
    expect(membersData.members[0].role).toBe('admin');

    // Change back to member for further tests
    await fetch(`${API_BASE}/orgs/${ownerOrgId}/members/${memberUserId}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'member' }),
    });
  });

  test('DELETE /v1/orgs/:orgId/members/:userId - remove member', async () => {
    // Create a throwaway member to remove
    const throwawayId = `${Date.now()}-throwaway`;
    const throwawayEmail = `throw-${throwawayId}@example.com`;
    const throwawayUsername = `thr_${Math.floor(Math.random() * 1000000000)}`;
    const throwawayData = await registerAndLogin(throwawayEmail, throwawayUsername, testPassword, `ThrowOrg_${throwawayId}`);

    // Create invite link and have throwaway join
    const inviteRes = await fetch(`${API_BASE}/orgs/${ownerOrgId}/invite-links`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'member' }),
    });
    const inviteData = await inviteRes.json();
    await fetch(`${API_BASE}/join/${inviteData.code}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${throwawayData.token}` },
    });

    // Remove the throwaway member
    const res = await fetch(`${API_BASE}/orgs/${ownerOrgId}/members/${throwawayData.user_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.message).toBe('member removed');
  });
});
