#!/usr/bin/env python3
"""Extract head signals from each route"""
import json
import urllib.request
import re
import csv
from html.parser import HTMLParser

BASE_URL = "http://127.0.0.1:4173"

class HeadParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_head = False
        self.in_title = False
        self.in_script = False
        self.script_type = None
        self.title = ""
        self.meta_description = ""
        self.canonical = ""
        self.robots = ""
        self.og_url = ""
        self.og_title = ""
        self.og_description = ""
        self.jsonld_scripts = []
        self.current_script = ""
        self.h1_texts = []
        self.in_h1 = False
        self.current_h1 = ""

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        if tag == 'head':
            self.in_head = True
        elif tag == 'title' and self.in_head:
            self.in_title = True
        elif tag == 'h1':
            self.in_h1 = True
            self.current_h1 = ""
        elif tag == 'meta' and self.in_head:
            name = attrs_dict.get('name', '').lower()
            prop = attrs_dict.get('property', '').lower()
            content = attrs_dict.get('content', '')

            if name == 'description':
                self.meta_description = content
            elif name == 'robots':
                self.robots = content
            elif prop == 'og:url':
                self.og_url = content
            elif prop == 'og:title':
                self.og_title = content
            elif prop == 'og:description':
                self.og_description = content
        elif tag == 'link' and self.in_head:
            rel = attrs_dict.get('rel', '')
            if rel == 'canonical':
                self.canonical = attrs_dict.get('href', '')
        elif tag == 'script':
            script_type = attrs_dict.get('type', '')
            if script_type == 'application/ld+json':
                self.in_script = True
                self.current_script = ""

    def handle_endtag(self, tag):
        if tag == 'head':
            self.in_head = False
        elif tag == 'title':
            self.in_title = False
        elif tag == 'h1':
            if self.current_h1.strip():
                self.h1_texts.append(self.current_h1.strip())
            self.in_h1 = False
        elif tag == 'script' and self.in_script:
            self.in_script = False
            if self.current_script.strip():
                try:
                    data = json.loads(self.current_script)
                    if isinstance(data, dict):
                        self.jsonld_scripts.append(data.get('@type', 'Unknown'))
                    elif isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict):
                                self.jsonld_scripts.append(item.get('@type', 'Unknown'))
                except:
                    pass

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        elif self.in_h1:
            self.current_h1 += data
        elif self.in_script:
            self.current_script += data

def fetch_and_parse(path):
    """Fetch URL and extract signals"""
    url = BASE_URL + path
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'AuditCrawler/1.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            final_url = response.geturl()
            final_path = path  # Python simple server doesn't redirect
            content = response.read().decode('utf-8', errors='replace')
            status = response.status
    except urllib.error.HTTPError as e:
        return {
            'url': path,
            'final_url': path,
            'status': e.code,
            'redirect_chain': '',
            'title': '',
            'meta_description': '',
            'canonical': '',
            'robots': '',
            'h1_text': '',
            'h1_count': 0,
            'jsonld_types': '',
            'og_url': '',
            'og_title': '',
            'og_description': ''
        }
    except Exception as e:
        print(f"Error: {e}")
        return None

    parser = HeadParser()
    try:
        parser.feed(content)
    except Exception as e:
        print(f"Parse error for {path}: {e}")

    return {
        'url': path,
        'final_url': final_path,
        'status': status,
        'redirect_chain': '',
        'title': parser.title.strip(),
        'meta_description': parser.meta_description,
        'canonical': parser.canonical,
        'robots': parser.robots,
        'h1_text': ' | '.join(parser.h1_texts),
        'h1_count': len(parser.h1_texts),
        'jsonld_types': ', '.join(parser.jsonld_scripts),
        'og_url': parser.og_url,
        'og_title': parser.og_title,
        'og_description': parser.og_description
    }

def main():
    # Load routes
    with open('routes.txt', 'r') as f:
        routes = [line.strip() for line in f if line.strip()]

    results = []
    for route in routes:
        print(f"Processing {route}...")
        result = fetch_and_parse(route)
        if result:
            results.append(result)

    # Write CSV
    fieldnames = ['url', 'final_url', 'status', 'redirect_chain', 'title',
                  'meta_description', 'canonical', 'robots', 'h1_text', 'h1_count',
                  'jsonld_types', 'og_url', 'og_title', 'og_description']

    with open('page-signals.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"Wrote {len(results)} rows to page-signals.csv")

if __name__ == '__main__':
    main()
