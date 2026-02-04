"""CLI entry point for the GSC module.

Usage:
    python -m gsc reports [--report TYPE] [--days N]
    python -m gsc feedback [--days N]
    python -m gsc autofix [--dry-run] [--fix NAME]
    python -m gsc optimizer [--dry-run] [--strategy NAME]
    python -m gsc weekly-report [--days N]
    python -m gsc auto-pr

For backwards compatibility, running without a subcommand falls back to
the original reports behaviour.
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import date
from pathlib import Path


def cmd_reports(args):
    """Run the GSC reports generator."""
    from .reports import main
    # Re-inject the correct sys.argv for the reports parser
    argv = []
    if hasattr(args, "report") and args.report:
        argv.extend(["--report", args.report])
    if hasattr(args, "days") and args.days:
        argv.extend(["--days", str(args.days)])
    sys.argv = ["gsc.reports"] + argv
    main()


def cmd_feedback(args):
    """Run the feedback report."""
    from .client import GSCClient
    from .feedback import generate_feedback_report
    client = GSCClient()
    generate_feedback_report(client, args.days)
    print("Done.")


def cmd_autofix(args):
    """Run the autofix engine."""
    from .autofix import main
    argv = []
    if args.dry_run:
        argv.append("--dry-run")
    if hasattr(args, "fix") and args.fix:
        argv.extend(["--fix", args.fix])
    sys.argv = ["gsc.autofix"] + argv
    main()


def cmd_optimizer(args):
    """Run the site-wide optimizer."""
    from .optimizer import main
    argv = []
    if args.dry_run:
        argv.append("--dry-run")
    if hasattr(args, "strategy") and args.strategy:
        argv.extend(["--strategy", args.strategy])
    sys.argv = ["gsc.optimizer"] + argv
    main()


def cmd_weekly_report(args):
    """Generate the weekly GSC report with bounded recommendations."""
    from .client import GSCClient
    from .weekly_report import generate_weekly_report
    client = GSCClient()
    generate_weekly_report(client, days=args.days)
    print("Done.")


def cmd_auto_pr(args):
    """Apply edits from the weekly report and open a pull request."""
    from .weekly_report import apply_auto_pr_edits, build_pr_body

    output_dir = Path("output/gsc-reports")
    report_path = output_dir / "weekly_latest.json"

    # 1. Apply page edits
    edit_summary = apply_auto_pr_edits(report_path)

    if not edit_summary.get("edits"):
        print("No edits were applied. Skipping PR creation.")
        return

    # Load report data for PR body
    report_data = None
    if report_path.exists():
        try:
            report_data = json.loads(report_path.read_text())
        except (json.JSONDecodeError, OSError):
            pass

    # 2. Create branch
    branch_name = f"seo/gsc-week-{date.today().isoformat()}"
    print(f"\n  Creating branch: {branch_name}")
    _run_git(["checkout", "-b", branch_name])

    # 3. Stage and commit changes
    # Collect all modified files
    changed_files = [e["file"] for e in edit_summary.get("edits", []) if e.get("file")]
    # Also include the edit log and weekly report
    for extra in [
        str(output_dir / f"auto_pr_{date.today().isoformat()}.json"),
        str(output_dir / f"weekly_{date.today().isoformat()}.json"),
        str(output_dir / "weekly_latest.json"),
        str(output_dir / f"{date.today().isoformat()}.md"),
    ]:
        if Path(extra).exists():
            changed_files.append(extra)

    if changed_files:
        _run_git(["add"] + changed_files)

    # Verify there are staged changes
    result = _run_git(["diff", "--staged", "--quiet"], check=False)
    if result.returncode == 0:
        print("  No staged changes. Skipping commit and PR.")
        _run_git(["checkout", "-"], check=False)
        return

    commit_msg = f"seo: weekly GSC improvements ({date.today().isoformat()})"
    _run_git(["commit", "-m", commit_msg])

    # 4. Push branch
    print(f"  Pushing branch {branch_name}...")
    _run_git(["push", "-u", "origin", branch_name])

    # 5. Open PR
    pr_body = build_pr_body(edit_summary, report_data)
    pr_title = f"SEO: Weekly GSC improvements ({date.today().isoformat()})"

    print(f"  Opening pull request...")
    pr_result = subprocess.run(
        [
            "gh", "pr", "create",
            "--title", pr_title,
            "--body", pr_body,
            "--base", _get_default_branch(),
        ],
        capture_output=True,
        text=True,
    )
    if pr_result.returncode == 0:
        print(f"  PR created: {pr_result.stdout.strip()}")
    else:
        print(f"  PR creation failed: {pr_result.stderr.strip()}")
        # Still successful if edits were applied and committed
        print("  Changes are committed on the branch. Create PR manually if needed.")


def _run_git(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a git command."""
    full_cmd = ["git"] + cmd
    return subprocess.run(full_cmd, capture_output=True, text=True, check=check)


def _get_default_branch() -> str:
    """Detect the default branch (main or master)."""
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "origin/HEAD"],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        # e.g. "origin/main" -> "main"
        return result.stdout.strip().replace("origin/", "")

    # Fallback: check if main exists
    result = subprocess.run(
        ["git", "branch", "-l", "main"],
        capture_output=True, text=True,
    )
    if "main" in result.stdout:
        return "main"
    return "master"


def main():
    parser = argparse.ArgumentParser(
        prog="python -m gsc",
        description="Google Search Console tools for tdrealtyohio.com",
    )
    subparsers = parser.add_subparsers(dest="command", help="Subcommand to run")

    # --- reports ---
    p_reports = subparsers.add_parser("reports", help="Generate GSC reports")
    p_reports.add_argument(
        "--report",
        choices=["performance", "indexing", "sitemap", "all"],
        default="all",
    )
    p_reports.add_argument("--days", type=int, default=28)
    p_reports.set_defaults(func=cmd_reports)

    # --- feedback ---
    p_feedback = subparsers.add_parser("feedback", help="Generate feedback report")
    p_feedback.add_argument("--days", type=int, default=28)
    p_feedback.set_defaults(func=cmd_feedback)

    # --- autofix ---
    p_autofix = subparsers.add_parser("autofix", help="Apply automatic SEO fixes")
    p_autofix.add_argument("--dry-run", action="store_true")
    p_autofix.add_argument(
        "--fix",
        choices=["schema", "crosslinks", "blog_links", "lastmod",
                 "alt_text", "internal_links", "area_faqs", "all"],
        default="all",
    )
    p_autofix.set_defaults(func=cmd_autofix)

    # --- optimizer ---
    p_optimizer = subparsers.add_parser("optimizer", help="Run site-wide optimizer")
    p_optimizer.add_argument("--dry-run", action="store_true")
    p_optimizer.add_argument(
        "--strategy",
        choices=["titles", "thin_content", "structured_data", "faq_schema",
                 "canonical", "linking", "keywords", "landing", "all"],
        default="all",
    )
    p_optimizer.set_defaults(func=cmd_optimizer)

    # --- weekly-report ---
    p_weekly = subparsers.add_parser(
        "weekly-report",
        help="Generate weekly GSC report with bounded recommendations",
    )
    p_weekly.add_argument("--days", type=int, default=28)
    p_weekly.set_defaults(func=cmd_weekly_report)

    # --- auto-pr ---
    p_auto_pr = subparsers.add_parser(
        "auto-pr",
        help="Apply weekly report edits and open a pull request",
    )
    p_auto_pr.set_defaults(func=cmd_auto_pr)

    args = parser.parse_args()

    if args.command is None:
        # Backwards compatibility: no subcommand -> run reports
        from .reports import main as reports_main
        reports_main()
    else:
        args.func(args)


main()
