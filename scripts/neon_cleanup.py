#!/usr/bin/env python3
"""Elimina i branch di anteprima di Neon che non servono più.

L'integrazione Neon-Vercel crea un branch del database per ogni deploy di anteprima
(`preview/<branch git>`); il piano gratuito ne ammette pochi e, finiti, i deploy falliscono.
Un branch è "orfano" quando il suo branch git non esiste più, oppure quando la sua PR è
stata chiusa.

Uso (da solo mostra cosa farebbe; con --apply elimina davvero):
    NEON_API_KEY=... python scripts/neon_cleanup.py --project-id <id> --repo owner/nome
    ... --closed-ref feat/qualcosa   # PR chiusa: elimina anche l'anteprima di quel branch
    ... --apply

Non tocca mai il branch predefinito, quelli protetti né quelli che non iniziano per `preview/`.
Usa solo la libreria standard.
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.request

API_BASE = "https://console.neon.tech/api/v2"
PREFIX = "preview/"
MAX_ELIMINAZIONI = 20


def orfani(branches: list[dict], rami_git: set[str], chiuso: str | None = None) -> list[dict]:
    """I branch Neon di anteprima da eliminare."""
    risultato = []
    for b in branches:
        nome = b["name"]
        if not nome.startswith(PREFIX) or b.get("default") or b.get("protected"):
            continue
        ramo = nome[len(PREFIX) :]
        if ramo and (ramo == chiuso or ramo not in rami_git):
            risultato.append(b)
    return risultato


def verifica_rami_git(rami_git: set[str]) -> None:
    """Se l'elenco dei branch git è vuoto o incompleto, ogni anteprima sembrerebbe orfana."""
    if "main" not in rami_git:
        sys.exit("Elenco dei branch git non affidabile (manca main): non elimino nulla.")


def _richiesta(base: str, chiave: str, metodo: str, percorso: str):
    req = urllib.request.Request(
        f"{base}{percorso}",
        method=metodo,
        headers={"Authorization": f"Bearer {chiave}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as risposta:  # noqa: S310
        corpo = risposta.read()
    return json.loads(corpo) if corpo else {}


def elenca_branches(base: str, chiave: str, progetto: str) -> list[dict]:
    return _richiesta(base, chiave, "GET", f"/projects/{progetto}/branches")["branches"]


def run(
    base: str,
    chiave: str,
    progetto: str,
    rami_git: set[str],
    *,
    apply: bool,
    chiuso: str | None = None,
    max_eliminazioni: int = MAX_ELIMINAZIONI,
) -> list[dict]:
    branches = elenca_branches(base, chiave, progetto)
    anteprime = [b["name"] for b in branches if b["name"].startswith(PREFIX)]
    print(f"Branch Neon: {len(branches)} totali, {len(anteprime)} di anteprima")
    for nome in anteprime:
        print(f"  - {nome}")

    da_eliminare = orfani(branches, rami_git, chiuso)
    if len(da_eliminare) > max_eliminazioni:
        sys.exit(f"Troppi branch da eliminare ({len(da_eliminare)}): controlla a mano.")

    for b in da_eliminare:
        if apply:
            _richiesta(base, chiave, "DELETE", f"/projects/{progetto}/branches/{b['id']}")
            print(f"Eliminato: {b['name']}")
        else:
            print(f"Eliminerei: {b['name']}  (prova: usa --apply per farlo davvero)")
    if not da_eliminare:
        print("Niente da eliminare.")
    return da_eliminare


def rami_git_remoti(repo: str) -> set[str]:
    """Branch del repo pubblico su GitHub (senza credenziali)."""
    out = subprocess.run(
        ["git", "ls-remote", "--heads", f"https://github.com/{repo}.git"],
        capture_output=True,
        text=True,
        check=True,
        timeout=60,
    ).stdout
    return {riga.split("refs/heads/", 1)[1] for riga in out.splitlines() if "refs/heads/" in riga}


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--repo", required=True, help="owner/nome del repository GitHub")
    parser.add_argument("--closed-ref", help="branch git della PR appena chiusa")
    parser.add_argument("--apply", action="store_true", help="elimina davvero (senza: solo prova)")
    args = parser.parse_args()

    chiave = os.environ.get("NEON_API_KEY")
    if not chiave:
        sys.exit("Manca la variabile NEON_API_KEY.")
    rami = rami_git_remoti(args.repo)
    verifica_rami_git(rami)
    run(
        os.environ.get("NEON_API_BASE", API_BASE),
        chiave,
        args.project_id,
        rami,
        apply=args.apply,
        chiuso=args.closed_ref,
    )


if __name__ == "__main__":
    main()
