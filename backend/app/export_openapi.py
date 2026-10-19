"""Scrive lo schema OpenAPI dell'API in backend/openapi.json.

Da lì il frontend genera i tipi (`npm run api:types`). Rilancia dopo ogni modifica
agli endpoint o agli schemi:  cd backend && uv run python -m app.export_openapi
"""

import json
from pathlib import Path

from app.main import app

OPENAPI_PATH = Path(__file__).resolve().parent.parent / "openapi.json"


def render() -> str:
    return json.dumps(app.openapi(), indent=2, ensure_ascii=False, sort_keys=True) + "\n"


if __name__ == "__main__":
    OPENAPI_PATH.write_text(render(), encoding="utf-8", newline="\n")
    print(f"Scritto {OPENAPI_PATH}")
