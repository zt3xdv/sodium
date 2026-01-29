import express from 'express';
import { loadAnnouncements, saveAnnouncements } from '../db.js';
import { authenticateUser, requireAdmin } from '../utils/auth.js';
import { generateUUID, sanitizeText } from '../utils/helpers.js';
import { logAudit, AUDIT_TYPES } from '../utils/activity.js';

const router = express.Router();

router.get('/', authenticateUser, (req, res) => {
  const data = loadAnnouncements();
  const now = new Date();
  
  let announcements = data.announcements;
  
  if (!req.user.isAdmin) {
    announcements = announcements.filter(a => {
      if (!a.active) return false;
      if (a.expiresAt && new Date(a.expiresAt) < now) return false;
      return true;
    });
  }
  
  res.json({ announcements });
});

router.get('/active', authenticateUser, (req, res) => {
  const data = loadAnnouncements();
  const now = new Date();
  
  const announcements = data.announcements.filter(a => {
    if (!a.active) return false;
    if (a.expiresAt && new Date(a.expiresAt) < now) return false;
    return true;
  });
  
  res.json({ announcements });
});

router.post('/', authenticateUser, requireAdmin, (req, res) => {
  const { title, content, type = 'info', active = true, expiresAt } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  
  const data = loadAnnouncements();
  const announcement = {
    id: generateUUID(),
    title: sanitizeText(title),
    content: sanitizeText(content),
    type,
    active,
    expiresAt: expiresAt || null,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.announcements.unshift(announcement);
  saveAnnouncements(data);
  
  logAudit(req.user.id, AUDIT_TYPES.ANNOUNCEMENT_CREATE, 'announcement', announcement.id, {
    title: announcement.title
  }, req.ip);
  
  res.json({ success: true, announcement });
});

router.put('/:id', authenticateUser, requireAdmin, (req, res) => {
  const { title, content, type, active, expiresAt } = req.body;
  const data = loadAnnouncements();
  const idx = data.announcements.findIndex(a => a.id === req.params.id);
  
  if (idx === -1) {
    return res.status(404).json({ error: 'Announcement not found' });
  }
  
  const announcement = data.announcements[idx];
  const oldTitle = announcement.title;
  
  if (title !== undefined) announcement.title = sanitizeText(title);
  if (content !== undefined) announcement.content = sanitizeText(content);
  if (type !== undefined) announcement.type = type;
  if (active !== undefined) announcement.active = active;
  if (expiresAt !== undefined) announcement.expiresAt = expiresAt;
  announcement.updatedAt = new Date().toISOString();
  
  saveAnnouncements(data);
  
  logAudit(req.user.id, AUDIT_TYPES.ANNOUNCEMENT_UPDATE, 'announcement', announcement.id, {
    oldTitle,
    newTitle: announcement.title
  }, req.ip);
  
  res.json({ success: true, announcement });
});

router.delete('/:id', authenticateUser, requireAdmin, (req, res) => {
  const data = loadAnnouncements();
  const announcement = data.announcements.find(a => a.id === req.params.id);
  
  if (!announcement) {
    return res.status(404).json({ error: 'Announcement not found' });
  }
  
  data.announcements = data.announcements.filter(a => a.id !== req.params.id);
  saveAnnouncements(data);
  
  logAudit(req.user.id, AUDIT_TYPES.ANNOUNCEMENT_DELETE, 'announcement', req.params.id, {
    title: announcement.title
  }, req.ip);
  
  res.json({ success: true });
});

export default router;
