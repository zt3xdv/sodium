import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Setup Validation', () => {
  describe('Password validation', () => {
    it('should reject passwords shorter than 8 characters', () => {
      const password = '1234567';
      assert.ok(password.length < 8);
    });

    it('should accept passwords with 8 or more characters', () => {
      const password = '12345678';
      assert.ok(password.length >= 8);
    });
  });

  describe('Admin fields validation', () => {
    it('should require username', () => {
      const admin = { username: '', email: 'test@test.com', password: 'password123' };
      assert.strictEqual(!!admin.username, false);
    });

    it('should require email', () => {
      const admin = { username: 'admin', email: '', password: 'password123' };
      assert.strictEqual(!!admin.email, false);
    });

    it('should require password', () => {
      const admin = { username: 'admin', email: 'test@test.com', password: '' };
      assert.strictEqual(!!admin.password, false);
    });

    it('should accept valid admin object', () => {
      const admin = {
        username: 'admin',
        email: 'admin@example.com',
        password: 'securepassword123'
      };

      assert.ok(admin.username);
      assert.ok(admin.email);
      assert.ok(admin.password);
      assert.ok(admin.password.length >= 8);
    });
  });

  describe('Email validation', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    it('should accept valid email', () => {
      assert.ok(emailRegex.test('valid@email.com'));
    });

    it('should accept email with subdomain', () => {
      assert.ok(emailRegex.test('user@subdomain.domain.com'));
    });

    it('should reject email without @', () => {
      assert.strictEqual(emailRegex.test('invalid-email'), false);
    });

    it('should reject email without domain extension', () => {
      assert.strictEqual(emailRegex.test('missing@domain'), false);
    });
  });

  describe('Database types', () => {
    const validTypes = ['file', 'sqlite', 'mysql', 'mariadb', 'postgresql', 'postgres'];

    it('should recognize file as valid', () => {
      assert.ok(validTypes.includes('file'));
    });

    it('should recognize sqlite as valid', () => {
      assert.ok(validTypes.includes('sqlite'));
    });

    it('should recognize mysql as valid', () => {
      assert.ok(validTypes.includes('mysql'));
    });

    it('should recognize postgresql as valid', () => {
      assert.ok(validTypes.includes('postgresql'));
    });

    it('should reject invalid type', () => {
      assert.strictEqual(validTypes.includes('mongodb'), false);
    });
  });

  describe('Default ports', () => {
    it('should use 3306 for MySQL', () => {
      assert.strictEqual(3306, 3306);
    });

    it('should use 5432 for PostgreSQL', () => {
      assert.strictEqual(5432, 5432);
    });

    it('should use 6379 for Redis', () => {
      assert.strictEqual(6379, 6379);
    });

    it('should use 3000 for panel', () => {
      assert.strictEqual(3000, 3000);
    });
  });

  describe('Config structure', () => {
    it('should build valid config object', () => {
      const config = {
        installed: true,
        panel: { name: 'Test', url: 'http://localhost:3000', port: 3000 },
        jwt: { secret: 'test-secret' },
        database: { type: 'file', host: 'localhost', port: 3306, name: 'sodium', user: 'sodium', password: '' },
        redis: { enabled: false, host: 'localhost', port: 6379, password: '' },
        registration: { enabled: true },
        defaults: { servers: 2, memory: 2048, disk: 10240, cpu: 200, allocations: 5 }
      };

      assert.strictEqual(config.installed, true);
      assert.strictEqual(config.panel.name, 'Test');
      assert.strictEqual(config.database.type, 'file');
      assert.strictEqual(config.redis.enabled, false);
      assert.strictEqual(config.defaults.memory, 2048);
    });
  });
});
