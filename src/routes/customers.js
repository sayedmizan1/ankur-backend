import { Router } from 'express';
import { createRepo } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const usersRepo = createRepo('users', ['email']);
const ordersRepo = createRepo('orders');
const router = Router();

router.get('/', authenticate, requireAdmin, (_req, res) => {
  const orders = ordersRepo.all();
  const customers = usersRepo.all().map(({ passwordHash: _passwordHash, ...user }) => ({
    ...user,
    orderCount: orders.filter((o) => o.userId === user.id).length,
  }));
  res.json(customers);
});

export default router;
