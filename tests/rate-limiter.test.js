import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

describe('Rate Limiter', () => {
  describe('rateLimit middleware', () => {
    it('should allow requests under the limit', async () => {
      const { rateLimit } = await import('../src/server/utils/rate-limiter.js');
      
      const limiter = rateLimit({ windowMs: 60000, max: 5 });
      const req = { ip: 'test-ip-allow' };
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();

      limiter(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(res.status.mock.calls.length, 0);
    });

    it('should block requests over the limit', async () => {
      const { rateLimit } = await import('../src/server/utils/rate-limiter.js');
      
      const limiter = rateLimit({ windowMs: 60000, max: 2 });
      const req = { ip: 'test-ip-block-' + Date.now() };
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

      limiter(req, res, next);
      limiter(req, res, next);
      limiter(req, res, next);

      assert.strictEqual(statusCode, 429);
      assert.deepStrictEqual(jsonResponse, { error: 'Too many requests' });
    });

    it('should use custom message', async () => {
      const { rateLimit } = await import('../src/server/utils/rate-limiter.js');
      
      const limiter = rateLimit({ windowMs: 60000, max: 1, message: 'Custom error' });
      const req = { ip: 'test-ip-custom-' + Date.now() };
      let jsonResponse = null;
      
      const res = {
        status: () => res,
        json: (data) => {
          jsonResponse = data;
        }
      };
      const next = mock.fn();

      limiter(req, res, next);
      limiter(req, res, next);

      assert.deepStrictEqual(jsonResponse, { error: 'Custom error' });
    });

    it('should track different IPs separately', async () => {
      const { rateLimit } = await import('../src/server/utils/rate-limiter.js');
      
      const limiter = rateLimit({ windowMs: 60000, max: 2 });
      const next1 = mock.fn();
      const next2 = mock.fn();
      
      const res = {
        status: () => res,
        json: () => {}
      };

      limiter({ ip: 'ip-a-' + Date.now() }, res, next1);
      limiter({ ip: 'ip-a-' + Date.now() }, res, next1);
      limiter({ ip: 'ip-b-' + Date.now() }, res, next2);
      limiter({ ip: 'ip-b-' + Date.now() }, res, next2);

      assert.strictEqual(next1.mock.calls.length, 2);
      assert.strictEqual(next2.mock.calls.length, 2);
    });

    it('should use connection.remoteAddress as fallback', async () => {
      const { rateLimit } = await import('../src/server/utils/rate-limiter.js');
      
      const limiter = rateLimit({ windowMs: 60000, max: 5 });
      const req = { connection: { remoteAddress: 'fallback-ip-' + Date.now() } };
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();

      limiter(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
    });

    it('should handle missing IP gracefully', async () => {
      const { rateLimit } = await import('../src/server/utils/rate-limiter.js');
      
      const limiter = rateLimit({ windowMs: 60000, max: 5 });
      const req = {};
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();

      limiter(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
    });
  });
});
