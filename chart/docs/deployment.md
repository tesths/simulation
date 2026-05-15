# 部署准备与上线说明

这份文档面向当前项目的第一次正式部署准备。

## 先说结论

当前版本可以部署，但有 4 个关键约束必须明确：

1. **只能用单个应用进程/单实例部署**
2. **SQLite 数据目录必须持久化**
3. **反向代理必须支持 WebSocket**
4. **如果公网开放，当前鉴权强度偏弱，需要额外收紧**

如果这 4 点不满足，部署后最容易出现的问题是：

- 老师端实时同步失效
- 重启后课堂数据丢失
- 学生链接或图表接口暴露范围过大

## 推荐部署模型

当前最稳妥的部署方式：

- 1 台服务器
- 1 个 Uvicorn 进程
- 1 个 SQLite 文件
- 1 个反向代理（Nginx / Caddy）

不建议当前版本直接做：

- 多个 Uvicorn worker
- 多个应用副本
- 无持久盘的临时容器部署

原因见下文。

## 为什么当前必须单进程

老师端实时同步依赖 `app/realtime.py` 里的进程内 WebSocket 连接管理器。

这意味着：

- 学生保存数据时，只会通知当前 Python 进程内维护的老师连接
- 如果有多个 worker / 多个实例，保存请求和老师 WebSocket 连接可能落在不同进程
- 这时老师端就收不到实时更新

当前生产启动建议：

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

如果以后一定要多实例部署，需要先改造为共享消息总线，例如：

- Redis pub/sub
- 或其他跨实例广播方案

## 环境变量

生产环境至少显式设置：

```bash
export TEACHER_PASSWORD='换成强密码'
export SECRET_KEY='换成随机长字符串'
export DATABASE_PATH='/srv/chart/data/classroom.sqlite3'
```

说明：

- `TEACHER_PASSWORD`
  - 不要保留默认值 `teacher123`
- `SECRET_KEY`
  - 必须是随机长字符串
  - 用于 Session 签名
- `DATABASE_PATH`
  - 必须指向持久化目录
  - 不要放在临时目录中

## 数据持久化要求

当前数据库是 SQLite，路径默认是：

- `data/classroom.sqlite3`

SQLite 采用 WAL 模式时，运行中通常还会出现：

- `classroom.sqlite3-wal`
- `classroom.sqlite3-shm`

部署时必须保证：

- 应用进程对数据库目录有读写权限
- 数据目录在重启后仍然保留
- 备份时要考虑 WAL 文件，或在服务停止后再复制

推荐目录：

```text
/srv/chart/
  app-code/
  data/
    classroom.sqlite3
```

## 反向代理要求

如果前面放 Nginx，至少要支持 `/ws/teacher` 的 WebSocket 升级。

参考配置：

```nginx
server {
    listen 80;
    server_name your-domain.example.com;

    location /ws/teacher {
        proxy_pass http://127.0.0.1:8000/ws/teacher;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

如果 WebSocket 配置漏掉，常见现象是：

- 老师页面能打开
- 学生能保存
- 但老师端卡片不会实时刷新

## 进程守护建议

可以用 `systemd` 托管：

```ini
[Unit]
Description=Chart Classroom App
After=network.target

[Service]
WorkingDirectory=/srv/chart/app-code
Environment=TEACHER_PASSWORD=replace-me
Environment=SECRET_KEY=replace-me
Environment=DATABASE_PATH=/srv/chart/data/classroom.sqlite3
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=always
RestartSec=3
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

## 当前公网部署风险

如果下一步是公网部署，而不是校园内网/局域网部署，需要注意：

### 1. 学生专属链接不是完整鉴权

当前学生入口依赖：

- 老师创建班级后生成的 `slug`
- 学生拿到这个链接后再选组

这更像“私有分享链接”，不是严格的身份认证。

### 2. 图表接口当前未做老师鉴权

接口：

- `GET /api/charts/group/{group_id}`

当前没有额外鉴权保护。

如果公网部署，建议至少做其中一项：

- 给图表接口加老师权限校验
- 仅允许内网访问
- 在反向代理层加访问限制

### 3. Session Cookie 仍是开发态配置

当前代码里：

- `https_only=False`

如果正式公网部署，建议尽快改成 HTTPS-only，并同步检查 Cookie 策略。

## 上线前检查清单

### 最低可上线清单

- [ ] `TEACHER_PASSWORD` 已改成强密码
- [ ] `SECRET_KEY` 已改成随机长字符串
- [ ] `DATABASE_PATH` 指向持久化目录
- [ ] 应用只启动 `1` 个 worker
- [ ] 反向代理已支持 `/ws/teacher` WebSocket
- [ ] 老师能登录并创建班级
- [ ] 新建班级后能拿到学生专属链接
- [ ] 学生能通过专属链接选组并提交
- [ ] 老师端能实时看到更新

### 建议额外检查

- [ ] HTTPS 已配置
- [ ] 数据目录已备份策略确认
- [ ] 日志路径和日志轮转策略已确认
- [ ] 如果公网部署，已评估学生链接和图表接口的暴露风险

## 建议的人工验收流程

部署完成后，手动跑一遍：

1. 访问首页 `/`
2. 确认首页只提供教师入口，不暴露公共学生入口
3. 老师登录
4. 新建一个 3 组或 5 组班级
5. 复制学生专属链接到另一个浏览器窗口
6. 学生选择某组并填写一组数据
7. 回到老师大屏，确认对应卡片自动刷新
8. 重启服务，再确认数据库数据仍然存在

## 后续如果要继续增强部署能力

优先顺序建议：

1. 给图表接口补老师鉴权
2. 把 Session Cookie 改成生产配置
3. 引入更强的学生访问控制
4. 如需多实例，再引入 Redis 等共享广播机制
