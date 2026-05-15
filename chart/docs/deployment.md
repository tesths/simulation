# 部署准备与上线说明

当前版本的目标部署平台是 `Zeabur + Postgres`。

## 部署结论

这版可以上线到 Zeabur，但有 3 条硬约束：

1. 只能保留 **单实例、单 worker**
2. 数据库必须通过 `DATABASE_URL` 指向 Postgres
3. 生产必须显式开启 `SESSION_COOKIE_SECURE=true`

如果以后要扩成多实例，数据库切到 Postgres 也不够，还需要把老师端实时广播改成跨实例消息总线。

## Zeabur 推荐配置

### 服务拆分

- `chart-app`：Python Web 服务
- `chart-postgres`：Zeabur Postgres 服务

### 启动命令

仓库里已经提供 [`zbpack.json`](../zbpack.json)，核心启动命令是：

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
```

重点：

- `--workers 1` 不能改大
- 端口必须绑定平台注入的 `PORT`

### 环境变量

至少设置：

```bash
DATABASE_URL=postgresql+psycopg://...
TEACHER_PASSWORD=换成强密码
SECRET_KEY=换成随机长字符串
SESSION_COOKIE_SECURE=true
```

说明：

- `DATABASE_URL`
  - 生产优先使用这个值
  - 支持 `postgres://` / `postgresql://`，应用会在内部规范化为 `psycopg` 驱动
- `TEACHER_PASSWORD`
  - 不要保留默认值 `teacher123`
- `SECRET_KEY`
  - 必须是随机长字符串
  - 用于 Session 签名
- `SESSION_COOKIE_SECURE`
  - 生产必须设为 `true`

## 首次启动会做什么

应用启动时会自动执行数据库 bootstrap：

- 创建 `classrooms`
- 创建 `groups`
- 创建 `temperature_records`
- 如果数据库为空，自动创建一个 `默认班级` 和 `10` 个组

因此当前版本第一次部署到新的 Postgres 实例时，不需要单独手跑迁移命令。

## 单实例约束

老师端实时同步依赖 `app/realtime.py` 里的进程内连接管理器。

这意味着：

- 学生保存后，只会通知当前 Python 进程中的老师连接
- 如果开多个 worker 或多个副本，请求和 WebSocket 连接可能落到不同进程
- 结果就是老师端看不到实时更新

所以当前生产约束是：

- 1 个服务实例
- 1 个 Uvicorn worker

## 回滚思路

如果上线后需要回滚：

1. 在 Zeabur 回退到上一个成功部署版本
2. 保持同一个 Postgres 实例不变
3. 确认应用日志中没有数据库连接错误
4. 用老师端和学生端做一次最小回归

当前 schema 仍然保持“每组一条当前记录”的简单结构，回滚风险主要在应用版本，而不在数据库数据量。
