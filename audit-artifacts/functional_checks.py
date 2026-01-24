#!/usr/bin/env python3
"""Phase 4: Automated functional checks"""
import json
import urllib.request
import csv
import re
from html.parser import HTMLParser

BASE_URL = "http://127.0.0.1:4173"

# ====== LINK CHECK ======
class LinkExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'a':
            href = attrs_dict.get('href', '')
            if href and not href.startswith('#') and not href.startswith('mailto:') and not href.startswith('tel:'):
                self.links.append(href)

def check_links():
    """Check all internal links"""
    print("=== LINK CHECK ===")
    with open('routes.txt', 'r') as f:
        routes = [line.strip() for line in f if line.strip()]

    all_links = {}
    broken = []

    for route in routes:
        url = BASE_URL + route
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                content = response.read().decode('utf-8', errors='replace')
        except:
            continue

        parser = LinkExtractor()
        parser.feed(content)

        for link in parser.links:
            if link.startswith('/'):
                full_url = BASE_URL + link
            elif link.startswith('http://127.0.0.1') or link.startswith('http://localhost'):
                full_url = link
            elif link.startswith('http'):
                continue  # Skip external
            else:
                continue

            if full_url not in all_links:
                all_links[full_url] = {'sources': [], 'status': None}
            all_links[full_url]['sources'].append(route)

    # Check each link
    for link_url, info in all_links.items():
        try:
            req = urllib.request.Request(link_url, method='HEAD')
            with urllib.request.urlopen(req, timeout=5) as response:
                info['status'] = response.status
        except urllib.error.HTTPError as e:
            info['status'] = e.code
            broken.append({'url': link_url, 'status': e.code, 'sources': info['sources']})
        except Exception as e:
            info['status'] = 0
            broken.append({'url': link_url, 'status': 0, 'error': str(e), 'sources': info['sources']})

    # Write results
    with open('link-check.json', 'w') as f:
        json.dump({'all_links': len(all_links), 'broken': broken}, f, indent=2)

    with open('link-check.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['url', 'status', 'sources'])
        writer.writeheader()
        for b in broken:
            writer.writerow({'url': b['url'], 'status': b['status'], 'sources': '; '.join(b.get('sources', []))})

    print(f"Checked {len(all_links)} links, found {len(broken)} broken")
    return broken

# ====== SITEMAP + ROBOTS ======
def check_sitemap_robots():
    """Check sitemap.xml and robots.txt"""
    print("\n=== SITEMAP + ROBOTS CHECK ===")

    results = {}

    # Check robots.txt
    try:
        with urllib.request.urlopen(BASE_URL + '/robots.txt', timeout=10) as response:
            content = response.read().decode('utf-8')
            results['robots'] = {
                'status': response.status,
                'content_type': response.headers.get('Content-Type', ''),
                'content': content[:2000]
            }
            with open('robots.txt.snapshot', 'w') as f:
                f.write(f"Status: {response.status}\n")
                f.write(f"Content-Type: {response.headers.get('Content-Type', '')}\n\n")
                for line in content.split('\n')[:40]:
                    f.write(line + '\n')
    except Exception as e:
        results['robots'] = {'status': 0, 'error': str(e)}
        with open('robots.txt.snapshot', 'w') as f:
            f.write(f"ERROR: {e}\n")

    # Check sitemap.xml
    try:
        with urllib.request.urlopen(BASE_URL + '/sitemap.xml', timeout=10) as response:
            content = response.read().decode('utf-8')
            results['sitemap'] = {
                'status': response.status,
                'content_type': response.headers.get('Content-Type', ''),
                'is_xml': '<?xml' in content[:100] or '<urlset' in content[:200]
            }
            with open('sitemap.xml.snapshot', 'w') as f:
                f.write(f"Status: {response.status}\n")
                f.write(f"Content-Type: {response.headers.get('Content-Type', '')}\n")
                f.write(f"Is XML: {results['sitemap']['is_xml']}\n\n")
                for line in content.split('\n')[:40]:
                    f.write(line + '\n')
    except Exception as e:
        results['sitemap'] = {'status': 0, 'error': str(e)}
        with open('sitemap.xml.snapshot', 'w') as f:
            f.write(f"ERROR: {e}\n")

    print(f"robots.txt: {results.get('robots', {}).get('status', 'ERROR')}")
    print(f"sitemap.xml: {results.get('sitemap', {}).get('status', 'ERROR')}")
    return results

# ====== NAV DUPLICATION ======
class NavCounter(HTMLParser):
    def __init__(self):
        super().__init__()
        self.nav_count = 0
        self.header_count = 0
        self.in_header = False
        self.nav_selectors = []
        self.depth = 0
        self.current_classes = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        classes = attrs_dict.get('class', '')

        if tag == 'header':
            self.header_count += 1
            self.in_header = True
        if tag == 'nav':
            self.nav_count += 1
            self.nav_selectors.append(f"nav.{classes}" if classes else "nav")

    def handle_endtag(self, tag):
        if tag == 'header':
            self.in_header = False

def check_nav_duplication():
    """Check for duplicate navigation on each page"""
    print("\n=== NAV DUPLICATION CHECK ===")
    with open('routes.txt', 'r') as f:
        routes = [line.strip() for line in f if line.strip()]

    results = []
    for route in routes:
        url = BASE_URL + route
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                content = response.read().decode('utf-8', errors='replace')
        except:
            continue

        parser = NavCounter()
        parser.feed(content)

        results.append({
            'url': route,
            'nav_count': parser.nav_count,
            'header_count': parser.header_count,
            'selector_used': 'nav, header'
        })

    with open('nav-duplication.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['url', 'nav_count', 'header_count', 'selector_used'])
        writer.writeheader()
        writer.writerows(results)

    duplicates = [r for r in results if r['nav_count'] > 1 or r['header_count'] > 1]
    print(f"Found {len(duplicates)} pages with potential nav/header duplication")
    return results

# ====== FORMS ======
class FormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms = []
        self.current_form = None
        self.in_form = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        if tag == 'form':
            self.in_form = True
            self.current_form = {
                'id': attrs_dict.get('id', ''),
                'action': attrs_dict.get('action', ''),
                'method': attrs_dict.get('method', 'get'),
                'fields': [],
                'labels': [],
                'honeypot': None
            }
        elif self.in_form:
            if tag in ['input', 'select', 'textarea']:
                field = {
                    'tag': tag,
                    'type': attrs_dict.get('type', 'text'),
                    'name': attrs_dict.get('name', ''),
                    'id': attrs_dict.get('id', ''),
                    'required': 'required' in attrs_dict,
                    'aria_describedby': attrs_dict.get('aria-describedby', ''),
                    'tabindex': attrs_dict.get('tabindex', '')
                }
                # Check for honeypot
                if attrs_dict.get('name', '') == '_gotcha' or 'hp-' in attrs_dict.get('id', ''):
                    self.current_form['honeypot'] = {
                        'name': attrs_dict.get('name', ''),
                        'id': attrs_dict.get('id', ''),
                        'tabindex': attrs_dict.get('tabindex', ''),
                        'autocomplete': attrs_dict.get('autocomplete', '')
                    }
                else:
                    self.current_form['fields'].append(field)
            elif tag == 'label':
                self.current_form['labels'].append(attrs_dict.get('for', ''))

    def handle_endtag(self, tag):
        if tag == 'form' and self.in_form:
            self.in_form = False
            if self.current_form:
                self.forms.append(self.current_form)
            self.current_form = None

def check_forms():
    """Analyze forms on each page"""
    print("\n=== FORMS CHECK ===")
    pages_with_forms = ['/contact.html', '/home-value.html', '/agents.html', '/referrals.html']

    all_forms = {}
    for route in pages_with_forms:
        url = BASE_URL + route
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                content = response.read().decode('utf-8', errors='replace')
        except:
            continue

        parser = FormParser()
        parser.feed(content)

        if parser.forms:
            all_forms[route] = parser.forms

    with open('forms.json', 'w') as f:
        json.dump(all_forms, f, indent=2)

    print(f"Found forms on {len(all_forms)} pages")
    return all_forms

# ====== MAIN ======
if __name__ == '__main__':
    check_links()
    check_sitemap_robots()
    check_nav_duplication()
    check_forms()
    print("\n=== FUNCTIONAL CHECKS COMPLETE ===")
