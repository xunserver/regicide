from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

from cardpipe.config import ProviderConfig, load_project
from cardpipe.models import CardStatus, GeneratedImage, ReviewResult
from cardpipe.orchestrator import Orchestrator
from cardpipe.prompting import PromptCompiler
from cardpipe.provider import OpenAICompatibleProvider
from cardpipe.review import Reviewer
from cardpipe.rendering import render_cards
from cardpipe.store import Store
from cardpipe.templates import default_deck, write_template


def test_default_deck_has_54_unique_cards() -> None:
    deck = default_deck()
    assert len(deck["cards"]) == 54
    assert len({card["id"] for card in deck["cards"]}) == 54


def test_template_loads_and_prompts_inherit_rules(tmp_path: Path) -> None:
    write_template(tmp_path)
    project = load_project(tmp_path / "project.json")
    prompt = PromptCompiler(project.art_bible).compile(project.cards[0])
    assert len(project.cards) == 54
    assert "HOUSE STYLE:" in prompt
    assert "FACTION LANGUAGE:" in prompt
    assert "DO NOT INCLUDE:" in prompt
    assert "no text" in prompt.lower()


def test_store_resumes_and_tracks_approval(tmp_path: Path) -> None:
    write_template(tmp_path)
    project = load_project(tmp_path / "project.json")
    store = Store(project.workspace)
    store.sync_cards(project.cards)
    card = project.cards[0]
    attempt = store.start_attempt(card.id, "prompt", "hash")
    asset = project.workspace / "assets" / card.id / "v01.png"
    asset.parent.mkdir(parents=True)
    Image.new("RGB", (32, 48), "red").save(asset)
    store.generation_succeeded(card.id, attempt, asset, {"model": "fake"})
    store.approve(card.id)
    assert store.card_row(card.id)["status"] == CardStatus.APPROVED
    assert len(store.attempts_for(card.id)) == 1


def test_auto_approval_records_release_asset(tmp_path: Path) -> None:
    write_template(tmp_path)
    project = load_project(tmp_path / "project.json")
    store = Store(project.workspace)
    store.sync_cards(project.cards)
    card = project.cards[0]
    attempt = store.start_attempt(card.id, "prompt", "hash")
    asset = project.workspace / "assets" / card.id / "v01.png"
    asset.parent.mkdir(parents=True)
    Image.new("RGB", (32, 48), "blue").save(asset)
    store.generation_succeeded(card.id, attempt, asset, {"model": "fake"})
    status = store.save_review(
        card.id, attempt, ReviewResult(passed=True, score=1), require_human=False
    )
    row = store.card_row(card.id)
    assert status == CardStatus.APPROVED
    assert row["approved_asset"] == f"assets/{card.id}/v01.png"


def test_deterministic_review_checks_dimensions(tmp_path: Path) -> None:
    path = tmp_path / "image.png"
    image = Image.new("RGB", (64, 96), (10, 30, 80))
    for x in range(32, 64):
        for y in range(96):
            image.putpixel((x, y), (180, 130, 60))
    image.save(path)
    review = Reviewer("64x96").review(path, "unused")
    assert review.passed
    wrong = Reviewer("96x64").review(path, "unused")
    assert not wrong.passed


def test_provider_normalizes_v1_url() -> None:
    class Config:
        base_url = "https://example.test"

    provider = object.__new__(OpenAICompatibleProvider)
    provider.config = Config()
    assert provider._url("images/generations") == (
        "https://example.test/v1/images/generations"
    )


def test_project_rejects_duplicate_ids(tmp_path: Path) -> None:
    write_template(tmp_path)
    deck_path = tmp_path / "deck.json"
    deck = json.loads(deck_path.read_text())
    deck["cards"].append(deck["cards"][0])
    deck_path.write_text(json.dumps(deck))
    try:
        load_project(tmp_path / "project.json")
    except ValueError as exc:
        assert "unique" in str(exc)
    else:
        raise AssertionError("duplicate IDs were accepted")


def test_render_uses_fixed_layout(tmp_path: Path) -> None:
    write_template(tmp_path)
    project = load_project(tmp_path / "project.json")
    store = Store(project.workspace)
    store.sync_cards(project.cards)
    card = project.cards[0]
    attempt = store.start_attempt(card.id, "prompt", "hash")
    asset = project.workspace / "assets" / card.id / "v01.png"
    asset.parent.mkdir(parents=True)
    Image.effect_noise((256, 384), 64).convert("RGB").save(asset)
    store.generation_succeeded(card.id, attempt, asset, {"model": "fake"})
    store.approve(card.id)
    outputs = render_cards(project, store, tmp_path / "rendered")
    assert len(outputs) == 1
    with Image.open(outputs[0]) as rendered:
        assert rendered.size == (1024, 1536)


def test_orchestrator_runs_generation_to_human_gate(tmp_path: Path) -> None:
    write_template(tmp_path)
    project = load_project(tmp_path / "project.json")
    config = ProviderConfig(
        base_url="https://example.test",
        api_key="test-only",
        image_model="fake-image",
        qa_model=None,
        size="1024x1536",
        quality="high",
        output_format="png",
        timeout_seconds=5,
        supports_edits=False,
        extra_body={},
    )
    image = Image.new("RGB", (1024, 1536), "#17243b")
    ImageDraw.Draw(image).rectangle((300, 300, 800, 1200), fill="#b89a52")
    buffer = BytesIO()
    image.save(buffer, format="PNG")

    orchestrator = Orchestrator(project, config)
    orchestrator.provider.generate = lambda *_args: GeneratedImage(
        buffer.getvalue(), "png", provider_metadata={"test": True}
    )
    result = orchestrator.run({"spades_ace"}, limit=1)
    assert result[CardStatus.NEEDS_HUMAN] == 1
    row = orchestrator.store.card_row("spades_ace")
    assert row["attempt"] == 1
    assert (project.workspace / "assets/spades_ace/v01.png").exists()
