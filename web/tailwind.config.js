/** @type {import('tailwindcss').Config} */
export default {
  // 指定要扫描的文件，用于 purge 未使用的样式
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{html,vue}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // 优化选项
  corePlugins: {
    // 可以禁用不需要的功能来减少体积
    // preflight: false, // 如果不需要重置样式
  },
  // 启用 JIT 模式以减少CSS体积
  mode: 'jit',
} 