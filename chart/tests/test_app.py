import re
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import ensure_database
from app.main import create_app
from app.settings import Settings


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    settings = Settings(
        database_path=tmp_path / "classroom.sqlite3",
        secret_key="test-secret",
        teacher_password="teach-pass",
    )
    app = create_app(settings)
    return TestClient(app)


def login_teacher(client: TestClient, password: str = "teach-pass") -> None:
    response = client.post(
        "/teacher/login",
        data={"password": password},
        follow_redirects=False,
    )
    assert response.status_code in {302, 303}


def extract_attr(html: str, attr_name: str) -> str:
    match = re.search(rf'{attr_name}="([^"]+)"', html)
    assert match, f"expected to find {attr_name}"
    return match.group(1)


def extract_group_id(student_entry_html: str, group_name: str) -> int:
    pattern = (
        r'<button class="group-button" type="submit" name="group_id" value="(\d+)">\s*'
        + re.escape(group_name)
        + r"\s*</button>"
    )
    match = re.search(pattern, student_entry_html)
    assert match, f"expected to find button for {group_name}"
    return int(match.group(1))


def record_payload(record_date: str, base_cool: int, base_hot: int) -> dict[str, str]:
    payload = {"record_date": record_date}
    for point_index, point in enumerate((2, 4, 6, 8, 10, 12, 14), start=0):
        payload[f"cool_{point}"] = str(base_cool + point_index * 2)
        payload[f"hot_{point}"] = str(base_hot - point_index * 2)
    return payload


def test_home_page_only_shows_teacher_entry_and_student_notice(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "老师登录" in response.text
    assert "教师入口" in response.text
    assert "学生请使用老师发送的班级专属链接" in response.text
    assert "学生填写入口" not in response.text


def test_student_root_requires_teacher_shared_link(client: TestClient) -> None:
    response = client.get("/student")

    assert response.status_code == 200
    assert "请向老师获取班级专属链接" in response.text
    assert "不能从这里直接进入填写页面" in response.text


def test_teacher_can_create_classroom_with_custom_group_count_and_student_link(
    client: TestClient,
) -> None:
    login_teacher(client)

    initial_dashboard = client.get("/teacher/dashboard")

    assert initial_dashboard.status_code == 200
    assert initial_dashboard.text.count('data-group-id="') == 10
    assert 'action="/teacher/classrooms/select"' in initial_dashboard.text
    assert 'action="/teacher/classrooms"' not in initial_dashboard.text
    assert "把下面链接或二维码发给学生" not in initial_dashboard.text

    new_page = client.get("/teacher/classrooms/new")
    assert new_page.status_code == 200
    assert "新建班级" in new_page.text
    assert "创建后，这里会显示学生专属链接。" in new_page.text
    assert "当前学生链接" not in new_page.text
    assert 'data-student-entry-link="' not in new_page.text

    redirect_response = client.post(
        "/teacher/classrooms",
        data={"name": "公开课一班", "group_count": "6"},
        follow_redirects=False,
    )
    assert redirect_response.status_code in {302, 303}
    assert redirect_response.headers["location"].startswith(
        "/teacher/classrooms/new?created_classroom_id="
    )

    created_page = client.get(redirect_response.headers["location"])

    assert created_page.status_code == 200
    assert "公开课一班" in created_page.text
    assert "班级已创建" in created_page.text

    student_entry_path = extract_attr(
        created_page.text,
        "data-student-entry-link",
    )
    student_entry = client.get(student_entry_path)

    assert student_entry.status_code == 200
    assert student_entry.text.count('name="group_id"') == 6
    assert "第6组" in student_entry.text
    assert "第7组" not in student_entry.text

    dashboard_after_create = client.get("/teacher/dashboard")
    assert dashboard_after_create.status_code == 200
    assert "公开课一班" in dashboard_after_create.text
    assert dashboard_after_create.text.count('data-group-id="') == 6
    assert 'action="/teacher/classrooms"' not in dashboard_after_create.text
    assert "当前学生链接" not in dashboard_after_create.text


def test_student_classroom_entry_selects_group_and_form_hides_switch_group(
    client: TestClient,
) -> None:
    login_teacher(client)
    dashboard = client.get("/teacher/dashboard")
    student_entry_path = extract_attr(dashboard.text, "data-student-entry-link")

    student_entry = client.get(student_entry_path)
    group_id = extract_group_id(student_entry.text, "第2组")
    login_response = client.post(
        f"{student_entry_path}/login",
        data={"group_id": str(group_id)},
        follow_redirects=False,
    )

    assert login_response.status_code in {302, 303}

    form_response = client.get("/student/form")

    assert form_response.status_code == 200
    assert "第2组" in form_response.text
    assert "切换小组" not in form_response.text
    assert "/student/logout" not in form_response.text


def test_same_group_names_in_different_classrooms_keep_separate_records(
    client: TestClient,
) -> None:
    login_teacher(client)

    classroom_one_dashboard = client.post(
        "/teacher/classrooms",
        data={"name": "五年级1班", "group_count": "3"},
        follow_redirects=True,
    )
    classroom_one_id = int(extract_attr(classroom_one_dashboard.text, "data-current-classroom-id"))
    classroom_one_entry_path = extract_attr(
        classroom_one_dashboard.text,
        "data-student-entry-link",
    )
    classroom_one_entry = client.get(classroom_one_entry_path)
    classroom_one_group_id = extract_group_id(classroom_one_entry.text, "第1组")
    client.post(
        f"{classroom_one_entry_path}/login",
        data={"group_id": str(classroom_one_group_id)},
    )
    save_first = client.post(
        "/student/record",
        data=record_payload("2026-05-14", base_cool=10, base_hot=60),
    )
    assert save_first.status_code == 200

    classroom_two_dashboard = client.post(
        "/teacher/classrooms",
        data={"name": "五年级2班", "group_count": "3"},
        follow_redirects=True,
    )
    classroom_two_entry_path = extract_attr(
        classroom_two_dashboard.text,
        "data-student-entry-link",
    )
    classroom_two_entry = client.get(classroom_two_entry_path)
    classroom_two_group_id = extract_group_id(classroom_two_entry.text, "第1组")
    client.post(
        f"{classroom_two_entry_path}/login",
        data={"group_id": str(classroom_two_group_id)},
    )
    save_second = client.post(
        "/student/record",
        data=record_payload("2026-05-15", base_cool=20, base_hot=70),
    )
    assert save_second.status_code == 200

    first_chart = client.get(f"/api/charts/group/{classroom_one_group_id}")
    second_chart = client.get(f"/api/charts/group/{classroom_two_group_id}")

    assert first_chart.status_code == 200
    assert second_chart.status_code == 200
    assert first_chart.json()["record_date"] == "2026-05-14"
    assert second_chart.json()["record_date"] == "2026-05-15"
    assert first_chart.json()["series"][0]["values"][0] == 10.0
    assert second_chart.json()["series"][0]["values"][0] == 20.0

    switched_dashboard = client.post(
        "/teacher/classrooms/select",
        data={"classroom_id": str(classroom_one_id)},
        follow_redirects=True,
    )
    assert switched_dashboard.status_code == 200
    assert "五年级1班" in switched_dashboard.text
    assert "2026-05-14" in switched_dashboard.text


def test_teacher_login_is_required_and_dashboard_scopes_to_current_classroom(
    client: TestClient,
) -> None:
    response = client.get("/teacher/dashboard", follow_redirects=False)
    assert response.status_code in {302, 303}

    login_teacher(client)
    client.post(
        "/teacher/classrooms",
        data={"name": "六组公开课", "group_count": "6"},
        follow_redirects=True,
    )

    dashboard = client.get("/teacher/dashboard")

    assert dashboard.status_code == 200
    assert dashboard.text.count('data-group-id="') == 6
    assert 'action="/teacher/classrooms/select"' in dashboard.text
    assert 'action="/teacher/classrooms"' not in dashboard.text
    assert "当前学生链接" not in dashboard.text


def test_teacher_websocket_receives_classroom_scoped_update_after_save(
    client: TestClient,
) -> None:
    login_teacher(client)
    dashboard = client.get("/teacher/dashboard")
    classroom_id = int(extract_attr(dashboard.text, "data-current-classroom-id"))
    student_entry_path = extract_attr(dashboard.text, "data-student-entry-link")
    student_entry = client.get(student_entry_path)
    group_id = extract_group_id(student_entry.text, "第1组")

    with client.websocket_connect("/ws/teacher") as websocket:
        client.post(
            f"{student_entry_path}/login",
            data={"group_id": str(group_id)},
        )
        client.post(
            "/student/record",
            data=record_payload("2026-05-14", base_cool=11, base_hot=61),
        )

        message = websocket.receive_json()
        assert message == {
            "type": "group-updated",
            "classroom_id": classroom_id,
            "group_id": group_id,
        }


def test_legacy_database_is_migrated_into_default_classroom(tmp_path: Path) -> None:
    database_path = tmp_path / "legacy.sqlite3"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE groups (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            sort_order INTEGER NOT NULL UNIQUE
        );

        CREATE TABLE temperature_records (
            group_id INTEGER PRIMARY KEY,
            record_date TEXT NOT NULL,
            cool_2 REAL NOT NULL,
            hot_2 REAL NOT NULL,
            cool_4 REAL NOT NULL,
            hot_4 REAL NOT NULL,
            cool_6 REAL NOT NULL,
            hot_6 REAL NOT NULL,
            cool_8 REAL NOT NULL,
            hot_8 REAL NOT NULL,
            cool_10 REAL NOT NULL,
            hot_10 REAL NOT NULL,
            cool_12 REAL NOT NULL,
            hot_12 REAL NOT NULL,
            cool_14 REAL NOT NULL,
            hot_14 REAL NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
        );
        """
    )
    connection.execute(
        "INSERT INTO groups (id, name, sort_order) VALUES (1, '第1组', 1)"
    )
    connection.execute(
        """
        INSERT INTO temperature_records (
            group_id, record_date, cool_2, hot_2, cool_4, hot_4, cool_6, hot_6,
            cool_8, hot_8, cool_10, hot_10, cool_12, hot_12, cool_14, hot_14, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            1,
            "2026-05-13",
            10,
            60,
            12,
            58,
            14,
            56,
            16,
            54,
            18,
            52,
            20,
            50,
            22,
            48,
            "2026-05-13T08:00:00+00:00",
        ),
    )
    connection.commit()
    connection.close()

    ensure_database(database_path)

    migrated = sqlite3.connect(database_path)
    classroom = migrated.execute(
        "SELECT name, slug, group_count FROM classrooms ORDER BY id LIMIT 1"
    ).fetchone()
    group = migrated.execute(
        "SELECT classroom_id, name FROM groups WHERE id = 1"
    ).fetchone()
    record = migrated.execute(
        "SELECT record_date, cool_2, hot_2 FROM temperature_records WHERE group_id = 1"
    ).fetchone()
    migrated.close()

    assert classroom == ("默认班级", "default", 10)
    assert group[0] == 1
    assert group[1] == "第1组"
    assert record == ("2026-05-13", 10.0, 60.0)


def test_teacher_new_classroom_page_requires_login_and_hides_link_before_create(
    client: TestClient,
) -> None:
    response = client.get("/teacher/classrooms/new", follow_redirects=False)
    assert response.status_code in {302, 303}

    login_teacher(client)
    page = client.get("/teacher/classrooms/new")

    assert page.status_code == 200
    assert "新建班级" in page.text
    assert "创建后，这里会显示学生专属链接。" in page.text
    assert "当前学生链接" not in page.text
    assert 'data-student-entry-link="' not in page.text
