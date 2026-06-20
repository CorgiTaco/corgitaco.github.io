#!/usr/bin/env python3
"""
Fetch total view count (and a few other aggregate stats) across all videos
in a YouTube playlist, and append a daily snapshot row to a CSV file.

Each row represents one day's totals: date, video count, total views,
total likes, total comments. If a row for today's date already exists,
it is updated in place rather than duplicated (so re-running the same
day is safe).

Required environment variables:
  YOUTUBE_API_KEY       - YouTube Data API v3 key
  YOUTUBE_PLAYLIST_ID   - ID of the playlist to aggregate
"""

import csv
import json
import os
import sys
from datetime import datetime, timezone

import requests

API_BASE = "https://www.googleapis.com/youtube/v3"
FIELDNAMES = ["date", "videoCount", "totalViews", "totalLikes", "totalComments"]
USER_AGENT = "CorgiTaco/corgitaco.github.io"
HEADERS = {"User-Agent": USER_AGENT}


def get_video_ids(api_key: str, playlist_id: str) -> list[str]:
    video_ids = []
    page_token = ""

    while True:
        params = {
            "part": "contentDetails",
            "maxResults": 50,
            "playlistId": playlist_id,
            "key": api_key,
        }
        if page_token:
            params["pageToken"] = page_token

        resp = requests.get(f"{API_BASE}/playlistItems", headers=HEADERS, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if "items" not in data:
            break

        video_ids.extend(
            item["contentDetails"]["videoId"]
            for item in data["items"]
            if "videoId" in item.get("contentDetails", {})
        )

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return video_ids


def get_video_details(api_key: str, video_ids: list[str]) -> list[dict]:
    details = []

    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        params = {
            "part": "snippet,statistics",
            "id": ",".join(batch),
            "key": api_key,
        }
        resp = requests.get(f"{API_BASE}/videos", headers=HEADERS, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        for item in data.get("items", []):
            snippet = item.get("snippet", {})
            stats = item.get("statistics", {})
            thumbs = snippet.get("thumbnails", {})
            thumbnail = (
                thumbs.get("medium", {}).get("url")
                or thumbs.get("high", {}).get("url")
                or thumbs.get("default", {}).get("url")
                or ""
            )
            details.append({
                "videoId": item["id"],
                "title": snippet.get("title", ""),
                "thumbnail": thumbnail,
                "viewCount": int(stats.get("viewCount", 0)),
                "likeCount": int(stats.get("likeCount", 0)) if "likeCount" in stats else 0,
                "commentCount": int(stats.get("commentCount", 0)) if "commentCount" in stats else 0,
            })

    return details


def write_statistics_json(json_path: str, playlist_id: str, videos: list[dict]):
    os.makedirs(os.path.dirname(json_path) or ".", exist_ok=True)
    payload = {
        "playlistId": playlist_id,
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "videoCount": len(videos),
        "totalViews": sum(v["viewCount"] for v in videos),
        "totalLikes": sum(v["likeCount"] for v in videos),
        "totalComments": sum(v["commentCount"] for v in videos),
        "videos": videos,
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote statistics.json -> {json_path}")


def read_existing_rows(csv_path: str) -> list[dict]:
    if not os.path.exists(csv_path):
        return []

    with open(csv_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader)


def write_rows(csv_path: str, rows: list[dict]):
    os.makedirs(os.path.dirname(csv_path) or ".", exist_ok=True)
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def main():
    api_key = os.environ.get("YOUTUBE_API_KEY")
    playlist_id = os.environ.get("YOUTUBE_PLAYLIST_ID")

    if not api_key or not playlist_id:
        print(
            "Error: YOUTUBE_API_KEY and YOUTUBE_PLAYLIST_ID must be set.",
            file=sys.stderr,
        )
        sys.exit(1)

    csv_path  = os.environ.get("OUTPUT_PATH", "data/youtube_stats.csv")
    json_path = os.environ.get("OUTPUT_JSON", "data/statistics.json")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    print(f"Fetching video IDs for playlist {playlist_id}...")
    video_ids = get_video_ids(api_key, playlist_id)
    print(f"Found {len(video_ids)} videos.")

    print("Fetching video details...")
    videos = get_video_details(api_key, video_ids)

    write_statistics_json(json_path, playlist_id, videos)

    new_row = {
        "date": now,
        "videoCount": len(videos),
        "totalViews": sum(v["viewCount"] for v in videos),
        "totalLikes": sum(v["likeCount"] for v in videos),
        "totalComments": sum(v["commentCount"] for v in videos),
    }

    rows = read_existing_rows(csv_path)

    existing_index = next(
        (i for i, r in enumerate(rows) if r.get("date", "")[:10] == now[:10]), None
    )
    if existing_index is not None:
        rows[existing_index] = new_row
        print(f"Updated existing row for {now[:10]}.")
    else:
        rows.append(new_row)
        print(f"Appended new row for {now[:10]}.")

    write_rows(csv_path, rows)

    print(f"Wrote {len(rows)} total rows to {csv_path}")
    print(f"Today's totals: {new_row}")


if __name__ == "__main__":
    main()