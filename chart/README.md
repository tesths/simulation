# 温度记录课堂系统

面向五年级科学实验的课堂网页应用。

- 教师端：固定密码登录，创建班级、设置组数、查看历史班级与学生专属链接，并在 16:9 大屏中查看各组实时曲线与全班叠加图
- 学生端：不提供公共登录入口，只能通过老师发送的班级专属链接进入，选择本组后填写温度记录
- 后端：FastAPI + SQLAlchemy + SQLite / Postgres + WebSocket（更新通知）+ HTTP（拉取最新图表数据）

## 当前使用方式

1. 老师访问 `http://127.0.0.1:8000/teacher`
2. 老师登录后，在“新建班级”页面创建班级并设置组数
3. 系统生成该班级的学生专属链接，同时可查看之前创建过的班级及其对应链接
4. 老师把链接发给学生
5. 学生通过该链接进入，选择本组并填写数据
6. 老师端实时看到对应组卡片更新，并可切换查看全班叠加图

说明：

- 首页 `/` 只提供教师入口和学生使用说明
- `/student` 现在是说明页，不再直接跳到默认班级
- 学生唯一正确入口是老师创建后生成的 `/student/classrooms/{slug}` 链接

## 快速开始

运行环境：

- Python 3.11

安装依赖：

```bash
python3 -m pip install -r requirements.txt
```

本地默认使用 SQLite 启动服务：

```bash
TEACHER_PASSWORD='请改成老师密码' \
SECRET_KEY='请改成随机长字符串' \
SESSION_COOKIE_SECURE='false' \
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

如果你要在本地直接连 Postgres，可以改为：

```bash
DATABASE_URL='postgresql+psycopg://user:password@host:5432/chart' \
TEACHER_PASSWORD='请改成老师密码' \
SECRET_KEY='请改成随机长字符串' \
SESSION_COOKIE_SECURE='false' \
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

访问地址：

- 首页：`http://127.0.0.1:8000/`
- 教师入口：`http://127.0.0.1:8000/teacher`
- 学生说明页：`http://127.0.0.1:8000/student`

## 当前默认规则

- 系统首次启动会自动创建一个 `默认班级`，默认含 `10` 个组
- 老师后续可创建任意新班级，并在创建时指定组数
- 老师可在班级管理页查看所有已创建班级及其学生端链接
- 每个班级的数据彼此独立
- 每个组只保留一份“当前记录”，重复提交会覆盖旧数据
- 温度图纵轴固定为 `0-100°C`
- 老师端实时同步采用“WebSocket 通知 + 单组 HTTP 拉取最新数据”
- 老师端支持查看“全班叠加图”，同组同色、凉水实线、热水虚线

## 环境变量

- `TEACHER_PASSWORD`：老师登录密码
- `SECRET_KEY`：Session 签名密钥
- `DATABASE_URL`：生产优先使用的数据库连接串，支持 Postgres，也可用于 SQLite URL
- `DATABASE_PATH`：SQLite 数据库路径，默认是 `data/classroom.sqlite3`
- `SESSION_COOKIE_SECURE`：是否给 Session Cookie 加 `Secure` 标记，生产应设为 `true`

## 测试

基础测试：

```bash
pytest -q
```

浏览器端到端测试首次运行前需要安装 Chromium：

```bash
python3 -m playwright install chromium
```

然后执行：

```bash
./scripts/run_e2e.sh
```

## 文档

- [系统架构](docs/architecture.md)
- [开发与扩展指南](docs/development.md)
- [部署准备与上线说明](docs/deployment.md)
- [Zeabur 部署清单](docs/zeabur-checklist.md)
