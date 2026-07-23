import { Router } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { createRepo } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

// Images are stored as base64 directly in the SQLite database (not on disk) so every product
// photo persists alongside the rest of the data - no separate uploads volume to configure or
// lose on a redeploy/restart (Render's free plan wipes its disk on every restart).
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) return cb(new Error('Only PNG, JPG or WEBP images are allowed'));
    cb(null, true);
  },
});

const imagesRepo = createRepo('images');
const router = Router();

// Admin-only: upload one or more product photos into the database, returns their URLs.
router.post('/images', authenticate, requireAdmin, upload.array('images', 8), (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const urls = files.map((file) => {
    const id = nanoid(14);
    imagesRepo.insert({
      id,
      mimetype: file.mimetype,
      base64: file.buffer.toString('base64'),
      createdAt: new Date().toISOString(),
    });
    return `/api/upload/images/${id}`;
  });

  res.status(201).json({ urls });
});

// Public: serve an image stored in the database (no auth - product photos must be viewable by
// every shopper, not just admins).
router.get('/images/:id', (req, res) => {
  const image = imagesRepo.getById(req.params.id);
  if (!image) return res.status(404).end();
  res.set('Content-Type', image.mimetype);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(image.base64, 'base64'));
});

export default router;
