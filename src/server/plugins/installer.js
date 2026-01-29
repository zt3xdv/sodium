import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.join(__dirname, '../../../plugins');

export async function installPlugin(source) {
  if (source.endsWith('.sodium') || source.endsWith('.tar.gz')) {
    return await installFromArchive(source);
  }
  
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return await installFromUrl(source);
  }
  
  if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
    return await installFromDirectory(source);
  }
  
  throw new Error(`Unknown plugin source: ${source}`);
}

async function installFromDirectory(sourcePath) {
  const manifestPath = path.join(sourcePath, 'plugin.json');
  
  if (!fs.existsSync(manifestPath)) {
    throw new Error('plugin.json not found');
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const pluginName = manifest.id || manifest.name;
  const targetPath = path.join(PLUGINS_DIR, pluginName);
  
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true });
  }
  
  copyDirectory(sourcePath, targetPath);
  
  logger.info(`Plugin installed: ${pluginName}`);
  return { name: pluginName, path: targetPath, manifest };
}

async function installFromArchive(archivePath) {
  const tempDir = path.join(PLUGINS_DIR, '.temp', Date.now().toString());
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    await extractArchive(archivePath, tempDir);
    
    const entries = fs.readdirSync(tempDir);
    let pluginRoot = tempDir;
    
    if (entries.length === 1 && fs.statSync(path.join(tempDir, entries[0])).isDirectory()) {
      pluginRoot = path.join(tempDir, entries[0]);
    }
    
    const result = await installFromDirectory(pluginRoot);
    
    fs.rmSync(tempDir, { recursive: true });
    return result;
  } catch (err) {
    fs.rmSync(tempDir, { recursive: true });
    throw err;
  }
}

async function installFromUrl(url) {
  const tempFile = path.join(PLUGINS_DIR, '.temp', `download-${Date.now()}.sodium`);
  fs.mkdirSync(path.dirname(tempFile), { recursive: true });
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    
    const fileStream = createWriteStream(tempFile);
    await pipeline(response.body, fileStream);
    
    const result = await installFromArchive(tempFile);
    
    fs.unlinkSync(tempFile);
    return result;
  } catch (err) {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    throw err;
  }
}

async function extractArchive(archivePath, targetDir) {
  const tar = await import('tar');
  
  if (archivePath.endsWith('.sodium')) {
    await tar.extract({
      file: archivePath,
      cwd: targetDir,
      gzip: true
    });
  } else {
    await tar.extract({
      file: archivePath,
      cwd: targetDir
    });
  }
}

function copyDirectory(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export async function uninstallPlugin(pluginName) {
  const pluginPath = path.join(PLUGINS_DIR, pluginName);
  
  if (!fs.existsSync(pluginPath)) {
    throw new Error(`Plugin not found: ${pluginName}`);
  }
  
  fs.rmSync(pluginPath, { recursive: true });
  logger.info(`Plugin uninstalled: ${pluginName}`);
  
  return true;
}

export async function createPluginPackage(pluginName, outputPath) {
  const tar = await import('tar');
  const pluginPath = path.join(PLUGINS_DIR, pluginName);
  
  if (!fs.existsSync(pluginPath)) {
    throw new Error(`Plugin not found: ${pluginName}`);
  }
  
  const output = outputPath || path.join(PLUGINS_DIR, `${pluginName}.sodium`);
  
  await tar.create(
    {
      gzip: true,
      file: output,
      cwd: PLUGINS_DIR
    },
    [pluginName]
  );
  
  logger.info(`Plugin packaged: ${output}`);
  return output;
}
