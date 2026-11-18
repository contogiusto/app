"""Slug dei ristoranti: l'indirizzo pubblico di un locale (`/ristorante/<slug>`)."""

import re
import unicodedata

# Parole che non possono essere uno slug: collidono con rotte dell'app o dell'API.
RESERVED_SLUGS = frozenset(
    {
        "api",
        "admin",
        "waiter",
        "staff",
        "customer",
        "table",
        "tavolo",
        "privacy",
        "piattaforma",
        "platform",
        "ristorante",
        "ristoranti",
        "login",
        "accesso",
        "reset-password",
        "assets",
    }
)

_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def valid_slug(slug: str) -> bool:
    return 3 <= len(slug) <= 40 and bool(_SLUG.match(slug)) and slug not in RESERVED_SLUGS


def slugify(name: str) -> str:
    """Slug proposto a partire da un nome (non garantisce l'unicità né l'assenza di riservati)."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")[:40].strip("-")
    return slug if len(slug) >= 3 else "ristorante"
