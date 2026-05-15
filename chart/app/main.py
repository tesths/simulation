from __future__ import annotations

import math
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import FastAPI, Form, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from app.db import (
    create_classroom,
    ensure_database,
    get_classroom,
    get_classroom_by_slug,
    get_group,
    get_group_in_classroom,
    get_record,
    list_classrooms,
    list_groups,
    list_groups_with_records,
    save_record,
)
from app.realtime import TeacherConnectionManager
from app.schemas import (
    RecordSubmission,
    TIME_POINTS,
    chart_payload_from_record,
    empty_chart_payload,
)
from app.settings import Settings

MAX_GROUP_COUNT = 20


def _build_chart_payload(
    group: dict[str, int | str], record: dict[str, int | str | float] | None
) -> dict[str, object]:
    if not record:
        return empty_chart_payload(
            group_id=int(group["id"]),
            group_name=str(group["name"]),
        ).model_dump(mode="json")

    values = {
        key: float(record[key])
        for key in record
        if key.startswith("cool_") or key.startswith("hot_")
    }
    return chart_payload_from_record(
        group_id=int(group["id"]),
        group_name=str(group["name"]),
        record_date=str(record["record_date"]),
        values=values,
    ).model_dump(mode="json")


def _build_dashboard_items(
    settings: Settings,
    classroom_id: int,
) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    for row in list_groups_with_records(settings.database_target, classroom_id):
        group = {"id": int(row["id"]), "name": str(row["name"])}
        record = row if row["record_date"] else None
        chart = _build_chart_payload(group, record)
        items.append(
            {
                "id": group["id"],
                "name": group["name"],
                "record_date": chart["record_date"] or "未填写",
                "chart": chart,
            }
        )
    return items


def _dashboard_grid_columns(group_count: int) -> int:
    if group_count <= 4:
        rows = 1
    elif group_count <= 10:
        rows = 2
    else:
        rows = 3
    return max(1, math.ceil(group_count / rows))


def _student_entry_path(classroom_slug: str) -> str:
    return f"/student/classrooms/{classroom_slug}"


def _student_redirect() -> RedirectResponse:
    return RedirectResponse(url="/student", status_code=303)


def _teacher_redirect() -> RedirectResponse:
    return RedirectResponse(url="/teacher", status_code=303)


def _require_teacher_auth(request: Request) -> None:
    if not request.session.get("teacher_authenticated"):
        raise HTTPException(status_code=401, detail="请先登录教师账号")


def _resolve_current_classroom(
    request: Request,
    settings: Settings,
) -> dict[str, int | str]:
    classroom_id = request.session.get("teacher_current_classroom_id")
    classroom = None
    if classroom_id:
        classroom = get_classroom(settings.database_target, int(classroom_id))

    if classroom:
        return classroom

    classrooms = list_classrooms(settings.database_target)
    if not classrooms:
        raise HTTPException(status_code=500, detail="未找到可用班级")

    classroom = classrooms[0]
    request.session["teacher_current_classroom_id"] = int(classroom["id"])
    return classroom


def _teacher_classroom_page_context(
    request: Request,
    settings: Settings,
    current_classroom: dict[str, int | str],
    *,
    created: bool = False,
) -> dict[str, object]:
    student_entry_path = _student_entry_path(str(current_classroom["slug"]))
    student_entry_url = f"{str(request.base_url).rstrip('/')}{student_entry_path}"
    return {
        "request": request,
        "current_classroom": current_classroom,
        "student_entry_path": student_entry_path if created else None,
        "student_entry_url": student_entry_url if created else None,
        "group_count_value": int(current_classroom["group_count"]),
        "created": created,
    }


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    ensure_database(settings.database_target)
    base_dir = Path(__file__).resolve().parent
    templates = Jinja2Templates(directory=str(base_dir / "templates"))
    realtime_manager = TeacherConnectionManager()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        ensure_database(settings.database_target)
        yield

    app = FastAPI(title="温度记录课堂系统", lifespan=lifespan)
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.secret_key,
        same_site="lax",
        https_only=settings.session_cookie_secure,
    )
    app.mount("/static", StaticFiles(directory=str(base_dir / "static")), name="static")
    app.state.settings = settings
    app.state.templates = templates
    app.state.realtime_manager = realtime_manager

    @app.get("/", response_class=HTMLResponse)
    async def home(request: Request) -> HTMLResponse:
        return templates.TemplateResponse(
            request,
            "home.html",
            {"request": request},
        )

    @app.get("/student", response_class=HTMLResponse)
    async def student_root(request: Request) -> HTMLResponse:
        return templates.TemplateResponse(
            request,
            "student_link_required.html",
            {"request": request},
        )

    @app.get(
        "/student/classrooms/{classroom_slug}",
        response_class=HTMLResponse,
        name="student_classroom_entry",
    )
    async def student_classroom_entry(
        request: Request,
        classroom_slug: str,
    ) -> HTMLResponse:
        classroom = get_classroom_by_slug(settings.database_target, classroom_slug)
        if not classroom:
            raise HTTPException(status_code=404, detail="未找到对应班级")

        groups = list_groups(settings.database_target, int(classroom["id"]))
        return templates.TemplateResponse(
            request,
            "student_login.html",
            {
                "request": request,
                "classroom": classroom,
                "groups": groups,
            },
        )

    @app.post("/student/classrooms/{classroom_slug}/login")
    async def student_login(
        request: Request,
        classroom_slug: str,
        group_id: int = Form(...),
    ) -> RedirectResponse:
        classroom = get_classroom_by_slug(settings.database_target, classroom_slug)
        if not classroom:
            raise HTTPException(status_code=404, detail="未找到对应班级")

        group = get_group_in_classroom(
            settings.database_target,
            int(classroom["id"]),
            group_id,
        )
        if not group:
            raise HTTPException(status_code=404, detail="未找到对应小组")

        request.session["student_classroom_id"] = int(classroom["id"])
        request.session["student_classroom_name"] = str(classroom["name"])
        request.session["student_classroom_slug"] = str(classroom["slug"])
        request.session["student_group_id"] = group_id
        request.session["student_group_name"] = str(group["name"])
        return RedirectResponse(url="/student/form", status_code=303)

    @app.get("/student/logout")
    async def student_logout(request: Request) -> RedirectResponse:
        classroom_slug = request.session.get("student_classroom_slug")
        request.session.pop("student_classroom_id", None)
        request.session.pop("student_classroom_name", None)
        request.session.pop("student_classroom_slug", None)
        request.session.pop("student_group_id", None)
        request.session.pop("student_group_name", None)
        target = (
            _student_entry_path(str(classroom_slug))
            if classroom_slug
            else "/student"
        )
        return RedirectResponse(url=target, status_code=303)

    @app.get("/student/form", response_class=HTMLResponse)
    async def student_form(request: Request) -> Response:
        group_id = request.session.get("student_group_id")
        classroom_id = request.session.get("student_classroom_id")
        if not group_id or not classroom_id:
            return _student_redirect()

        group = get_group_in_classroom(
            settings.database_target,
            int(classroom_id),
            int(group_id),
        )
        if not group:
            return _student_redirect()

        record = get_record(settings.database_target, int(group_id))
        chart_payload = _build_chart_payload(group, record)
        initial_values = {
            key: record[key]
            for key in record or {}
            if key.startswith("cool_") or key.startswith("hot_")
        }
        classroom = {
            "id": int(group["classroom_id"]),
            "name": str(group["classroom_name"]),
            "slug": str(group["classroom_slug"]),
        }
        return templates.TemplateResponse(
            request,
            "student_form.html",
            {
                "request": request,
                "classroom": classroom,
                "group": group,
                "chart_payload": chart_payload,
                "initial_values": initial_values,
                "record_date": (record or {}).get("record_date", date.today().isoformat()),
                "time_points": TIME_POINTS,
            },
        )

    @app.post("/student/record")
    async def student_record_save(
        request: Request,
        record_date: date = Form(...),
        cool_2: float = Form(...),
        hot_2: float = Form(...),
        cool_4: float = Form(...),
        hot_4: float = Form(...),
        cool_6: float = Form(...),
        hot_6: float = Form(...),
        cool_8: float = Form(...),
        hot_8: float = Form(...),
        cool_10: float = Form(...),
        hot_10: float = Form(...),
        cool_12: float = Form(...),
        hot_12: float = Form(...),
        cool_14: float = Form(...),
        hot_14: float = Form(...),
    ) -> JSONResponse:
        group_id = request.session.get("student_group_id")
        classroom_id = request.session.get("student_classroom_id")
        if not group_id or not classroom_id:
            raise HTTPException(status_code=401, detail="请先通过班级入口选择本组")

        submission = RecordSubmission(
            record_date=record_date,
            cool_2=cool_2,
            hot_2=hot_2,
            cool_4=cool_4,
            hot_4=hot_4,
            cool_6=cool_6,
            hot_6=hot_6,
            cool_8=cool_8,
            hot_8=hot_8,
            cool_10=cool_10,
            hot_10=hot_10,
            cool_12=cool_12,
            hot_12=hot_12,
            cool_14=cool_14,
            hot_14=hot_14,
        )

        group = get_group_in_classroom(
            settings.database_target,
            int(classroom_id),
            int(group_id),
        )
        if not group:
            raise HTTPException(status_code=404, detail="未找到对应小组")

        save_record(
            settings.database_target,
            int(group_id),
            submission.record_date.isoformat(),
            submission.value_map(),
        )
        record = get_record(settings.database_target, int(group_id))
        payload = _build_chart_payload(group, record)
        await realtime_manager.broadcast_group_update(
            int(classroom_id),
            int(group_id),
        )
        return JSONResponse(payload)

    @app.get("/teacher", response_class=HTMLResponse)
    async def teacher_login_page(request: Request) -> HTMLResponse:
        return templates.TemplateResponse(
            request,
            "teacher_login.html",
            {"request": request, "login_error": False},
        )

    @app.post("/teacher/login")
    async def teacher_login(
        request: Request,
        password: str = Form(...),
    ) -> Response:
        if password != settings.teacher_password:
            return templates.TemplateResponse(
                request,
                "teacher_login.html",
                {"request": request, "login_error": True},
                status_code=401,
            )

        request.session["teacher_authenticated"] = True
        _resolve_current_classroom(request, settings)
        return RedirectResponse(url="/teacher/dashboard", status_code=303)

    @app.get("/teacher/logout")
    async def teacher_logout(request: Request) -> RedirectResponse:
        request.session.pop("teacher_authenticated", None)
        request.session.pop("teacher_current_classroom_id", None)
        return RedirectResponse(url="/teacher", status_code=303)

    @app.get("/teacher/classrooms/new", response_class=HTMLResponse)
    async def teacher_new_classroom_page(
        request: Request,
        created_classroom_id: int | None = None,
    ) -> Response:
        if not request.session.get("teacher_authenticated"):
            return _teacher_redirect()

        current_classroom = _resolve_current_classroom(request, settings)
        created = False
        classroom_for_page = current_classroom
        if created_classroom_id is not None:
            created_classroom = get_classroom(settings.database_target, created_classroom_id)
            if created_classroom:
                classroom_for_page = created_classroom
                request.session["teacher_current_classroom_id"] = int(created_classroom["id"])
                created = True

        return templates.TemplateResponse(
            request,
            "teacher_classroom_new.html",
            _teacher_classroom_page_context(
                request,
                settings,
                classroom_for_page,
                created=created,
            ),
        )

    @app.post("/teacher/classrooms")
    async def teacher_create_classroom(
        request: Request,
        name: str = Form(...),
        group_count: int = Form(...),
    ) -> RedirectResponse:
        _require_teacher_auth(request)

        classroom_name = name.strip()
        if not classroom_name:
            raise HTTPException(status_code=422, detail="班级名称不能为空")
        if group_count < 1 or group_count > MAX_GROUP_COUNT:
            raise HTTPException(
                status_code=422,
                detail=f"组数需在 1 到 {MAX_GROUP_COUNT} 之间",
            )

        classroom = create_classroom(
            settings.database_target,
            classroom_name,
            group_count,
        )
        request.session["teacher_current_classroom_id"] = int(classroom["id"])
        return RedirectResponse(
            url=f"/teacher/classrooms/new?created_classroom_id={int(classroom['id'])}",
            status_code=303,
        )

    @app.post("/teacher/classrooms/select")
    async def teacher_select_classroom(
        request: Request,
        classroom_id: int = Form(...),
    ) -> RedirectResponse:
        _require_teacher_auth(request)
        classroom = get_classroom(settings.database_target, classroom_id)
        if not classroom:
            raise HTTPException(status_code=404, detail="未找到对应班级")

        request.session["teacher_current_classroom_id"] = classroom_id
        return RedirectResponse(url="/teacher/dashboard", status_code=303)

    @app.get("/teacher/dashboard", response_class=HTMLResponse)
    async def teacher_dashboard(request: Request) -> Response:
        if not request.session.get("teacher_authenticated"):
            return _teacher_redirect()

        current_classroom = _resolve_current_classroom(request, settings)
        dashboard_items = _build_dashboard_items(
            settings,
            int(current_classroom["id"]),
        )
        student_entry_path = _student_entry_path(str(current_classroom["slug"]))
        student_entry_url = f"{str(request.base_url).rstrip('/')}{student_entry_path}"
        return templates.TemplateResponse(
            request,
            "teacher_dashboard.html",
            {
                "request": request,
                "classrooms": list_classrooms(settings.database_target),
                "current_classroom": current_classroom,
                "grid_columns": _dashboard_grid_columns(
                    int(current_classroom["group_count"])
                ),
                "student_entry_path": student_entry_path,
                "dashboard_items": dashboard_items,
            },
        )

    @app.get("/api/charts/group/{group_id}")
    async def group_chart(group_id: int) -> JSONResponse:
        group = get_group(settings.database_target, group_id)
        if not group:
            raise HTTPException(status_code=404, detail="未找到对应小组")

        record = get_record(settings.database_target, group_id)
        return JSONResponse(_build_chart_payload(group, record))

    @app.websocket("/ws/teacher")
    async def teacher_updates(websocket: WebSocket) -> None:
        if not websocket.session.get("teacher_authenticated"):
            await websocket.close(code=1008)
            return

        await realtime_manager.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            realtime_manager.disconnect(websocket)

    return app


app = create_app()
