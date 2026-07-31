from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .models import Card


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Missing configuration file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc


def load_dotenv(path: Path) -> None:
    """Load a simple local .env without overriding the caller's environment."""
    if not path.exists():
        return
    for number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"Invalid .env entry at line {number}")
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value[:1] == value[-1:] and value.startswith(("'", '"')):
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


@dataclass(frozen=True)
class ProviderConfig:
    base_url: str
    api_key: str
    image_model: str
    qa_model: str | None
    size: str
    quality: str
    output_format: str
    timeout_seconds: int
    supports_edits: bool
    extra_body: dict[str, Any]

    @classmethod
    def from_environment(
        cls, project: dict[str, Any], require_key: bool = True
    ) -> "ProviderConfig":
        provider = project.get("provider", {})
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if require_key and not api_key:
            raise ValueError("OPENAI_API_KEY is required for live generation")
        return cls(
            base_url=os.getenv(
                "CARDPIPE_BASE_URL", provider.get("base_url", "https://api.openai.com")
            ).rstrip("/"),
            api_key=api_key or "dry-run-no-key",
            image_model=os.getenv(
                "CARDPIPE_IMAGE_MODEL", provider.get("image_model", "gpt-image-2")
            ),
            qa_model=os.getenv("CARDPIPE_QA_MODEL") or provider.get("qa_model"),
            size=provider.get("size", "1024x1536"),
            quality=provider.get("quality", "high"),
            output_format=provider.get("output_format", "png"),
            timeout_seconds=int(provider.get("timeout_seconds", 180)),
            supports_edits=bool(provider.get("supports_edits", False)),
            extra_body=dict(provider.get("extra_body", {})),
        )


@dataclass(frozen=True)
class Project:
    root: Path
    raw: dict[str, Any]
    art_bible: dict[str, Any]
    cards: tuple[Card, ...]

    @property
    def workspace(self) -> Path:
        configured = self.raw.get("workspace", "workspaces/default")
        return (self.root / configured).resolve()

    @property
    def max_attempts(self) -> int:
        return int(self.raw.get("workflow", {}).get("max_attempts", 3))

    @property
    def concurrency(self) -> int:
        return max(1, int(self.raw.get("workflow", {}).get("concurrency", 2)))

    @property
    def require_human_approval(self) -> bool:
        return bool(self.raw.get("workflow", {}).get("require_human_approval", True))


def load_project(project_path: Path) -> Project:
    project_path = project_path.resolve()
    raw = read_json(project_path)
    root = project_path.parent
    art_bible = read_json(root / raw.get("art_bible", "art_bible.json"))
    deck_raw = read_json(root / raw.get("deck", "deck.json"))
    cards = tuple(Card.from_dict(item) for item in deck_raw.get("cards", []))
    if not cards:
        raise ValueError("Deck has no cards")
    ids = [card.id for card in cards]
    if len(ids) != len(set(ids)):
        raise ValueError("Card IDs must be unique")
    return Project(root=root, raw=raw, art_bible=art_bible, cards=cards)
