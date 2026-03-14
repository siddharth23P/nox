import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/v1';

test.describe('RBAC - Roles & Permissions (Issue #64)', () => {
  let token: string;
  let orgId: string;
  let userId: string;
  let customRoleId: string;

  test.beforeAll(async ({ request }) => {
    // Register a fresh user for RBAC tests
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000000)}`;
    const email = `rbac-test-${uniqueId}@example.com`;
    const username = `rbac_${Math.floor(Math.random() * 1000000000)}`;

    const registerRes = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email,
        password: 'Password123!',
        username,
        full_name: 'RBAC Tester',
        org_name: 'RBAC Test Org',
      },
    });
    expect(registerRes.ok()).toBeTruthy();
    const registerData = await registerRes.json();
    userId = registerData.user_id;
    orgId = registerData.org_id;

    // Auto-verify the user directly via the API (CI shortcut)
    const { Client } = await import('pg');
    const connectionString = process.env.DATABASE_URL || 'postgres://serpent@localhost:5432/nox?sslmode=disable';
    const client = new Client({ connectionString });
    await client.connect();
    await client.query('UPDATE users SET is_email_verified = TRUE WHERE id = $1', [userId]);
    await client.end();

    // Login to get a token
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email, password: 'Password123!' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    token = loginData.token;
    orgId = loginData.org_id;
    userId = loginData.user_id;
  });

  test('should list default roles for a new org', async ({ request }) => {
    const res = await request.get(`${API_BASE}/orgs/${orgId}/roles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.roles).toBeDefined();
    expect(data.roles.length).toBeGreaterThanOrEqual(5);

    const roleNames = data.roles.map((r: { name: string }) => r.name);
    expect(roleNames).toContain('Owner');
    expect(roleNames).toContain('Admin');
    expect(roleNames).toContain('Moderator');
    expect(roleNames).toContain('Member');
    expect(roleNames).toContain('Guest');
  });

  test('should create a custom role', async ({ request }) => {
    const res = await request.post(`${API_BASE}/orgs/${orgId}/roles`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: 'Designer',
        color: '#9B59B6',
        position: 50,
        permissions: {
          send_messages: true,
          upload_files: true,
          use_ai: true,
        },
      },
    });
    expect(res.ok() || res.status() === 201).toBeTruthy();
    const role = await res.json();
    expect(role.name).toBe('Designer');
    expect(role.color).toBe('#9B59B6');
    expect(role.is_default).toBe(false);
    customRoleId = role.id;
  });

  test('should update a custom role', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/orgs/${orgId}/roles/${customRoleId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: 'Lead Designer',
        color: '#E91E63',
        position: 55,
        permissions: {
          send_messages: true,
          upload_files: true,
          manage_files: true,
          use_ai: true,
        },
      },
    });
    expect(res.ok()).toBeTruthy();
    const role = await res.json();
    expect(role.name).toBe('Lead Designer');
    expect(role.permissions.manage_files).toBe(true);
  });

  test('should assign and query user roles', async ({ request }) => {
    // Assign the custom role
    const assignRes = await request.post(`${API_BASE}/orgs/${orgId}/members/${userId}/roles`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { role_id: customRoleId },
    });
    expect(assignRes.ok()).toBeTruthy();

    // Query effective permissions
    const permRes = await request.get(`${API_BASE}/orgs/${orgId}/members/${userId}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(permRes.ok()).toBeTruthy();
    const permData = await permRes.json();
    expect(permData.permissions).toBeDefined();
    expect(permData.permissions.send_messages).toBe(true);
  });

  test('should remove a role from a user', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/orgs/${orgId}/members/${userId}/roles/${customRoleId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('should not delete a default role', async ({ request }) => {
    // Get the Owner role ID
    const listRes = await request.get(`${API_BASE}/orgs/${orgId}/roles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await listRes.json();
    const ownerRole = data.roles.find((r: { name: string }) => r.name === 'Owner');
    expect(ownerRole).toBeDefined();

    const res = await request.delete(`${API_BASE}/orgs/${orgId}/roles/${ownerRole.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeFalsy();
  });

  test('should delete a custom role', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/orgs/${orgId}/roles/${customRoleId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();

    // Verify it's gone
    const listRes = await request.get(`${API_BASE}/orgs/${orgId}/roles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await listRes.json();
    const found = data.roles.find((r: { id: string }) => r.id === customRoleId);
    expect(found).toBeUndefined();
  });

  test('should fetch permission schema', async ({ request }) => {
    const res = await request.get(`${API_BASE}/permissions/schema`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.categories).toBeDefined();
    expect(data.categories.length).toBeGreaterThanOrEqual(6);
    expect(data.categories[0].permissions).toBeDefined();
  });
});
