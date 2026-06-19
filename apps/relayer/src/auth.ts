/**
 * Authentication middleware for the Veil relayer.
 *
 * Protects sensitive endpoints with API key authentication.
 * The API key is set via the RELAYER_API_KEY environment variable.
 *
 * Usage:
 *   import { requireApiKey } from './auth.js';
 *   router.post('/protected', requireApiKey, handler);
 *
 * In production, this should be replaced with proper OAuth2/JWT authentication
 * tied to employer/auditor identities.
 */
import type { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.RELAYER_API_KEY || '';

/**
 * Middleware that requires a valid API key in the Authorization header.
 * Format: Authorization: Bearer <api-key>
 *
 * If RELAYER_API_KEY is not set, all requests are allowed (dev mode).
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  // If no API key is configured, allow all requests (development mode)
  if (!API_KEY) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header. Expected: Bearer <api-key>' });
    return;
  }

  const providedKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  if (providedKey !== API_KEY) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  next();
}

/**
 * Middleware that requires a valid API key OR allows public access.
 * Used for endpoints that are sensitive but may need public access in demo mode.
 *
 * If RELAYER_API_KEY is set, requires authentication.
 * If not set, allows all requests.
 */
export function optionalApiKey(req: Request, res: Response, next: NextFunction): void {
  // Same logic as requireApiKey, but this is semantically different:
  // the endpoint is designed to be public in demo mode but protected in production.
  requireApiKey(req, res, next);
}
