import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

describe('Auth Utilities', () => {
  describe('getJwtSecret', () => {
    it('should return a string', async () => {
      const { getJwtSecret } = await import('../src/server/utils/auth.js');
      const secret = getJwtSecret();
      assert.strictEqual(typeof secret, 'string');
      assert.ok(secret.length > 0);
    });
  });

  describe('authenticateUser middleware', () => {
    it('should reject requests without authorization header', async () => {
      const { authenticateUser } = await import('../src/server/utils/auth.js');
      
      const req = { headers: {} };
      let statusCode = null;
      let jsonResponse = null;
      
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => {
          jsonResponse = data;
        }
      };
      const next = mock.fn();

      authenticateUser(req, res, next);

      assert.strictEqual(statusCode, 401);
      assert.deepStrictEqual(jsonResponse, { error: 'No token provided' });
      assert.strictEqual(next.mock.calls.length, 0);
    });

    it('should reject requests with invalid Bearer format', async () => {
      const { authenticateUser } = await import('../src/server/utils/auth.js');
      
      const req = { headers: { authorization: 'InvalidFormat token123' } };
      let statusCode = null;
      
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: () => {}
      };
      const next = mock.fn();

      authenticateUser(req, res, next);

      assert.strictEqual(statusCode, 401);
      assert.strictEqual(next.mock.calls.length, 0);
    });

    it('should reject requests with invalid token', async () => {
      const { authenticateUser } = await import('../src/server/utils/auth.js');
      
      const req = { headers: { authorization: 'Bearer invalid.token.here' } };
      let statusCode = null;
      let jsonResponse = null;
      
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => {
          jsonResponse = data;
        }
      };
      const next = mock.fn();

      authenticateUser(req, res, next);

      assert.strictEqual(statusCode, 401);
      assert.deepStrictEqual(jsonResponse, { error: 'Invalid or expired token' });
      assert.strictEqual(next.mock.calls.length, 0);
    });
  });

  describe('requireAdmin middleware', () => {
    it('should reject non-admin users', async () => {
      const { requireAdmin } = await import('../src/server/utils/auth.js');
      
      const req = { user: { id: '123', isAdmin: false } };
      let statusCode = null;
      let jsonResponse = null;
      
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => {
          jsonResponse = data;
        }
      };
      const next = mock.fn();

      requireAdmin(req, res, next);

      assert.strictEqual(statusCode, 403);
      assert.deepStrictEqual(jsonResponse, { error: 'Admin access required' });
      assert.strictEqual(next.mock.calls.length, 0);
    });

    it('should reject requests without user', async () => {
      const { requireAdmin } = await import('../src/server/utils/auth.js');
      
      const req = {};
      let statusCode = null;
      
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: () => {}
      };
      const next = mock.fn();

      requireAdmin(req, res, next);

      assert.strictEqual(statusCode, 403);
      assert.strictEqual(next.mock.calls.length, 0);
    });

    it('should allow admin users', async () => {
      const { requireAdmin } = await import('../src/server/utils/auth.js');
      
      const req = { user: { id: '123', isAdmin: true } };
      let statusCode = null;
      
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: () => {}
      };
      const next = mock.fn();

      requireAdmin(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(statusCode, null);
    });
  });
});
