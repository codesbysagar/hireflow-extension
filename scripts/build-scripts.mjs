import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function buildExtensionScripts() {
  console.log('Building Service Worker (background.js)...');
  await build({
    configFile: false,
    build: {
      outDir: resolve(rootDir, 'dist'),
      emptyOutDir: false,
      lib: {
        entry: resolve(rootDir, 'src/background/service-worker.ts'),
        name: 'HireFlowBackground',
        formats: ['es'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  console.log('Building Content Script (content.js)...');
  await build({
    configFile: false,
    build: {
      outDir: resolve(rootDir, 'dist'),
      emptyOutDir: false,
      lib: {
        entry: resolve(rootDir, 'src/content/linkedin-content.ts'),
        name: 'HireFlowContentScript',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          extend: true,
        },
      },
    },
  });

  console.log('Successfully built background and content scripts!');
}

buildExtensionScripts().catch((err) => {
  console.error('Build scripts failed:', err);
  process.exit(1);
});
