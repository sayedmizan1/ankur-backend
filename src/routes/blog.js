import { Router } from 'express';
import { nanoid } from 'nanoid';
import { createRepo } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const repo = createRepo('blog_posts', ['slug']);
const router = Router();

router.get('/', (_req, res) => {
  res.json(repo.all());
});

router.get('/:slug', (req, res) => {
  const post = repo.getBy('slug', req.params.slug);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  const post = { ...req.body, id: `blog-${nanoid(8)}` };
  repo.insert(post);
  res.status(201).json(post);
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const existing = repo.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });
  const updated = { ...existing, ...req.body, id: existing.id, slug: existing.slug };
  repo.update(existing.id, updated);
  res.json(updated);
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  if (!repo.getById(req.params.id)) return res.status(404).json({ error: 'Post not found' });
  repo.remove(req.params.id);
  res.status(204).end();
});

export default router;
