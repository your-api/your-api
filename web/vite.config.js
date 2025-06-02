import react from '@vitejs/plugin-react';
import { defineConfig, transformWithEsbuild } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'treat-js-files-as-jsx',
      async transform(code, id) {
        if (!/src\/.*\.js$/.test(id)) {
          return null;
        }

        // Use the exposed transform from vite, instead of directly
        // transforming with esbuild
        return transformWithEsbuild(code, id, {
          loader: 'jsx',
          jsx: 'automatic',
        });
      },
    },
    react(),
  ],
  optimizeDeps: {
    force: true,
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.json': 'json',
      },
      minify: true,
      treeShaking: true,
    },
  },
  build: {
    minify: 'esbuild',
    chunkSizeWarningLimit: 200,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('@visactor/vchart') && !id.includes('react-vchart')) {
              return 'vchart-core';
            }
            if (id.includes('@visactor/react-vchart')) {
              return 'vchart-react';
            }
            if (id.includes('@douyinfe/semi-ui')) {
              return 'semi-ui';
            }
            if (id.includes('@douyinfe/semi-icons')) {
              return 'semi-icons';
            }
            if (id.includes('semantic-ui-react')) {
              return 'semantic-react';
            }
            if (id.includes('semantic-ui-offline')) {
              return 'semantic-css';
            }
            if (id.includes('react-dom')) {
              return 'react-dom';
            }
            if (id.includes('react/') || id.includes('react\\')) {
              return 'react';
            }
            if (id.includes('react-router')) {
              return 'react-router';
            }
            if (id.includes('react-redux') || id.includes('@reduxjs/toolkit') || id.includes('redux')) {
              return 'redux';
            }
            if (id.includes('react-') && !id.includes('react-router') && !id.includes('react-redux')) {
              return 'react-components';
            }
            if (id.includes('lottie-web')) {
              return 'lottie';
            }
            if (id.includes('qrcode')) {
              return 'qrcode';
            }
            if (id.includes('axios')) {
              return 'http';
            }
            if (id.includes('dayjs')) {
              return 'date';
            }
            if (id.includes('marked')) {
              return 'markdown';
            }
            if (id.includes('i18next')) {
              return 'i18n';
            }
            if (id.includes('heroicons')) {
              return 'heroicons';
            }
            return 'vendor';
          }
        },
        entryFileNames: 'js/[name].[hash].js',
        chunkFileNames: 'js/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name)) {
            return `fonts/[name].[hash].${ext}`;
          }
          if (/\.(png|jpe?g|gif|svg|webp|ico)(\?.*)?$/i.test(assetInfo.name)) {
            return `img/[name].[hash].${ext}`;
          }
          if (ext === 'css') {
            return `css/[name].[hash].${ext}`;
          }
          return `assets/[name].[hash].${ext}`;
        },
      },
    },
    cssCodeSplit: true,
    sourcemap: false,
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
    assetsInlineLimit: 2048,
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/pg': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

