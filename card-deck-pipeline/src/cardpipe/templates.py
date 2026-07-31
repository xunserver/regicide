from __future__ import annotations

import json
from pathlib import Path


SUITS = {
    "spades": {
        "name": "Spades",
        "faction": "night_court",
        "setting": "a moonlit basalt citadel",
    },
    "hearts": {
        "name": "Hearts",
        "faction": "ember_court",
        "setting": "a crimson palace garden",
    },
    "diamonds": {
        "name": "Diamonds",
        "faction": "crystal_court",
        "setting": "a luminous crystal treasury",
    },
    "clubs": {
        "name": "Clubs",
        "faction": "wild_court",
        "setting": "an ancient overgrown forest temple",
    },
}

RANKS = [
    ("ace", "Ace", "a singular herald holding the faction relic"),
    ("2", "Two", "two sworn scouts crossing paths"),
    ("3", "Three", "three sentinels forming a triangular guard"),
    ("4", "Four", "four warding monuments around a glowing sigil"),
    ("5", "Five", "five elite guards advancing in formation"),
    ("6", "Six", "six riders returning from a distant campaign"),
    ("7", "Seven", "seven ritual lanterns surrounding a lone champion"),
    ("8", "Eight", "eight banners rising in a ceremonial avenue"),
    ("9", "Nine", "nine spectral guardians emerging from mist"),
    ("10", "Ten", "ten warriors assembled before the fortress gate"),
    ("jack", "Jack", "the young court duelist in signature armor"),
    ("queen", "Queen", "the sovereign queen seated with quiet authority"),
    ("king", "King", "the elder warrior king commanding the court"),
]


def default_deck() -> dict:
    cards = []
    for suit, info in SUITS.items():
        for rank, rank_name, subject in RANKS:
            cards.append(
                {
                    "id": f"{suit}_{rank}",
                    "name": f"{rank_name} of {info['name']}",
                    "category": "court" if rank in {"jack", "queen", "king"} else "number",
                    "faction": info["faction"],
                    "subject": subject,
                    "action": "poised in a readable, iconic moment",
                    "scene": info["setting"],
                    "mood": "mythic, restrained, dignified",
                    "composition": (
                        "vertical 2:3 composition, centered hierarchy, medium-wide shot, "
                        "clear silhouette, generous negative space near top and bottom"
                    ),
                    "required": [f"subtle {info['name'].lower()} suit symbolism"],
                    "forbidden": ["playing-card typography", "modern objects"],
                    "metadata": {"suit": suit, "rank": rank},
                }
            )
    for number, palette in ((1, "ivory and antique gold"), (2, "charcoal and silver")):
        cards.append(
            {
                "id": f"joker_{number}",
                "name": f"Joker {number}",
                "category": "joker",
                "faction": "wanderers",
                "subject": "an enigmatic masked trickster carrying a split-color marotte",
                "action": "balancing on a narrow stone arch with theatrical confidence",
                "scene": "a borderland where all four courts meet under an eclipsed sky",
                "mood": "mysterious and playful, never comedic",
                "composition": "vertical 2:3, dynamic full figure, sweeping diagonal cape",
                "required": [f"dominant palette of {palette}", "four subtle court emblems"],
                "forbidden": ["clown makeup", "circus tent", "text"],
                "metadata": {"rank": "joker", "variant": number},
            }
        )
    return {"name": "Four Courts", "cards": cards}


def default_art_bible() -> dict:
    return {
        "name": "Four Courts Visual Bible",
        "style": (
            "Premium dark-fantasy editorial illustration; hand-painted gouache and "
            "tempera texture on fine paper; elegant simplified shapes; crisp silhouette "
            "design; restrained detail; consistent anatomically believable figures."
        ),
        "world": (
            "A timeless mythic realm of four rival medieval courts. Materials are stone, "
            "aged metal, woven cloth, glass and living wood. No modern technology."
        ),
        "palette": ["deep charcoal", "parchment ivory", "muted antique gold"],
        "global_forbidden": [
            "letters",
            "words",
            "numbers",
            "logos",
            "watermarks",
            "card borders",
            "photorealism",
            "3D render",
            "anime",
            "neon cyberpunk colors",
            "cropped heads",
            "extra limbs",
        ],
        "output_contract": (
            "One borderless portrait illustration only. No text, numbers, icons, UI, "
            "frames, margins or watermarks. Keep faces, hands and faction relics inside "
            "the central 80% safe area. The image must fill the canvas."
        ),
        "categories": {
            "number": {
                "composition": (
                    "Environmental tableau with a simple countable motif; subjects read "
                    "clearly at thumbnail size."
                )
            },
            "court": {
                "composition": (
                    "Formal character portrait with the same camera height and painterly "
                    "finish across all court cards."
                )
            },
            "joker": {
                "composition": (
                    "More kinetic than court cards while preserving the same materials, "
                    "brushwork and world."
                )
            },
        },
        "factions": {
            "night_court": {
                "palette": ["blue-black", "cold silver", "desaturated moon blue"],
                "visual_language": "pointed arches, raven feathers, narrow steel shapes",
            },
            "ember_court": {
                "palette": ["oxblood red", "warm ivory", "aged brass"],
                "visual_language": "rounded arches, rose motifs, layered ceremonial cloth",
            },
            "crystal_court": {
                "palette": ["smoky teal", "pale gold", "translucent quartz"],
                "visual_language": "faceted geometry, glass inlays, precise symmetry",
            },
            "wild_court": {
                "palette": ["forest green", "umber", "weathered bronze"],
                "visual_language": "branching forms, carved wood, asymmetrical organic lines",
            },
            "wanderers": {
                "palette": ["charcoal", "ivory", "antique gold"],
                "visual_language": "balanced mixture of the four courts with mask motifs",
            },
        },
        "characters": {},
        "reference_images": [],
        "qa_rubric": {
            "minimum_score": 0.72,
            "must_have": [
                "matches the house style and faction palette",
                "contains all required details",
                "contains no text or border",
                "clear readable composition at thumbnail size",
                "believable anatomy",
            ],
            "reject_if": [
                "wrong faction palette",
                "photorealistic, 3D, anime, or modern",
                "major anatomy defect",
                "missing required subject",
                "visible text, logo, watermark, or card frame",
            ],
        },
    }


def default_project() -> dict:
    return {
        "art_bible": "art_bible.json",
        "deck": "deck.json",
        "workspace": "workspaces/four-courts",
        "provider": {
            "base_url": "https://www.inroi.shop",
            "image_model": "gpt-image-2",
            "qa_model": None,
            "size": "1024x1536",
            "quality": "high",
            "output_format": "png",
            "timeout_seconds": 300,
            "supports_edits": False,
            "extra_body": {},
        },
        "workflow": {
            "concurrency": 2,
            "max_attempts": 3,
            "require_human_approval": True,
        },
        "layout": {
            "output_size": [1024, 1536],
            "frame_width": 18,
            "panel_opacity": 205,
            "title_height": 112,
            "footer_height": 62,
            "font_path": None,
        },
    }


def write_template(target: Path, force: bool = False) -> None:
    target.mkdir(parents=True, exist_ok=True)
    files = {
        "project.json": default_project(),
        "art_bible.json": default_art_bible(),
        "deck.json": default_deck(),
    }
    for name, content in files.items():
        path = target / name
        if path.exists() and not force:
            raise FileExistsError(f"Refusing to overwrite {path}; pass --force")
        path.write_text(
            json.dumps(content, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    refs = target / "references"
    refs.mkdir(exist_ok=True)
    (refs / ".gitkeep").touch()
