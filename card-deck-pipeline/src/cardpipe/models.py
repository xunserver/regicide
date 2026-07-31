from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class CardStatus(StrEnum):
    DRAFT = "draft"
    READY = "ready"
    GENERATING = "generating"
    GENERATED = "generated"
    REVIEWING = "reviewing"
    NEEDS_REVISION = "needs_revision"
    NEEDS_HUMAN = "needs_human"
    APPROVED = "approved"
    FAILED = "failed"


@dataclass(frozen=True)
class Card:
    id: str
    name: str
    category: str
    faction: str
    subject: str
    action: str
    scene: str
    mood: str = ""
    composition: str = ""
    required: tuple[str, ...] = ()
    forbidden: tuple[str, ...] = ()
    character_id: str | None = None
    reference_images: tuple[str, ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "Card":
        known = {
            "id", "name", "category", "faction", "subject", "action", "scene",
            "mood", "composition", "required", "forbidden", "character_id",
            "reference_images", "metadata",
        }
        unknown = set(value) - known
        if unknown:
            raise ValueError(f"Unknown card fields: {sorted(unknown)}")
        return cls(
            **{
                **value,
                "required": tuple(value.get("required", ())),
                "forbidden": tuple(value.get("forbidden", ())),
                "reference_images": tuple(value.get("reference_images", ())),
            }
        )


@dataclass(frozen=True)
class ReviewResult:
    passed: bool
    score: float
    issues: tuple[str, ...] = ()
    revision_instruction: str = ""
    reviewer: str = "deterministic"
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class GeneratedImage:
    data: bytes
    extension: str
    revised_prompt: str | None = None
    provider_metadata: dict[str, Any] = field(default_factory=dict)
