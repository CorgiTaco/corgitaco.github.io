#!/usr/bin/env python3
"""Generate blog/<slug>/index.html for each blog post markdown file."""

import os
import re
import json
import html as html_mod
import glob
import datetime

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


def parse_frontmatter_simple(meta_str):
    meta = {}
    current_list_key = None
    current_list_item = None

    for raw_line in meta_str.split('\n'):
        raw_line = raw_line.rstrip('\r')

        list_item_kv  = re.match(r'^(\s+)-\s+(\w[\w-]*):\s*["\']?(.*?)["\']?\s*$', raw_line)
        list_kv       = re.match(r'^(\s+)(\w[\w-]*):\s*["\']?(.*?)["\']?\s*$', raw_line)
        top_list      = re.match(r'^(\w[\w-]*):\s*$', raw_line)
        top_kv        = re.match(r'^(\w[\w-]*):\s*["\']?(.*?)["\']?\s*$', raw_line)
        list_item_bare = re.match(r'^(\s+)-\s*$', raw_line)

        if list_item_bare:
            if current_list_key:
                current_list_item = {}
                if not isinstance(meta.get(current_list_key), list):
                    meta[current_list_key] = []
                meta[current_list_key].append(current_list_item)
        elif list_item_kv:
            if current_list_key:
                current_list_item = {list_item_kv.group(2): list_item_kv.group(3)}
                if not isinstance(meta.get(current_list_key), list):
                    meta[current_list_key] = []
                meta[current_list_key].append(current_list_item)
        elif list_kv and current_list_key and current_list_item is not None:
            current_list_item[list_kv.group(2)] = list_kv.group(3)
        elif top_list and not top_kv:
            current_list_key = top_list.group(1)
            current_list_item = None
            meta[current_list_key] = []
        elif top_kv:
            current_list_key = None
            current_list_item = None
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
    body = fence.group(2)
    if HAS_YAML:
        try:
            meta = yaml.safe_load(meta_str) or {}
        except Exception:
            meta = parse_frontmatter_simple(meta_str)
    else:
        meta = parse_frontmatter_simple(meta_str)
    return meta, body


def normalize_meta(meta):
    tags = meta.get('tags', [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(',') if t.strip()]
    elif not isinstance(tags, list):
        tags = []
    meta['tags'] = tags

    date_val = meta.get('date', '')
    if isinstance(date_val, (datetime.date, datetime.datetime)):
        date_val = date_val.strftime('%Y-%m-%d')
    elif not isinstance(date_val, str):
        date_val = str(date_val) if date_val else ''
    meta['date'] = date_val

    if not isinstance(meta.get('downloads'), list):
        meta['downloads'] = []

    return meta


def resolve_photo(photo_path):
    """Convert photo paths (relative to blog/) to paths relative to blog/<slug>/.

    Frontmatter photo paths are resolved by the browser relative to blog/index.html.
    Generated pages live at blog/<slug>/index.html — one level deeper — so prepend ../
    for relative paths, or strip the leading / and prepend ../../ for absolute paths.
    """
    if not photo_path:
        return photo_path
    if photo_path.startswith('http://') or photo_path.startswith('https://'):
        return photo_path
    if photo_path.startswith('/'):
        # Absolute site path: make relative from blog/<slug>/
        return '../../' + photo_path.lstrip('/')
    # Relative to blog/ → relative to blog/<slug>/ needs one extra ../
    resolved = os.path.normpath(os.path.join('blog', photo_path))
    return '../../' + resolved.replace('\\', '/')


def format_date(date_str):
    if not date_str:
        return ''
    try:
        d = datetime.datetime.strptime(date_str, '%Y-%m-%d')
        return d.strftime('%B ') + str(d.day) + d.strftime(', %Y')
    except Exception:
        return date_str


def build_sidebar_html(meta):
    parts = []

    if meta.get('date'):
        parts.append(f'''
        <div class="blog-sidebar-section">
            <div class="blog-sidebar-label"><i class="fa fa-calendar"></i> Published</div>
            <div class="blog-sidebar-value">{html_mod.escape(format_date(meta['date']))}</div>
        </div>''')

    if meta.get('author'):
        parts.append(f'''
        <div class="blog-sidebar-section">
            <div class="blog-sidebar-label"><i class="fa fa-user"></i> Author</div>
            <div class="blog-sidebar-value">{html_mod.escape(str(meta['author']))}</div>
        </div>''')

    downloads = meta.get('downloads', [])
    if downloads:
        btns = ''.join(
            f'<a href="{html_mod.escape(str(dl.get("url", "")))}" target="_blank" rel="noopener" '
            f'class="blog-download-btn btn-theme">'
            f'<i class="fa fa-download"></i>'
            f'<span>{html_mod.escape(str(dl.get("name", "")))}</span></a>'
            for dl in downloads if isinstance(dl, dict)
        )
        parts.append(f'''
        <div class="blog-sidebar-section">
            <div class="blog-sidebar-label"><i class="fa fa-download"></i> Downloads</div>
            <div id="blog-modal-downloads">{btns}</div>
        </div>''')

    tags = meta.get('tags', [])
    if tags:
        chips = ''.join(
            f'<span class="blog-tag"><i class="fa fa-tag"></i>{html_mod.escape(str(t))}</span>'
            for t in tags
        )
        parts.append(f'''
        <div class="blog-sidebar-section">
            <div class="blog-sidebar-label"><i class="fa fa-tag"></i> Tags</div>
            <div class="blog-sidebar-tags">
                <div class="blog-tag-row" style="flex-wrap:wrap;max-height:none;overflow:visible">{chips}</div>
            </div>
        </div>''')

    return '\n'.join(parts)


def safe_json(data):
    """JSON-encode data and escape characters that could break a <script> tag."""
    s = json.dumps(data, ensure_ascii=False)
    return s.replace('<', r'<').replace('>', r'>').replace('&', r'&')


def generate_html(slug, meta, body):
    title_raw  = str(meta.get('title', slug))
    title      = html_mod.escape(title_raw)
    photo      = resolve_photo(str(meta.get('photo', '')))
    photo_fit  = html_mod.escape(str(meta.get('photo_fit', 'cover')))
    excerpt    = html_mod.escape(str(meta.get('excerpt', title_raw)))

    banner_html = (
        f'<img id="blog-modal-banner" src="{html_mod.escape(photo)}" '
        f'alt="{title}" style="object-fit:{photo_fit}">'
        if photo else ''
    )
    # og:image must be an absolute URL — derive it from the relative photo path
    og_photo_abs = photo  # may be relative; resolve to absolute for the OG tag
    if photo and not photo.startswith('http'):
        # Strip leading ../../ to get root-relative, then prefix with the site origin
        og_photo_abs = 'https://corgitaco.dev/' + photo.lstrip('./').lstrip('/')
    og_image = f'<meta property="og:image" content="{html_mod.escape(og_photo_abs)}">' if photo else ''

    sidebar_html = build_sidebar_html(meta)

    post_data = {
        'slug':      slug,
        'title':     title_raw,
        'photo':     photo,                              # already resolved to absolute path
        'photo_fit': str(meta.get('photo_fit', 'cover')),
        'date':      meta.get('date', ''),
        'author':    str(meta.get('author', '')),
        'excerpt':   str(meta.get('excerpt', '')),
        'tags':      meta.get('tags', []),
        'downloads': meta.get('downloads', []),
        'body':      body,
    }
    post_json = safe_json(post_data)

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{excerpt}">
    <meta property="og:url" content="https://corgitaco.dev/blog/{html_mod.escape(slug)}/">
    <meta property="og:type" content="article">
    {og_image}
    <meta property="og:image:width" content="1920">
    <meta property="og:image:height" content="1080">
    <meta property="og:image:type" content="image/png">
    <meta property="twitter:card" content="summary_large_image">

    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>{title} — Corgi Taco</title>

    <link rel="icon" href="../../assets/favicons/blog.svg" type="image/svg+xml">
    <link rel="stylesheet" href="../../assets/css/style.css">
    <link rel="stylesheet" href="../../assets/css/projects_style.css">
    <link rel="stylesheet" href="../../assets/css/blog_style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r121/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.waves.min.js"></script>
    <script src="../../assets/js/navbar.js"></script>
    <script src="../../assets/js/script.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js"></script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
</head>
<body id="vanta-bg" class="blog-post-page">

<div id="main">
    <script src="../../assets/js/pagechange.js"></script>

    <div id="sticky-header">
        <div id="titlebar">
            <div id="win-controls">
                <span class="win-btn win-close" id="post-win-close" style="cursor:pointer" title="Back to Blog"></span>
                <span class="win-btn win-minimize"></span>
                <span class="win-btn win-maximize"></span>
            </div>
            <span id="win-title"></span>
            <script src="../../assets/js/win_title.js"></script>
            <button class="blog-modal-fav-btn btn-theme" id="blog-post-fav-btn" title="Add to favorites">
                <i class="fa fa-star"></i>
            </button>
        </div>
        <div class="header">
            <nav role="navigation">
                <ul id="nav-main">
                    <li class="more hidden" data-width="80">
                        <a href="#">&#9776;</a>
                        <ul></ul>
                    </li>
                </ul>
            </nav>
        </div>
    </div>

    <div id="blog-modal-inner" class="active">
        {banner_html}
        <div id="blog-modal-body">
            <div id="blog-modal-content"></div>
            <div id="blog-modal-sidebar">{sidebar_html}
            </div>
        </div>
    </div>

    <div id="blog-modal-footer">
        <button id="blog-modal-back"><i class="fa fa-arrow-left"></i> Back</button>
    </div>

    <script>
(function() {{
    var POST = {post_json};
    var FAVORITES_KEY = 'blog-favorites';
    var VIEWED_KEY    = 'blog-viewed-history';

    // Wire up UI elements immediately — none of these depend on marked.
    try {{
        var viewed = JSON.parse(localStorage.getItem(VIEWED_KEY) || '[]');
        if (!viewed.includes(POST.slug)) {{
            viewed.push(POST.slug);
            localStorage.setItem(VIEWED_KEY, JSON.stringify(viewed));
        }}
    }} catch(e) {{}}

    var favBtn = document.getElementById('blog-post-fav-btn');

    function getFavs() {{
        try {{ return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); }}
        catch(e) {{ return []; }}
    }}

    function syncFav() {{
        var faved = getFavs().includes(POST.slug);
        favBtn.classList.toggle('active', faved);
        favBtn.title = faved ? 'Remove from favorites' : 'Add to favorites';
    }}

    favBtn.addEventListener('click', function() {{
        var favs = getFavs();
        var i = favs.indexOf(POST.slug);
        if (i === -1) favs.push(POST.slug); else favs.splice(i, 1);
        try {{ localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs)); }} catch(e) {{}}
        syncFav();
    }});

    syncFav();

    function goBack() {{
        var path = (window._navBasePath || '') + '/blog/';
        if (typeof handleRoute === 'function') {{
            history.pushState(null, '', path);
            handleRoute(path);
        }} else {{
            window.location.href = path;
        }}
    }}
    document.getElementById('blog-modal-back').addEventListener('click', goBack);
    document.getElementById('post-win-close').addEventListener('click', goBack);

    // Render markdown — marked may not be on window if we arrived via SPA from a
    // page whose <head> didn't include it (e.g. home → blog → post). Load it on
    // demand so the content always renders regardless of navigation path.
    function renderMarkdown() {{
        marked.setOptions({{ breaks: true, gfm: true }});
        document.getElementById('blog-modal-content').innerHTML = marked.parse(POST.body || '');
    }}

    if (typeof marked !== 'undefined') {{
        renderMarkdown();
    }} else {{
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js';
        s.onload = renderMarkdown;
        document.head.appendChild(s);
    }}
}})();
    </script>
</div>

</body>
</html>'''


def main():
    blog_dir    = 'assets/blog'
    output_base = 'blog'
    md_files    = glob.glob(os.path.join(blog_dir, '*.md'))
    existing_slugs = set()

    for md_file in md_files:
        filename = os.path.basename(md_file)
        slug     = filename[:-3]
        existing_slugs.add(slug)

        with open(md_file, 'r', encoding='utf-8') as f:
            content = f.read()

        meta, body = parse_frontmatter(content)
        meta = normalize_meta(meta)

        out_dir  = os.path.join(output_base, slug)
        os.makedirs(out_dir, exist_ok=True)

        html_content = generate_html(slug, meta, body)
        out_path = os.path.join(out_dir, 'index.html')
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        print(f'Generated {out_path}')

    # Remove stale generated pages for deleted posts
    if os.path.isdir(output_base):
        for entry in os.listdir(output_base):
            full = os.path.join(output_base, entry)
            if not os.path.isdir(full) or entry in existing_slugs:
                continue
            page = os.path.join(full, 'index.html')
            if not os.path.exists(page):
                continue
            with open(page, 'r', encoding='utf-8', errors='ignore') as f:
                head = f.read(300)
            if 'blog-post-page' in head:
                os.remove(page)
                try:
                    os.rmdir(full)
                except OSError:
                    pass
                print(f'Removed stale page: {full}')


if __name__ == '__main__':
    main()
