import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

const router = Router();
const SALT_ROUNDS = 10;

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (User.findByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    if (User.findByUsername(username)) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = User.create({ username, email, password_hash });

    const token = jwt.sign(
      { id: user.id, uuid: user.uuid },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, uuid: user.uuid },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({ user: User.sanitize(user), token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', auth, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
