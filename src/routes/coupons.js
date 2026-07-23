import { Router } from 'express';
import { nanoid } from 'nanoid';
import { createRepo } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const repo = createRepo('coupons', ['code']);
const router = Router();

router.get('/', authenticate, requireAdmin, (_req, res) => {
  res.json(repo.all());
});

// Public: used by the cart page to validate & preview a coupon before checkout.
router.post('/validate', (req, res) => {
  const { code, subtotal } = req.body ?? {};
  const coupon = repo.getBy('code', String(code ?? '').trim().toUpperCase());
  if (!coupon || !coupon.active) return res.status(404).json({ valid: false, message: 'Invalid or expired coupon code.' });
  if (new Date(coupon.expiryDate) < new Date()) return res.status(400).json({ valid: false, message: 'This coupon has expired.' });
  if (coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ valid: false, message: 'This coupon has reached its usage limit.' });
  const numericSubtotal = Number(subtotal) || 0;
  if (numericSubtotal < coupon.minOrderValue) {
    return res.status(400).json({ valid: false, message: `This coupon requires a minimum order of \u20B9${coupon.minOrderValue}.` });
  }
  let discount = coupon.type === 'percent' ? (numericSubtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.round(Math.min(discount, numericSubtotal));
  res.json({ valid: true, code: coupon.code, discount, message: `Coupon "${coupon.code}" applied!` });
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  const coupon = { usedCount: 0, ...req.body, id: `coup-${nanoid(8)}`, code: String(req.body.code).trim().toUpperCase() };
  repo.insert(coupon);
  res.status(201).json(coupon);
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const existing = repo.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Coupon not found' });
  const updated = { ...existing, ...req.body, id: existing.id };
  if (updated.code) updated.code = String(updated.code).trim().toUpperCase();
  repo.update(existing.id, updated);
  res.json(updated);
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  if (!repo.getById(req.params.id)) return res.status(404).json({ error: 'Coupon not found' });
  repo.remove(req.params.id);
  res.status(204).end();
});

export default router;
