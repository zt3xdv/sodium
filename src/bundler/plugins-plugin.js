import fs from 'fs';
import path from 'path';

const PLUGINS_DIR = path.resolve('plugins');

export default function pluginsPlugin(options = {}) {
  const outDir = options.outDir || 'dist';
  
  return {
    name: 'sodium-plugins',
    
    async generateBundle() {
      if (!fs.existsSync(PLUGINS_DIR)) {
        return;
      }
      
      const plugins = [];
      const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const pluginPath = path.join(PLUGINS_DIR, entry.name);
        const manifestPath = path.join(pluginPath, 'plugin.json');
        
        if (!fs.existsSync(manifestPath)) continue;
        
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          const pluginId = manifest.id || entry.name;
          
          const pluginData = {
            id: pluginId,
            name: manifest.name || entry.name,
            version: manifest.version || '1.0.0',
            description: manifest.description || '',
            author: manifest.author || 'Unknown',
            sidebar: (manifest.sidebar || []).map(item => ({
              ...item,
              plugin: pluginId
            })),
            pages: (manifest.pages || []).map(page => ({
              ...page,
              plugin: pluginId
            })),
            injections: (manifest.injections || []).map(inj => ({
              target: inj.target,
              html: inj.html || null,
              file: inj.file || null,
              position: inj.position || 'append',
              priority: inj.priority || 100,
              plugin: pluginId
            })),
            styles: [],
            scripts: []
          };
          
          // Process styles
          for (const style of manifest.styles || []) {
            pluginData.styles.push({
              url: `/plugins/${pluginId}/${style}`,
              plugin: pluginId
            });
          }
          
          // Process scripts
          for (const script of manifest.scripts || []) {
            pluginData.scripts.push({
              url: `/plugins/${pluginId}/${script}`,
              plugin: pluginId
            });
          }
          
          // Read injection files
          for (const inj of pluginData.injections) {
            if (inj.file && !inj.html) {
              const injPath = path.join(pluginPath, inj.file);
              if (fs.existsSync(injPath)) {
                inj.html = fs.readFileSync(injPath, 'utf-8');
              }
              delete inj.file;
            }
          }
          
          // Read page templates
          for (const page of pluginData.pages) {
            if (page.template) {
              const templatePath = path.join(pluginPath, page.template);
              if (fs.existsSync(templatePath)) {
                page.html = fs.readFileSync(templatePath, 'utf-8');
              }
            }
          }
          
          plugins.push(pluginData);
          
          // Copy plugin assets to dist
          const assetsDir = manifest.assets 
            ? path.join(pluginPath, manifest.assets)
            : path.join(pluginPath, 'assets');
          
          if (fs.existsSync(assetsDir)) {
            const destDir = path.join(outDir, 'plugins', pluginId);
            fs.mkdirSync(destDir, { recursive: true });
            copyDir(assetsDir, destDir);
          }
          
        } catch (err) {
          console.warn(`Failed to process plugin ${entry.name}: ${err.message}`);
        }
      }
      
      // Emit plugins manifest
      this.emitFile({
        type: 'asset',
        fileName: 'plugins.json',
        source: JSON.stringify(plugins, null, 2)
      });
    }
  };
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
