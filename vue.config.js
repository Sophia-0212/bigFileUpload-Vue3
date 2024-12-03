const { defineConfig } = require('@vue/cli-service');
const { createProxyMiddleware } = require('http-proxy-middleware');

// 把以/api开头的请求代理到http://localhost:8081后端服务，避免跨域问题，pathRewrite没生效，不知道为什么，所以后端仍然需要拦截/api 请求
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:8081', // 这里假设你的后端服务运行在 8081 端口
        changeOrigin: true,
      },
    },
  },
});