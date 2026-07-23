import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../config.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

// Single shared admin account, configured via server/.env (see .env.example). Optionally set
// ADMIN_PASSWORD_HASH (a bcrypt hash) instead of a plaintext ADMIN_PASSWORD for extra safety.
router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  const validUsername = username === ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD_HASH
    ? await bcrypt.compare(password ?? '', process.env.ADMIN_PASSWORD_HASH)
    : password === ADMIN_PASSWORD;

  if (!validUsername || !validPassword) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = signToken({ sub: 'admin', role: 'admin' }, '7d');
  res.json({ token });
});

export default router;
