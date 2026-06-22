#!/usr/bin/env python3
"""Generate feed.xml (RSS 2.0) from blog markdown files."""

import os
import re
import glob
import datetime
import html as html_mod

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

SITE_URL   = 'https://corgitaco.dev'
FEED_TITLE = "Corgi Taco's Blog"
FEED_DESC  = 'Posts about Minecraft modding and more from Corgi Taco.'
FEED_PATH  = 'feed.xml'
BLOG_DIR   = 'assets/blog'


def parse_frontmatter_simple(meta_str):
    meta = {}
    current_list_key = None

    for raw_line in meta_str.split('\n'):
        raw_line = raw_line.rstrip('\r')
        top_kv   = re.match(r'^(\w[\w-]*):\s*["\']?(.*?)["\']?\s*$', raw_line)
        top_list = re.match(r'^(\w[\w-]*):\s*$', raw_line)

        if top_list and not top_kv:
            current_list_key = top_list.group(1)
            meta[current_list_key] = []
        elif top_kv:
            current_list_key = None
            key, value = top_kv.group(1), top_kv.group(2)
            if key == 'tags' and value:
                meta['tags'] = [t.strip() for t in value.split(',') if t.strip()]
            else:
                meta[key] = value

    return meta


def parse_frontmatter(content):
    fence = re.match(r'^---\r?\n(.*?)\r?\n---\r?\n?(.*)', content, re.DOTALL)
    if not fence:
        return {}, content
    meta_str = fence.group(1)
    body     = fence.group(2)
    if HAS_YAML:
        try:
            meta = yaml.safe_load(meta_str) or {}
        except Exception:
            meta = parse_frontmatter_simple(meta_str)
    else:
        meta = parse_frontmatter_simple(meta_str)
    return meta, body


def normalize_date(raw):
    """Return a datetime.date, or None on failure."""
    if isinstance(raw, (datetime.date, datetime.datetime)):
        return raw if isinstance(raw, datetime.date) else raw.date()
    s = str(raw).strip()
    for fmt in ('%Y-%m-%d', '%Y/%m/%d', '%B %d, %Y'):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def to_rfc822(d):
    """Convert a date/datetime to RFC-822 format required by RSS pubDate."""
    if isinstance(d, datetime.datetime):
        dt = d.replace(tzinfo=datetime.timezone.utc)
    else:
        dt = datetime.datetime(d.year, d.month, d.day, tzinfo=datetime.timezone.utc)
    return dt.strftime('%a, %d %b %Y %H:%M:%S +0000')


def strip_markdown(text):
    """Very lightweight markdown stripper for the <description> field."""
    # Remove headings, bold, italic, code, images, links
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'`{1,3}[^`]*`{1,3}', '', text)
    text = re.sub(r'\*{1,2}([^*]+)\*{1,2}', r'\1', text)
    text = re.sub(r'_{1,2}([^_]+)_{1,2}', r'\1', text)
    text = re.sub(r'\n{2,}', ' ', text)
    return text.strip()


def build_feed(posts):
    now_rfc = to_rfc822(datetime.datetime.now(datetime.timezone.utc))
    last_build = to_rfc822(posts[0]['date']) if posts else now_rfc

    items = []
    for p in posts:
        url      = f"{SITE_URL}/blog/{p['slug']}/"
        pub_date = to_rfc822(p['date']) if p['date'] else now_rfc
        desc     = html_mod.escape(p['excerpt'] or strip_markdown(p['body'])[:300])
        title    = html_mod.escape(p['title'])

        category_xml = ''.join(
            f'        <category>{html_mod.escape(t)}</category>\n'
            for t in p.get('tags', [])
        )

        items.append(f'''    <item>
      <title>{title}</title>
      <link>{url}</link>
      <guid isPermaLink="true">{url}</guid>
      <pubDate>{pub_date}</pubDate>
      <description>{desc}</description>
{category_xml}    </item>''')

    items_xml = '\n'.join(items)

    return f'''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{html_mod.escape(FEED_TITLE)}</title>
    <link>{SITE_URL}/blog/</link>
    <description>{html_mod.escape(FEED_DESC)}</description>
    <language>en-us</language>
    <lastBuildDate>{last_build}</lastBuildDate>
    <atom:link href="{SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
{items_xml}
  </channel>
</rss>
'''


def main():
    md_files = glob.glob(os.path.join(BLOG_DIR, '*.md'))
    posts = []

    for md_file in md_files:
        filename = os.path.basename(md_file)
        slug     = filename[:-3]

        with open(md_file, 'r', encoding='utf-8') as f:
            content = f.read()

        meta, body = parse_frontmatter(content)

        tags = meta.get('tags', [])
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(',') if t.strip()]

        date_raw = meta.get('date', '')
        date_obj = normalize_date(date_raw)

        posts.append({
            'slug':    slug,
            'title':   str(meta.get('title', slug)),
            'excerpt': str(meta.get('excerpt', '')),
            'date':    date_obj,
            'tags':    tags if isinstance(tags, list) else [],
            'body':    body,
        })

    # Newest first; posts without dates go last
    posts.sort(key=lambda p: p['date'] or datetime.date.min, reverse=True)

    feed_xml = build_feed(posts)

    with open(FEED_PATH, 'w', encoding='utf-8') as f:
        f.write(feed_xml)

    print(f'Generated {FEED_PATH} with {len(posts)} post(s).')


if __name__ == '__main__':
    main()
