import { getPluginAssets } from './plugins.js';

const injectionPoints = new Map();
const observers = new Map();
let initialized = false;

export const InjectionPosition = {
  BEFORE: 'before',
  AFTER: 'after',
  PREPEND: 'prepend',
  APPEND: 'append',
  REPLACE: 'replace'
};

export function registerInjectionPoint(id, element) {
  injectionPoints.set(id, element);
  processQueuedInjections(id);
}

export function injectContent(targetId, content, position = InjectionPosition.APPEND) {
  const target = document.getElementById(targetId) || injectionPoints.get(targetId);
  
  if (!target) {
    queueInjection(targetId, content, position);
    return false;
  }
  
  const wrapper = document.createElement('div');
  wrapper.className = 'sodium-injection';
  wrapper.dataset.target = targetId;
  
  if (typeof content === 'string') {
    wrapper.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    wrapper.appendChild(content);
  } else if (typeof content === 'function') {
    const result = content(target);
    if (typeof result === 'string') {
      wrapper.innerHTML = result;
    } else if (result instanceof HTMLElement) {
      wrapper.appendChild(result);
    }
  }
  
  switch (position) {
    case InjectionPosition.BEFORE:
      target.parentNode.insertBefore(wrapper, target);
      break;
    case InjectionPosition.AFTER:
      target.parentNode.insertBefore(wrapper, target.nextSibling);
      break;
    case InjectionPosition.PREPEND:
      target.insertBefore(wrapper, target.firstChild);
      break;
    case InjectionPosition.APPEND:
      target.appendChild(wrapper);
      break;
    case InjectionPosition.REPLACE:
      target.innerHTML = '';
      target.appendChild(wrapper);
      break;
  }
  
  initializeInjectedScripts(wrapper);
  return true;
}

const injectionQueue = new Map();

function queueInjection(targetId, content, position) {
  if (!injectionQueue.has(targetId)) {
    injectionQueue.set(targetId, []);
  }
  injectionQueue.get(targetId).push({ content, position });
}

function processQueuedInjections(targetId) {
  const queued = injectionQueue.get(targetId);
  if (!queued) return;
  
  for (const { content, position } of queued) {
    injectContent(targetId, content, position);
  }
  injectionQueue.delete(targetId);
}

function initializeInjectedScripts(container) {
  const scripts = container.querySelectorAll('script');
  scripts.forEach(oldScript => {
    const newScript = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => {
      newScript.setAttribute(attr.name, attr.value);
    });
    newScript.textContent = oldScript.textContent;
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}

export function processPluginInjections() {
  const assets = getPluginAssets();
  if (!assets?.injections) return;
  
  for (const injection of assets.injections) {
    injectContent(injection.target, injection.html, injection.position || InjectionPosition.APPEND);
  }
}

export function observeElement(selector, callback) {
  const existing = document.querySelector(selector);
  if (existing) {
    callback(existing);
    return;
  }
  
  const observer = new MutationObserver((mutations, obs) => {
    const element = document.querySelector(selector);
    if (element) {
      callback(element);
      obs.disconnect();
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  observers.set(selector, observer);
}

export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

export function createInjectionSlot(id, container = null) {
  const slot = document.createElement('div');
  slot.id = `injection-${id}`;
  slot.className = 'injection-slot';
  slot.dataset.slot = id;
  
  if (container) {
    container.appendChild(slot);
  }
  
  registerInjectionPoint(id, slot);
  return slot;
}

export function injectCSS(css, id) {
  const existingStyle = document.getElementById(`plugin-css-${id}`);
  if (existingStyle) {
    existingStyle.textContent = css;
    return existingStyle;
  }
  
  const style = document.createElement('style');
  style.id = `plugin-css-${id}`;
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

export function injectScript(code, id) {
  const existingScript = document.getElementById(`plugin-script-${id}`);
  if (existingScript) {
    existingScript.remove();
  }
  
  const script = document.createElement('script');
  script.id = `plugin-script-${id}`;
  script.textContent = code;
  document.body.appendChild(script);
  return script;
}

export function removeInjections(pluginId) {
  document.querySelectorAll(`.sodium-injection[data-plugin="${pluginId}"]`).forEach(el => el.remove());
  document.querySelectorAll(`[id^="plugin-css-${pluginId}"]`).forEach(el => el.remove());
  document.querySelectorAll(`[id^="plugin-script-${pluginId}"]`).forEach(el => el.remove());
}

export function cleanup() {
  observers.forEach(observer => observer.disconnect());
  observers.clear();
  injectionPoints.clear();
  injectionQueue.clear();
}
