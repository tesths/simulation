from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest
from playwright.sync_api import BrowserContext, sync_playwright

ROOT = Path(__file__).resolve().parents[2]


def wait_for_server(base_url: str, timeout_seconds: float = 15.0) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None

    while time.monotonic() < deadline:
        try:
            response = httpx.get(f"{base_url}/student", timeout=1.0)
            if response.status_code in {200, 302, 303, 307, 308}:
                return
        except Exception as exc:  # pragma: no cover - only used on startup race
            last_error = exc
        time.sleep(0.2)

    if last_error:
        raise RuntimeError(f"Server did not start: {last_error}") from last_error
    raise RuntimeError("Server did not start before timeout")


@pytest.fixture()
def live_server(tmp_path: Path, free_tcp_port: int) -> str:
    database_path = tmp_path / "browser-e2e.sqlite3"
    env = os.environ.copy()
    env["DATABASE_PATH"] = str(database_path)
    env["TEACHER_PASSWORD"] = "e2e-teacher-pass"
    env["SECRET_KEY"] = "e2e-secret-key"

    command = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(free_tcp_port),
        "--log-level",
        "warning",
    ]
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    base_url = f"http://127.0.0.1:{free_tcp_port}"

    try:
        wait_for_server(base_url)
        yield base_url
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


@pytest.fixture()
def browser_contexts() -> tuple[BrowserContext, BrowserContext, BrowserContext, BrowserContext]:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        contexts = tuple(
            browser.new_context(
                locale="zh-CN",
                viewport={"width": 1400, "height": 900},
            )
            for _ in range(4)
        )
        try:
            yield contexts
        finally:
            for context in contexts:
                context.close()
            browser.close()
