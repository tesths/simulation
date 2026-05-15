# Zeabur 部署清单

这份清单面向当前仓库在 Zeabur 上的第一次正式部署。

## 0. 部署前准备

- [ ] 代码已经推到 GitHub
- [ ] Zeabur 将连接的仓库就是当前 Git 仓库根目录 `simulation`
- [ ] 应用服务的 `Root Directory` 将设置为 `chart`
- [ ] 仓库中已包含 [`zbpack.json`](../zbpack.json)

## 1. 服务创建

- [ ] 在 Zeabur 新建一个 Project
- [ ] 创建一个 `PostgreSQL` 服务，建议命名为 `chart-postgres`
- [ ] 创建一个 `GitHub` 服务，选择当前仓库，建议命名为 `chart-app`

## 2. 应用服务设置

- [ ] `Root Directory` = `chart`
- [ ] Build Spec 使用仓库里的 `chart/zbpack.json`
- [ ] 服务实例数保持 `1`
- [ ] 不额外改写启动命令

说明：

- 当前 `zbpack.json` 已固定 Python 版本为 `3.11`
- 当前 `zbpack.json` 已固定启动命令为单 worker 的 `uvicorn`
- 不要把实例数扩到 `2` 个及以上

## 3. 环境变量清单

在 `chart-app` 服务中至少设置以下变量：

```env
DATABASE_URL=${POSTGRES_CONNECTION_STRING}
TEACHER_PASSWORD=替换为强密码
SECRET_KEY=替换为随机长字符串
SESSION_COOKIE_SECURE=true
```

填写说明：

- `DATABASE_URL`
  - 推荐直接引用 Zeabur Postgres 提供的连接串
  - 如果同项目里有多个 Postgres 服务，改为手动填对应实例的内部连接串
- `TEACHER_PASSWORD`
  - 不要使用默认值 `teacher123`
- `SECRET_KEY`
  - 建议至少 32 位随机字符串
- `SESSION_COOKIE_SECURE`
  - 生产必须为 `true`

## 4. 首次部署后检查

- [ ] 部署日志中没有数据库连接错误
- [ ] 打开首页 `/` 返回 `200`
- [ ] 打开教师入口 `/teacher`
- [ ] 使用教师密码可以成功登录
- [ ] 创建一个新班级成功
- [ ] 页面展示学生专属链接
- [ ] 打开该学生链接可以进入选组页
- [ ] 学生提交一次记录成功
- [ ] 教师大屏对应组卡片实时刷新

## 5. 上线后保留项

- [ ] 保留同一个 Postgres 实例，不要随意重建
- [ ] 后续发版继续保持单实例、单 worker
- [ ] 如果要绑定自定义域名，确认仍然走 HTTPS

## 6. 回滚清单

- [ ] 在 Zeabur 回退到上一个成功部署版本
- [ ] 不更换 Postgres 实例
- [ ] 检查应用日志是否恢复正常
- [ ] 重新执行一次教师端 / 学生端最小回归
