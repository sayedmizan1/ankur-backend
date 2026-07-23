import { Router } from 'express';
import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';
import { createRepo } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { GMAIL_USER, GMAIL_APP_PASSWORD } from '../config.js';

const router = Router();
const repo = createRepo('course_inquiries');

// Build a nodemailer transporter. If Gmail credentials are not configured the
// mailer is disabled and submissions are only persisted in the database.
function createTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

function courseTypeLabel(type) {
  const map = {
    pdf: '📄 PDF Course',
    recorded: '🎬 Recorded Class',
    live: '🔴 Live Class',
  };
  return map[type] ?? type;
}

// Public: submit a course inquiry (saved to DB + emailed to admin).
router.post('/', async (req, res) => {
  const { name, email, phone, courseType, message } = req.body ?? {};
  if (!name || !email || !courseType) {
    return res.status(400).json({ error: 'name, email and courseType are required' });
  }

  const entry = {
    id: `ci-${nanoid(10)}`,
    name,
    email,
    phone: phone ?? '',
    courseType,
    message: message ?? '',
    status: 'New',
    createdAt: new Date().toISOString(),
  };

  repo.insert(entry);

  // Send email notification if Gmail is configured.
  const transporter = createTransporter();
  if (transporter) {
    const mailOptions = {
      from: `"Ankur Courses" <${GMAIL_USER}>`,
      to: GMAIL_USER,
      subject: `New Course Inquiry – ${courseTypeLabel(courseType)} from ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
          <div style="background:#1a3c2a;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">New Course Enquiry</h1>
            <p style="color:#a3d9b1;margin:6px 0 0;font-size:13px;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
          </div>
          <div style="padding:24px;background:#fafaf8;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:10px 0;color:#555;font-weight:bold;width:130px;">Course Type</td><td style="padding:10px 0;color:#222;">${courseTypeLabel(courseType)}</td></tr>
              <tr style="background:#f0f0eb;"><td style="padding:10px;color:#555;font-weight:bold;">Name</td><td style="padding:10px;color:#222;">${name}</td></tr>
              <tr><td style="padding:10px 0;color:#555;font-weight:bold;">Email</td><td style="padding:10px 0;color:#222;"><a href="mailto:${email}" style="color:#1a3c2a;">${email}</a></td></tr>
              <tr style="background:#f0f0eb;"><td style="padding:10px;color:#555;font-weight:bold;">Phone</td><td style="padding:10px;color:#222;">${phone || '—'}</td></tr>
              <tr><td style="padding:10px 0;color:#555;font-weight:bold;vertical-align:top;">Message</td><td style="padding:10px 0;color:#222;">${message || '—'}</td></tr>
            </table>
          </div>
          <div style="padding:16px;background:#1a3c2a;text-align:center;">
            <p style="color:#a3d9b1;font-size:12px;margin:0;">This inquiry was submitted via the Ankur website course enquiry form.</p>
          </div>
        </div>
      `,
    };
    try {
      await transporter.sendMail(mailOptions);
    } catch (err) {
      // Log but don't fail the request – the record is already saved.
      console.error('[course-inquiry] Email send failed:', err.message);
    }
  }

  res.status(201).json({ ok: true, id: entry.id });
});

// Admin: list all course inquiries.
router.get('/', authenticate, requireAdmin, (_req, res) => {
  res.json(repo.all().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

// Admin: update status of an inquiry.
router.patch('/:id', authenticate, requireAdmin, (req, res) => {
  const existing = repo.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const updated = { ...existing, status: req.body?.status ?? existing.status };
  repo.update(existing.id, updated);
  res.json(updated);
});

export default router;
