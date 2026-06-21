#!/usr/bin/env python3
"""
Populate every history CSV with 365 days of mock data before today.

Strategy
--------
- "Anchor" rows  : any existing row whose date >= yesterday (real CI data).
- "Endpoint"     : the anchor row for yesterday specifically — the mock series
                   grows smoothly up to that value so the transition is seamless.
- On re-runs     : old mock rows are discarded and regenerated from scratch.

Run from the repo root:
    python gh_scripts/mock_history.py
"""

import csv
import os
import random
from datetime import date, timedelta

random.seed(42)

TODAY     = date.today()
YESTERDAY = TODAY - timedelta(days=1)
DAYS      = 365
START_FRAC = 0.85      # value DAYS ago as a fraction of yesterday's value
NOISE_FRAC = 0.0008    # gaussian noise as fraction of (end - start)

# Mock dates: DAYS ago up to (and including) yesterday
MOCK_DATES = [TODAY - timedelta(days=DAYS - i) for i in range(DAYS)]
MOCK_DATE_STRS = {d.isoformat() for d in MOCK_DATES}


def mock_series(end_value: int, n: int = DAYS) -> list[int]:
    """n monotonically increasing integers, smoothstep from end*START_FRAC to end."""
    if end_value <= 0:
        return [0] * n
    start = int(end_value * START_FRAC)
    values: list[int] = []
    prev = start
    for i in range(n):
        t          = i / max(n - 1, 1)
        smooth     = t * t * (3 - 2 * t)
        trend      = start + (end_value - start) * smooth
        noise_std  = (end_value - start) * NOISE_FRAC * (1 - t)  # tapers to 0 at endpoint
        noise      = random.gauss(0, noise_std) if noise_std > 0 else 0
        val        = max(prev, int(round(trend + noise)))
        values.append(val)
        prev = val
    return values


def date_key(row: dict) -> str:
    return row["date"][:10]


def read_csv(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: str, rows: list[dict], fieldnames: list[str]) -> None:
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def rebuild(path: str, existing: list[dict], mock_rows: list[dict], fields: list[str]) -> None:
    # Discard any previously generated mock rows; keep only real anchor rows.
    anchor_rows = [r for r in existing if date_key(r) not in MOCK_DATE_STRS]
    all_rows    = sorted(anchor_rows + mock_rows, key=date_key)
    write_csv(path, all_rows, fields)
    print(f"  {len(mock_rows)} mock rows -> {path}")


def find_endpoint(existing: list[dict], key: str) -> int:
    """Return the value for 'key' from yesterday's row (or the earliest anchor row)."""
    anchors = sorted(
        [r for r in existing if date_key(r) not in MOCK_DATE_STRS],
        key=date_key,
    )
    # Prefer the row whose date is yesterday; fall back to earliest anchor
    yesterday_rows = [r for r in anchors if date_key(r) == YESTERDAY.isoformat()]
    row = yesterday_rows[0] if yesterday_rows else (anchors[0] if anchors else None)
    return int((row or {}).get(key, 0) or 0)


# ── Mod per-mod CSVs ──────────────────────────────────────────────────────────

MODS_DIR = "data/history/mods"
print("Mods:")
for fname in sorted(os.listdir(MODS_DIR)):
    if not fname.endswith(".csv") or fname == "totals.csv":
        continue
    path     = os.path.join(MODS_DIR, fname)
    existing = read_csv(path)
    if not existing:
        continue

    cf_end  = find_endpoint(existing, "downloads_cf")
    mr_end  = find_endpoint(existing, "downloads_mr")

    cf_s    = mock_series(cf_end)
    mr_s    = mock_series(mr_end)
    tot_s   = [cf_s[i] + mr_s[i] for i in range(DAYS)]

    mock_rows = [
        {"date":            MOCK_DATES[i].isoformat(),
         "downloads_cf":    cf_s[i],
         "downloads_mr":    mr_s[i],
         "downloads_total": tot_s[i]}
        for i in range(DAYS)
    ]
    rebuild(path, existing, mock_rows, ["date", "downloads_cf", "downloads_mr", "downloads_total"])

# ── Mod totals ────────────────────────────────────────────────────────────────

print("Mod totals:")
path     = os.path.join(MODS_DIR, "totals.csv")
existing = read_csv(path)
if existing:
    tot_end   = find_endpoint(existing, "downloads_total")
    tot_s     = mock_series(tot_end)
    mock_rows = [
        {"date": MOCK_DATES[i].isoformat(), "downloads_total": tot_s[i]}
        for i in range(DAYS)
    ]
    rebuild(path, existing, mock_rows, ["date", "downloads_total"])

# ── YouTube per-video CSVs ────────────────────────────────────────────────────

VIDEOS_DIR = "data/history/youtube/videos"
print("YouTube videos:")
for fname in sorted(os.listdir(VIDEOS_DIR)):
    if not fname.endswith(".csv"):
        continue
    path     = os.path.join(VIDEOS_DIR, fname)
    existing = read_csv(path)
    if not existing:
        continue

    views_end    = find_endpoint(existing, "views")
    likes_end    = find_endpoint(existing, "likes")
    comments_end = find_endpoint(existing, "comments")

    views_s    = mock_series(views_end)
    likes_s    = mock_series(likes_end)
    comments_s = mock_series(comments_end)

    mock_rows = [
        {"date":     MOCK_DATES[i].isoformat(),
         "views":    views_s[i],
         "likes":    likes_s[i],
         "comments": comments_s[i]}
        for i in range(DAYS)
    ]
    rebuild(path, existing, mock_rows, ["date", "views", "likes", "comments"])

# ── YouTube totals ────────────────────────────────────────────────────────────

print("YouTube totals:")
path     = "data/history/youtube/totals.csv"
existing = read_csv(path)
if existing:
    views_end    = find_endpoint(existing, "views")
    likes_end    = find_endpoint(existing, "likes")
    comments_end = find_endpoint(existing, "comments")
    vc_end       = find_endpoint(existing, "video_count")

    views_s    = mock_series(views_end)
    likes_s    = mock_series(likes_end)
    comments_s = mock_series(comments_end)

    mock_rows = [
        {"date":        MOCK_DATES[i].isoformat(),
         "video_count": vc_end,
         "views":       views_s[i],
         "likes":       likes_s[i],
         "comments":    comments_s[i]}
        for i in range(DAYS)
    ]
    rebuild(path, existing, mock_rows, ["date", "video_count", "views", "likes", "comments"])

print("Done.")
