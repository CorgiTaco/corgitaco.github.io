#!/usr/bin/env python3
"""Send the daily blog digest.

Collects blog post markdown files ADDED in the last N hours, parses their front
matter (reusing generate_blog_pages.py so fields match the generated pages), and
POSTs them as ONE list to the newsletter webhook:

    { "action": "sendPost", "secret": "...", "posts": [ {…}, {…} ] }

Designed for a daily 3pm-Eastern schedule. Sends nothing when there are no new
posts. GitHub cron is UTC-only and not DST-aware, so the workflow fires at both
19:00 and 20:00 UTC and this script only proceeds when it is 15:00 in
America/New_York — guaranteeing 3pm Eastern year-round, exactly once per day.

Env:
    BLOG_WEBHOOK_URL     - Apps Script /exec URL (must bypass the Worker, which
                           403s POSTs without an allowed Origin)
    BLOG_WEBHOOK_SECRET  - shared secret (matches config.gs BLOG_WEBHOOK_SECRET)
    EVENT_NAME           - github.event_name; 'schedule' enforces the 3pm-ET gate
    LOOKBACK_HOURS       - detection window in hours (default 24)
"""

import datetime
import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_blog_pages as gbp  # noqa: E402  (reuse the shared parser)

BLOG_MD_RE = re.compile(r'^assets/blog/[^/]+\.md$')


def is_eastern_3pm():
    """True if it's currently the 15:00 hour in America/New_York (DST-aware)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo('America/New_York')).hour == 15
    except Exception as e:
        print('Could not resolve Eastern time (%s) — proceeding without the gate.' % e)
        return True


def recently_added_posts(hours):
    """Blog .md paths added (--diff-filter=A) within the last `hours` hours."""
    out = subprocess.check_output(
        ['git', 'log', '--diff-filter=A', '--since', '%d hours ago' % hours,
         '--name-only', '--pretty=format:', '--', 'assets/blog'],
        stderr=subprocess.DEVNULL
    ).decode('utf-8', 'ignore')

    seen, files = set(), []
    for line in out.splitlines():
        line = line.strip()
        if line and BLOG_MD_RE.match(line) and line not in seen and os.path.exists(line):
            seen.add(line)
            files.append(line)
    return files


def post_to_dict(md_path):
    slug = os.path.basename(md_path)[:-3]
    with open(md_path, 'r', encoding='utf-8') as f:
        meta, _ = gbp.parse_frontmatter(f.read())
    meta = gbp.normalize_meta(meta)
    return {
        'title':   str(meta.get('title', slug)),
        'excerpt': str(meta.get('excerpt', '')),
        'author':  str(meta.get('author', '')),
        'date':    meta.get('date', ''),
        'tags':    meta.get('tags', []),          # list; the web app joins it
        'photo':   str(meta.get('photo', '')),     # relative path; resolved server-side
        'slug':    slug,
    }


def send_payload(url, secret, posts):
    """POST {action:'sendPost', secret, posts} to the newsletter webhook."""
    body = json.dumps({'action': 'sendPost', 'secret': secret, 'posts': posts}).encode('utf-8')
    req = urllib.request.Request(
        url, data=body, method='POST',
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            print('Webhook response [%s]: %s' % (resp.status, resp.read().decode('utf-8', 'ignore')))
    except urllib.error.HTTPError as err:
        print('Webhook HTTP error [%s]: %s' % (err.code, err.read().decode('utf-8', 'ignore')))
        sys.exit(1)
    except urllib.error.URLError as err:
        print('Webhook request failed: %s' % err.reason)
        sys.exit(1)


def main():
    if os.environ.get('EVENT_NAME', '').strip() == 'schedule' and not is_eastern_3pm():
        print('Not 3pm in America/New_York — skipping this scheduled run.')
        return

    url    = os.environ.get('BLOG_WEBHOOK_URL', '').strip()
    secret = os.environ.get('BLOG_WEBHOOK_SECRET', '').strip()
    if not url or not secret:
        print('Webhook not configured (BLOG_WEBHOOK_URL / BLOG_WEBHOOK_SECRET) — skipping.')
        return

    hours = int(os.environ.get('LOOKBACK_HOURS', '24') or '24')
    files = recently_added_posts(hours)
    if not files:
        print('No blog posts added in the last %dh — nothing to send.' % hours)
        return

    posts = [post_to_dict(f) for f in files]
    print('Sending digest of %d post(s): %s'
          % (len(posts), ', '.join(p['slug'] for p in posts)))
    send_payload(url, secret, posts)


if __name__ == '__main__':
    main()