from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from .config import Project
from .store import Store


def write_audit(project: Project, store: Store, output: Path) -> None:
    rows = store.all_cards()
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "deck_size": len(project.cards),
        "status_counts": store.status_counts(),
        "cards": [],
    }
    by_id = {card.id: card for card in project.cards}
    for row in rows:
        card = by_id[row["card_id"]]
        report["cards"].append(
            {
                "id": card.id,
                "name": card.name,
                "status": row["status"],
                "attempts": row["attempt"],
                "approved_asset": row["approved_asset"],
                "error": row["error"],
                "history": store.attempts_for(card.id),
            }
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def write_contact_sheet(project: Project, store: Store, output: Path) -> int:
    cards = {card.id: card for card in project.cards}
    items: list[tuple[str, str, Path]] = []
    for row in store.all_cards():
        asset = row["approved_asset"]
        if not asset:
            attempts = store.attempts_for(row["card_id"])
            generated = [item for item in attempts if item.get("asset_path")]
            asset = generated[-1]["asset_path"] if generated else None
        if asset:
            path = project.workspace / asset
            if path.exists():
                items.append((row["card_id"], cards[row["card_id"]].name, path))
    if not items:
        raise ValueError("No generated images are available")

    columns = min(6, max(1, len(items)))
    thumb = (192, 288)
    label_height = 42
    gap = 14
    rows = (len(items) + columns - 1) // columns
    canvas = Image.new(
        "RGB",
        (
            columns * (thumb[0] + gap) + gap,
            rows * (thumb[1] + label_height + gap) + gap,
        ),
        "#171717",
    )
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for index, (_card_id, name, path) in enumerate(items):
        x = gap + (index % columns) * (thumb[0] + gap)
        y = gap + (index // columns) * (thumb[1] + label_height + gap)
        with Image.open(path) as image:
            fitted = ImageOps.fit(image.convert("RGB"), thumb, method=Image.Resampling.LANCZOS)
        canvas.paste(fitted, (x, y))
        draw.text((x, y + thumb[1] + 8), name[:30], fill="#f2eadf", font=font)
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output)
    return len(items)
