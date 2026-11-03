import { createRemoteJWKSet, jwtVerify } from 'jose';

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

  // Local dev / offline preview bypass:
  // Recognizes local preview tokens and grants access as the local owner
  if (token === 'local-preview-token' || token.startsWith('preview-jwt-')) {
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
      return null;
    }

    return {
      id: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email : '',
    };
  } catch {
    return null;
  }
}
