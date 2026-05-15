from __future__ import annotations

from playwright.sync_api import expect

TIME_POINTS = (2, 4, 6, 8, 10, 12, 14)


def fill_temperature_form(page, record_date: str, cool_values: list[int], hot_values: list[int]) -> None:
    page.locator('input[name="record_date"]').fill(record_date)
    for point, cool, hot in zip(TIME_POINTS, cool_values, hot_values, strict=True):
        page.locator(f'input[name="cool_{point}"]').fill(str(cool))
        page.locator(f'input[name="hot_{point}"]').fill(str(hot))


def test_teacher_dashboard_updates_after_student_saves(live_server, browser_contexts) -> None:
    teacher_context, student_one_context, student_two_context, student_three_context = browser_contexts
    base_url = live_server

    teacher_page = teacher_context.new_page()
    teacher_page.goto(f"{base_url}/teacher")
    teacher_page.locator('input[name="password"]').fill("e2e-teacher-pass")
    teacher_page.get_by_role("button", name="进入总览页").click()

    expect(teacher_page).to_have_url(f"{base_url}/teacher/dashboard")
    expect(teacher_page.locator("[data-chart-card]")).to_have_count(10)
    student_entry_path = teacher_page.locator("[data-teacher-dashboard]").get_attribute("data-student-entry-link")
    assert student_entry_path
    teacher_layout = teacher_page.evaluate(
        """() => {
            const screen = document.querySelector('.teacher-screen');
            const grid = document.querySelector('.teacher-grid');
            return {
                screenClientHeight: screen?.clientHeight ?? 0,
                screenScrollHeight: screen?.scrollHeight ?? 0,
                gridClientHeight: grid?.clientHeight ?? 0,
                gridScrollHeight: grid?.scrollHeight ?? 0,
            };
        }"""
    )
    assert teacher_layout["screenScrollHeight"] <= teacher_layout["screenClientHeight"]
    assert teacher_layout["gridScrollHeight"] <= teacher_layout["gridClientHeight"]
    expect(teacher_page.locator('[data-group-id="1"] [data-chart-date]')).to_have_text("未填写")
    expect(teacher_page.locator('[data-group-id="2"] [data-chart-date]')).to_have_text("未填写")
    expect(teacher_page.locator('[data-group-id="3"] [data-chart-date]')).to_have_text("未填写")

    student_cases = (
        (student_one_context, "第1组", "2026-05-11", [10, 12, 14, 16, 18, 20, 22], [60, 58, 56, 54, 52, 50, 48]),
        (student_two_context, "第2组", "2026-05-12", [11, 13, 15, 17, 19, 21, 23], [61, 59, 57, 55, 53, 51, 49]),
        (student_three_context, "第3组", "2026-05-13", [9, 11, 13, 15, 17, 19, 21], [59, 57, 55, 53, 51, 49, 47]),
    )

    for context, group_name, record_date, cool_values, hot_values in student_cases:
        page = context.new_page()
        page.goto(f"{base_url}{student_entry_path}")
        page.get_by_role("button", name=group_name).click()
        expect(page).to_have_url(f"{base_url}/student/form")
        student_layout = page.evaluate(
            """() => {
                const dateInput = document.querySelector('.date-field input');
                const button = document.querySelector('.form-meta .primary-button');
                const table = document.querySelector('.record-table');
                return {
                    dateBottom: dateInput?.getBoundingClientRect().bottom ?? 0,
                    buttonBottom: button?.getBoundingClientRect().bottom ?? 0,
                    tableHeight: table?.getBoundingClientRect().height ?? 0,
                };
            }"""
        )
        assert abs(student_layout["dateBottom"] - student_layout["buttonBottom"]) <= 2
        assert student_layout["tableHeight"] <= 500

        fill_temperature_form(page, record_date, cool_values, hot_values)
        page.get_by_role("button", name="保存并生成折线图").click()

        expect(page.locator("#save-status")).to_have_text("保存成功，折线图已更新。")
        expect(page.locator("[data-student-chart] svg")).to_have_count(1)
        page.close()

    expect(teacher_page.locator('[data-group-id="1"] [data-chart-date]')).to_have_text("2026-05-11")
    expect(teacher_page.locator('[data-group-id="2"] [data-chart-date]')).to_have_text("2026-05-12")
    expect(teacher_page.locator('[data-group-id="3"] [data-chart-date]')).to_have_text("2026-05-13")
    expect(teacher_page.locator('[data-group-id="1"] svg')).to_have_count(1)
    expect(teacher_page.locator('[data-group-id="2"] svg')).to_have_count(1)
    expect(teacher_page.locator('[data-group-id="3"] svg')).to_have_count(1)
