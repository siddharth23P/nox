/**
 * Shared E2E auth helper – logs in a seeded user via the real API and returns a valid JWT.
 *
 * Seeded users all share the password "TestPassword123" and are pre-verified.
 */
import { BrowserContext, Page } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8080/v1';
const SEED_PASSWORD = 'TestPassword123';

export interface AuthResult {
  token: string;
  userId: string;
  orgId: string;
}

/** Well-known seeded users. */
export const USERS = {
  AliceReads: { id: 'a1111111-1111-1111-1111-111111111111', email: 'alice.reads@example.com', username: 'AliceReads' },
  BobReads: { id: 'b2222222-2222-2222-2222-222222222222', email: 'bob.reads@example.com', username: 'BobReads' },
  AliceReacts: { id: 'a1000000-0000-0000-0000-000000000000', email: 'alice.reactions@example.com', username: 'AliceReacts' },
  BobReacts: { id: 'b2000000-0000-0000-0000-000000000000', email: 'bob.reactions@example.com', username: 'BobReacts' },
  AliceQuote: { id: 'a7000000-0000-0000-0000-000000000000', email: 'alice.quote@example.com', username: 'AliceQuote' },
  BobQuote: { id: 'b7000000-0000-0000-0000-000000000000', email: 'bob.quote@example.com', username: 'BobQuote' },
  Charlie: { id: 'a3000000-0000-0000-0000-000000000000', email: 'charlie@nox.inc', username: 'Charlie' },
  Diana: { id: 'a4000000-0000-0000-0000-000000000000', email: 'diana@nox.inc', username: 'Diana' },
  Evan: { id: 'a5000000-0000-0000-0000-000000000000', email: 'evan@nox.inc', username: 'Evan' },
  Fiona: { id: 'a6000000-0000-0000-0000-000000000000', email: 'fiona@nox.inc', username: 'Fiona' },
  TestUser: { id: '22222222-2222-2222-2222-222222222222', email: 'test@example.com', username: 'TestUser' },
  ThreadMaster: { id: '33333333-3333-3333-3333-333333333333', email: 'threads@example.com', username: 'ThreadMaster' },
  AlicePresence: { id: 'e1000000-0000-0000-0000-000000000000', email: 'alice.presence@example.com', username: 'AlicePresence' },
  BobPresence: { id: 'e2000000-0000-0000-0000-000000000000', email: 'bob.presence@example.com', username: 'BobPresence' },
  RogueUser: { id: 'c7f8b902-7785-46f6-8144-07d0d526f5c0', email: 'rogue@example.com', username: 'RogueUser' },
} as const;

const ORG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Login a seeded user via the REST API and return the JWT + metadata.
 */
export async function loginUser(email: string): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed for ${email}: ${res.status} ${body}`);
  }

  const data = await res.json();
  return {
    token: data.token,
    userId: data.user_id,
    orgId: data.org_id || ORG_ID,
  };
}

interface InjectOpts {
  role?: string;
  activeChannel?: { id: string; name: string };
}

function buildInitScript(
  user: { id: string; username: string; email: string },
  auth: AuthResult,
  opts?: InjectOpts,
) {
  const role = opts?.role || 'member';
  const activeChannel = opts?.activeChannel || { id: '00000000-0000-0000-0000-000000000001', name: 'general' };
  return {
    fn: (data: Record<string, unknown>) => {
      (window as unknown as { IS_PLAYWRIGHT: boolean }).IS_PLAYWRIGHT = true;
      localStorage.setItem('nox_token', data.token as string);
      localStorage.setItem('nox_org_id', data.orgId as string);
      localStorage.setItem('nox_role', data.role as string);
      localStorage.setItem('nox_user', JSON.stringify({ id: data.userId, username: data.username, email: data.email }));
      localStorage.setItem('nox_active_channel', JSON.stringify(data.activeChannel));
    },
    arg: {
      token: auth.token,
      orgId: auth.orgId,
      role,
      userId: user.id,
      username: user.username,
      email: user.email,
      activeChannel,
    },
  };
}

/**
 * Inject auth state into a Playwright page's localStorage via addInitScript.
 */
export async function injectAuth(page: Page, user: { id: string; username: string; email: string }, auth: AuthResult, opts?: InjectOpts) {
  const { fn, arg } = buildInitScript(user, auth, opts);
  await page.addInitScript(fn, arg);
}

/**
 * Inject auth state into a BrowserContext (for multi-context tests).
 */
export async function injectAuthToContext(ctx: BrowserContext, user: { id: string; username: string; email: string }, auth: AuthResult, opts?: InjectOpts) {
  const { fn, arg } = buildInitScript(user, auth, opts);
  await ctx.addInitScript(fn, arg);
}

/**
 * Convenience: login + inject into page. Returns the auth result.
 */
export async function loginAndInject(page: Page, user: { id: string; username: string; email: string }, opts?: InjectOpts): Promise<AuthResult> {
  const auth = await loginUser(user.email);
  await injectAuth(page, user, auth, opts);
  return auth;
}

/**
 * Convenience: login + inject into context. Returns the auth result.
 */
export async function loginAndInjectContext(ctx: BrowserContext, user: { id: string; username: string; email: string }, opts?: InjectOpts): Promise<AuthResult> {
  const auth = await loginUser(user.email);
  await injectAuthToContext(ctx, user, auth, opts);
  return auth;
}
