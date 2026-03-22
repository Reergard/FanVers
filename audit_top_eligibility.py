#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Обгортка для запуску з кореня репозиторію Fan-vers:
    python audit_top_eligibility.py
    python audit_top_eligibility.py --skip-ineligible

Реальний код: backend/audit_top_eligibility.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parent
    backend = root / "backend"
    script = backend / "audit_top_eligibility.py"
    if not script.is_file():
        print(f"Не знайдено: {script}", file=sys.stderr)
        return 1
    return subprocess.call(
        [sys.executable, str(script), *sys.argv[1:]],
        cwd=str(backend),
    )


if __name__ == "__main__":
    raise SystemExit(main())
