"""Test di scripts/neon_cleanup.py. Si lanciano da backend/:  uv run pytest ../scripts"""

import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import neon_cleanup as nc  # noqa: E402


def branch(name, id_="br-x", default=False, protected=False):
    return {"id": id_, "name": name, "default": default, "protected": protected}


LIVE = {"main", "feat/aperta"}


class TestOrfani:
    def test_un_branch_di_anteprima_senza_branch_git_e_orfano(self):
        b = [branch("preview/feat/vecchia", "br-1")]
        assert [x["id"] for x in nc.orfani(b, LIVE)] == ["br-1"]

    def test_un_branch_di_anteprima_con_branch_git_vivo_resta(self):
        assert nc.orfani([branch("preview/feat/aperta")], LIVE) == []

    def test_non_tocca_mai_main_default_o_protetti(self):
        b = [
            branch("main", default=True),
            branch("production", protected=True),
            branch("preview/feat/protetto", protected=True),
            branch("preview/feat/default", default=True),
        ]
        assert nc.orfani(b, LIVE) == []

    def test_ignora_i_branch_che_non_sono_di_anteprima(self):
        assert nc.orfani([branch("sviluppo-mio"), branch("dev/qualcosa")], LIVE) == []

    def test_pr_chiusa_elimina_il_suo_branch_anche_se_il_branch_git_esiste_ancora(self):
        b = [branch("preview/feat/aperta", "br-2")]
        assert [x["id"] for x in nc.orfani(b, LIVE, chiuso="feat/aperta")] == ["br-2"]

    def test_pr_chiusa_non_tocca_gli_altri_branch(self):
        b = [branch("preview/feat/aperta"), branch("preview/feat/altra-aperta")]
        assert nc.orfani(b, LIVE | {"feat/altra-aperta"}, chiuso="feat/aperta") == [b[0]]

    def test_nome_vuoto_dopo_il_prefisso_non_viene_eliminato(self):
        assert nc.orfani([branch("preview/")], LIVE) == []


class FakeNeon(BaseHTTPRequestHandler):
    """Finto server Neon: restituisce i branch e registra le DELETE."""

    branches: list[dict] = []
    deleted: list[str] = []
    auth: list[str | None] = []

    def log_message(self, *args):  # silenzioso
        pass

    def _send(self, status, body=None):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if body is not None:
            self.wfile.write(json.dumps(body).encode())

    def do_GET(self):
        FakeNeon.auth.append(self.headers.get("Authorization"))
        assert self.path.startswith("/projects/prj-1/branches")
        self._send(200, {"branches": FakeNeon.branches})

    def do_DELETE(self):
        FakeNeon.deleted.append(self.path.rsplit("/", 1)[-1])
        self._send(200, {})


@pytest.fixture
def neon():
    FakeNeon.branches, FakeNeon.deleted, FakeNeon.auth = [], [], []
    server = HTTPServer(("127.0.0.1", 0), FakeNeon)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


def esegui(neon, apply, **kw):
    return nc.run(neon, "chiave-finta", "prj-1", LIVE, apply=apply, **kw)


class TestRun:
    def setup_method(self):
        FakeNeon.branches = [
            branch("main", "br-main", default=True),
            branch("preview/feat/vecchia", "br-vecchia"),
            branch("preview/feat/aperta", "br-aperta"),
        ]

    def test_senza_apply_non_elimina_nulla(self, neon):
        FakeNeon.branches = [
            branch("main", "br-main", default=True),
            branch("preview/feat/vecchia", "br-vecchia"),
        ]
        assert [b["id"] for b in esegui(neon, apply=False)] == ["br-vecchia"]
        assert FakeNeon.deleted == []

    def test_con_apply_elimina_solo_gli_orfani(self, neon):
        FakeNeon.branches = [
            branch("main", "br-main", default=True),
            branch("preview/feat/vecchia", "br-vecchia"),
            branch("preview/feat/aperta", "br-aperta"),
        ]
        esegui(neon, apply=True)
        assert FakeNeon.deleted == ["br-vecchia"]

    def test_manda_la_chiave_come_bearer(self, neon):
        FakeNeon.branches = [branch("main", default=True)]
        esegui(neon, apply=False)
        assert FakeNeon.auth[0] == "Bearer chiave-finta"

    def test_rifiuta_di_eliminare_troppi_branch_in_un_colpo(self, neon):
        FakeNeon.branches = [branch(f"preview/feat/x{i}", f"br-{i}") for i in range(5)]
        with pytest.raises(SystemExit, match="Troppi"):
            esegui(neon, apply=True, max_eliminazioni=3)
        assert FakeNeon.deleted == []


class TestBranchGit:
    def test_rifiuta_un_elenco_senza_main(self):
        with pytest.raises(SystemExit, match="main"):
            nc.verifica_rami_git({"feat/a"})

    def test_accetta_un_elenco_con_main(self):
        nc.verifica_rami_git({"main", "feat/a"})
