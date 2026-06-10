import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] })
  const clientServerUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    ''
  const proxyServerUrl = clientServerUrl || 'http://localhost:3000'
  const isProd = envMode === 'production'
  const devProxy = Object.fromEntries(
    (['/api', '/mj', '/pg'] as const).map((key) => [
      key,
      { target: proxyServerUrl, changeOrigin: true },
    ]),
  ) as Record<string, { target: string; changeOrigin: boolean }>

  return {
    plugins: [pluginReact()],
    splitChunks: {
      cacheGroups: {
        'react-core': {
          test: /node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
          name: 'react-core',
          chunks: 'all',
          priority: 30,
          enforce: true,
        },
        'semi-ui': {
          test: /node_modules[\\/]@douyinfe[\\/](semi-icons|semi-ui)[\\/]/,
          name: 'semi-ui',
          chunks: 'all',
          priority: 25,
          enforce: true,
        },
        i18n: {
          test: /node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/,
          name: 'i18n',
          chunks: 'all',
          priority: 20,
          enforce: true,
        },
        tools: {
          test: /node_modules[\\/](axios|history|marked)[\\/]/,
          name: 'tools',
          chunks: 'all',
          priority: 15,
          enforce: true,
        },
        'react-components': {
          test: /node_modules[\\/](react-dropzone|react-fireworks|react-telegram-login|react-toastify|react-turnstile)[\\/]/,
          name: 'react-components',
          chunks: 'all',
          priority: 10,
          enforce: true,
        },
      },
    },
    source: {
      entry: {
        index: './src/index.jsx',
      },
      define: {
        'import.meta.env.VITE_REACT_APP_SERVER_URL': JSON.stringify(
          clientServerUrl,
        ),
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@douyinfe/semi-ui$': path.resolve(__dirname, './src/lib/semi-ui.js'),
        '@douyinfe/semi-ui/dist/css/semi.css': path.resolve(
          __dirname,
          './src/styles/empty-semi.css',
        ),
      },
    },
    html: {
      template: './index.html',
    },
    server: {
      host: '0.0.0.0',
      strictPort: true,
      proxy: devProxy,
    },
    output: {
      minify: isProd,
      target: 'web',
      distPath: {
        root: 'dist',
      },
    },
    performance: {
      removeConsole: isProd ? ['log'] : false,
      buildCache: {
        cacheDigest: [process.env.VITE_REACT_APP_VERSION],
      },
    },
    tools: {
      rspack: (config, { rspack }) => {
        config.plugins = config.plugins || []
        config.plugins.push(
          new rspack.NormalModuleReplacementPlugin(
            /@douyinfe\/semi-(foundation|ui)\/lib\/(cjs|es)\/.+\.css$/,
            path.resolve(__dirname, './src/styles/empty-semi.css'),
          ),
        )
        config.module = config.module || {}
        config.module.rules = [
          ...(config.module.rules || []),
          {
            test: /src[\\/].*\.js$/,
            type: 'javascript/auto',
            use: [
              {
                loader: 'builtin:swc-loader',
                options: {
                  jsc: {
                    parser: {
                      syntax: 'ecmascript',
                      jsx: true,
                    },
                    transform: {
                      react: {
                        runtime: 'automatic',
                        development: !isProd,
                        refresh: !isProd,
                      },
                    },
                  },
                },
              },
            ],
          },
        ]
      },
    },
  }
})
