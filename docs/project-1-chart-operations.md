# 项目 1 运维手册

项目目录：[`chart`](../chart/README.md)

## 日常操作

- 查看应用日志：在 Zeabur 的 `chart-app` 服务日志页查看
- 查看数据库状态：在 Zeabur 的 Postgres 服务页查看连接与容量
- 重启应用：只重启 `chart-app`，不要删除 Postgres 服务

## 已知运行约束

- 当前只支持单实例运行
- 老师端实时刷新依赖 `/ws/teacher`
- 如果 WebSocket 断掉，老师页能打开，但卡片不会实时更新

## 常见故障排查

### 老师端不能实时刷新

按顺序检查：

1. `chart-app` 是否只有 1 个实例
2. 服务启动命令是否仍然是 `--workers 1`
3. 浏览器控制台里 `/ws/teacher` 是否连接失败
4. 学生保存后应用日志里是否有 500 错误

### 登录后反复掉回登录页

优先检查：

1. `SECRET_KEY` 是否为空或被改错
2. `SESSION_COOKIE_SECURE=true` 时，访问是否确实走 HTTPS

### 启动时报数据库错误

优先检查：

1. `DATABASE_URL` 是否指向正确的 Postgres
2. Postgres 服务是否已就绪
3. 连接串前缀是否为 `postgres://` 或 `postgresql://`

## 回滚

1. 在 Zeabur 选择上一个成功部署版本回滚
2. 保持同一个 Postgres 服务不变
3. 回滚后执行一次老师端和学生端最小回归

## 备份建议

- 以 Postgres 服务自带备份能力为主
- 发版前做一次数据库快照
- 大改前再做一次快照
