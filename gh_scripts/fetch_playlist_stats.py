#!/usr/bin/env python3
"""
Fetch total view count (and a few other aggregate stats) across all videos
in a YouTube playlist, and write the result to a JSON file.

Required environment variables:
  YOUTUBE_API_KEY       - YouTube Data API v3 key
  YOUTUBE_PLAYLIST_ID   - ID of the playlist to aggregate
"""

import json
import os
import sys
from datetime import datetime, timezone

import requests

API_BASE = "https://www.googleapis.com/youtube/v3"


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

        resp = requests.get(f"{API_BASE}/playlistItems", params=params, timeout=30)
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


def get_video_stats(api_key: str, video_ids: list[str]) -> list[dict]:
    stats = []

    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        params = {
            "part": "statistics,snippet",
            "id": ",".join(batch),
            "key": api_key,
        }
        resp = requests.get(f"{API_BASE}/videos", params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        for item in data.get("items", []):
            video_stats = item.get("statistics", {})
            stats.append(
                {
                    "videoId": item["id"],
                    "title": item.get("snippet", {}).get("title", ""),
                    "viewCount": int(video_stats.get("viewCount", 0)),
                    "likeCount": int(video_stats.get("likeCount", 0))
                    if "likeCount" in video_stats
                    else None,
                    "commentCount": int(video_stats.get("commentCount", 0))
                    if "commentCount" in video_stats
                    else None,
                }
            )

    return stats


def main():
    api_key = os.environ.get("YOUTUBE_API_KEY")
    playlist_id = os.environ.get("YOUTUBE_PLAYLIST_ID")

    if not api_key or not playlist_id:
        print(
            "Error: YOUTUBE_API_KEY and YOUTUBE_PLAYLIST_ID must be set.",
            file=sys.stderr,
        )
        sys.exit(1)

    output_path = os.environ.get("OUTPUT_PATH", "data/statistics.json")

    print(f"Fetching video IDs for playlist {playlist_id}...")
    video_ids = get_video_ids(api_key, playlist_id)
    print(f"Found {len(video_ids)} videos.")

    print("Fetching video statistics...")
    videos = get_video_stats(api_key, video_ids)

    total_views = sum(v["viewCount"] for v in videos)
    total_likes = sum(v["likeCount"] for v in videos if v["likeCount"] is not None)
    total_comments = sum(
        v["commentCount"] for v in videos if v["commentCount"] is not None
    )

    result = {
        "playlistId": playlist_id,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "videoCount": len(videos),
        "totalViews": total_views,
        "totalLikes": total_likes,
        "totalComments": total_comments,
        "videos": videos,
    }

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Wrote stats to {output_path}")
    print(f"Total views: {total_views}")


if __name__ == "__main__":
    main()