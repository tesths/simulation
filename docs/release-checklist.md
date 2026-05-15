# 发版检查单

## 项目 1：chart

发版前确认：

1. `./.venv/bin/pytest -q` 通过
2. Zeabur 环境变量完整
3. `chart-app` 仍为单实例
4. 启动命令仍为 `--workers 1`
5. Postgres 服务健康

上线后确认：

1. 教师可登录
2. 可创建班级
3. 学生可提交
4. 老师端实时刷新正常

## 项目 2：simulation

发版前确认：

1. `npm run build` 通过
2. `npm run test` 通过
3. `npm run lint` 通过
4. `netlify.toml` 未被改坏

上线后确认：

1. 生产页面可访问
2. 静态资源无 404
3. 时间轴、播放、图表联动正常
