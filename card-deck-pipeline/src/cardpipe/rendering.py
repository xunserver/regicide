from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from .config import Project
from .store import Store


FONT_CANDIDATES = (
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)


def load_font(configured: str | None, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = ([configured] if configured else []) + list(FONT_CANDIDATES)
    for value in candidates:
        if value and Path(value).exists():
            try:
                return ImageFont.truetype(value, size)
            except OSError:
                continue
    return ImageFont.load_default()


def latest_asset(store: Store, card_id: str) -> str | None:
    attempts = store.attempts_for(card_id)
    paths = [row["asset_path"] for row in attempts if row.get("asset_path")]
    return paths[-1] if paths else None


def render_cards(
    project: Project,
    store: Store,
    output_dir: Path,
    only_ids: set[str] | None = None,
    allow_unapproved: bool = False,
) -> list[Path]:
    layout = project.raw.get("layout", {})
    size = tuple(layout.get("output_size", [1024, 1536]))
    frame_width = int(layout.get("frame_width", 18))
    title_height = int(layout.get("title_height", 112))
    footer_height = int(layout.get("footer_height", 62))
    opacity = int(layout.get("panel_opacity", 205))
    font_path = layout.get("font_path")
    title_font = load_font(font_path, max(22, size[0] // 26))
    small_font = load_font(font_path, max(16, size[0] // 42))

    rows = {row["card_id"]: row for row in store.all_cards()}
    output_dir.mkdir(parents=True, exist_ok=True)
    rendered: list[Path] = []
    for card in project.cards:
        if only_ids and card.id not in only_ids:
            continue
        row = rows[card.id]
        relative = row["approved_asset"]
        if not relative and allow_unapproved:
            relative = latest_asset(store, card.id)
        if not relative:
            continue
        source = project.workspace / relative
        if not source.exists():
            continue
        with Image.open(source) as image:
            canvas = ImageOps.fit(
                image.convert("RGBA"), size, method=Image.Resampling.LANCZOS
            )
        overlay = Image.new("RGBA", size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        faction = project.art_bible.get("factions", {}).get(card.faction, {})
        accent = faction.get("frame_color", "#c5b58a")
        panel = (10, 13, 18, opacity)
        draw.rectangle(
            (frame_width, frame_width, size[0] - frame_width, title_height),
            fill=panel,
            outline=accent,
            width=max(2, frame_width // 4),
        )
        draw.rectangle(
            (
                frame_width,
                size[1] - footer_height,
                size[0] - frame_width,
                size[1] - frame_width,
            ),
            fill=panel,
            outline=accent,
            width=max(2, frame_width // 4),
        )
        draw.rectangle(
            (frame_width // 2, frame_width // 2, size[0] - frame_width // 2, size[1] - frame_width // 2),
            outline=accent,
            width=frame_width,
        )
        title_box = draw.textbbox((0, 0), card.name, font=title_font)
        title_width = title_box[2] - title_box[0]
        draw.text(
            ((size[0] - title_width) / 2, (title_height - (title_box[3] - title_box[1])) / 2 - 2),
            card.name,
            fill="#f7f1e7",
            font=title_font,
        )
        footer = f"{card.faction.replace('_', ' ').upper()}  •  {card.category.upper()}"
        footer_box = draw.textbbox((0, 0), footer, font=small_font)
        footer_width = footer_box[2] - footer_box[0]
        draw.text(
            (
                (size[0] - footer_width) / 2,
                size[1] - footer_height + 16,
            ),
            footer,
            fill="#e2d7c2",
            font=small_font,
        )
        composed = Image.alpha_composite(canvas, overlay).convert("RGB")
        target = output_dir / f"{card.id}.jpg"
        composed.save(target, quality=95, subsampling=0)
        rendered.append(target)
    return rendered
