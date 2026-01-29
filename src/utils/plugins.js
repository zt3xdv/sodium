import { api } from './api.js';

let pluginAssets = null;
let loadedStyles = new Set();
let loadedScripts = new Set();

export async function loadPluginAssets() {
  try {
    const res = await api('/api/plugins/assets');
    if (res.ok) {
      pluginAssets = await res.json();
      await injectStyles();
      await injectScripts();
      return pluginAssets;
    }
  } catch (e) {
    console.error('Failed to load plugin assets:', e);
  }
  return null;
}

export function getPluginAssets() {
  return pluginAssets;
}

export function getPluginSidebarItems() {
  return pluginAssets?.sidebar || [];
}

export function getPluginPages() {
  return pluginAssets?.pages || [];
}

export function getSlotContent(slotName) {
  return pluginAssets?.slots?.[slotName] || [];
}

async function injectStyles() {
  if (!pluginAssets?.styles) return;
  
  for (const style of pluginAssets.styles) {
    const id = `plugin-style-${style.plugin}`;
    if (loadedStyles.has(id)) continue;
    
    if (style.css) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = style.css;
      document.head.appendChild(el);
    } else if (style.url) {
      const el = document.createElement('link');
      el.id = id;
      el.rel = 'stylesheet';
      el.href = style.url;
      document.head.appendChild(el);
    }
    
    loadedStyles.add(id);
  }
}

async function injectScripts() {
  if (!pluginAssets?.scripts) return;
  
  for (const script of pluginAssets.scripts) {
    const id = `plugin-script-${script.plugin}`;
    if (loadedScripts.has(id)) continue;
    
    if (script.code) {
      try {
        const fn = new Function(script.code);
        fn();
      } catch (e) {
        console.error(`Plugin script error [${script.plugin}]:`, e);
      }
    } else if (script.url) {
      const el = document.createElement('script');
      el.id = id;
      el.src = script.url;
      document.body.appendChild(el);
    }
    
    loadedScripts.add(id);
  }
}

export function renderSlot(slotName, context = {}) {
  const content = getSlotContent(slotName);
  if (!content.length) return '';
  
  return content.map(item => {
    if (item.html) {
      return item.html;
    }
    if (item.render) {
      try {
        const fn = new Function('context', `return (${item.render})(context)`);
        return fn(context);
      } catch (e) {
        console.error(`Slot render error [${slotName}]:`, e);
        return '';
      }
    }
    return '';
  }).join('');
}

export function initSlotListeners(container) {
  const content = getSlotContent('global:listeners');
  
  for (const item of content) {
    if (item.init) {
      try {
        const fn = new Function('container', `return (${item.init})(container)`);
        fn(container);
      } catch (e) {
        console.error('Slot listener error:', e);
      }
    }
  }
}

export function getPluginComponent(name) {
  return pluginAssets?.components?.find(c => c.name === name);
}

export function renderPluginComponent(name, props = {}) {
  const component = getPluginComponent(name);
  if (!component) return '';
  
  if (component.html) {
    let html = component.html;
    for (const [key, value] of Object.entries(props)) {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return html;
  }
  
  if (component.render) {
    try {
      const fn = new Function('props', `return (${component.render})(props)`);
      return fn(props);
    } catch (e) {
      console.error(`Component render error [${name}]:`, e);
      return '';
    }
  }
  
  return '';
}
