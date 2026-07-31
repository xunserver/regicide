from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from .models import Card, CardStatus, ReviewResult


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, workspace: Path):
        self.workspace = workspace
        self.workspace.mkdir(parents=True, exist_ok=True)
        (workspace / "assets").mkdir(exist_ok=True)
        self.db_path = workspace / "pipeline.sqlite3"
        self._initialize()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.db_path, timeout=30)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _initialize(self) -> None:
        with self.connect() as db:
            db.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS cards (
                    card_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    attempt INTEGER NOT NULL DEFAULT 0,
                    prompt TEXT,
                    revision_instruction TEXT NOT NULL DEFAULT '',
                    approved_asset TEXT,
                    error TEXT,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    card_id TEXT NOT NULL,
                    attempt INTEGER NOT NULL,
                    prompt TEXT NOT NULL,
                    prompt_hash TEXT NOT NULL,
                    asset_path TEXT,
                    status TEXT NOT NULL,
                    review_json TEXT,
                    provider_json TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE(card_id, attempt)
                );
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    card_id TEXT,
                    event TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )

    def sync_cards(self, cards: tuple[Card, ...]) -> None:
        with self.connect() as db:
            for card in cards:
                db.execute(
                    """
                    INSERT INTO cards(card_id, name, status, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(card_id) DO UPDATE SET name=excluded.name
                    """,
                    (card.id, card.name, CardStatus.READY, utc_now()),
                )

    def candidates(self, only_ids: set[str] | None = None) -> list[sqlite3.Row]:
        allowed = (
            CardStatus.READY,
            CardStatus.NEEDS_REVISION,
            CardStatus.FAILED,
            CardStatus.GENERATING,
            CardStatus.REVIEWING,
        )
        placeholders = ",".join("?" for _ in allowed)
        query = f"SELECT * FROM cards WHERE status IN ({placeholders})"
        params: list[object] = list(allowed)
        if only_ids:
            query += f" AND card_id IN ({','.join('?' for _ in only_ids)})"
            params.extend(sorted(only_ids))
        query += " ORDER BY card_id"
        with self.connect() as db:
            return list(db.execute(query, params))

    def card_row(self, card_id: str) -> sqlite3.Row:
        with self.connect() as db:
            row = db.execute("SELECT * FROM cards WHERE card_id=?", (card_id,)).fetchone()
        if row is None:
            raise KeyError(card_id)
        return row

    def start_attempt(self, card_id: str, prompt: str, prompt_hash: str) -> int:
        with self.connect() as db:
            row = db.execute(
                "SELECT attempt FROM cards WHERE card_id=?", (card_id,)
            ).fetchone()
            attempt = int(row["attempt"]) + 1
            db.execute(
                """
                UPDATE cards SET status=?, attempt=?, prompt=?, error=NULL, updated_at=?
                WHERE card_id=?
                """,
                (CardStatus.GENERATING, attempt, prompt, utc_now(), card_id),
            )
            db.execute(
                """
                INSERT INTO attempts(card_id, attempt, prompt, prompt_hash, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (card_id, attempt, prompt, prompt_hash, CardStatus.GENERATING, utc_now()),
            )
        return attempt

    def generation_succeeded(
        self, card_id: str, attempt: int, asset_path: Path, provider: dict
    ) -> None:
        relative = str(asset_path.relative_to(self.workspace))
        with self.connect() as db:
            db.execute(
                "UPDATE cards SET status=?, updated_at=? WHERE card_id=?",
                (CardStatus.GENERATED, utc_now(), card_id),
            )
            db.execute(
                """
                UPDATE attempts SET asset_path=?, status=?, provider_json=?
                WHERE card_id=? AND attempt=?
                """,
                (relative, CardStatus.GENERATED, json.dumps(provider), card_id, attempt),
            )

    def generation_failed(self, card_id: str, attempt: int, error: str) -> None:
        with self.connect() as db:
            db.execute(
                "UPDATE cards SET status=?, error=?, updated_at=? WHERE card_id=?",
                (CardStatus.FAILED, error[:2000], utc_now(), card_id),
            )
            db.execute(
                """
                UPDATE attempts SET status=?, error=? WHERE card_id=? AND attempt=?
                """,
                (CardStatus.FAILED, error[:4000], card_id, attempt),
            )

    def save_review(
        self,
        card_id: str,
        attempt: int,
        review: ReviewResult,
        require_human: bool,
    ) -> CardStatus:
        if review.passed:
            status = CardStatus.NEEDS_HUMAN if require_human else CardStatus.APPROVED
            revision = ""
        else:
            status = CardStatus.NEEDS_REVISION
            revision = review.revision_instruction
        payload = {
            "passed": review.passed,
            "score": review.score,
            "issues": review.issues,
            "revision_instruction": revision,
            "reviewer": review.reviewer,
            "raw": review.raw,
        }
        with self.connect() as db:
            if status == CardStatus.APPROVED:
                asset = db.execute(
                    "SELECT asset_path FROM attempts WHERE card_id=? AND attempt=?",
                    (card_id, attempt),
                ).fetchone()
                db.execute(
                    """
                    UPDATE cards SET status=?, revision_instruction=?,
                    approved_asset=?, updated_at=? WHERE card_id=?
                    """,
                    (status, revision, asset["asset_path"], utc_now(), card_id),
                )
            else:
                db.execute(
                    """
                    UPDATE cards SET status=?, revision_instruction=?, updated_at=?
                    WHERE card_id=?
                    """,
                    (status, revision, utc_now(), card_id),
                )
            db.execute(
                """
                UPDATE attempts SET status=?, review_json=?
                WHERE card_id=? AND attempt=?
                """,
                (status, json.dumps(payload, ensure_ascii=False), card_id, attempt),
            )
        return status

    def approve(self, card_id: str, attempt: int | None = None) -> None:
        with self.connect() as db:
            if attempt is None:
                row = db.execute(
                    "SELECT attempt, asset_path FROM attempts WHERE card_id=? "
                    "AND asset_path IS NOT NULL ORDER BY attempt DESC LIMIT 1",
                    (card_id,),
                ).fetchone()
            else:
                row = db.execute(
                    "SELECT attempt, asset_path FROM attempts WHERE card_id=? AND attempt=?",
                    (card_id, attempt),
                ).fetchone()
            if row is None or not row["asset_path"]:
                raise ValueError(f"No generated asset found for {card_id}")
            db.execute(
                """
                UPDATE cards SET status=?, approved_asset=?, updated_at=?
                WHERE card_id=?
                """,
                (CardStatus.APPROVED, row["asset_path"], utc_now(), card_id),
            )
            db.execute(
                "INSERT INTO events(card_id,event,payload_json,created_at) VALUES(?,?,?,?)",
                (
                    card_id,
                    "human_approved",
                    json.dumps({"attempt": row["attempt"]}),
                    utc_now(),
                ),
            )

    def reject(self, card_id: str, instruction: str) -> None:
        if not instruction.strip():
            raise ValueError("A targeted revision instruction is required")
        with self.connect() as db:
            db.execute(
                """
                UPDATE cards SET status=?, revision_instruction=?, updated_at=?
                WHERE card_id=?
                """,
                (CardStatus.NEEDS_REVISION, instruction.strip(), utc_now(), card_id),
            )

    def require_human(self, card_id: str, reason: str) -> None:
        with self.connect() as db:
            db.execute(
                "UPDATE cards SET status=?, error=?, updated_at=? WHERE card_id=?",
                (CardStatus.NEEDS_HUMAN, reason[:2000], utc_now(), card_id),
            )

    def status_counts(self) -> dict[str, int]:
        with self.connect() as db:
            rows = db.execute(
                "SELECT status, COUNT(*) AS count FROM cards GROUP BY status"
            )
            return {row["status"]: row["count"] for row in rows}

    def all_cards(self) -> list[dict]:
        with self.connect() as db:
            return [
                dict(row)
                for row in db.execute("SELECT * FROM cards ORDER BY card_id")
            ]

    def attempts_for(self, card_id: str) -> list[dict]:
        with self.connect() as db:
            rows = db.execute(
                "SELECT * FROM attempts WHERE card_id=? ORDER BY attempt", (card_id,)
            )
            return [dict(row) for row in rows]
