import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { createRepo } from '../db.js';
import { authenticate, signToken } from '../middleware/auth.js';

const usersRepo = createRepo('users', ['email']);
const addressesRepo = createRepo('addresses', ['userId']);
const router = Router();

function toPublicUser(user) {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body ?? {};
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Name, email and a password of at least 6 characters are required.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (usersRepo.getBy('email', normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists. Please login instead.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: `user-${nanoid(12)}`,
    name: String(name).trim(),
    email: normalizedEmail,
    phone: phone ? String(phone).trim() : '',
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  usersRepo.insert(user);
  const token = signToken({ sub: user.id, role: 'customer' });
  res.status(201).json({ token, user: toPublicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  const user = usersRepo.getBy('email', normalizedEmail);
  if (!user) return res.status(401).json({ error: 'No account found with this email.' });
  const valid = await bcrypt.compare(password ?? '', user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  const token = signToken({ sub: user.id, role: 'customer' });
  res.json({ token, user: toPublicUser(user) });
});

router.get('/me', authenticate, (req, res) => {
  const user = usersRepo.getById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const addresses = addressesRepo.allBy('userId', user.id);
  res.json({ user: toPublicUser(user), addresses });
});

router.patch('/me', authenticate, (req, res) => {
  const user = usersRepo.getById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { name, phone } = req.body ?? {};
  const updated = { ...user, name: name ?? user.name, phone: phone ?? user.phone };
  usersRepo.update(user.id, updated);
  res.json({ user: toPublicUser(updated) });
});

export default router;
