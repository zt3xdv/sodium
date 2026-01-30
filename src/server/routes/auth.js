import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loadUsers, saveUsers, loadConfig } from '../db.js';
import { validateUsername, sanitizeText, generateUUID } from '../utils/helpers.js';
import { JWT_SECRET } from '../utils/auth.js';
import { rateLimit } from '../utils/rate-limiter.js';
import { logActivity, ACTIVITY_TYPES } from '../utils/activity.js';

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 60000, max: 5, message: 'Too many attempts, try again later' });

router.post('/register', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  const config = loadConfig();
  if (!config.registration?.enabled) {
    return res.status(403).json({ error: 'Registration is currently disabled' });
  }
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, underscore only)' });
  }
  
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
  }
  
  const data = loadUsers();
  const existingUser = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const defaults = config.defaults || {};
  const isFirstUser = data.users.length === 0;
  const newUser = {
    id: generateUUID(),
    username: sanitizeText(username),
    password: hashedPassword,
    displayName: sanitizeText(username),
    bio: '',
    avatar: '',
    links: {},
    isAdmin: isFirstUser,
    limits: {
      servers: defaults.servers || 2,
      memory: defaults.memory || 2048,
      disk: defaults.disk || 10240,
      cpu: defaults.cpu || 200
    },
    createdAt: new Date().toISOString(),
    settings: {
      theme: 'dark',
      notifications: true,
      privacy: 'public'
    }
  };
  
  data.users.push(newUser);
  saveUsers(data);
  
  const { password: _, ...userWithoutPassword } = newUser;
  const token = jwt.sign(
    { id: newUser.id, username: newUser.username, isAdmin: newUser.isAdmin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  logActivity(newUser.id, ACTIVITY_TYPES.LOGIN, { method: 'register' }, req.ip);
  
  res.json({ success: true, user: userWithoutPassword, token });
});

router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const isValidPassword = await bcrypt.compare(password, user.password);
  
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const { password: _, ...userWithoutPassword } = user;
  const token = jwt.sign(
    { id: user.id, username: user.username, isAdmin: user.isAdmin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  logActivity(user.id, ACTIVITY_TYPES.LOGIN, { method: 'password' }, req.ip);
  
  res.json({ success: true, user: userWithoutPassword, token });
});

export default router;
