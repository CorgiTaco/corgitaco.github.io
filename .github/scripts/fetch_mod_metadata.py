#!/usr/bin/env python3
"""
Fetch mod metadata + download history from CurseForge and Modrinth.

Outputs:
  {OUTPUT_JSON}                                   — current mod snapshot (metadata + stats)
  {HISTORY_DIR}/curseforge/{cf_id}-curseforge.csv  — daily CurseForge download history per project
  {HISTORY_DIR}/modrinth/{mr_id}-modrinth.csv       — daily Modrinth download history per project
  {HISTORY_DIR}/totals.csv                        — daily cross-mod totals (overall + per platform)

History files are keyed by each platform's permanent project id (the numeric
CurseForge id, the Modrinth project id), so renaming a mod in the table or
changing its Modrinth slug never orphans its history. The mod's site id is its
table name, lowercased with non-alphanumerics collapsed to "-".
History is capped at 5 years; rows older than that are dropped on each run.
When a platform request fails, that project gets no history row for the day, but
its last known download count (and the mod's metadata from the previous
OUTPUT_JSON) is carried into totals.csv and OUTPUT_JSON so totals never dip.
If a CSV does not exist it is created fresh on the next run.

The tracked project table comes from PROJECTS_JSON. Each row ties a CurseForge
and/or Modrinth project together under one name:

    [{"name": "Block Swap", "modrinth_id": "f9kXyjJX", "curseforge_id": "468893"}, ...]

Either id may be left empty if the mod is not on that platform. A project id
listed on two rows, or two names that map to the same site id, stops the run.

Environment variables:
  CURSEFORGE_API_KEY   - CurseForge API key
  MODRINTH_TOKEN       - Modrinth token (optional; public projects work without it)
  PROJECTS_JSON        - Tracked project table   (default: data/mod_projects.json)
  OUTPUT_JSON          - Metadata output path    (default: data/mods.json)
  HISTORY_DIR          - History output dir      (default: data/history/mods)
"""

import csv
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

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

PLATFORM_HISTORY_FIELDS = ["date", "downloads"]
TOTALS_HISTORY_FIELDS   = ["date", "downloads_total", "downloads_cf", "downloads_mr"]

MAX_HISTORY_DAYS = 5 * 365


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


# ── CSV helpers ───────────────────────────────────────────────────────────────

def read_csv_rows(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: str, rows: list[dict], fieldnames: list[str]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def trim_old_rows(rows: list[dict], cutoff: str) -> list[dict]:
    """Drop any rows whose date is older than cutoff (YYYY-MM-DD)."""
    return [r for r in rows if r.get("date", "")[:10] >= cutoff]


def upsert_row(rows: list[dict], now: str, new_row: dict) -> list[dict]:
    idx = next((i for i, r in enumerate(rows) if r.get("date", "")[:10] == now[:10]), None)
    if idx is not None:
        rows[idx] = new_row
    else:
        rows.append(new_row)
    return rows


# ── History writers ───────────────────────────────────────────────────────────

def platform_history_path(history_dir: str, platform: str, project_id: str) -> str:
    return os.path.join(history_dir, platform, f"{project_id}-{platform}.csv")


def write_platform_history(path: str, downloads: int, now: str, cutoff: str) -> None:
    rows = trim_old_rows(read_csv_rows(path), cutoff)
    rows = upsert_row(rows, now, {"date": now, "downloads": downloads})
    write_csv(path, rows, PLATFORM_HISTORY_FIELDS)


def last_known_downloads(path: str) -> int | None:
    for row in reversed(read_csv_rows(path)):
        value = (row.get("downloads") or "").strip()
        if value.isdigit():
            return int(value)
    return None


def write_totals_history(mods: list[dict], now: str, history_dir: str, cutoff: str) -> None:
    path = os.path.join(history_dir, "totals.csv")
    rows = trim_old_rows(read_csv_rows(path), cutoff)
    rows = upsert_row(rows, now, {
        "date":            now,
        "downloads_total": sum(m["stats"]["downloads_total"] for m in mods),
        "downloads_cf":    sum(m["stats"]["downloads_cf"] for m in mods),
        "downloads_mr":    sum(m["stats"]["downloads_mr"] for m in mods),
    })
    write_csv(path, rows, TOTALS_HISTORY_FIELDS)


# ── Tracked project table ─────────────────────────────────────────────────────

def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("'", "")).strip("-")


def load_project_table(path: str) -> list[dict]:
    """Read the committed project table. Exits if it is missing, a project id is listed
    twice (its downloads would be counted twice), or two names map to the same site id."""
    if not os.path.exists(path):
        print(f"Error: project table {path} not found.", file=sys.stderr)
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    projects: list[dict] = []
    seen_slugs: dict[str, str] = {}
    seen_ids:   dict[tuple[str, str], str] = {}
    for entry in data:
        name = (entry.get("name") or "").strip()
        cf   = str(entry.get("curseforge_id") or "").strip()
        mr   = str(entry.get("modrinth_id") or "").strip()
        if not name:
            print(f"[table] entry without a name, skipping: {entry}", file=sys.stderr)
            continue
        if cf and not cf.isdigit():
            print(f"[table] bad curseforge_id for {name}: {cf!r}", file=sys.stderr)
            cf = ""
        if not cf and not mr:
            print(f"[table] {name} has no platform id, skipping", file=sys.stderr)
            continue
        for key in (("curseforge", cf), ("modrinth", mr)):
            if not key[1]:
                continue
            if key in seen_ids:
                print(f"Error: {key[0]} project {key[1]} is listed under both "
                      f"'{seen_ids[key]}' and '{name}'.", file=sys.stderr)
                sys.exit(1)
            seen_ids[key] = name
        slug = slugify(name)
        if slug in seen_slugs:
            print(f"Error: '{name}' and '{seen_slugs[slug]}' share site id '{slug}'.",
                  file=sys.stderr)
            sys.exit(1)
        seen_slugs[slug] = name
        projects.append({"name": name, "slug": slug, "curseforge_id": cf, "modrinth_id": mr})

    print(f"[table] {path}: {len(projects)} projects")
    return projects


# ── Main ──────────────────────────────────────────────────────────────────────

def load_previous_mods(path: str) -> list[dict]:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f).get("mods") or []
    except (OSError, ValueError):
        return []


def find_previous(previous: list[dict], project: dict) -> dict | None:
    cf, mr = project["curseforge_id"], project["modrinth_id"]
    for m in previous:
        if (cf and str(m.get("curseforge_id") or "") == cf) or (mr and m.get("modrinth_id") == mr):
            return m
    return None


def platform_downloads(fresh: dict | None, stat_key: str, history_path: str,
                       prev: dict | None, label: str, name: str) -> int:
    """Fresh count if the platform answered, else the last known one (history, then old snapshot)."""
    if fresh:
        return fresh["stats"][stat_key]
    value = last_known_downloads(history_path)
    if value is None:
        value = ((prev or {}).get("stats") or {}).get(stat_key) or 0
    print(f"[stale] {name}: {label} fetch failed, reusing last known count {value}", file=sys.stderr)
    return value


def fetch_project(project: dict, cf_api_key: str, mr_token: str | None) -> tuple[dict | None, dict | None]:
    cf_entry = mr_entry = None
    cf_id, mr_id = project["curseforge_id"], project["modrinth_id"]
    if cf_id:
        if not cf_api_key:
            print(f"[CF] skipping {cf_id} (no CURSEFORGE_API_KEY)", file=sys.stderr)
        else:
            try:
                data = fetch_cf_mod(cf_api_key, int(cf_id))
                if data:
                    print(f"[CF] {data.get('name')}")
                    cf_entry = cf_to_entry(data)
                else:
                    print(f"[CF] not found: {cf_id}", file=sys.stderr)
            except Exception as exc:
                print(f"[CF] error for {cf_id}: {exc}", file=sys.stderr)
    if mr_id:
        try:
            data = fetch_mr_project(mr_token, mr_id)
            if data:
                print(f"[MR] {data.get('title')}")
                mr_entry = mr_to_entry(data)
            else:
                print(f"[MR] not found: {mr_id}", file=sys.stderr)
        except Exception as exc:
            print(f"[MR] error for {mr_id}: {exc}", file=sys.stderr)
    return cf_entry, mr_entry


def main() -> None:
    cf_api_key  = os.environ.get("CURSEFORGE_API_KEY", "")
    mr_token    = os.environ.get("MODRINTH_TOKEN")
    output_json = os.environ.get("OUTPUT_JSON", "data/mods.json")
    history_dir = os.environ.get("HISTORY_DIR", "data/history/mods")
    projects    = load_project_table(os.environ.get("PROJECTS_JSON", "data/mod_projects.json"))

    now    = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=MAX_HISTORY_DAYS)).strftime("%Y-%m-%d")

    previous = load_previous_mods(output_json)
    stale_count = 0

    mods: list[dict] = []
    for project in projects:
        cf_entry, mr_entry = fetch_project(project, cf_api_key, mr_token)
        prev = find_previous(previous, project)
        if not cf_entry and not mr_entry and not prev:
            print(f"[skip] {project['name']}: no platform answered and no earlier data", file=sys.stderr)
            continue

        # Modrinth files use the API's project id, not the table value, which could be a renameable slug
        cf_hist = platform_history_path(history_dir, "curseforge", project["curseforge_id"]) if project["curseforge_id"] else None
        mr_id   = (mr_entry or prev or {}).get("modrinth_id") or project["modrinth_id"]
        mr_hist = platform_history_path(history_dir, "modrinth", mr_id) if project["modrinth_id"] else None

        cf_dl = platform_downloads(cf_entry, "downloads_cf", cf_hist, prev, "CurseForge", project["name"]) if cf_hist else 0
        mr_dl = platform_downloads(mr_entry, "downloads_mr", mr_hist, prev, "Modrinth",   project["name"]) if mr_hist else 0
        stale = (cf_hist and not cf_entry) or (mr_hist and not mr_entry)
        stale_count += bool(stale)

        if cf_entry and mr_entry:
            mod = merge(cf_entry, mr_entry)
            mod["modrinth_id"]  = mr_entry["modrinth_id"]
            mod["modrinth_url"] = mr_entry["modrinth_url"]
        elif stale and prev:
            mod = dict(prev)  # keep last good metadata rather than dropping the missing platform's links
        else:
            mod = cf_entry or mr_entry
        mod = {"id": project["slug"], **mod, "title": project["name"]}
        mod["stats"] = {"downloads_cf": cf_dl, "downloads_mr": mr_dl, "downloads_total": cf_dl + mr_dl}
        mods.append(mod)

        # Only platforms that answered get a row, so a failed fetch leaves a gap instead of a fake value
        if cf_entry:
            write_platform_history(cf_hist, cf_dl, now, cutoff)
        if mr_entry:
            write_platform_history(platform_history_path(history_dir, "modrinth", mr_entry["modrinth_id"]),
                                   mr_dl, now, cutoff)

    write_totals_history(mods, now, history_dir, cutoff)
    print(f"Wrote history -> {history_dir}/  (cutoff: {cutoff})")
    if stale_count:
        print(f"[stale] {stale_count} mod(s) used last known counts for a failed platform", file=sys.stderr)

    os.makedirs(os.path.dirname(output_json) or ".", exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump({"fetchedAt": now, "mods": mods}, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(mods)} mods -> {output_json}")


if __name__ == "__main__":
    main()
