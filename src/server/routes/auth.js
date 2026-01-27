import express from 'express';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers, loadConfig } from '../db.js';
import { validateUsername, sanitizeText } from '../utils/helpers.js';

const router = express.Router();

router.post('/register', async (req, res) => {
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
  const newUser = {
    id: Date.now().toString(),
    username: sanitizeText(username),
    password: hashedPassword,
    displayName: sanitizeText(username),
    bio: '',
    avatar: '',
    links: {},
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
  res.json({ success: true, user: userWithoutPassword });
});

router.post('/login', async (req, res) => {
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
  res.json({ success: true, user: userWithoutPassword });
});

router.get('/me', async (req, res) => {
  const { username, password } = req.query;
  
  if (!username || !password) {
    return res.status(401).json({ error: 'Not authenticated' });
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
  res.json({ user: userWithoutPassword });
});

export default router;
