#!/usr/bin/env python3
"""
Fetch mod metadata from CurseForge and/or Modrinth and write data/mods.json.

Reads project IDs from environment variables (same pattern as fetch_modrinth_stats.py
and fetch_curseforge_stats.py) instead of a registry file.

Required environment variables (at least one must be set):
  CURSEFORGE_API_KEY   - CurseForge API key
  MODRINTH_TOKEN       - Modrinth personal access token (optional; public
                         projects work without it)

Optional environment variables:
  CURSEFORGE_PROJECTS  - Comma-separated CurseForge slugs (e.g. "corgilib,enhanced-celestials")
  MODRINTH_PROJECTS    - Comma-separated Modrinth project IDs or slugs
  OUTPUT_JSON          - Output path (default: data/mods.json)
"""

import json
import os
import re
import sys
from datetime import datetime, timezone

import requests

CF_API_BASE = "https://api.curseforge.com"
MR_API_BASE = "https://api.modrinth.com/v2"
CF_GAME_ID  = 432   # Minecraft
USER_AGENT  = "CorgiTaco/corgitaco.github.io"

CF_LOADER_NAMES: dict[int, str | None] = {
    0: None,
    1: "Forge",
    2: "Cauldron",
    3: "LiteLoader",
    4: "Fabric",
    5: "Quilt",
    6: "NeoForge",
}

MR_LOADER_DISPLAY: dict[str, str] = {
    "forge":       "Forge",
    "fabric":      "Fabric",
    "quilt":       "Quilt",
    "neoforge":    "NeoForge",
    "cauldron":    "Cauldron",
    "liteloader":  "LiteLoader",
    "modloader":   "ModLoader",
    "bukkit":      "Bukkit",
    "paper":       "Paper",
    "purpur":      "Purpur",
    "folia":       "Folia",
}

_MC_RELEASE_RE = re.compile(r"^\d+\.\d+(\.\d+)?$")


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


def fetch_cf_mod_by_slug(api_key: str, slug: str) -> dict | None:
    params = {"gameId": CF_GAME_ID, "slug": slug, "pageSize": 10}
    resp = requests.get(
        f"{CF_API_BASE}/v1/mods/search",
        headers=cf_headers(api_key),
        params=params,
        timeout=30,
    )
    resp.raise_for_status()
    items = resp.json().get("data", [])
    for item in items:
        if item.get("slug") == slug:
            return item
    return items[0] if items else None


def _cf_loaders_and_versions(mod: dict) -> tuple[list[str], list[str]]:
    indexes = mod.get("latestFilesIndexes") or []
    loader_ids: set[int] = set()
    raw_versions: set[str] = set()
    for idx in indexes:
        loader_ids.add(idx.get("modLoader", 0))
        gv = idx.get("gameVersion", "")
        if gv and is_release_version(gv):
            raw_versions.add(gv)
    loaders = sorted(
        name for lid in loader_ids if (name := CF_LOADER_NAMES.get(lid))
    )
    versions = sorted(raw_versions, key=mc_version_sort_key, reverse=True)
    return loaders, versions


def cf_to_entry(mod: dict) -> dict:
    links   = mod.get("links") or {}
    logo    = mod.get("logo")  or {}
    date    = mod.get("dateReleased") or mod.get("dateCreated") or ""
    loaders, game_versions = _cf_loaders_and_versions(mod)
    return {
        "title":         mod.get("name", ""),
        "description":   mod.get("summary", ""),
        "icon":          logo.get("thumbnailUrl", ""),
        "curseforge":    links.get("websiteUrl", ""),
        "modrinth":      "",
        "github":        links.get("sourceUrl") or "",
        "date":          date[:10],
        "loaders":       loaders,
        "game_versions": game_versions,
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
    loaders = sorted(
        MR_LOADER_DISPLAY.get(l.lower(), l.title()) for l in raw_loaders
    )
    raw_versions = proj.get("game_versions") or []
    versions = sorted(
        (v for v in raw_versions if is_release_version(v)),
        key=mc_version_sort_key,
        reverse=True,
    )
    return loaders, versions


def mr_to_entry(proj: dict) -> dict:
    slug = proj.get("slug") or proj.get("id", "")
    loaders, game_versions = _mr_loaders_and_versions(proj)
    return {
        "title":         proj.get("title", ""),
        "description":   proj.get("description", ""),
        "icon":          proj.get("icon_url") or "",
        "curseforge":    "",
        "modrinth":      f"https://modrinth.com/mod/{slug}",
        "github":        proj.get("source_url") or "",
        "date":          (proj.get("published") or "")[:10],
        "loaders":       loaders,
        "game_versions": game_versions,
    }


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    cf_api_key  = os.environ.get("CURSEFORGE_API_KEY", "")
    mr_token    = os.environ.get("MODRINTH_TOKEN")
    output_json = os.environ.get("OUTPUT_JSON", "data/mods.json")

    cf_slugs_env = os.environ.get("CURSEFORGE_PROJECTS", "")
    mr_ids_env   = os.environ.get("MODRINTH_PROJECTS", "")

    cf_slugs = [s.strip() for s in cf_slugs_env.split(",") if s.strip()]
    mr_ids   = [s.strip() for s in mr_ids_env.split(",")   if s.strip()]

    if not cf_slugs and not mr_ids:
        print("Error: CURSEFORGE_PROJECTS and/or MODRINTH_PROJECTS must be set.", file=sys.stderr)
        sys.exit(1)

    mods: list[dict] = []

    for slug in cf_slugs:
        if not cf_api_key:
            print(f"[CF] skipping {slug} (no CURSEFORGE_API_KEY)", file=sys.stderr)
            continue
        try:
            cf_data = fetch_cf_mod_by_slug(cf_api_key, slug)
            if cf_data:
                print(f"[CF] {cf_data.get('name')}")
                mods.append(cf_to_entry(cf_data))
            else:
                print(f"[CF] not found: {slug}", file=sys.stderr)
        except Exception as exc:
            print(f"[CF] error for {slug}: {exc}", file=sys.stderr)

    for mr_id in mr_ids:
        try:
            mr_data = fetch_mr_project(mr_token, mr_id)
            if mr_data:
                print(f"[MR] {mr_data.get('title')}")
                mods.append(mr_to_entry(mr_data))
            else:
                print(f"[MR] not found: {mr_id}", file=sys.stderr)
        except Exception as exc:
            print(f"[MR] error for {mr_id}: {exc}", file=sys.stderr)

    os.makedirs(os.path.dirname(output_json) or ".", exist_ok=True)
    payload = {
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mods": mods,
    }
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(mods)} mods -> {output_json}")


if __name__ == "__main__":
    main()