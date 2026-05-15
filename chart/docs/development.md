# 开发与扩展指南

## 本地开发

在项目根目录执行：

```bash
python3 -m pip install -r requirements.txt
```

启动开发服务：

```bash
TEACHER_PASSWORD='teacher123' \
SECRET_KEY='dev-secret-change-me' \
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

默认数据库文件：

- `data/classroom.sqlite3`

如果你想用独立数据库做实验，可以覆盖：

```bash
DATABASE_PATH='data/my-feature.sqlite3' python3 -m uvicorn app.main:app --reload
```

## 当前页面与入口规则

- `/`：首页，只提供教师入口和学生说明
- `/teacher`：老师登录页
- `/teacher/dashboard`：老师实时总览页
- `/teacher/classrooms/new`：新建班级并获取学生专属链接
- `/student`：学生说明页，不直接进入填写
- `/student/classrooms/{slug}`：老师发给学生的班级专属入口
- `/student/form`：学生填写页

开发时不要无意打破下面这些规则：

- 学生不能从首页直接进入填写页
- 学生只能通过老师分享的班级专属链接进入
- 每个组只保留当前一条记录
- 老师端实时更新依赖 WebSocket 通知

## 测试命令

基础测试：

```bash
pytest -q
```

只跑后端行为测试：

```bash
pytest tests/test_app.py -q
```

浏览器端到端测试：

```bash
./scripts/run_e2e.sh
```

首次在新机器上运行浏览器测试：

```bash
python3 -m playwright install chromium
```

## 代码入口速查

新增功能时，通常先看这些文件：

- `app/main.py`：主路由、页面流程、Session、WebSocket 入口
- `app/db.py`：数据库结构、迁移、查询和保存逻辑
- `app/schemas.py`：表单字段与图表 payload
- `app/realtime.py`：老师端实时广播
- `app/templates/student_login.html`：班级专属选组页
- `app/templates/student_form.html`：学生填写页
- `app/templates/teacher_dashboard.html`：老师实时总览
- `app/templates/teacher_classroom_new.html`：新建班级与专属链接页
- `app/static/app.js`：学生提交、老师端局部刷新
- `app/static/styles.css`：所有页面样式

## 常见开发任务从哪里改

### 1. 增加新的学生填写字段

通常需要同时改：

- `app/schemas.py`
- `app/db.py`
- `app/templates/student_form.html`
- `app/static/app.js`
- `tests/test_app.py`
- 如果影响老师端显示，再改 `tests/e2e/test_browser_flow.py`

### 2. 把“只保留当前”改成“保留历史”

通常需要同时改：

- `app/db.py`
  - 取消 `group_id` 单主键设计
  - 引入记录主键或 `(group_id, record_date)` 等唯一键
- `app/main.py`
  - 查询当前记录与历史记录的逻辑拆开
- 学生端和老师端页面
  - 增加“查看哪一天/哪次实验”的选择
- 测试
  - 补“同一组多次提交不覆盖”的断言

### 3. 增加老师管理能力

当前已经把“总览”和“新建班级/发链接”拆成了两个页面：

- `teacher_dashboard.html`
- `teacher_classroom_new.html`

继续扩展时建议保持这种分离，不要把配置功能重新塞回 dashboard。

### 4. 增加更强的学生访问控制

如果以后长期公网部署，优先补这几项：

- 学生入口邀请码或一次性令牌
- 老师端更安全的账号体系
- `GET /api/charts/group/{group_id}` 的权限保护
- HTTPS 部署和更严格的 Session Cookie 配置

### 5. 支持多实例或多进程部署

当前 `app/realtime.py` 的 WebSocket 连接管理是进程内内存方案。

这意味着：

- 单进程部署没问题
- 多进程或多实例部署时，老师端实时同步会失效或不稳定

要扩展到多实例，通常需要：

- Redis pub/sub
- 或其他共享消息总线

## 部署前需要注意的开发点

下一步准备部署时，务必先看：

- [部署准备与上线说明](deployment.md)

最重要的几个事实：

- 当前建议单个 Uvicorn worker 部署
- SQLite 数据目录必须持久化
- 反向代理必须支持 `/ws/teacher` 的 WebSocket 升级
- 当前 `SessionMiddleware` 仍是开发态 Cookie 配置，公网前应收紧

## 文档维护约定

后续每次新增功能，至少同步检查这几处文档：

- `README.md`
  - 只保留当前真实可用的入口和运行方式
- `docs/architecture.md`
  - 当前系统行为、路由、数据结构有没有变化
- `docs/development.md`
  - 本地开发入口、测试命令、开发注意事项是否需要更新
- `docs/deployment.md`
  - 部署方式、环境变量、上线约束是否过期

如果新功能改变了用户主流程，也要同步更新：

- `tests/test_app.py`
- `tests/e2e/test_browser_flow.py`

## 提交前检查建议

在准备继续开发别的功能前，建议把下面当成最小自检清单：

```bash
pytest -q
./scripts/run_e2e.sh
```

如果修改了数据库结构，再额外确认：

- 新库能正常初始化
- 老数据库迁移是否仍然可用
- 文档中的“当前默认规则”有没有过期
