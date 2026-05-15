# 系统架构

## 概览

当前系统是一个单体 FastAPI 应用，围绕“老师创建班级并分享链接，学生填写本组数据，老师实时看全班曲线”展开。

主要职责：

- 服务端渲染教师页、学生说明页、班级选组页、学生填写页
- 使用 SQLAlchemy 保存班级、小组和每组当前实验记录，支持 SQLite 与 Postgres
- 使用 Cookie Session 维护老师登录状态与学生当前班级/小组状态
- 使用 WebSocket 向老师端广播“某个班级中的某个组已更新”
- 浏览器端使用原生 JavaScript + SVG 渲染折线图

当前代码主入口在 `app/main.py`。

## 技术栈

- 后端框架：FastAPI
- 模板：Jinja2
- 数据库：SQLite / Postgres（通过 SQLAlchemy 统一访问）
- 实时通信：WebSocket
- 前端：原生 JavaScript
- 图表：原生 SVG
- 测试：pytest + Playwright

## 主要模块

### `app/main.py`

负责：

- 应用创建
- 路由定义
- Session 中间件
- 老师/学生主流程
- WebSocket 入口

### `app/db.py`

负责：

- 初始化数据库
- 旧版 SQLite 单班级数据库迁移
- 班级、小组、当前记录的增删查改
- 统一的 SQLite / Postgres 数据访问

### `app/schemas.py`

负责：

- 温度提交数据校验
- 折线图 payload 结构
- 时间点、图例、统一纵轴范围等常量

### `app/realtime.py`

负责：

- 管理老师端 WebSocket 连接
- 广播班级/小组更新事件

### `app/templates/`

页面模板：

- `home.html`：首页，只提供教师入口和学生说明
- `student_link_required.html`：学生说明页，提示需使用老师发送的专属链接
- `student_login.html`：班级专属链接进入后的选组页
- `student_form.html`：学生填写页
- `teacher_login.html`：老师登录页
- `teacher_dashboard.html`：老师实时总览页
- `teacher_classroom_new.html`：新建班级与生成学生链接页

### `app/static/`

- `app.js`：学生提交、老师端增量刷新、SVG 绘图
- `styles.css`：首页、学生页、老师页样式

## 当前用户流程

### 学生端

1. 学生不能从首页或 `/student` 直接进入填写流程
2. 老师创建班级后，系统生成一个班级专属链接：`/student/classrooms/{slug}`
3. 学生打开该链接，进入当前班级的小组选组页
4. 学生选择本组，提交 `POST /student/classrooms/{slug}/login`
5. 服务端把 `student_classroom_id` 和 `student_group_id` 写入 Session
6. 跳转到 `GET /student/form`
7. 学生填写表单，提交 `POST /student/record`
8. 后端校验并覆盖保存该组当前记录
9. 后端返回最新图表 JSON，学生页立即重绘右侧图表
10. 后端同时通过 WebSocket 通知老师端该组已更新

### 老师端

1. 访问 `GET /teacher`
2. 提交 `POST /teacher/login`
3. 服务端把 `teacher_authenticated` 写入 Session
4. 跳转到 `GET /teacher/dashboard`
5. 老师可切换当前班级，也可前往 `GET /teacher/classrooms/new` 新建班级
6. 新建班级后，系统生成学生专属链接并展示给老师
7. dashboard 页面建立 `WS /ws/teacher` 连接
8. 学生保存时，老师端收到 `group-updated` 消息
9. 老师端再调用 `GET /api/charts/group/{group_id}` 拉取该组最新图表数据
10. 浏览器仅更新对应卡片，不整页刷新

## 实时同步机制

当前同步不是“WebSocket 直接推整份图表数据”，而是“两段式”：

1. 学生保存后，后端通过 WebSocket 广播一条轻量消息：

```json
{
  "type": "group-updated",
  "classroom_id": 1,
  "group_id": 3
}
```

2. 教师前端收到消息后，再请求：

- `GET /api/charts/group/{group_id}`

优点：

- 消息体很小
- 前端失败恢复简单
- 只更新单组，不整页刷新

代价：

- 实时广播依赖当前应用进程内存中的连接管理器
- 如果以后要做多实例部署，即使数据库切到 Postgres，也需要共享消息总线（如 Redis pub/sub）

## 路由清单

### 页面路由

- `GET /`：首页
- `GET /student`：学生说明页
- `GET /student/classrooms/{classroom_slug}`：班级专属选组页
- `GET /student/form`：学生填写页
- `GET /teacher`：老师登录页
- `GET /teacher/dashboard`：老师实时总览页
- `GET /teacher/classrooms/new`：新建班级与获取学生链接页

### 行为路由

- `POST /student/classrooms/{classroom_slug}/login`
- `GET /student/logout`
- `POST /student/record`
- `POST /teacher/login`
- `GET /teacher/logout`
- `POST /teacher/classrooms`
- `POST /teacher/classrooms/select`

### 数据与实时

- `GET /api/charts/group/{group_id}`
- `WS /ws/teacher`

## 数据模型

### `classrooms`

字段：

- `id`
- `name`
- `slug`
- `group_count`
- `created_at`

用途：

- 表示一个独立班级/场次
- 每次老师新建班级都会生成一条记录
- `slug` 用于生成学生专属链接

### `groups`

字段：

- `id`
- `classroom_id`
- `name`
- `sort_order`

用途：

- 保存某个班级下的 `第1组` 到 `第N组`
- 同名组在不同班级下互不冲突

### `temperature_records`

字段：

- `group_id`
- `record_date`
- `cool_2`, `hot_2`
- `cool_4`, `hot_4`
- `cool_6`, `hot_6`
- `cool_8`, `hot_8`
- `cool_10`, `hot_10`
- `cool_12`, `hot_12`
- `cool_14`, `hot_14`
- `updated_at`

当前约束：

- `group_id` 是主键
- 这意味着每个组只保留一份“当前记录”

## 当前产品边界

这些是现在已经实现并默认成立的规则：

- 学生端没有账号密码
- 学生不能从首页直接进入填写页
- 学生只能使用老师发送的班级专属链接
- 老师端只有一个固定密码角色
- 没有注册、没有后台用户管理界面
- 没有历史记录页面
- 没有导出、打印、二维码生成功能
- 图表纵轴固定为 `0-100°C`

## 已知实现取舍

### 1. WebSocket 连接管理是进程内的

- `TeacherConnectionManager` 只保存在当前 Python 进程内存中
- 因此生产部署时必须保持单进程/单实例，或引入共享消息总线

### 2. `GET /api/charts/group/{group_id}` 当前未额外做老师鉴权

- 局域网或课堂工具阶段可接受
- 如果以后公网部署，建议补老师权限校验，或至少加网络层限制

### 3. 学生专属链接是“可访问链接”，不是完整鉴权体系

- 现在更像课堂场景下的私有入口
- 如果以后公网长期使用，建议补邀请码、一次性令牌或更强鉴权

### 4. Session Cookie 需要按环境收紧

- 本地开发可用 `SESSION_COOKIE_SECURE=false`
- 公网正式部署时应使用 HTTPS + `SESSION_COOKIE_SECURE=true`

## 后续扩展入口

如果后续继续开发，优先从下面这些位置切入：

- 增加历史记录：先改 `app/db.py` 的 `temperature_records` 结构
- 增加更强鉴权：先改 `app/main.py` 的学生入口和老师登录流
- 增加更多学生输入字段：先改 `app/schemas.py` 和学生表单模板
- 调整图表展示：先改 `app/static/app.js`
- 做多实例实时广播：先替换 `app/realtime.py` 的进程内连接管理方案
