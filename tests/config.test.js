import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Config', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have correct default values', async () => {
      const { DEFAULT_CONFIG } = await import('../src/server/config.js');
      
      assert.strictEqual(DEFAULT_CONFIG.installed, false);
      assert.strictEqual(DEFAULT_CONFIG.panel.name, 'Sodium');
      assert.strictEqual(DEFAULT_CONFIG.panel.port, 3000);
      assert.strictEqual(DEFAULT_CONFIG.database.type, 'file');
      assert.strictEqual(DEFAULT_CONFIG.redis.enabled, false);
      assert.strictEqual(DEFAULT_CONFIG.registration.enabled, true);
    });

    it('should have all required sections', async () => {
      const { DEFAULT_CONFIG } = await import('../src/server/config.js');
      
      assert.ok(DEFAULT_CONFIG.panel);
      assert.ok(DEFAULT_CONFIG.jwt);
      assert.ok(DEFAULT_CONFIG.database);
      assert.ok(DEFAULT_CONFIG.redis);
      assert.ok(DEFAULT_CONFIG.registration);
      assert.ok(DEFAULT_CONFIG.defaults);
      assert.ok(DEFAULT_CONFIG.features);
    });

    it('should have correct default limits', async () => {
      const { DEFAULT_CONFIG } = await import('../src/server/config.js');
      
      assert.strictEqual(DEFAULT_CONFIG.defaults.servers, 2);
      assert.strictEqual(DEFAULT_CONFIG.defaults.memory, 2048);
      assert.strictEqual(DEFAULT_CONFIG.defaults.disk, 10240);
      assert.strictEqual(DEFAULT_CONFIG.defaults.cpu, 200);
      assert.strictEqual(DEFAULT_CONFIG.defaults.allocations, 5);
    });
  });

  describe('generateJwtSecret', () => {
    it('should generate a non-empty string', async () => {
      const { generateJwtSecret } = await import('../src/server/config.js');
      const secret = generateJwtSecret();
      
      assert.strictEqual(typeof secret, 'string');
      assert.ok(secret.length > 0);
    });

    it('should generate unique secrets', async () => {
      const { generateJwtSecret } = await import('../src/server/config.js');
      const secret1 = generateJwtSecret();
      const secret2 = generateJwtSecret();
      
      assert.notStrictEqual(secret1, secret2);
    });

    it('should generate secrets of sufficient length', async () => {
      const { generateJwtSecret } = await import('../src/server/config.js');
      const secret = generateJwtSecret();
      
      // 64 bytes in base64url should be ~86 characters
      assert.ok(secret.length >= 80);
    });
  });

  describe('isInstalled', () => {
    it('should return false when config does not exist', async () => {
      const { isInstalled } = await import('../src/server/config.js');
      assert.strictEqual(isInstalled(), false);
    });
  });
});
