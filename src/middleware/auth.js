import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

export function signToken(payload, expiresIn = '30d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function extractToken(req) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/** Requires a valid JWT. Sets req.user = { sub, role, ... }. Responds 401 if missing/invalid. */
export function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/** Verifies a JWT if present, but never fails the request when it's missing/invalid. */
export function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // ignore invalid/expired token on optional routes (e.g. guest checkout)
    }
  }
  next();
}

/** Must run after `authenticate`. Responds 403 if the caller isn't an admin. */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
