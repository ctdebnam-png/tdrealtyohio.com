#!/usr/bin/env python3
"""Route discovery crawler for audit"""
import json
import urllib.request
import urllib.parse
from html.parser import HTMLParser
from collections import deque

BASE_URL = "http://127.0.0.1:4173"
VISITED = set()
ROUTES = []
REDIRECTS = {}

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            for name, value in attrs:
                if name == 'href' and value:
                    self.links.append(value)

def normalize_url(url, current_url):
    """Normalize URL to absolute path"""
    if url.startswith('http://') or url.startswith('https://'):
        parsed = urllib.parse.urlparse(url)
        if parsed.netloc not in ['127.0.0.1:4173', 'localhost:4173', 'tdrealtyohio.com']:
            return None  # External link
        return parsed.path or '/'
    if url.startswith('#') or url.startswith('mailto:') or url.startswith('tel:'):
        return None
    if url.startswith('/'):
        return url.split('#')[0].split('?')[0]
    # Relative URL
    base_path = current_url.rsplit('/', 1)[0] + '/'
    return urllib.parse.urljoin(base_path, url).split('#')[0].split('?')[0]

def fetch_url(path):
    """Fetch URL and return status, final_url, content"""
    url = BASE_URL + path
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'AuditCrawler/1.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            final_url = response.geturl()
            final_path = urllib.parse.urlparse(final_url).path or '/'
            content = response.read().decode('utf-8', errors='replace')
            return response.status, final_path, content
    except urllib.error.HTTPError as e:
        return e.code, path, ""
    except Exception as e:
        print(f"Error fetching {path}: {e}")
        return 0, path, ""

def crawl():
    """Crawl site starting from /"""
    queue = deque(['/'])

    while queue:
        path = queue.popleft()
        if path in VISITED:
            continue
        VISITED.add(path)

        status, final_path, content = fetch_url(path)

        # Track redirects
        if final_path != path:
            if path not in REDIRECTS:
                REDIRECTS[path] = []
            REDIRECTS[path].append({'from': path, 'to': final_path, 'status': status})
            # Also visit the final path
            if final_path not in VISITED:
                queue.append(final_path)

        if status == 200 and content:
            route_info = {
                'url': path,
                'final_url': final_path,
                'status': status,
                'redirect_chain': REDIRECTS.get(path, [])
            }
            # Avoid duplicates
            if not any(r['final_url'] == final_path for r in ROUTES):
                ROUTES.append(route_info)

            # Parse links
            parser = LinkParser()
            try:
                parser.feed(content)
            except:
                pass

            for link in parser.links:
                normalized = normalize_url(link, final_path)
                if normalized and normalized not in VISITED:
                    queue.append(normalized)

    return ROUTES, REDIRECTS

if __name__ == '__main__':
    routes, redirects = crawl()

    # Sort routes
    routes = sorted(routes, key=lambda r: r['final_url'])

    # Write routes.json
    with open('routes.json', 'w') as f:
        json.dump(routes, f, indent=2)

    # Write routes.txt
    with open('routes.txt', 'w') as f:
        for r in routes:
            f.write(r['final_url'] + '\n')

    # Write redirects.json
    with open('redirects.json', 'w') as f:
        json.dump(redirects, f, indent=2)

    print(f"Discovered {len(routes)} routes")
    print(f"Found {len(redirects)} redirect chains")
