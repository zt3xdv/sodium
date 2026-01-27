import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import pkg from '../../package.json' with { type: 'json' };

export default function htmlPlugin(options = {}) {
  const {
    template = 'src/index.html',
    filename = 'index.html'
  } = options;

  return {
    name: 'html-plugin',
    async generateBundle(outputOptions, bundle) {
      try {
        const htmlContent = await readFile(template, 'utf8');
        
        const jsFiles = Object.keys(bundle).filter(file => file.endsWith('.js'));
        const cssFiles = Object.keys(bundle).filter(file => file.endsWith('.css'));
        
        let processedHtml = htmlContent;
        
        if (jsFiles.length > 0) {
          processedHtml = processedHtml.replace(
            '</body>',
            `  <script src="/${jsFiles[0]}" type="module"></script>\n</body>`
          );
        }
        
        if (cssFiles.length > 0) {
          processedHtml = processedHtml.replace(
            '</head>',
            `  <link rel="stylesheet" href="/${cssFiles[0]}">\n</head>`
          );
        }
        
        this.emitFile({
          type: 'asset',
          fileName: filename,
          source: processedHtml
                  .replaceAll("\n", "")
                  .replaceAll("APP_DESCRIPTION", pkg.manifest.description)
                  .replaceAll("APP_TITLE", pkg.manifest.name)
                  .replaceAll("APP_URL", pkg.manifest.url)
        });
      } catch (error) {
        this.error(`Failed to process HTML template: ${error.message}`);
      }
    }
  };
}
