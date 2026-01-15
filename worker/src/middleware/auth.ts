// Authentication Middleware

import type { Env } from '../types';

/**
 * Simple API key authentication (stored in KV)
 * In production, use proper session management
 */
export async function authenticate(
  request: Request,
  env: Env
): Promise<{ authenticated: boolean; user_email?: string; error?: string }> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    // Check for session cookie as fallback
    const sessionCookie = request.headers.get('Cookie');
    if (sessionCookie && sessionCookie.includes('session=')) {
      const sessionId = sessionCookie.split('session=')[1]?.split(';')[0];
      if (sessionId) {
        const session = await env.AUTH.get(`session:${sessionId}`, 'json');
        if (session && typeof session === 'object' && 'user_email' in session) {
          return { authenticated: true, user_email: (session as any).user_email };
        }
      }
    }

    return { authenticated: false, error: 'No authorization provided' };
  }

  // Bearer token format
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Check against stored API keys in KV
    const storedKey = await env.AUTH.get('admin_key');
    if (token === storedKey) {
      return { authenticated: true, user_email: 'admin@tdrealty.com' };
    }

    // Check partner keys (format: partner_key:{partner_id})
    const partnerEmail = await env.AUTH.get(`partner_key:${token}`);
    if (partnerEmail) {
      return { authenticated: true, user_email: partnerEmail };
    }

    return { authenticated: false, error: 'Invalid API key' };
  }

  return { authenticated: false, error: 'Invalid authorization format' };
}

/**
 * Creates a session and returns session ID
 */
export async function createSession(
  env: Env,
  user_email: string,
  ttl: number = 86400
): Promise<string> {
  const sessionId = crypto.randomUUID();
  await env.AUTH.put(
    `session:${sessionId}`,
    JSON.stringify({ user_email, created_at: new Date().toISOString() }),
    { expirationTtl: ttl }
  );
  return sessionId;
}
