import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, adminMiddleware } from '../utils/auth.js';
import pluginManager from '../plugins/manager.js';
import { installPlugin, uninstallPlugin, createPluginPackage } from '../plugins/installer.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.join(__dirname, '../../../plugins');

router.get('/', authMiddleware, adminMiddleware, (req, res) => {
  const plugins = pluginManager.getLoadedPlugins();
  res.json({ plugins });
});

router.get('/available', authMiddleware, adminMiddleware, (req, res) => {
  if (!fs.existsSync(PLUGINS_DIR)) {
    return res.json({ plugins: [] });
  }

  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const available = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    
    let manifest = { name: entry.name, version: '1.0.0' };
    
    if (entry.isDirectory()) {
      const manifestPath = path.join(PLUGINS_DIR, entry.name, 'plugin.json');
      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        } catch {}
      }
    } else if (entry.name.endsWith('.js')) {
      manifest.name = entry.name.replace('.js', '');
    } else {
      continue;
    }

    const loaded = pluginManager.plugins.has(manifest.name);
    available.push({
      ...manifest,
      loaded,
      path: entry.name
    });
  }

  res.json({ plugins: available });
});

router.post('/reload/:name', authMiddleware, adminMiddleware, async (req, res) => {
  const { name } = req.params;
  
  try {
    const success = await pluginManager.reloadPlugin(name);
    if (success) {
      res.json({ message: `Plugin ${name} reloaded` });
    } else {
      res.status(404).json({ error: 'Plugin not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/unload/:name', authMiddleware, adminMiddleware, async (req, res) => {
  const { name } = req.params;
  
  try {
    const success = await pluginManager.unloadPlugin(name);
    if (success) {
      res.json({ message: `Plugin ${name} unloaded` });
    } else {
      res.status(404).json({ error: 'Plugin not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/load/:name', authMiddleware, adminMiddleware, async (req, res) => {
  const { name } = req.params;
  
  const pluginPath = path.join(PLUGINS_DIR, name);
  const pluginFile = path.join(PLUGINS_DIR, `${name}.js`);
  
  try {
    if (fs.existsSync(pluginPath) && fs.statSync(pluginPath).isDirectory()) {
      await pluginManager.loadPlugin(pluginPath);
    } else if (fs.existsSync(pluginFile)) {
      await pluginManager.loadPluginFile(pluginFile);
    } else {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    
    res.json({ message: `Plugin ${name} loaded` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/hooks', authMiddleware, adminMiddleware, (req, res) => {
  const hooks = Array.from(pluginManager.hooks.keys());
  res.json({ hooks });
});

router.get('/assets', authMiddleware, (req, res) => {
  const user = req.user;
  const assets = pluginManager.getClientAssets();
  
  assets.sidebar = pluginManager.getSidebarItems(user?.isAdmin);
  
  res.json(assets);
});

router.get('/slots/:name', authMiddleware, (req, res) => {
  const { name } = req.params;
  const content = pluginManager.getSlotContent(name);
  res.json({ slot: name, content });
});

router.post('/install', authMiddleware, adminMiddleware, async (req, res) => {
  const { source } = req.body;
  
  if (!source) {
    return res.status(400).json({ error: 'Source is required' });
  }
  
  try {
    const result = await installPlugin(source);
    await pluginManager.loadPlugin(result.path);
    res.json({ message: `Plugin ${result.name} installed`, plugin: result.manifest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:name', authMiddleware, adminMiddleware, async (req, res) => {
  const { name } = req.params;
  
  try {
    await pluginManager.unloadPlugin(name);
    await uninstallPlugin(name);
    res.json({ message: `Plugin ${name} uninstalled` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/package', authMiddleware, adminMiddleware, async (req, res) => {
  const { name } = req.params;
  
  try {
    const outputPath = await createPluginPackage(name);
    res.json({ message: `Plugin packaged`, path: outputPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:name/settings', authMiddleware, adminMiddleware, (req, res) => {
  const { name } = req.params;
  const plugin = pluginManager.plugins.get(name);
  
  if (!plugin) {
    return res.status(404).json({ error: 'Plugin not found' });
  }
  
  const settings = pluginManager.getPluginSettings(name);
  const schema = plugin.manifest.settings?.schema || [];
  
  res.json({ settings, schema });
});

router.put('/:name/settings', authMiddleware, adminMiddleware, (req, res) => {
  const { name } = req.params;
  const { settings } = req.body;
  
  const plugin = pluginManager.plugins.get(name);
  if (!plugin) {
    return res.status(404).json({ error: 'Plugin not found' });
  }
  
  for (const [key, value] of Object.entries(settings)) {
    pluginManager.setPluginSetting(name, key, value);
  }
  
  res.json({ message: 'Settings updated' });
});

router.get('/:name', authMiddleware, adminMiddleware, (req, res) => {
  const { name } = req.params;
  const plugin = pluginManager.plugins.get(name);
  
  if (!plugin) {
    return res.status(404).json({ error: 'Plugin not found' });
  }
  
  res.json({
    name: plugin.manifest.name,
    id: plugin.manifest.id,
    version: plugin.manifest.version,
    description: plugin.manifest.description,
    author: plugin.manifest.author,
    website: plugin.manifest.website,
    license: plugin.manifest.license,
    permissions: plugin.manifest.permissions,
    hasSettings: !!(plugin.manifest.settings?.schema?.length)
  });
});

export default router;
