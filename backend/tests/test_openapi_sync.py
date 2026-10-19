from app.export_openapi import OPENAPI_PATH, render


def test_openapi_json_e_aggiornato():
    """Se fallisce: cd backend && uv run python -m app.export_openapi, poi npm run api:types."""
    assert OPENAPI_PATH.read_text(encoding="utf-8") == render()
