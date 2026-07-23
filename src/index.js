import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { seedDatabase } from './seed.js';
import { PORT, CORS_ORIGINS } from './config.js';

import productsRouter from './routes/products.js';
import couponsRouter from './routes/coupons.js';
import bannersRouter from './routes/banners.js';
import blogRouter from './routes/blog.js';
import ordersRouter from './routes/orders.js';
import authRouter from './routes/auth.js';
import adminAuthRouter from './routes/adminAuth.js';
import addressesRouter from './routes/addresses.js';
import inquiriesRouter from './routes/inquiries.js';
import uploadRouter from './routes/upload.js';
import customersRouter from './routes/customers.js';
import courseInquiriesRouter from './routes/courseInquiries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

seedDatabase();

const app = express();
app.use(
  cors({
    origin: CORS_ORIGINS.includes('*') ? true : CORS_ORIGINS,
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/products', productsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/blog', blogRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminAuthRouter);
app.use('/api/admin/customers', customersRouter);
app.use('/api/addresses', addressesRouter);
app.use('/api/inquiries', inquiriesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/course-inquiries', courseInquiriesRouter);

// In production, serve the built frontend from the same server/port so only one process (and
// one tunnel/host) is needed. Run `npm run build` at the repo root first to generate /dist.
const distDir = path.join(__dirname, '..', '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SoapVeda API server running on http://localhost:${PORT}`);
});
