# 项目 2 运维手册

项目目录：[`simulation`](../simulation/README.md)

## 日常操作

- 查看构建日志：Netlify Deploys 页面
- 重新部署：在 Netlify 对最新成功 commit 重新触发 deploy
- 回滚：直接选择上一个成功 deploy 进行回滚

## 常见故障排查

### 构建失败

优先检查：

1. Node 版本是否仍然是 `22.16.0`
2. Base directory 是否还是 `simulation`
3. Build command 是否还是 `npm run build`
4. Publish directory 是否还是 `dist`

### 页面空白或资源 404

优先检查：

1. 发布目录是否配置成了 `dist`
2. `netlify.toml` 是否被覆盖
3. 当前 deploy 是否来自最新 commit

## 回滚

1. 打开 Netlify Deploys
2. 选择上一个成功版本
3. 执行回滚
4. 刷新页面确认静态资源恢复正常
