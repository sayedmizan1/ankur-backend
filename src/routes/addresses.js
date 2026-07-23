import { Router } from 'express';
import { nanoid } from 'nanoid';
import { createRepo } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const repo = createRepo('addresses', ['userId']);
const router = Router();

router.use(authenticate);

function clearDefaults(userId, exceptId) {
  for (const a of repo.allBy('userId', userId)) {
    if (a.id !== exceptId && a.isDefault) repo.update(a.id, { ...a, isDefault: false });
  }
}

router.get('/', (req, res) => {
  res.json(repo.allBy('userId', req.user.sub));
});

router.post('/', (req, res) => {
  const address = { ...req.body, id: `addr-${nanoid(8)}`, userId: req.user.sub };
  repo.insert(address);
  if (address.isDefault) clearDefaults(req.user.sub, address.id);
  res.status(201).json(address);
});

router.put('/:id', (req, res) => {
  const existing = repo.getById(req.params.id);
  if (!existing || existing.userId !== req.user.sub) return res.status(404).json({ error: 'Address not found' });
  const updated = { ...existing, ...req.body, id: existing.id, userId: existing.userId };
  repo.update(existing.id, updated);
  if (updated.isDefault) clearDefaults(req.user.sub, existing.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const existing = repo.getById(req.params.id);
  if (!existing || existing.userId !== req.user.sub) return res.status(404).json({ error: 'Address not found' });
  repo.remove(req.params.id);
  res.status(204).end();
});

router.put('/:id/default', (req, res) => {
  const existing = repo.getById(req.params.id);
  if (!existing || existing.userId !== req.user.sub) return res.status(404).json({ error: 'Address not found' });
  repo.update(existing.id, { ...existing, isDefault: true });
  clearDefaults(req.user.sub, existing.id);
  res.json(repo.getById(existing.id));
});

export default router;
