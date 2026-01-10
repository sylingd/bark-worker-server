import path from 'node:path';
import { defineConfig } from '@rsbuild/core';
import fs from 'fs-extra';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  output: {
    target: 'web',
    module: true,
    distPath: {
      root: 'dist',
      js: '.',
    },
    filename: {
      js: '[name].js',
    },
    cleanDistPath: true,
    polyfill: 'off',
    sourceMap: false,
    minify: false,
  },
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
  source: {
    entry: {
      handler: {
        import: `./src/entry/${process.env.ENTRY}.ts`,
        html: false,
      },
    },
  },
  tools: {
    rspack: {
      target: 'es2020',
      output: {
        asyncChunks: false,
        library: {
          type: 'module',
        },
        // pathinfo: true,
      },
      experiments: {
        outputModule: true,
      },
    },
  },
  plugins: [
    {
      name: 'after',
      setup(api) {
        api.onAfterBuild(async () => {
          if (process.env.ENTRY === 'edgeone') {
            const dist = path.join(__dirname, 'dist');
            const functions = process.env.ROOT_PATH
              ? path.join(dist, 'edge-functions', process.env.ROOT_PATH)
              : path.join(dist, 'edge-functions');
            await fs.ensureDir(functions);
            await fs.move(
              path.join(dist, 'handler.js'),
              path.join(functions, '[[default]].js'),
            );
          }
        });
      },
    },
  ],
});
