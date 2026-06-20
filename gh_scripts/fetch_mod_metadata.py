#!/usr/bin/env python3
"""
Fetch mod metadata from CurseForge and/or Modrinth and write data/mods.json.

Reads data/mod_registry.json to discover which mods to fetch.  Each registry
entry may supply a CurseForge slug, a Modrinth project ID/slug, and an
optional GitHub URL.  When both platforms are present the data is merged
(CurseForge is primary; Modrinth fills in any gaps, including supported
game versions and mod loaders).

Required environment variables (at least one API key must be set):
  CURSEFORGE_API_KEY   - CurseForge API key
  MODRINTH_TOKEN       - Modrinth personal access token (optional; public
                         projects work without it)

Optional environment variables:
  REGISTRY_PATH        - Path to mod_registry.json (default: data/mod_registry.json)
  OUTPUT_JSON          - Output path              (default: data/mods.json)
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

# CurseForge modLoader enum -> display name (None = skip "Any")
CF_LOADER_NAMES: dict[int, str | None] = {
    0: None,
    1: "Forge",
    2: "Cauldron",
    3: "LiteLoader",
    4: "Fabric",
    5: "Quilt",
    6: "NeoForge",
}

# Modrinth loader slug -> display name
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

# Only keep proper release versions like "1.20.1" or "1.21"; skip snapshots.
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


# ── Merge ─────────────────────────────────────────────────────────────────────

def merge(base: dict, extra: dict) -> dict:
    """Fill empty fields of base from extra; union list fields."""
    merged = dict(base)
    for key, value in extra.items():
        if isinstance(value, list) and isinstance(merged.get(key), list):
            seen = set(merged[key])
            for item in value:
                if item not in seen:
                    merged[key].append(item)
                    seen.add(item)
        elif not merged.get(key) and value:
            merged[key] = value
    # Re-sort versions after merging so newest is always first.
    if merged.get("game_versions"):
        merged["game_versions"] = sorted(
            merged["game_versions"], key=mc_version_sort_key, reverse=True
        )
    return merged


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    cf_api_key    = os.environ.get("CURSEFORGE_API_KEY", "")
    mr_token      = os.environ.get("MODRINTH_TOKEN")
    registry_path = os.environ.get("REGISTRY_PATH", "data/mod_registry.json")
    output_json   = os.environ.get("OUTPUT_JSON",   "data/mods.json")

    if not cf_api_key and not mr_token:
        print("Warning: no API keys set — CF lookups will be skipped.", file=sys.stderr)

    with open(registry_path, encoding="utf-8") as f:
        registry = json.load(f)

    mods: list[dict] = []

    for entry in registry:
        cf_slug = entry.get("curseforge")
        mr_id   = entry.get("modrinth")
        gh_url  = entry.get("github") or ""

        cf_data: dict | None = None
        mr_data: dict | None = None

        if cf_slug:
            if cf_api_key:
                try:
                    cf_data = fetch_cf_mod_by_slug(cf_api_key, cf_slug)
                    if cf_data:
                        print(f"[CF] {cf_data.get('name')}")
                    else:
                        print(f"[CF] not found: {cf_slug}", file=sys.stderr)
                except Exception as exc:
                    print(f"[CF] error for {cf_slug}: {exc}", file=sys.stderr)
            else:
                print(f"[CF] skipping {cf_slug} (no CURSEFORGE_API_KEY)", file=sys.stderr)

        if mr_id:
            try:
                mr_data = fetch_mr_project(mr_token, mr_id)
                if mr_data:
                    print(f"[MR] {mr_data.get('title')}")
                else:
                    print(f"[MR] not found: {mr_id}", file=sys.stderr)
            except Exception as exc:
                print(f"[MR] error for {mr_id}: {exc}", file=sys.stderr)

        if cf_data is None and mr_data is None:
            print(f"Warning: no data fetched for {entry}, skipping.", file=sys.stderr)
            continue

        if cf_data and mr_data:
            mod = merge(cf_to_entry(cf_data), mr_to_entry(mr_data))
        elif cf_data:
            mod = cf_to_entry(cf_data)
        else:
            mod = mr_to_entry(mr_data)  # type: ignore[arg-type]

        # Registry-level github overrides anything the API returned.
        if gh_url:
            mod["github"] = gh_url

        # Ensure modrinth URL is set when an mr_id is given but CF was primary.
        if mr_id and not mod.get("modrinth"):
            mod["modrinth"] = f"https://modrinth.com/mod/{mr_id}"

        mods.append(mod)

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
