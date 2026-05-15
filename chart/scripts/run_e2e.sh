#!/bin/sh
set -eu

if command -v pytest >/dev/null 2>&1; then
    exec pytest tests/e2e/test_browser_flow.py -q
fi

exec python3 -m pytest tests/e2e/test_browser_flow.py -q
