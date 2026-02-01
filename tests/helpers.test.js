import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Helper Utilities', () => {
  describe('sanitizeText', () => {
    it('should escape HTML special characters', async () => {
      const { sanitizeText } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(sanitizeText('<script>'), '&lt;script&gt;');
      assert.strictEqual(sanitizeText('&test'), '&amp;test');
      assert.strictEqual(sanitizeText('"quoted"'), '&quot;quoted&quot;');
      assert.strictEqual(sanitizeText("'single'"), "&#x27;single&#x27;");
    });

    it('should return empty string for non-string input', async () => {
      const { sanitizeText } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(sanitizeText(null), '');
      assert.strictEqual(sanitizeText(undefined), '');
      assert.strictEqual(sanitizeText(123), '');
      assert.strictEqual(sanitizeText({}), '');
    });

    it('should handle empty string', async () => {
      const { sanitizeText } = await import('../src/server/utils/helpers.js');
      assert.strictEqual(sanitizeText(''), '');
    });
  });

  describe('sanitizeUrl', () => {
    it('should accept valid http/https URLs', async () => {
      const { sanitizeUrl } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(sanitizeUrl('https://example.com'), 'https://example.com/');
      assert.strictEqual(sanitizeUrl('http://test.org/path'), 'http://test.org/path');
    });

    it('should reject invalid protocols', async () => {
      const { sanitizeUrl } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '');
      assert.strictEqual(sanitizeUrl('ftp://files.com'), '');
      assert.strictEqual(sanitizeUrl('file:///etc/passwd'), '');
    });

    it('should reject invalid URLs', async () => {
      const { sanitizeUrl } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(sanitizeUrl('not a url'), '');
      assert.strictEqual(sanitizeUrl(''), '');
      assert.strictEqual(sanitizeUrl(null), '');
    });

    it('should reject URLs with HTML in hostname', async () => {
      const { sanitizeUrl } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(sanitizeUrl('https://<script>.com'), '');
    });
  });

  describe('validateUsername', () => {
    it('should accept valid usernames', async () => {
      const { validateUsername } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateUsername('john'), true);
      assert.strictEqual(validateUsername('user123'), true);
      assert.strictEqual(validateUsername('test_user'), true);
      assert.strictEqual(validateUsername('ABC'), true);
    });

    it('should reject usernames that are too short', async () => {
      const { validateUsername } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateUsername('ab'), false);
      assert.strictEqual(validateUsername('a'), false);
      assert.strictEqual(validateUsername(''), false);
    });

    it('should reject usernames that are too long', async () => {
      const { validateUsername } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateUsername('a'.repeat(21)), false);
    });

    it('should reject usernames with invalid characters', async () => {
      const { validateUsername } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateUsername('user@name'), false);
      assert.strictEqual(validateUsername('user name'), false);
      assert.strictEqual(validateUsername('user-name'), false);
      assert.strictEqual(validateUsername('user.name'), false);
    });

    it('should reject non-string input', async () => {
      const { validateUsername } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateUsername(null), false);
      assert.strictEqual(validateUsername(123), false);
      assert.strictEqual(validateUsername({}), false);
    });
  });

  describe('sanitizeLinks', () => {
    it('should only allow whitelisted link types', async () => {
      const { sanitizeLinks } = await import('../src/server/utils/helpers.js');
      
      const input = {
        website: 'https://example.com',
        twitter: 'https://twitter.com/user',
        malicious: 'https://evil.com'
      };
      
      const result = sanitizeLinks(input);
      assert.ok('website' in result);
      assert.ok('twitter' in result);
      assert.ok(!('malicious' in result));
    });

    it('should return empty object for invalid input', async () => {
      const { sanitizeLinks } = await import('../src/server/utils/helpers.js');
      
      assert.deepStrictEqual(sanitizeLinks(null), {});
      assert.deepStrictEqual(sanitizeLinks('string'), {});
      assert.deepStrictEqual(sanitizeLinks(123), {});
    });
  });

  describe('generateUUID', () => {
    it('should generate valid UUID format', async () => {
      const { generateUUID } = await import('../src/server/utils/helpers.js');
      
      const uuid = generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      assert.ok(uuidRegex.test(uuid));
    });

    it('should generate unique UUIDs', async () => {
      const { generateUUID } = await import('../src/server/utils/helpers.js');
      
      const uuids = new Set();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      assert.strictEqual(uuids.size, 100);
    });
  });

  describe('generateToken', () => {
    it('should generate token of specified length', async () => {
      const { generateToken } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(generateToken(32).length, 32);
      assert.strictEqual(generateToken(64).length, 64);
      assert.strictEqual(generateToken(16).length, 16);
    });

    it('should generate unique tokens', async () => {
      const { generateToken } = await import('../src/server/utils/helpers.js');
      
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateToken());
      }
      assert.strictEqual(tokens.size, 100);
    });
  });

  describe('validateVariableValue', () => {
    it('should validate required fields', async () => {
      const { validateVariableValue } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateVariableValue('', 'required'), 'This field is required');
      assert.strictEqual(validateVariableValue('value', 'required'), null);
    });

    it('should allow nullable fields to be empty', async () => {
      const { validateVariableValue } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateVariableValue('', 'nullable'), null);
    });

    it('should validate numeric types', async () => {
      const { validateVariableValue } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateVariableValue('abc', 'numeric'), 'Must be a number');
      assert.strictEqual(validateVariableValue('123', 'numeric'), null);
    });

    it('should validate min/max for numbers', async () => {
      const { validateVariableValue } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateVariableValue('5', 'numeric|min:10'), 'Minimum value is 10');
      assert.strictEqual(validateVariableValue('15', 'numeric|max:10'), 'Maximum value is 10');
      assert.strictEqual(validateVariableValue('10', 'numeric|min:5|max:15'), null);
    });

    it('should validate min/max for strings', async () => {
      const { validateVariableValue } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateVariableValue('ab', 'string|min:3'), 'Minimum length is 3');
      assert.strictEqual(validateVariableValue('abcdef', 'string|max:3'), 'Maximum length is 3');
    });

    it('should validate in: rule', async () => {
      const { validateVariableValue } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateVariableValue('invalid', 'in:a,b,c'), 'Must be one of: a, b, c');
      assert.strictEqual(validateVariableValue('a', 'in:a,b,c'), null);
    });

    it('should return null for empty rules', async () => {
      const { validateVariableValue } = await import('../src/server/utils/helpers.js');
      
      assert.strictEqual(validateVariableValue('anything', ''), null);
      assert.strictEqual(validateVariableValue('anything', null), null);
    });
  });
});
