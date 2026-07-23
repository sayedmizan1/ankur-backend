import { Router } from 'express';
import { nanoid } from 'nanoid';
import { createRepo } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const repo = createRepo('banners');
const router = Router();

router.get('/', (_req, res) => {
  res.json(repo.all());
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  const banner = { active: true, ...req.body, id: `ban-${nanoid(8)}` };
  repo.insert(banner);
  res.status(201).json(banner);
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const existing = repo.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Banner not found' });
  const updated = { ...existing, ...req.body, id: existing.id };
  repo.update(existing.id, updated);
  res.json(updated);
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  if (!repo.getById(req.params.id)) return res.status(404).json({ error: 'Banner not found' });
  repo.remove(req.params.id);
  res.status(204).end();
});

export default router;
