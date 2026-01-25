import { Router } from 'express';
import bcrypt from 'bcryptjs';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import limits from '../services/limits.js';

const router = Router();

router.get('/profile', auth, (req, res) => {
  try {
    const user = User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const limitsData = limits.getUserLimitsWithUsage(req.user.id);

    res.json({
      data: {
        ...user,
        limits: limitsData
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const { display_name, bio, avatar, email, username } = req.body;

    const updates = {};

    if (display_name !== undefined) updates.display_name = display_name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar !== undefined) updates.avatar = avatar;

    if (email && email !== req.user.email) {
      const existing = User.findByEmail(email);
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updates.email = email;
    }

    if (username && username !== req.user.username) {
      const existing = User.findByUsername(username);
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      updates.username = username;
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ data: req.user });
    }

    const updated = User.update(req.user.id, updates);
    const limitsData = limits.getUserLimitsWithUsage(req.user.id);

    res.json({
      data: {
        ...updated,
        limits: limitsData
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = User.findByIdWithPassword(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    User.update(req.user.id, { password_hash });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/limits', auth, (req, res) => {
  try {
    const limitsData = limits.getUserLimitsWithUsage(req.user.id);
    res.json({ data: limitsData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
