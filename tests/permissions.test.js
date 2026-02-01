import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Permissions Utilities', () => {
  describe('hasPermission', () => {
    it('should return false for null/undefined subuser', async () => {
      const { hasPermission } = await import('../src/server/utils/permissions.js');
      
      assert.strictEqual(hasPermission(null, 'console.read'), false);
      assert.strictEqual(hasPermission(undefined, 'console.read'), false);
    });

    it('should return false for subuser without permissions array', async () => {
      const { hasPermission } = await import('../src/server/utils/permissions.js');
      
      assert.strictEqual(hasPermission({}, 'console.read'), false);
      assert.strictEqual(hasPermission({ id: '123' }, 'console.read'), false);
    });

    it('should return true for wildcard permission', async () => {
      const { hasPermission } = await import('../src/server/utils/permissions.js');
      
      const subuser = { permissions: ['*'] };
      assert.strictEqual(hasPermission(subuser, 'console.read'), true);
      assert.strictEqual(hasPermission(subuser, 'files.write'), true);
      assert.strictEqual(hasPermission(subuser, 'any.permission'), true);
    });

    it('should return true when permission is in array', async () => {
      const { hasPermission } = await import('../src/server/utils/permissions.js');
      
      const subuser = { permissions: ['console.read', 'files.read'] };
      assert.strictEqual(hasPermission(subuser, 'console.read'), true);
      assert.strictEqual(hasPermission(subuser, 'files.read'), true);
    });

    it('should return false when permission is not in array', async () => {
      const { hasPermission } = await import('../src/server/utils/permissions.js');
      
      const subuser = { permissions: ['console.read'] };
      assert.strictEqual(hasPermission(subuser, 'files.write'), false);
      assert.strictEqual(hasPermission(subuser, 'console.write'), false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if any permission matches', async () => {
      const { hasAnyPermission } = await import('../src/server/utils/permissions.js');
      
      const subuser = { permissions: ['console.read'] };
      assert.strictEqual(hasAnyPermission(subuser, ['console.read', 'files.write']), true);
    });

    it('should return false if no permissions match', async () => {
      const { hasAnyPermission } = await import('../src/server/utils/permissions.js');
      
      const subuser = { permissions: ['console.read'] };
      assert.strictEqual(hasAnyPermission(subuser, ['files.read', 'files.write']), false);
    });

    it('should return true for wildcard with any permissions', async () => {
      const { hasAnyPermission } = await import('../src/server/utils/permissions.js');
      
      const subuser = { permissions: ['*'] };
      assert.strictEqual(hasAnyPermission(subuser, ['files.read', 'files.write']), true);
    });

    it('should return false for empty permissions array check', async () => {
      const { hasAnyPermission } = await import('../src/server/utils/permissions.js');
      
      const subuser = { permissions: ['console.read'] };
      assert.strictEqual(hasAnyPermission(subuser, []), false);
    });
  });

  describe('PERMISSIONS constant', () => {
    it('should export PERMISSIONS object', async () => {
      const { PERMISSIONS } = await import('../src/server/utils/permissions.js');
      
      assert.ok(typeof PERMISSIONS === 'object');
      assert.ok(Object.keys(PERMISSIONS).length > 0);
    });
  });

  describe('PERMISSION_GROUPS constant', () => {
    it('should export PERMISSION_GROUPS object', async () => {
      const { PERMISSION_GROUPS } = await import('../src/server/utils/permissions.js');
      
      assert.ok(typeof PERMISSION_GROUPS === 'object');
      assert.ok(Object.keys(PERMISSION_GROUPS).length > 0);
    });
  });
});
