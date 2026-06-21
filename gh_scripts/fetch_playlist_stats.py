#!/usr/bin/env python3
"""
Fetch YouTube playlist stats. Writes:
  {OUTPUT_JSON}                          — current snapshot per video + totals
  {HISTORY_DIR}/totals.csv              — daily playlist-level history
  {HISTORY_DIR}/videos/{video_id}.csv  — daily per-video history

On first run, migrates legacy playlist totals from LEGACY_CSV.

statistics.json schema:
  {
    "playlistId": "...",
    "fetchedAt": "...",
    "totals": { "video_count": N, "views": N, "likes": N, "comments": N },
    "videos": [
      {
        "id": "...",
        "title": "...",
        "channel": "...",
        "thumbnail": "...",
        "stats": { "views": N, "likes": N, "comments": N }
      }
    ]
  }

Environment variables:
  YOUTUBE_API_KEY      - YouTube Data API v3 key
  YOUTUBE_PLAYLIST_ID  - Playlist ID
  OUTPUT_JSON          - Output path      (default: data/statistics.json)
  HISTORY_DIR          - History dir      (default: data/history/youtube)
  LEGACY_CSV           - Old totals CSV   (default: data/youtube_stats.csv)
"""

import csv
import json
import os
import sys
from datetime import datetime, timezone

import requests

API_BASE   = "https://www.googleapis.com/youtube/v3"
USER_AGENT = "CorgiTaco/corgitaco.github.io"
HEADERS    = {"User-Agent": USER_AGENT}

TOTALS_FIELDS = ["date", "video_count", "views", "likes", "comments"]
VIDEO_FIELDS  = ["date", "views", "likes", "comments"]


# ── YouTube API ───────────────────────────────────────────────────────────────

def get_video_ids(api_key: str, playlist_id: str) -> list[str]:
    ids = []
    page_token = ""
    while True:
        params = {"part": "contentDetails", "maxResults": 50,
                  "playlistId": playlist_id, "key": api_key}
        if page_token:
            params["pageToken"] = page_token
        resp = requests.get(f"{API_BASE}/playlistItems", headers=HEADERS, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        ids.extend(
            item["contentDetails"]["videoId"]
            for item in data.get("items", [])
            if "videoId" in item.get("contentDetails", {})
        )
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return ids


def get_video_details(api_key: str, video_ids: list[str]) -> list[dict]:
    details = []
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i + 50]
        params = {"part": "snippet,statistics", "id": ",".join(batch), "key": api_key}
        resp = requests.get(f"{API_BASE}/videos", headers=HEADERS, params=params, timeout=30)
        resp.raise_for_status()
        for item in resp.json().get("items", []):
            snippet = item.get("snippet", {})
            stats   = item.get("statistics", {})
            thumbs  = snippet.get("thumbnails", {})
            thumbnail = (
                thumbs.get("medium", {}).get("url")
                or thumbs.get("high", {}).get("url")
                or thumbs.get("default", {}).get("url")
                or ""
            )
            details.append({
                "id":        item["id"],
                "title":     snippet.get("title", ""),
                "channel":   snippet.get("channelTitle", ""),
                "thumbnail": thumbnail,
                "stats": {
                    "views":    int(stats.get("viewCount",   0)),
                    "likes":    int(stats.get("likeCount",   0)) if "likeCount"   in stats else 0,
                    "comments": int(stats.get("commentCount",0)) if "commentCount" in stats else 0,
                },
            })
    return details


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


def upsert_row(rows: list[dict], now: str, new_row: dict) -> list[dict]:
    idx = next((i for i, r in enumerate(rows) if r.get("date", "")[:10] == now[:10]), None)
    if idx is not None:
        rows[idx] = new_row
    else:
        rows.append(new_row)
    return rows


# ── Legacy migration ──────────────────────────────────────────────────────────

def migrate_legacy_totals(legacy_csv: str) -> list[dict]:
    result = []
    for row in read_csv_rows(legacy_csv):
        result.append({
            "date":        row.get("date", ""),
            "video_count": row.get("videoCount", 0),
            "views":       row.get("totalViews", 0),
            "likes":       row.get("totalLikes", 0),
            "comments":    row.get("totalComments", 0),
        })
    return result


# ── History writers ───────────────────────────────────────────────────────────

def write_video_history(video: dict, now: str, videos_dir: str) -> None:
    path = os.path.join(videos_dir, f"{video['id']}.csv")
    rows = read_csv_rows(path)
    s = video["stats"]
    rows = upsert_row(rows, now, {
        "date":     now,
        "views":    s["views"],
        "likes":    s["likes"],
        "comments": s["comments"],
    })
    write_csv(path, rows, VIDEO_FIELDS)


def write_totals_history(videos: list[dict], now: str, history_dir: str,
                         legacy_csv: str) -> None:
    path = os.path.join(history_dir, "totals.csv")

    if not os.path.exists(path):
        rows = migrate_legacy_totals(legacy_csv)
    else:
        rows = read_csv_rows(path)

    rows = upsert_row(rows, now, {
        "date":        now,
        "video_count": len(videos),
        "views":       sum(v["stats"]["views"]    for v in videos),
        "likes":       sum(v["stats"]["likes"]    for v in videos),
        "comments":    sum(v["stats"]["comments"] for v in videos),
    })
    write_csv(path, rows, TOTALS_FIELDS)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    api_key     = os.environ.get("YOUTUBE_API_KEY")
    playlist_id = os.environ.get("YOUTUBE_PLAYLIST_ID")
    if not api_key or not playlist_id:
        print("Error: YOUTUBE_API_KEY and YOUTUBE_PLAYLIST_ID must be set.", file=sys.stderr)
        sys.exit(1)

    output_json = os.environ.get("OUTPUT_JSON",  "data/statistics.json")
    history_dir = os.environ.get("HISTORY_DIR",  "data/history/youtube")
    legacy_csv  = os.environ.get("LEGACY_CSV",   "data/youtube_stats.csv")
    videos_dir  = os.path.join(history_dir, "videos")
    now         = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    print(f"Fetching video IDs for playlist {playlist_id}...")
    video_ids = get_video_ids(api_key, playlist_id)
    print(f"Found {len(video_ids)} videos. Fetching details...")
    videos = get_video_details(api_key, video_ids)

    os.makedirs(videos_dir, exist_ok=True)
    for video in videos:
        write_video_history(video, now, videos_dir)
    write_totals_history(videos, now, history_dir, legacy_csv)
    print(f"Wrote history -> {history_dir}/")

    totals = {
        "video_count": len(videos),
        "views":       sum(v["stats"]["views"]    for v in videos),
        "likes":       sum(v["stats"]["likes"]    for v in videos),
        "comments":    sum(v["stats"]["comments"] for v in videos),
    }
    payload = {
        "playlistId": playlist_id,
        "fetchedAt":  now,
        "totals":     totals,
        "videos":     videos,
    }
    os.makedirs(os.path.dirname(output_json) or ".", exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"Wrote statistics.json -> {output_json}")


if __name__ == "__main__":
    main()