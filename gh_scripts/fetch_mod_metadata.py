#!/usr/bin/env python3
"""
Fetch mod metadata + download history from CurseForge and Modrinth.

Outputs:
  {OUTPUT_JSON}              — current mod snapshot (metadata + stats)
  {HISTORY_DIR}/{id}.csv    — daily download history per mod
  {HISTORY_DIR}/totals.csv  — daily cross-mod download totals

On first run, migrates legacy per-platform CSVs from LEGACY_CF_DIR and
LEGACY_MR_DIR into the unified history format (no data is lost).

Environment variables:
  CURSEFORGE_API_KEY   - CurseForge API key
  MODRINTH_TOKEN       - Modrinth token (optional; public projects work without it)
  CURSEFORGE_PROJECTS  - Comma-separated numeric CF mod IDs
  MODRINTH_PROJECTS    - Comma-separated MR project IDs or slugs
  OUTPUT_JSON          - Metadata output path    (default: data/mods.json)
  HISTORY_DIR          - History output dir      (default: data/history/mods)
  LEGACY_CF_DIR        - Old CF CSV dir          (default: data/curseforge)
  LEGACY_MR_DIR        - Old MR CSV dir          (default: data/modrinth)
"""

import csv
import json
import os
import re
import sys
from datetime import datetime, timezone

import requests

CF_API_BASE = "https://api.curseforge.com"
MR_API_BASE = "https://api.modrinth.com/v2"
CF_GAME_ID  = 432
USER_AGENT  = "CorgiTaco/corgitaco.github.io"

CF_LOADER_NAMES: dict[int, str | None] = {
    0: None, 1: "Forge", 2: "Cauldron", 3: "LiteLoader",
    4: "Fabric", 5: "Quilt", 6: "NeoForge",
}
MR_LOADER_DISPLAY: dict[str, str] = {
    "forge": "Forge", "fabric": "Fabric", "quilt": "Quilt",
    "neoforge": "NeoForge", "cauldron": "Cauldron", "liteloader": "LiteLoader",
    "modloader": "ModLoader", "bukkit": "Bukkit", "paper": "Paper",
    "purpur": "Purpur", "folia": "Folia",
}

_MC_RELEASE_RE = re.compile(r"^\d+\.\d+(\.\d+)?$")

MOD_HISTORY_FIELDS = ["date", "downloads_cf", "downloads_mr", "downloads_total"]


def is_release_version(v: str) -> bool:
    return bool(_MC_RELEASE_RE.match(v))


def mc_version_sort_key(v: str) -> tuple[int, ...]:
    try:
        return tuple(int(p) for p in v.split("."))
    except ValueError:
        return (0,)


# ── CurseForge ────────────────────────────────────────────────────────────────

def cf_headers(api_key: str) -> dict:
    return {"Accept": "application/json", "x-api-key": api_key}


def fetch_cf_mod(api_key: str, mod_id: int) -> dict | None:
    resp = requests.get(
        f"{CF_API_BASE}/v1/mods/{mod_id}",
        headers=cf_headers(api_key),
        timeout=30,
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json().get("data")


def _cf_loaders_and_versions(mod: dict) -> tuple[list[str], list[str]]:
    indexes = mod.get("latestFilesIndexes") or []
    loader_ids: set[int] = set()
    raw_versions: set[str] = set()
    for idx in indexes:
        loader_ids.add(idx.get("modLoader", 0))
        gv = idx.get("gameVersion", "")
        if gv and is_release_version(gv):
            raw_versions.add(gv)
    loaders = sorted(name for lid in loader_ids if (name := CF_LOADER_NAMES.get(lid)))
    versions = sorted(raw_versions, key=mc_version_sort_key, reverse=True)
    return loaders, versions


def cf_to_entry(mod: dict) -> dict:
    links  = mod.get("links") or {}
    logo   = mod.get("logo") or {}
    date   = mod.get("dateReleased") or mod.get("dateCreated") or ""
    loaders, game_versions = _cf_loaders_and_versions(mod)
    dl = int(mod.get("downloadCount") or 0)
    return {
        "id":             mod.get("slug", ""),
        "title":          mod.get("name", ""),
        "description":    mod.get("summary", ""),
        "icon":           logo.get("thumbnailUrl", ""),
        "curseforge_id":  mod.get("id"),
        "modrinth_id":    None,
        "curseforge_url": links.get("websiteUrl", ""),
        "modrinth_url":   "",
        "github_url":     links.get("sourceUrl") or "",
        "date":           date[:10],
        "loaders":        loaders,
        "game_versions":  game_versions,
        "stats": {
            "downloads_cf":    dl,
            "downloads_mr":    0,
            "downloads_total": dl,
        },
    }


# ── Modrinth ──────────────────────────────────────────────────────────────────

def mr_headers(token: str | None) -> dict:
    h = {"User-Agent": USER_AGENT}
    if token:
        h["Authorization"] = token
    return h


def fetch_mr_project(token: str | None, project_id: str) -> dict | None:
    resp = requests.get(
        f"{MR_API_BASE}/project/{project_id}",
        headers=mr_headers(token),
        timeout=30,
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def _mr_loaders_and_versions(proj: dict) -> tuple[list[str], list[str]]:
    raw_loaders = proj.get("loaders") or []
    loaders = sorted(MR_LOADER_DISPLAY.get(l.lower(), l.title()) for l in raw_loaders)
    raw_versions = proj.get("game_versions") or []
    versions = sorted(
        (v for v in raw_versions if is_release_version(v)),
        key=mc_version_sort_key,
        reverse=True,
    )
    return loaders, versions


def mr_to_entry(proj: dict) -> dict:
    slug  = proj.get("slug") or proj.get("id", "")
    mr_id = proj.get("id", "")
    loaders, game_versions = _mr_loaders_and_versions(proj)
    dl = int(proj.get("downloads") or 0)
    return {
        "id":             slug,
        "title":          proj.get("title", ""),
        "description":    proj.get("description", ""),
        "icon":           proj.get("icon_url") or "",
        "curseforge_id":  None,
        "modrinth_id":    mr_id,
        "curseforge_url": "",
        "modrinth_url":   f"https://modrinth.com/mod/{slug}",
        "github_url":     proj.get("source_url") or "",
        "date":           (proj.get("published") or "")[:10],
        "loaders":        loaders,
        "game_versions":  game_versions,
        "stats": {
            "downloads_cf":    0,
            "downloads_mr":    dl,
            "downloads_total": dl,
        },
    }


# ── Merge ─────────────────────────────────────────────────────────────────────

def merge(base: dict, extra: dict) -> dict:
    merged = dict(base)
    for key, value in extra.items():
        if key == "stats" and isinstance(value, dict) and isinstance(merged.get(key), dict):
            s = dict(merged[key])
            for sk, sv in value.items():
                s[sk] = s.get(sk, 0) + sv
            s["downloads_total"] = s["downloads_cf"] + s["downloads_mr"]
            merged[key] = s
        elif isinstance(value, list) and isinstance(merged.get(key), list):
            seen = set(merged[key])
            for item in value:
                if item not in seen:
                    merged[key].append(item)
                    seen.add(item)
        elif not merged.get(key) and value:
            merged[key] = value
    if merged.get("game_versions"):
        merged["game_versions"] = sorted(
            merged["game_versions"], key=mc_version_sort_key, reverse=True
        )
    return merged


def combine_by_title(cf_entries: list[dict], mr_entries: list[dict]) -> list[dict]:
    mr_by_title = {e["title"].lower(): e for e in mr_entries}
    matched: set[str] = set()
    result: list[dict] = []

    for cf in cf_entries:
        key = cf["title"].lower()
        mr  = mr_by_title.get(key)
        if mr:
            matched.add(key)
            combined = merge(cf, mr)
            combined["modrinth_id"]  = mr["modrinth_id"]
            combined["modrinth_url"] = mr["modrinth_url"] or combined.get("modrinth_url", "")
            print(f"[merge] {cf['title']}")
            result.append(combined)
        else:
            result.append(cf)

    for mr in mr_entries:
        if mr["title"].lower() not in matched:
            result.append(mr)

    return result


# ── History CSV helpers ───────────────────────────────────────────────────────

def read_csv_rows(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, newline="") as f:
        first = f.readline()
        if not first.startswith("#"):
            f.seek(0)
        return list(csv.DictReader(f))


def write_csv(path: str, rows: list[dict], fieldnames: list[str]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def upsert_row(rows: list[dict], now: str, new_row: dict) -> list[dict]:
    idx = next((i for i, r in enumerate(rows) if r.get("date", "")[:10] == now[:10]), None)
    if idx is not None:
        rows[idx] = new_row
    else:
        rows.append(new_row)
    return rows


# ── Legacy migration ──────────────────────────────────────────────────────────

def migrate_legacy_mod(cf_id: int | None, mr_id: str | None,
                       legacy_cf_dir: str, legacy_mr_dir: str) -> list[dict]:
    cf_rows: dict[str, int] = {}
    mr_rows: dict[str, int] = {}

    if cf_id is not None:
        for row in read_csv_rows(os.path.join(legacy_cf_dir, f"{cf_id}.csv")):
            cf_rows[row["date"][:10]] = int(row.get("downloads", 0))

    if mr_id is not None:
        for row in read_csv_rows(os.path.join(legacy_mr_dir, f"{mr_id}.csv")):
            mr_rows[row["date"][:10]] = int(row.get("downloads", 0))

    result = []
    for date in sorted(set(cf_rows) | set(mr_rows)):
        cf_dl = cf_rows.get(date, 0)
        mr_dl = mr_rows.get(date, 0)
        result.append({
            "date":            date,
            "downloads_cf":    cf_dl,
            "downloads_mr":    mr_dl,
            "downloads_total": cf_dl + mr_dl,
        })
    return result


def migrate_legacy_totals(legacy_cf_dir: str, legacy_mr_dir: str) -> list[dict]:
    cf_rows: dict[str, int] = {}
    mr_rows: dict[str, int] = {}

    for row in read_csv_rows(os.path.join(legacy_cf_dir, "project_totals.csv")):
        cf_rows[row["date"][:10]] = int(row.get("downloads", 0))

    for row in read_csv_rows(os.path.join(legacy_mr_dir, "project_totals.csv")):
        mr_rows[row["date"][:10]] = int(row.get("downloads", 0))

    result = []
    for date in sorted(set(cf_rows) | set(mr_rows)):
        result.append({
            "date":            date,
            "downloads_total": cf_rows.get(date, 0) + mr_rows.get(date, 0),
        })
    return result


# ── History writers ───────────────────────────────────────────────────────────

def write_mod_history(mod: dict, now: str, history_dir: str,
                      legacy_cf_dir: str, legacy_mr_dir: str) -> None:
    mod_id = mod.get("id", "")
    if not mod_id:
        return

    path = os.path.join(history_dir, f"{mod_id}.csv")

    if not os.path.exists(path):
        rows = migrate_legacy_mod(
            mod.get("curseforge_id"), mod.get("modrinth_id"),
            legacy_cf_dir, legacy_mr_dir,
        )
    else:
        rows = read_csv_rows(path)

    s = mod["stats"]
    rows = upsert_row(rows, now, {
        "date":            now,
        "downloads_cf":    s["downloads_cf"],
        "downloads_mr":    s["downloads_mr"],
        "downloads_total": s["downloads_total"],
    })
    write_csv(path, rows, MOD_HISTORY_FIELDS)


def write_totals_history(mods: list[dict], now: str, history_dir: str,
                         legacy_cf_dir: str, legacy_mr_dir: str) -> None:
    path = os.path.join(history_dir, "totals.csv")
    fieldnames = ["date", "downloads_total"]

    if not os.path.exists(path):
        rows = migrate_legacy_totals(legacy_cf_dir, legacy_mr_dir)
    else:
        rows = read_csv_rows(path)

    total = sum(m["stats"]["downloads_total"] for m in mods)
    rows = upsert_row(rows, now, {"date": now, "downloads_total": total})
    write_csv(path, rows, fieldnames)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    cf_api_key    = os.environ.get("CURSEFORGE_API_KEY", "")
    mr_token      = os.environ.get("MODRINTH_TOKEN")
    output_json   = os.environ.get("OUTPUT_JSON",   "data/mods.json")
    history_dir   = os.environ.get("HISTORY_DIR",   "data/history/mods")
    legacy_cf_dir = os.environ.get("LEGACY_CF_DIR", "data/curseforge")
    legacy_mr_dir = os.environ.get("LEGACY_MR_DIR", "data/modrinth")

    cf_ids = [int(s.strip()) for s in os.environ.get("CURSEFORGE_PROJECTS", "").split(",") if s.strip()]
    mr_ids = [s.strip()      for s in os.environ.get("MODRINTH_PROJECTS",   "").split(",") if s.strip()]

    if not cf_ids and not mr_ids:
        print("Error: CURSEFORGE_PROJECTS and/or MODRINTH_PROJECTS must be set.", file=sys.stderr)
        sys.exit(1)

    cf_entries: list[dict] = []
    mr_entries: list[dict] = []

    for mod_id in cf_ids:
        if not cf_api_key:
            print(f"[CF] skipping {mod_id} (no CURSEFORGE_API_KEY)", file=sys.stderr)
            continue
        try:
            data = fetch_cf_mod(cf_api_key, mod_id)
            if data:
                print(f"[CF] {data.get('name')}")
                cf_entries.append(cf_to_entry(data))
            else:
                print(f"[CF] not found: {mod_id}", file=sys.stderr)
        except Exception as exc:
            print(f"[CF] error for {mod_id}: {exc}", file=sys.stderr)

    for mr_id in mr_ids:
        try:
            data = fetch_mr_project(mr_token, mr_id)
            if data:
                print(f"[MR] {data.get('title')}")
                mr_entries.append(mr_to_entry(data))
            else:
                print(f"[MR] not found: {mr_id}", file=sys.stderr)
        except Exception as exc:
            print(f"[MR] error for {mr_id}: {exc}", file=sys.stderr)

    mods = combine_by_title(cf_entries, mr_entries)
    now  = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    os.makedirs(history_dir, exist_ok=True)
    for mod in mods:
        write_mod_history(mod, now, history_dir, legacy_cf_dir, legacy_mr_dir)
    write_totals_history(mods, now, history_dir, legacy_cf_dir, legacy_mr_dir)
    print(f"Wrote history -> {history_dir}/")

    os.makedirs(os.path.dirname(output_json) or ".", exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump({"fetchedAt": now, "mods": mods}, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(mods)} mods -> {output_json}")


if __name__ == "__main__":
    main()