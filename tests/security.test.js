import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Security Utilities (Client)', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', async () => {
      const { escapeHtml } = await import('../src/utils/security.js');
      
      assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      assert.strictEqual(escapeHtml('&test'), '&amp;test');
      assert.strictEqual(escapeHtml("'quotes'"), "&#x27;quotes&#x27;");
      assert.strictEqual(escapeHtml('`backticks`'), '&#96;backticks&#96;');
    });

    it('should return empty string for non-string input', async () => {
      const { escapeHtml } = await import('../src/utils/security.js');
      
      assert.strictEqual(escapeHtml(null), '');
      assert.strictEqual(escapeHtml(undefined), '');
      assert.strictEqual(escapeHtml(123), '');
      assert.strictEqual(escapeHtml({}), '');
      assert.strictEqual(escapeHtml([]), '');
    });

    it('should handle empty string', async () => {
      const { escapeHtml } = await import('../src/utils/security.js');
      assert.strictEqual(escapeHtml(''), '');
    });

    it('should preserve safe characters', async () => {
      const { escapeHtml } = await import('../src/utils/security.js');
      
      assert.strictEqual(escapeHtml('Hello World'), 'Hello World');
      assert.strictEqual(escapeHtml('user@email.com'), 'user@email.com');
      assert.strictEqual(escapeHtml('100%'), '100%');
    });
  });

  describe('escapeUrl', () => {
    it('should accept valid http/https URLs', async () => {
      const { escapeUrl } = await import('../src/utils/security.js');
      
      assert.strictEqual(escapeUrl('https://example.com'), 'https://example.com/');
      assert.strictEqual(escapeUrl('http://test.org/path?q=1'), 'http://test.org/path?q=1');
    });

    it('should reject dangerous protocols', async () => {
      const { escapeUrl } = await import('../src/utils/security.js');
      
      assert.strictEqual(escapeUrl('javascript:alert(1)'), '');
      assert.strictEqual(escapeUrl('data:text/html,<script>'), '');
      assert.strictEqual(escapeUrl('vbscript:msgbox'), '');
    });

    it('should reject invalid URLs', async () => {
      const { escapeUrl } = await import('../src/utils/security.js');
      
      assert.strictEqual(escapeUrl('not a url'), '');
      assert.strictEqual(escapeUrl(''), '');
      assert.strictEqual(escapeUrl('   '), '');
    });

    it('should handle non-string input', async () => {
      const { escapeUrl } = await import('../src/utils/security.js');
      
      assert.strictEqual(escapeUrl(null), '');
      assert.strictEqual(escapeUrl(undefined), '');
      assert.strictEqual(escapeUrl(123), '');
    });

    it('should trim whitespace', async () => {
      const { escapeUrl } = await import('../src/utils/security.js');
      
      assert.strictEqual(escapeUrl('  https://example.com  '), 'https://example.com/');
    });
  });

  describe('sanitizeText', () => {
    it('should escape and trim text', async () => {
      const { sanitizeText } = await import('../src/utils/security.js');
      
      assert.strictEqual(sanitizeText('  <script>  '), '&lt;script&gt;');
    });

    it('should truncate to maxLength', async () => {
      const { sanitizeText } = await import('../src/utils/security.js');
      
      const longText = 'a'.repeat(2000);
      const result = sanitizeText(longText, 100);
      assert.strictEqual(result.length, 100);
    });

    it('should use default maxLength of 1000', async () => {
      const { sanitizeText } = await import('../src/utils/security.js');
      
      const longText = 'b'.repeat(2000);
      const result = sanitizeText(longText);
      assert.strictEqual(result.length, 1000);
    });

    it('should return empty string for non-string input', async () => {
      const { sanitizeText } = await import('../src/utils/security.js');
      
      assert.strictEqual(sanitizeText(null), '');
      assert.strictEqual(sanitizeText(123), '');
    });
  });

  describe('isValidUrl', () => {
    it('should accept HTTPS URLs', async () => {
      const { isValidUrl } = await import('../src/utils/security.js');
      
      assert.strictEqual(isValidUrl('https://example.com'), true);
      assert.strictEqual(isValidUrl('https://sub.domain.org/path'), true);
    });

    it('should reject HTTP URLs', async () => {
      const { isValidUrl } = await import('../src/utils/security.js');
      
      assert.strictEqual(isValidUrl('http://example.com'), false);
    });

    it('should reject invalid URLs', async () => {
      const { isValidUrl } = await import('../src/utils/security.js');
      
      assert.strictEqual(isValidUrl('not a url'), false);
    });

    it('should return true for empty/null values', async () => {
      const { isValidUrl } = await import('../src/utils/security.js');
      
      assert.strictEqual(isValidUrl(''), true);
      assert.strictEqual(isValidUrl(null), true);
      assert.strictEqual(isValidUrl(undefined), true);
    });
  });
});
