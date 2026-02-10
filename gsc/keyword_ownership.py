"""Keyword ownership rules for GSC optimization suggestions.

This module centralizes URL/query-cluster ownership so automation can avoid
recommending edits that cannibalize higher-priority pages.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

OWNERSHIP_FILE = Path("ops/keyword-ownership.json")


class KeywordOwnership:
    """Loads and evaluates query ownership rules."""

    def __init__(self, config: dict):
        self.config = config
        self.url_rules = config.get("url_rules", {})
        self.clusters = config.get("clusters", {})
        self.blocked_overlaps = config.get("blocked_overlaps", [])

    @classmethod
    @lru_cache(maxsize=1)
    def load(cls) -> "KeywordOwnership":
        if not OWNERSHIP_FILE.exists():
            return cls({})
        return cls(json.loads(OWNERSHIP_FILE.read_text()))

    @property
    def enabled(self) -> bool:
        return bool(self.url_rules and self.clusters)

    @staticmethod
    def _normalize_path(path: str) -> str:
        if not path:
            return "/"
        if not path.startswith("/"):
            path = "/" + path
        return path.rstrip("/") + "/"

    @staticmethod
    def _normalize_query(query: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", query.lower())).strip()

    def _detect_cluster(self, query: str) -> str | None:
        normalized = self._normalize_query(query)
        if not normalized:
            return None
        for cluster_id, meta in self.clusters.items():
            for term in meta.get("terms", []):
                term_norm = self._normalize_query(term)
                if term_norm and term_norm in normalized:
                    return cluster_id
        return None

    def _cluster_owners(self, cluster_id: str) -> list[dict]:
        owners = []
        for raw_path, rule in self.url_rules.items():
            primary = rule.get("primary_cluster")
            secondary = set(rule.get("secondary_clusters", []))
            if cluster_id == primary or cluster_id in secondary:
                owners.append(
                    {
                        "path": self._normalize_path(raw_path),
                        "priority": int(rule.get("priority", 0)),
                        "group": rule.get("group", ""),
                        "is_primary": cluster_id == primary,
                    }
                )
        return sorted(owners, key=lambda x: x["priority"], reverse=True)

    def choose_owner_for_query(self, query: str) -> tuple[str | None, str | None]:
        """Return (preferred_path, cluster_id) for a query if detectable."""
        cluster_id = self._detect_cluster(query)
        if not cluster_id:
            return None, None
        owners = self._cluster_owners(cluster_id)
        if not owners:
            return None, cluster_id
        return owners[0]["path"], cluster_id

    def query_allowed_for_page(self, page_path: str, query: str) -> tuple[bool, str | None, str | None]:
        """Validate if a query can be targeted by a page.

        Returns (allowed, reason, cluster_id).
        """
        if not self.enabled:
            return True, None, None

        cluster_id = self._detect_cluster(query)
        if not cluster_id:
            return True, None, None

        page_path = self._normalize_path(page_path)
        page_rule = self.url_rules.get(page_path)
        if not page_rule:
            return True, None, cluster_id

        owners = self._cluster_owners(cluster_id)
        page_priority = int(page_rule.get("priority", 0))
        page_group = page_rule.get("group", "")

        for owner in owners:
            if owner["path"] == page_path:
                continue
            blocked_between_groups = any(
                b.get("source_group") == page_group
                and b.get("target_group") == owner["group"]
                and cluster_id in set(b.get("clusters", []))
                for b in self.blocked_overlaps
            )
            if blocked_between_groups and owner["priority"] >= page_priority:
                return False, (
                    f'cluster "{cluster_id}" blocked between groups '
                    f'{page_group} -> {owner["group"]} (owner: {owner["path"]})'
                ), cluster_id

        allowed_clusters = {page_rule.get("primary_cluster")} | set(page_rule.get("secondary_clusters", []))
        if cluster_id in allowed_clusters:
            return True, None, cluster_id

        for owner in owners:
            blocked_between_groups = any(
                b.get("source_group") == page_group
                and b.get("target_group") == owner["group"]
                and cluster_id in set(b.get("clusters", []))
                for b in self.blocked_overlaps
            )
            if blocked_between_groups and owner["priority"] >= page_priority:
                return False, (
                    f'cluster "{cluster_id}" blocked between groups '
                    f'{page_group} -> {owner["group"]} (owner: {owner["path"]})'
                ), cluster_id

            if owner["priority"] > page_priority:
                return False, (
                    f'cluster "{cluster_id}" owned by higher-priority page '
                    f'{owner["path"]}'
                ), cluster_id

        return True, None, cluster_id
