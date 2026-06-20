#!/usr/bin/env python3
"""
Fetch mod metadata from CurseForge and/or Modrinth and write data/mods.json.

Reads data/mod_registry.json to discover which mods to fetch.  Each registry
entry may supply a CurseForge slug, a Modrinth project ID/slug, and an
optional GitHub URL.  When both platforms are present the data is merged
(CurseForge is primary; Modrinth fills in any gaps).

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
import sys
from datetime import datetime, timezone

import requests

CF_API_BASE = "https://api.curseforge.com"
MR_API_BASE = "https://api.modrinth.com/v2"
CF_GAME_ID  = 432   # Minecraft
USER_AGENT  = "CorgiTaco/corgitaco.github.io"


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


def cf_to_entry(mod: dict) -> dict:
    links = mod.get("links") or {}
    logo  = mod.get("logo")  or {}
    date  = (
        mod.get("dateReleased")
        or mod.get("dateCreated")
        or ""
    )
    return {
        "title":       mod.get("name", ""),
        "description": mod.get("summary", ""),
        "icon":        logo.get("thumbnailUrl", ""),
        "curseforge":  links.get("websiteUrl", ""),
        "modrinth":    "",
        "github":      links.get("sourceUrl") or "",
        "date":        date[:10],
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


def mr_to_entry(proj: dict) -> dict:
    slug = proj.get("slug") or proj.get("id", "")
    return {
        "title":       proj.get("title", ""),
        "description": proj.get("description", ""),
        "icon":        proj.get("icon_url") or "",
        "curseforge":  "",
        "modrinth":    f"https://modrinth.com/mod/{slug}",
        "github":      proj.get("source_url") or "",
        "date":        (proj.get("published") or "")[:10],
    }


# ── Merge ─────────────────────────────────────────────────────────────────────

def merge(base: dict, extra: dict) -> dict:
    """Fill empty string/None fields in base from extra."""
    merged = dict(base)
    for key, value in extra.items():
        if not merged.get(key) and value:
            merged[key] = value
    return merged


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    cf_api_key    = os.environ.get("CURSEFORGE_API_KEY", "")
    mr_token      = os.environ.get("MODRINTH_TOKEN")
    registry_path = os.environ.get("REGISTRY_PATH", "data/mod_registry.json")
    output_json   = os.environ.get("OUTPUT_JSON",   "data/mods.json")

    if not cf_api_key and not mr_token:
        # Allow the script to run if at least one API source is available.
        # Entries that need CF will be skipped; Modrinth-only entries still work.
        print("Warning: no API keys set — CF lookups will be skipped.", file=sys.stderr)

    with open(registry_path, encoding="utf-8") as f:
        registry = json.load(f)

    mods: list[dict] = []

    for entry in registry:
        cf_slug  = entry.get("curseforge")
        mr_id    = entry.get("modrinth")
        gh_url   = entry.get("github") or ""

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
            mod = mr_to_entry(mr_data)   # type: ignore[arg-type]

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
