import { createRemoteJWKSet, jwtVerify } from 'jose';
import { logger } from './logger.mjs';

let cachedJwks = null;
let cachedJwksUrl = null;

/**
 * Verifies a Supabase JWT access token using either JWKS (asymmetric signing)
 * or SUPABASE_JWT_SECRET (legacy HS256).
 * Never logs raw tokens.
 */
export async function verifySupabaseToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // Local dev / offline preview bypass (strictly restricted to non-production dev mode with explicit flag)
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_DEV_TOKENS === 'true' &&
    (token === 'local-preview-token' || token.startsWith('preview-jwt-'))
  ) {
    const ownerEmail = (process.env.OWNER_EMAIL || 'owner@example.com').toLowerCase().trim();
    return {
      id: 'local-dev-owner',
      email: ownerEmail,
    };
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not configured');
  }

  const expectedIssuer = `${supabaseUrl}/auth/v1`;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  try {
    let payload;
    if (jwtSecret) {
      const secretKey = new TextEncoder().encode(jwtSecret);
      const verified = await jwtVerify(token, secretKey, {
        issuer: expectedIssuer,
        audience: 'authenticated',
      });
      payload = verified.payload;
    } else {
      const jwksUrl = `${expectedIssuer}/.well-known/jwks.json`;
      if (!cachedJwks || cachedJwksUrl !== jwksUrl) {
        cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
        cachedJwksUrl = jwksUrl;
      }
      const verified = await jwtVerify(token, cachedJwks, {
        issuer: expectedIssuer,
        audience: 'authenticated',
      });
      payload = verified.payload;
    }

    if (!payload || !payload.sub) {
      logger.log('AUTH', 'Token rejected: missing sub claim in payload');
      return null;
    }

    const resolvedEmail =
      typeof payload.email === 'string' && payload.email.trim()
        ? payload.email.trim()
        : typeof payload.user_metadata?.email === 'string' && payload.user_metadata.email.trim()
          ? payload.user_metadata.email.trim()
          : '';

    return {
      id: String(payload.sub),
      email: resolvedEmail,
    };
  } catch (err) {
    logger.log('AUTH', `JWKS verification failed: ${err?.message || err}. Attempting Supabase API fallback...`);
    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(4000),
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData?.id) {
          logger.log('AUTH', `Supabase API verified client: ${userData.email || userData.id}`);
          const fallbackEmail =
            typeof userData.email === 'string' && userData.email.trim()
              ? userData.email.trim()
              : typeof userData.user_metadata?.email === 'string' && userData.user_metadata.email.trim()
                ? userData.user_metadata.email.trim()
                : '';
          return {
            id: String(userData.id),
            email: fallbackEmail,
          };
        }
      }
    } catch (fallbackErr) {
      logger.log('AUTH', `Supabase API fallback error: ${fallbackErr?.message || fallbackErr}`);
    }
    return null;
  }
}
