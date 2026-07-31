from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import ProviderConfig, load_dotenv, load_project
from .orchestrator import Orchestrator
from .reporting import write_audit, write_contact_sheet
from .rendering import render_cards
from .store import Store
from .templates import write_template


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        prog="cardpipe",
        description="Generate a visually consistent card deck with a resumable agent pipeline.",
    )
    root.add_argument(
        "--project",
        type=Path,
        default=Path("project.json"),
        help="Project JSON path (default: project.json)",
    )
    commands = root.add_subparsers(dest="command", required=True)

    init = commands.add_parser("init", help="Create an isolated 54-card starter project")
    init.add_argument("directory", type=Path)
    init.add_argument("--force", action="store_true")

    run = commands.add_parser("run", help="Run generation, QA, and targeted revisions")
    run.add_argument("--card", action="append", default=[], help="Only this card ID")
    run.add_argument("--limit", type=int, help="Maximum API generation calls this run")
    run.add_argument("--dry-run", action="store_true", help="Print prompts without API calls")

    commands.add_parser("status", help="Show state-machine status for every card")

    approve = commands.add_parser("approve", help="Approve a generated card version")
    approve.add_argument("card_id")
    approve.add_argument("--attempt", type=int)

    reject = commands.add_parser("reject", help="Request one targeted revision")
    reject.add_argument("card_id")
    reject.add_argument("instruction")

    audit = commands.add_parser("audit", help="Export full reproducibility history")
    audit.add_argument("--output", type=Path)

    sheet = commands.add_parser("contact-sheet", help="Build a visual QA contact sheet")
    sheet.add_argument("--output", type=Path)

    render = commands.add_parser("render", help="Render deterministic final card frames")
    render.add_argument("--card", action="append", default=[], help="Only this card ID")
    render.add_argument("--output-dir", type=Path)
    render.add_argument(
        "--latest",
        action="store_true",
        help="Allow the latest generated version before human approval",
    )
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "init":
            write_template(args.directory.resolve(), args.force)
            print(f"Created 54-card project in {args.directory.resolve()}")
            return 0

        project_path = args.project.resolve()
        load_dotenv(project_path.parent / ".env")
        project = load_project(project_path)
        store = Store(project.workspace)
        store.sync_cards(project.cards)

        if args.command == "run":
            config = ProviderConfig.from_environment(
                project.raw, require_key=not args.dry_run
            )
            orchestrator = Orchestrator(project, config, dry_run=args.dry_run)
            counts = orchestrator.run(set(args.card) or None, args.limit)
            print(json.dumps(counts, sort_keys=True))
            return 0
        if args.command == "status":
            print(f"{'CARD':<22} {'STATUS':<18} {'TRY':>3}  NAME")
            for row in store.all_cards():
                print(
                    f"{row['card_id']:<22} {row['status']:<18} "
                    f"{row['attempt']:>3}  {row['name']}"
                )
            print(json.dumps(store.status_counts(), sort_keys=True))
            return 0
        if args.command == "approve":
            store.approve(args.card_id, args.attempt)
            print(f"Approved {args.card_id}")
            return 0
        if args.command == "reject":
            store.reject(args.card_id, args.instruction)
            print(f"Queued targeted revision for {args.card_id}")
            return 0
        if args.command == "audit":
            output = args.output or project.workspace / "audit.json"
            write_audit(project, store, output.resolve())
            print(f"Wrote audit report to {output.resolve()}")
            return 0
        if args.command == "contact-sheet":
            output = args.output or project.workspace / "contact-sheet.jpg"
            count = write_contact_sheet(project, store, output.resolve())
            print(f"Wrote {count}-image contact sheet to {output.resolve()}")
            return 0
        if args.command == "render":
            output = args.output_dir or project.workspace / "rendered"
            paths = render_cards(
                project,
                store,
                output.resolve(),
                set(args.card) or None,
                allow_unapproved=args.latest,
            )
            if not paths:
                raise ValueError(
                    "No eligible assets; approve cards first or pass --latest for previews"
                )
            print(f"Rendered {len(paths)} final cards to {output.resolve()}")
            return 0
    except (ValueError, FileNotFoundError, FileExistsError, KeyError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
