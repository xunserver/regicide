from __future__ import annotations

import hashlib
import json
from typing import Any

from .models import Card


class PromptCompiler:
    """Compiles structured intent into a stable prompt with inherited rules."""

    def __init__(self, art_bible: dict[str, Any]):
        self.art_bible = art_bible

    @property
    def version_hash(self) -> str:
        canonical = json.dumps(self.art_bible, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(canonical.encode()).hexdigest()[:12]

    def compile(self, card: Card, revision_instruction: str = "") -> str:
        bible = self.art_bible
        faction = bible.get("factions", {}).get(card.faction, {})
        category = bible.get("categories", {}).get(card.category, {})
        character = bible.get("characters", {}).get(card.character_id or "", {})
        palette = ", ".join(faction.get("palette", bible.get("palette", [])))
        required = "; ".join(card.required) or "none beyond the described subject"
        forbidden = list(bible.get("global_forbidden", [])) + list(card.forbidden)

        sections = [
            ("ROLE", "Create one production-ready collectible card illustration."),
            ("HOUSE STYLE", bible.get("style", "")),
            ("WORLD", bible.get("world", "")),
            ("COLOR SCRIPT", palette),
            ("FACTION LANGUAGE", faction.get("visual_language", "")),
            ("CARD TYPE", category.get("composition", "")),
            ("SUBJECT", card.subject),
            ("CHARACTER CONTINUITY", character.get("identity", "")),
            ("ACTION", card.action),
            ("SCENE", card.scene),
            ("MOOD", card.mood),
            ("COMPOSITION", card.composition),
            ("REQUIRED DETAILS", required),
            (
                "OUTPUT CONTRACT",
                bible.get(
                    "output_contract",
                    "Single borderless illustration, no text, no numbers, no card frame, "
                    "keep important content inside the central 80% safe area.",
                ),
            ),
            ("DO NOT INCLUDE", "; ".join(item for item in forbidden if item)),
        ]
        if revision_instruction:
            sections.append(
                (
                    "TARGETED REVISION",
                    "Preserve every approved visual decision and change only this: "
                    + revision_instruction,
                )
            )
        return "\n".join(f"{name}: {value}" for name, value in sections if value)
