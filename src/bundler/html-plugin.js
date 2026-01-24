const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function generate(assets = {}) {
  const templatePath = path.join(ROOT, 'src/templates/index.html');
  const outputPath = path.join(ROOT, 'dist/index.html');
  
  if (!fs.existsSync(templatePath)) {
    console.log('⚠ No HTML template found, skipping...');
    return;
  }
  
  let html = fs.readFileSync(templatePath, 'utf8');
  
  const cssLink = assets.css 
    ? `<link rel="stylesheet" href="${assets.css}">`
    : '';
  
  const jsScript = assets.js 
    ? `<script src="${assets.js}"></script>`
    : '';
  
  html = html.replace('<!-- CSS_INJECT -->', cssLink);
  html = html.replace('<!-- JS_INJECT -->', jsScript);
  
  html = html.replace(/\$\{CSS_FILE\}/g, assets.css || '');
  html = html.replace(/\$\{JS_FILE\}/g, assets.js || '');
  
  fs.writeFileSync(outputPath, html);
  console.log('✓ HTML generated');
}

function injectAssets(html, assets) {
  const headEnd = html.indexOf('</head>');
  const bodyEnd = html.indexOf('</body>');
  
  if (headEnd === -1 || bodyEnd === -1) {
    return html;
  }
  
  let result = html;
  
  if (assets.css) {
    const cssLink = `  <link rel="stylesheet" href="${assets.css}">\n  `;
    result = result.slice(0, headEnd) + cssLink + result.slice(headEnd);
  }
  
  const newBodyEnd = result.indexOf('</body>');
  if (assets.js) {
    const jsScript = `  <script src="${assets.js}"></script>\n  `;
    result = result.slice(0, newBodyEnd) + jsScript + result.slice(newBodyEnd);
  }
  
  return result;
}

module.exports = { generate, injectAssets };
