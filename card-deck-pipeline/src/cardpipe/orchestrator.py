from __future__ import annotations

import hashlib
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from .config import Project, ProviderConfig
from .models import Card, CardStatus
from .prompting import PromptCompiler
from .provider import OpenAICompatibleProvider
from .review import Reviewer
from .store import Store


class Orchestrator:
    """Stateful art-director agent backed by deterministic production tools."""

    def __init__(
        self,
        project: Project,
        provider_config: ProviderConfig,
        dry_run: bool = False,
    ):
        self.project = project
        self.store = Store(project.workspace)
        self.store.sync_cards(project.cards)
        self.compiler = PromptCompiler(project.art_bible)
        self.provider = OpenAICompatibleProvider(provider_config)
        rubric = json.dumps(
            project.art_bible.get("qa_rubric", {}), ensure_ascii=False
        )
        self.reviewer = Reviewer(provider_config.size, self.provider, rubric)
        self.dry_run = dry_run
        self.card_map = {card.id: card for card in project.cards}

    def run(
        self, only_ids: set[str] | None = None, limit: int | None = None
    ) -> dict[str, int]:
        if self.dry_run:
            candidates = self.store.candidates(only_ids)
            if limit is not None:
                candidates = candidates[:limit]
            for row in candidates:
                card = self.card_map[row["card_id"]]
                print(f"\n--- {card.id}: {card.name} ---")
                print(self.compiler.compile(card, row["revision_instruction"]))
            return self.store.status_counts()

        processed = 0
        for _round in range(self.project.max_attempts):
            candidates = self.store.candidates(only_ids)
            candidates = [
                row for row in candidates
                if int(row["attempt"]) < self.project.max_attempts
            ]
            if limit is not None:
                candidates = candidates[: max(0, limit - processed)]
            if not candidates:
                break
            with ThreadPoolExecutor(max_workers=self.project.concurrency) as pool:
                futures = [
                    pool.submit(self._process_one, row["card_id"]) for row in candidates
                ]
                for future in as_completed(futures):
                    card_id, result = future.result()
                    processed += 1
                    print(f"{card_id}: {result}")
            if limit is not None and processed >= limit:
                break

        for row in self.store.candidates(only_ids):
            if int(row["attempt"]) >= self.project.max_attempts:
                self.store.require_human(
                    row["card_id"],
                    f"Automatic attempt budget exhausted ({self.project.max_attempts})",
                )
        return self.store.status_counts()

    def _process_one(self, card_id: str) -> tuple[str, str]:
        card = self.card_map[card_id]
        row = self.store.card_row(card_id)
        if int(row["attempt"]) >= self.project.max_attempts:
            self.store.require_human(card_id, "Automatic attempt budget exhausted")
            return card_id, "maximum attempts reached; human review required"
        prompt = self.compiler.compile(card, row["revision_instruction"])
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
        attempt = self.store.start_attempt(card_id, prompt, prompt_hash)
        references = self._resolve_references(card)
        try:
            generated = self.provider.generate(prompt, references)
            card_dir = self.project.workspace / "assets" / card.id
            card_dir.mkdir(parents=True, exist_ok=True)
            asset = card_dir / f"v{attempt:02d}.{generated.extension}"
            asset.write_bytes(generated.data)
            provider_meta = {
                **generated.provider_metadata,
                "revised_prompt": generated.revised_prompt,
                "model": self.provider.config.image_model,
                "art_bible_hash": self.compiler.version_hash,
                "references": [str(path) for path in references],
            }
            self.store.generation_succeeded(card_id, attempt, asset, provider_meta)
            review = self.reviewer.review(asset, prompt)
            status = self.store.save_review(
                card_id,
                attempt,
                review,
                self.project.require_human_approval,
            )
            return card_id, f"{status} (score={review.score:.2f}, asset={asset})"
        except Exception as exc:
            self.store.generation_failed(card_id, attempt, str(exc))
            return card_id, f"failed: {exc}"

    def _resolve_references(self, card: Card) -> tuple[Path, ...]:
        references: list[Path] = []
        global_refs = self.project.art_bible.get("reference_images", [])
        faction_refs = (
            self.project.art_bible.get("factions", {})
            .get(card.faction, {})
            .get("reference_images", [])
        )
        character_refs = (
            self.project.art_bible.get("characters", {})
            .get(card.character_id or "", {})
            .get("reference_images", [])
        )
        for value in [*global_refs, *faction_refs, *character_refs, *card.reference_images]:
            path = (self.project.root / value).resolve()
            if path.exists():
                references.append(path)
        return tuple(dict.fromkeys(references))
