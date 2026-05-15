# 项目 2 部署方案

项目目录：[`simulation`](../simulation/README.md)

## 目标

- 部署平台：Netlify
- 站点类型：静态单页应用

## 已固定的配置

仓库根目录已有 [`netlify.toml`](../netlify.toml)：

```toml
[build]
  base = "simulation"
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22.16.0"
```

同时，`simulation/.nvmrc` 也固定为 `22.16.0`。

## Netlify 部署步骤

1. 把仓库推到 Git 远端。
2. 在 Netlify 新建站点并连接仓库。
3. 使用仓库根目录作为站点来源。
4. 确认构建设置与 `netlify.toml` 一致：
   - Base directory: `simulation`
   - Build command: `npm run build`
   - Publish directory: `dist`
5. 触发首次部署。
6. 打开 Netlify 分配的站点域名验收。

## 环境变量

当前项目没有业务环境变量。

唯一需要固定的是 Node 版本：

- `NODE_VERSION=22.16.0`

## 注意事项

- 当前项目没有前端路由，不需要额外的 SPA rewrite
- 构建日志里会有一个 chunk 大小告警，但当前不阻塞部署
