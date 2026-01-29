import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.join(__dirname, '../../../plugins');

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
    this.routes = [];
    this.middlewares = [];
    this.wsHandlers = new Map();
    this.overrides = new Map();
    this.sidebarItems = [];
    this.styles = [];
    this.scripts = [];
    this.components = new Map();
    this.slots = new Map();
    this.pages = new Map();
    this.app = null;
  }

  setApp(app) {
    this.app = app;
  }

  registerHook(event, callback, priority = 10) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event).push({ callback, priority });
    this.hooks.get(event).sort((a, b) => a.priority - b.priority);
  }

  async executeHook(event, data) {
    const handlers = this.hooks.get(event) || [];
    let result = data;
    
    for (const handler of handlers) {
      try {
        const hookResult = await handler.callback(result);
        if (hookResult !== undefined) {
          result = hookResult;
        }
      } catch (err) {
        logger.error(`Plugin hook error [${event}]: ${err.message}`);
      }
    }
    
    return result;
  }

  registerRoute(method, path, handler, middleware = []) {
    this.routes.push({ method, path, handler, middleware });
    
    if (this.app) {
      const fullMiddleware = [...middleware, handler];
      this.app[method.toLowerCase()](path, ...fullMiddleware);
    }
  }

  registerMiddleware(path, handler) {
    this.middlewares.push({ path, handler });
    
    if (this.app) {
      if (path) {
        this.app.use(path, handler);
      } else {
        this.app.use(handler);
      }
    }
  }

  registerWebSocketHandler(event, handler) {
    if (!this.wsHandlers.has(event)) {
      this.wsHandlers.set(event, []);
    }
    this.wsHandlers.get(event).push(handler);
  }

  registerSidebarItem(item) {
    const sidebarItem = {
      path: item.path,
      icon: item.icon || 'extension',
      label: item.label,
      adminOnly: item.adminOnly || false,
      position: item.position || 'bottom',
      priority: item.priority || 100,
      plugin: item.plugin
    };
    this.sidebarItems.push(sidebarItem);
    this.sidebarItems.sort((a, b) => a.priority - b.priority);
  }

  getSidebarItems(isAdmin = false) {
    return this.sidebarItems.filter(item => !item.adminOnly || isAdmin);
  }

  registerStyle(style) {
    this.styles.push(style);
  }

  registerScript(script) {
    this.scripts.push(script);
  }

  registerComponent(name, component) {
    this.components.set(name, component);
  }

  registerSlot(slotName, content) {
    if (!this.slots.has(slotName)) {
      this.slots.set(slotName, []);
    }
    this.slots.get(slotName).push(content);
    this.slots.get(slotName).sort((a, b) => (a.priority || 100) - (b.priority || 100));
  }

  getSlotContent(slotName) {
    return this.slots.get(slotName) || [];
  }

  registerPage(path, page) {
    this.pages.set(path, page);
  }

  getClientAssets() {
    return {
      styles: this.styles,
      scripts: this.scripts,
      components: Array.from(this.components.entries()).map(([name, comp]) => ({
        name,
        ...comp
      })),
      slots: Object.fromEntries(this.slots),
      sidebar: this.sidebarItems,
      pages: Array.from(this.pages.entries()).map(([path, page]) => ({
        path,
        ...page
      }))
    };
  }

  async handleWebSocketEvent(event, args, context) {
    const handlers = this.wsHandlers.get(event) || [];
    let result = { handled: false, data: args };
    
    for (const handler of handlers) {
      try {
        const handlerResult = await handler(args, context);
        if (handlerResult?.handled) {
          result = handlerResult;
          break;
        }
      } catch (err) {
        logger.error(`Plugin WS handler error [${event}]: ${err.message}`);
      }
    }
    
    return result;
  }

  override(target, replacement) {
    this.overrides.set(target, replacement);
  }

  getOverride(target) {
    return this.overrides.get(target);
  }

  hasOverride(target) {
    return this.overrides.has(target);
  }

  wrapFunction(original, before, after) {
    return async function(...args) {
      let modifiedArgs = args;
      
      if (before) {
        const beforeResult = await before(...args);
        if (beforeResult !== undefined) {
          modifiedArgs = Array.isArray(beforeResult) ? beforeResult : [beforeResult];
        }
      }
      
      let result = await original.apply(this, modifiedArgs);
      
      if (after) {
        const afterResult = await after(result, ...modifiedArgs);
        if (afterResult !== undefined) {
          result = afterResult;
        }
      }
      
      return result;
    };
  }

  async loadPlugins() {
    if (!fs.existsSync(PLUGINS_DIR)) {
      fs.mkdirSync(PLUGINS_DIR, { recursive: true });
      return;
    }

    const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await this.loadPlugin(path.join(PLUGINS_DIR, entry.name));
      } else if (entry.name.endsWith('.js')) {
        await this.loadPluginFile(path.join(PLUGINS_DIR, entry.name));
      }
    }
  }

  async loadPlugin(pluginPath) {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    const indexPath = path.join(pluginPath, 'index.js');
    const mainPath = path.join(pluginPath, 'main.js');

    let manifest = { name: path.basename(pluginPath), version: '1.0.0' };
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        manifest.id = manifest.id || manifest.name;
        manifest._path = pluginPath;
      } catch (err) {
        logger.warn(`Invalid plugin manifest: ${manifestPath}`);
        return;
      }
    }

    await this.processManifest(manifest, pluginPath);

    const entryPoint = manifest.main 
      ? path.join(pluginPath, manifest.main)
      : fs.existsSync(indexPath) ? indexPath : mainPath;
    
    if (fs.existsSync(entryPoint)) {
      await this.loadPluginModule(entryPoint, manifest, pluginPath);
    } else {
      this.plugins.set(manifest.id || manifest.name, {
        manifest,
        module: null,
        path: pluginPath
      });
      logger.info(`Plugin loaded (declarative): ${manifest.name} v${manifest.version}`);
    }
  }

  async processManifest(manifest, pluginPath) {
    const pluginId = manifest.id || manifest.name;

    if (manifest.sidebar) {
      for (const item of manifest.sidebar) {
        this.registerSidebarItem({ ...item, plugin: pluginId });
      }
    }

    if (manifest.slots) {
      for (const [slotName, contents] of Object.entries(manifest.slots)) {
        for (const content of contents) {
          this.registerSlot(slotName, { ...content, plugin: pluginId });
        }
      }
    }

    if (manifest.styles) {
      for (const style of manifest.styles) {
        const stylePath = path.join(pluginPath, style);
        if (fs.existsSync(stylePath)) {
          const css = fs.readFileSync(stylePath, 'utf-8');
          this.registerStyle({ css, plugin: pluginId, file: style });
        } else {
          this.registerStyle({ url: `/plugins/${pluginId}/${style}`, plugin: pluginId });
        }
      }
    }

    if (manifest.scripts) {
      for (const script of manifest.scripts) {
        this.registerScript({ url: `/plugins/${pluginId}/${script}`, plugin: pluginId });
      }
    }

    if (manifest.pages) {
      for (const page of manifest.pages) {
        const templatePath = path.join(pluginPath, page.template);
        let html = '';
        if (fs.existsSync(templatePath)) {
          html = fs.readFileSync(templatePath, 'utf-8');
        }
        this.registerPage(page.path, {
          title: page.title,
          html,
          plugin: pluginId
        });
      }
    }
  }

  async loadPluginFile(filePath) {
    const name = path.basename(filePath, '.js');
    const manifest = { name, version: '1.0.0' };
    await this.loadPluginModule(filePath, manifest, path.dirname(filePath));
  }

  async loadPluginModule(modulePath, manifest, pluginPath) {
    try {
      const pluginModule = await import(`file://${modulePath}`);
      const plugin = pluginModule.default || pluginModule;
      const pluginId = manifest.id || manifest.name;
      
      const api = this.createPluginAPI(manifest, pluginPath);
      
      if (typeof plugin.init === 'function') {
        await plugin.init(api);
      }
      
      this.plugins.set(pluginId, {
        manifest,
        module: plugin,
        path: pluginPath || path.dirname(modulePath),
        api
      });
      
      logger.info(`Plugin loaded: ${manifest.name} v${manifest.version}`);
    } catch (err) {
      logger.error(`Failed to load plugin ${manifest.name}: ${err.message}`);
    }
  }

  createPluginAPI(manifest, pluginPath) {
    const self = this;
    const pluginId = manifest.id || manifest.name;
    
    return {
      name: manifest.name,
      version: manifest.version,
      
      hook: (event, callback, priority) => self.registerHook(event, callback, priority),
      
      route: {
        get: (path, handler, middleware) => self.registerRoute('get', path, handler, middleware),
        post: (path, handler, middleware) => self.registerRoute('post', path, handler, middleware),
        put: (path, handler, middleware) => self.registerRoute('put', path, handler, middleware),
        patch: (path, handler, middleware) => self.registerRoute('patch', path, handler, middleware),
        delete: (path, handler, middleware) => self.registerRoute('delete', path, handler, middleware)
      },
      
      middleware: (pathOrHandler, handler) => {
        if (typeof pathOrHandler === 'function') {
          self.registerMiddleware(null, pathOrHandler);
        } else {
          self.registerMiddleware(pathOrHandler, handler);
        }
      },
      
      ws: (event, handler) => self.registerWebSocketHandler(event, handler),
      
      sidebar: (item) => self.registerSidebarItem({ ...item, plugin: manifest.name }),
      
      ui: {
        style: (css) => self.registerStyle({ css, plugin: manifest.name }),
        styleUrl: (url) => self.registerStyle({ url, plugin: manifest.name }),
        script: (code) => self.registerScript({ code, plugin: manifest.name }),
        scriptUrl: (url) => self.registerScript({ url, plugin: manifest.name }),
        component: (name, config) => self.registerComponent(name, { ...config, plugin: manifest.name }),
        slot: (slotName, content) => self.registerSlot(slotName, { ...content, plugin: manifest.name }),
        page: (path, config) => self.registerPage(path, { ...config, plugin: manifest.name })
      },
      
      override: (target, replacement) => self.override(target, replacement),
      
      wrap: (original, before, after) => self.wrapFunction(original, before, after),
      
      storage: {
        get: (key) => self.getPluginStorage(pluginId, key),
        set: (key, value) => self.setPluginStorage(pluginId, key, value),
        delete: (key) => self.deletePluginStorage(pluginId, key),
        getAll: () => self.getPluginStorage(pluginId)
      },
      
      settings: {
        get: (key) => self.getPluginSetting(pluginId, key),
        set: (key, value) => self.setPluginSetting(pluginId, key, value),
        getAll: () => self.getPluginSettings(pluginId),
        getSchema: () => manifest.settings?.schema || []
      },
      
      log: {
        info: (msg) => logger.info(`[${pluginId}] ${msg}`),
        warn: (msg) => logger.warn(`[${pluginId}] ${msg}`),
        error: (msg) => logger.error(`[${pluginId}] ${msg}`)
      },

      manifest,
      path: pluginPath,
      
      getPlugins: () => Array.from(self.plugins.keys()),
      
      emit: (event, data) => self.executeHook(event, data),
      
      require: (filePath) => import(`file://${path.join(pluginPath, filePath)}`)
    };
  }

  getPluginSettings(pluginId) {
    return this.getPluginStorage(pluginId, '_settings') || {};
  }

  getPluginSetting(pluginId, key) {
    const settings = this.getPluginSettings(pluginId);
    return settings[key];
  }

  setPluginSetting(pluginId, key, value) {
    const settings = this.getPluginSettings(pluginId);
    settings[key] = value;
    this.setPluginStorage(pluginId, '_settings', settings);
  }

  getPluginStorage(pluginName, key) {
    const storagePath = path.join(PLUGINS_DIR, '.storage', `${pluginName}.json`);
    
    if (!fs.existsSync(storagePath)) return undefined;
    
    try {
      const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      return key ? data[key] : data;
    } catch {
      return undefined;
    }
  }

  setPluginStorage(pluginName, key, value) {
    const storageDir = path.join(PLUGINS_DIR, '.storage');
    const storagePath = path.join(storageDir, `${pluginName}.json`);
    
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    
    let data = {};
    if (fs.existsSync(storagePath)) {
      try {
        data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      } catch {}
    }
    
    data[key] = value;
    fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
  }

  deletePluginStorage(pluginName, key) {
    const storagePath = path.join(PLUGINS_DIR, '.storage', `${pluginName}.json`);
    
    if (!fs.existsSync(storagePath)) return;
    
    try {
      const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      delete data[key];
      fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
    } catch {}
  }

  applyRoutes(app) {
    for (const route of this.routes) {
      const fullMiddleware = [...route.middleware, route.handler];
      app[route.method.toLowerCase()](route.path, ...fullMiddleware);
    }
  }

  applyMiddlewares(app) {
    for (const { path: mPath, handler } of this.middlewares) {
      if (mPath) {
        app.use(mPath, handler);
      } else {
        app.use(handler);
      }
    }
  }

  getLoadedPlugins() {
    return Array.from(this.plugins.entries()).map(([name, data]) => ({
      name,
      version: data.manifest.version,
      description: data.manifest.description || '',
      author: data.manifest.author || 'Unknown'
    }));
  }

  async reloadPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    
    if (plugin.module.unload) {
      await plugin.module.unload();
    }
    
    this.plugins.delete(name);
    
    const manifest = plugin.manifest;
    await this.loadPluginModule(plugin.path, manifest);
    
    return true;
  }

  async unloadPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    
    if (plugin.module.unload) {
      await plugin.module.unload();
    }
    
    this.plugins.delete(name);
    logger.info(`Plugin unloaded: ${name}`);
    
    return true;
  }
}

export const pluginManager = new PluginManager();
export default pluginManager;
