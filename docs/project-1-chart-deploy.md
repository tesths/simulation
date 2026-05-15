# 项目 1 部署方案

项目目录：[`chart`](../chart/README.md)

## 目标

- 部署平台：Zeabur
- 数据库：Postgres
- 访问形态：单实例 Web 服务

## 代码现状

- Web 框架：FastAPI
- 数据访问：SQLAlchemy
- 数据库入口：
  - 生产优先 `DATABASE_URL`
  - 本地回退 `DATABASE_PATH`
- 实时同步：WebSocket + 单组 HTTP 拉取

## Zeabur 部署步骤

1. 把仓库推到 Git 远端。
2. 在 Zeabur 新建一个项目。
3. 添加 `Postgres` 服务，记下连接串。
4. 添加 Git 服务，根目录指向 `chart/`。
5. 在应用服务环境变量中设置：

```bash
DATABASE_URL=postgresql+psycopg://...
TEACHER_PASSWORD=换成强密码
SECRET_KEY=换成随机长字符串
SESSION_COOKIE_SECURE=true
```

6. 确认启动命令为：

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
```

7. 部署完成后，打开 Zeabur 分配的域名。
8. 首次启动时应用会自动建表并创建默认班级。

## 关键限制

- 只能保留单实例、单 worker。
- 不能把实例数扩到 2 个以上，否则老师端实时刷新会失效。
- 当前老师鉴权仍是单密码模式，公网使用时必须保证密码强度。

## 需要保留的环境变量

- `DATABASE_URL`
- `TEACHER_PASSWORD`
- `SECRET_KEY`
- `SESSION_COOKIE_SECURE`

## 首次上线后的立即检查

1. 打开 `/teacher`
2. 使用教师密码登录
3. 创建一个新班级
4. 打开生成的学生专属链接
5. 学生提交一次记录
6. 回到老师端确认卡片实时刷新
