export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#96;');
}

export function escapeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    // Invalid URL format
    return '';
  }
}

export function sanitizeText(text, maxLength = 1000) {
  if (typeof text !== 'string') return '';
  return escapeHtml(text.slice(0, maxLength).trim());
}

export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return true;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:';
  } catch {
    // Invalid URL format
    return false;
  }
}

export function createSafeElement(tag, attributes = {}, textContent = '') {
  const el = document.createElement(tag);
  
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'href' || key === 'src') {
      const safeUrl = escapeUrl(value);
      if (safeUrl) el.setAttribute(key, safeUrl);
    } else if (key === 'class') {
      el.className = value;
    } else if (key.startsWith('data-')) {
      el.setAttribute(key, escapeHtml(value));
    } else {
      el.setAttribute(key, escapeHtml(value));
    }
  }
  
  if (textContent) {
    el.textContent = textContent;
  }
  
  return el;
}

export function safeInnerHTML(element, html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  
  const scripts = template.content.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  const elements = template.content.querySelectorAll('*');
  elements.forEach(el => {
    const attrs = Array.from(el.attributes);
    attrs.forEach(attr => {
      if (attr.name.startsWith('on') || 
          attr.value.includes('javascript:') ||
          attr.value.includes('data:text/html')) {
        el.removeAttribute(attr.name);
      }
    });
  });
  
  element.innerHTML = '';
  element.appendChild(template.content);
}
