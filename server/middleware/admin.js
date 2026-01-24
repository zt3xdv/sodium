import auth from './auth.js';

export function admin(req, res, next) {
  auth(req, res, (err) => {
    if (err) return next(err);

    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  });
}

export default admin;
