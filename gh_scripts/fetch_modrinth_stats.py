#!/usr/bin/env python3
"""
Fetch download counts for one or more Modrinth projects, and append a
daily snapshot row to a separate CSV file per project.

Each project gets its own file at:
  {OUTPUT_DIR}/{project_id}.csv

with columns: date, downloads

If a row for today's date already exists in a project's file, it is
updated in place rather than duplicated (so re-running the same day
is safe).

Required environment variables:
  MODRINTH_PROJECTS   - Comma-separated list of project IDs or slugs
                         (e.g. "ziOp6EO8,NTi7d3Xc")

Optional environment variables:
  MODRINTH_TOKEN   - Personal access token. Not required for public
                      project data, but supported if you ever need
                      authenticated access (private projects, etc).
  OUTPUT_DIR        - Directory to write per-project CSVs into
                      (default: data/modrinth)
"""

import csv
import json
import os
import sys
from datetime import datetime, timezone

import requests

API_BASE = "https://api.modrinth.com/v2"
FIELDNAMES = ["date", "downloads"]
USER_AGENT = "CorgiTaco/corgitaco.github.io"


def get_projects(project_ids: list[str], token: str | None) -> list[dict]:
    headers = {"User-Agent": USER_AGENT}
    if token:
        headers["Authorization"] = token

    params = {"ids": json.dumps(project_ids)}

    resp = requests.get(f"{API_BASE}/projects", headers=headers, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def read_existing_rows(csv_path: str) -> list[dict]:
    if not os.path.exists(csv_path):
        return []

    with open(csv_path, "r", newline="") as f:
        first_line = f.readline()
        if not first_line.startswith("#"):
            # No comment line present; rewind so DictReader sees the header.
            f.seek(0)
        reader = csv.DictReader(f)
        return list(reader)


def write_rows(csv_path: str, rows: list[dict], project_name: str = ""):
    os.makedirs(os.path.dirname(csv_path) or ".", exist_ok=True)
    with open(csv_path, "w", newline="") as f:
        if project_name:
            f.write(f"# {project_name}\n")
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def upsert_daily_row(csv_path: str, today: str, downloads: int, project_name: str = "") -> dict:
    rows = read_existing_rows(csv_path)
    new_row = {"date": today, "downloads": downloads}

    existing_index = next(
        (i for i, r in enumerate(rows) if r.get("date") == today), None
    )
    if existing_index is not None:
        rows[existing_index] = new_row
    else:
        rows.append(new_row)

    write_rows(csv_path, rows, project_name)
    return new_row


def main():
    projects_env = os.environ.get("MODRINTH_PROJECTS")
    if not projects_env:
        print("Error: MODRINTH_PROJECTS must be set.", file=sys.stderr)
        sys.exit(1)

    project_ids = [p.strip() for p in projects_env.split(",") if p.strip()]
    token = os.environ.get("MODRINTH_TOKEN")  # optional
    output_dir = os.environ.get("OUTPUT_DIR", "data/modrinth")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    print(f"Fetching data for projects: {', '.join(project_ids)}")
    projects = get_projects(project_ids, token)

    by_id = {p["id"]: int(p.get("downloads", 0)) for p in projects}
    by_slug = {p.get("slug"): int(p.get("downloads", 0)) for p in projects}
    title_by_id = {p["id"]: p.get("title", "") for p in projects}
    title_by_slug = {p.get("slug"): p.get("title", "") for p in projects}

    for pid in project_ids:
        downloads = by_id.get(pid, by_slug.get(pid))
        if downloads is None:
            print(f"Warning: no data returned for '{pid}', skipping.", file=sys.stderr)
            continue

        project_name = title_by_id.get(pid, title_by_slug.get(pid, pid))
        csv_path = os.path.join(output_dir, f"{pid}.csv")
        new_row = upsert_daily_row(csv_path, today, downloads, project_name)
        print(f"[{pid}] wrote {new_row} -> {csv_path}")

    print("Done.")


if __name__ == "__main__":
    main()