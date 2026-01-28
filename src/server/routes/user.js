import express from 'express';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers, loadServers } from '../db.js';
import { validateUsername, sanitizeText, sanitizeUrl, sanitizeLinks } from '../utils/helpers.js';
import { authenticateUser } from '../utils/auth.js';

const router = express.Router();

router.get('/profile', (req, res) => {
  const { username, viewer } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Invalid username format' });
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { password: _, ...userWithoutPassword } = user;
  
  const isOwner = viewer && viewer.toLowerCase() === username.toLowerCase();
  const isPublic = user.settings?.privacy === 'public';
  
  if (!isOwner && !isPublic) {
    return res.json({ 
      user: {
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isPrivate: true
      }
    });
  }
  
  res.json({ user: userWithoutPassword });
});

router.put('/profile', authenticateUser, (req, res) => {
  const { displayName, bio, avatar, links } = req.body;
  
  const data = loadUsers();
  const userIndex = data.users.findIndex(u => u.id === req.user.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const user = data.users[userIndex];
  
  if (displayName !== undefined) {
    user.displayName = sanitizeText(displayName.slice(0, 50));
  }
  
  if (bio !== undefined) {
    user.bio = sanitizeText(bio.slice(0, 500));
  }
  
  if (avatar !== undefined) {
    user.avatar = sanitizeUrl(avatar);
  }
  
  if (links !== undefined) {
    user.links = sanitizeLinks(links);
  }
  
  data.users[userIndex] = user;
  saveUsers(data);
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ success: true, user: userWithoutPassword });
});

router.put('/settings', authenticateUser, (req, res) => {
  const { settings } = req.body;
  
  const data = loadUsers();
  const userIndex = data.users.findIndex(u => u.id === req.user.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const user = data.users[userIndex];
  
  user.settings = { ...user.settings, ...settings };
  data.users[userIndex] = user;
  saveUsers(data);
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ success: true, user: userWithoutPassword });
});

router.put('/password', authenticateUser, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  
  const data = loadUsers();
  const userIndex = data.users.findIndex(u => u.id === req.user.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const user = data.users[userIndex];
  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  
  user.password = await bcrypt.hash(newPassword, 10);
  data.users[userIndex] = user;
  saveUsers(data);
  
  res.json({ success: true, message: 'Password updated successfully' });
});

router.get('/limits', (req, res) => {
  const { username } = req.query;
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username?.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const servers = loadServers();
  const userServers = servers.servers.filter(s => s.user_id === user.id);
  
  const used = userServers.reduce((acc, s) => ({
    servers: acc.servers + 1,
    memory: acc.memory + (s.limits?.memory || 0),
    disk: acc.disk + (s.limits?.disk || 0),
    cpu: acc.cpu + (s.limits?.cpu || 0)
  }), { servers: 0, memory: 0, disk: 0, cpu: 0 });
  
  const limits = user.limits || { servers: 2, memory: 2048, disk: 10240, cpu: 200 };
  
  res.json({ limits, used });
});

export default router;
