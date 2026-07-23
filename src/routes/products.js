import { Router } from 'express';
import { nanoid } from 'nanoid';
import { createRepo } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const repo = createRepo('products', ['slug']);
const router = Router();

function recomputeRating(reviews) {
  if (reviews.length === 0) return 0;
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return Math.round(avg * 10) / 10;
}

router.get('/', (_req, res) => {
  res.json(repo.all());
});

router.get('/:slugOrId', (req, res) => {
  const product = repo.getBy('slug', req.params.slugOrId) ?? repo.getById(req.params.slugOrId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  const product = { rating: 0, reviews: [], tags: [], ...req.body, id: `p-${nanoid(10)}` };
  repo.insert(product);
  res.status(201).json(product);
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const existing = repo.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const updated = { ...existing, ...req.body, id: existing.id, slug: existing.slug };
  repo.update(existing.id, updated);
  res.json(updated);
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  if (!repo.getById(req.params.id)) return res.status(404).json({ error: 'Product not found' });
  repo.remove(req.params.id);
  res.status(204).end();
});

// Public - anyone can leave a review (matches the original demo behavior; no purchase
// verification is performed here, same as before).
router.post('/:id/reviews', (req, res) => {
  const product = repo.getById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const { author, rating, comment, title } = req.body ?? {};
  if (!author || typeof author !== 'string' || !comment || typeof comment !== 'string') {
    return res.status(400).json({ error: 'A name and review comment are required' });
  }
  const safeRating = Math.min(5, Math.max(1, Number(rating) || 5));
  const review = {
    id: `rev-${nanoid(10)}`,
    author: author.slice(0, 100),
    rating: safeRating,
    date: new Date().toISOString().slice(0, 10),
    title: typeof title === 'string' ? title.slice(0, 150) : undefined,
    comment: comment.slice(0, 2000),
    verified: false,
  };
  const reviews = [review, ...product.reviews];
  const updated = { ...product, reviews, rating: recomputeRating(reviews) };
  repo.update(product.id, updated);
  res.status(201).json(updated);
});

export default router;
