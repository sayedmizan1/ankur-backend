import { Router } from 'express';
import { nanoid } from 'nanoid';
import { createRepo } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

function mountLeadResource(path, table, { withStatus = true } = {}) {
  const repo = createRepo(table);

  router.post(`/${path}`, (req, res) => {
    const entry = {
      ...req.body,
      id: `${path}-${nanoid(10)}`,
      createdAt: new Date().toISOString(),
      ...(withStatus ? { status: 'New' } : {}),
    };
    repo.insert(entry);
    res.status(201).json(entry);
  });

  router.get(`/${path}`, authenticate, requireAdmin, (_req, res) => {
    res.json(repo.all());
  });

  if (withStatus) {
    router.patch(`/${path}/:id`, authenticate, requireAdmin, (req, res) => {
      const existing = repo.getById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      const updated = { ...existing, status: req.body?.status ?? existing.status };
      repo.update(existing.id, updated);
      res.json(updated);
    });
  }
}

mountLeadResource('contact', 'contact_messages');

export default router;
