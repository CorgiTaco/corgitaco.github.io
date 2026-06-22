#!/usr/bin/env python3
"""Manually send a digest of the most recent N blog posts to all subscribers.

Triggered only from the Actions tab (send-recent-posts.yml, workflow_dispatch).
Reads the newest-first index (assets/blog/internal/posts.txt) and sends the top
N as a single digest. Reuses the parser + sender from notify_new_posts.py.

Env:
    BLOG_WEBHOOK_URL     - Apps Script /exec URL (bypass the Worker)
    BLOG_WEBHOOK_SECRET  - shared secret (matches config.gs BLOG_WEBHOOK_SECRET)
    COUNT                - how many recent posts to send (default 5)
"""

import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from notify_new_posts import post_to_dict, send_payload  # noqa: E402

POSTS_TXT = 'assets/blog/internal/posts.txt'


def recent_post_files(count):
    """Newest-first blog .md paths, capped at `count`."""
    files = []

    if os.path.exists(POSTS_TXT):
        with open(POSTS_TXT, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                path = 'assets/blog/' + line
                if os.path.exists(path):
                    files.append(path)
                if len(files) >= count:
                    break
        return files

    # Fallback: order by most recent commit if the index isn't present.
    out = subprocess.check_output(
        ['git', 'log', '--diff-filter=A', '--name-only', '--pretty=format:', '--', 'assets/blog'],
        stderr=subprocess.DEVNULL
    ).decode('utf-8', 'ignore')
    seen = set()
    for line in out.splitlines():
        line = line.strip()
        if (line.startswith('assets/blog/') and line.endswith('.md')
                and line.count('/') == 2 and line not in seen and os.path.exists(line)):
            seen.add(line)
            files.append(line)
        if len(files) >= count:
            break
    return files


def main():
    url    = os.environ.get('BLOG_WEBHOOK_URL', '').strip()
    secret = os.environ.get('BLOG_WEBHOOK_SECRET', '').strip()
    if not url or not secret:
        print('Webhook not configured (BLOG_WEBHOOK_URL / BLOG_WEBHOOK_SECRET).')
        sys.exit(1)

    try:
        count = max(1, int(os.environ.get('COUNT', '5') or '5'))
    except ValueError:
        count = 5

    files = recent_post_files(count)
    if not files:
        print('No blog posts found — nothing to send.')
        return

    posts = [post_to_dict(f) for f in files]
    print('Sending the %d most recent post(s): %s'
          % (len(posts), ', '.join(p['slug'] for p in posts)))
    send_payload(url, secret, posts)


if __name__ == '__main__':
    main()