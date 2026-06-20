#!/usr/bin/env python3
"""
Fetch download counts for one or more CurseForge mods and append a
daily snapshot row to a separate CSV file per mod.

Each mod gets its own file at:
  {OUTPUT_DIR}/{mod_id}.csv

with columns: date, downloads

If a row for today's date already exists in a mod's file, it is
updated in place rather than duplicated (so re-running the same day
is safe).

Required environment variables:
  CURSEFORGE_API_KEY  - CurseForge API key
  CURSEFORGE_MOD_IDS  - Comma-separated list of numeric mod IDs
                        (e.g. "247560,12345")

Optional environment variables:
  OUTPUT_DIR          - Directory to write per-mod CSVs into
                        (default: data/curseforge)
"""

import csv
import json
import os
import sys
from datetime import datetime, timezone

import requests

API_BASE = "https://api.curseforge.com"
FIELDNAMES = ["date", "downloads"]


def get_mod(api_key: str, mod_id: int) -> dict:
    headers = {
        "Accept": "application/json",
        "x-api-key": api_key,
    }
    resp = requests.get(f"{API_BASE}/v1/mods/{mod_id}", headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()["data"]


def read_existing_rows(csv_path: str) -> list[dict]:
    if not os.path.exists(csv_path):
        return []
    with open(csv_path, "r", newline="") as f:
        first_line = f.readline()
        if not first_line.startswith("#"):
            f.seek(0)
        reader = csv.DictReader(f)
        return list(reader)


def write_rows(csv_path: str, rows: list[dict], mod_name: str = "") -> None:
    os.makedirs(os.path.dirname(csv_path) or ".", exist_ok=True)
    with open(csv_path, "w", newline="") as f:
        if mod_name:
            f.write(f"# {mod_name}\n")
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def upsert_daily_row(csv_path: str, now: str, downloads: int, mod_name: str = "") -> dict:
    rows = read_existing_rows(csv_path)
    new_row = {"date": now, "downloads": downloads}

    existing_index = next(
        (i for i, r in enumerate(rows) if r.get("date", "")[:10] == now[:10]), None
    )
    if existing_index is not None:
        rows[existing_index] = new_row
    else:
        rows.append(new_row)

    write_rows(csv_path, rows, mod_name)
    return new_row


def write_mod_ids_json(output_dir: str, mod_ids: list[int]) -> None:
    os.makedirs(output_dir, exist_ok=True)
    json_path = os.path.join(output_dir, "mod_ids.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(mod_ids, f, indent=2)
    print(f"Wrote {len(mod_ids)} mod IDs -> {json_path}")


def main() -> None:
    api_key = os.environ.get("CURSEFORGE_API_KEY")
    if not api_key:
        print("Error: CURSEFORGE_API_KEY must be set.", file=sys.stderr)
        sys.exit(1)

    mod_ids_env = os.environ.get("CURSEFORGE_MOD_IDS")
    if not mod_ids_env:
        print("Error: CURSEFORGE_MOD_IDS must be set.", file=sys.stderr)
        sys.exit(1)

    try:
        mod_ids = [int(x.strip()) for x in mod_ids_env.split(",") if x.strip()]
    except ValueError as exc:
        print(f"Error: CURSEFORGE_MOD_IDS must be comma-separated integers: {exc}", file=sys.stderr)
        sys.exit(1)

    output_dir = os.environ.get("OUTPUT_DIR", "data/curseforge")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    print(f"Fetching CurseForge data for mod IDs: {mod_ids}")
    write_mod_ids_json(output_dir, mod_ids)

    total_downloads = 0
    for mod_id in mod_ids:
        try:
            mod = get_mod(api_key, mod_id)
        except requests.HTTPError as exc:
            print(f"Warning: failed to fetch mod {mod_id}: {exc}", file=sys.stderr)
            continue

        downloads = int(mod.get("downloadCount", 0))
        mod_name = mod.get("name", str(mod_id))
        total_downloads += downloads

        csv_path = os.path.join(output_dir, f"{mod_id}.csv")
        new_row = upsert_daily_row(csv_path, now, downloads, mod_name)
        print(f"[{mod_id}] {mod_name}: wrote {new_row} -> {csv_path}")

    totals_path = os.path.join(output_dir, "mod_totals.csv")
    totals_row = upsert_daily_row(totals_path, now, total_downloads)
    print(f"[totals] wrote {totals_row} -> {totals_path}")

    print("Done.")


if __name__ == "__main__":
    main()
