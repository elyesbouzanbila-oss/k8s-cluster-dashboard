"""
Tests for network_service.py — focuses on label_selector_matches utility.
"""

from services.network_service import label_selector_matches


class TestLabelSelectorMatches:
    """Duplicate of calico_service test coverage where both implement the
    same logic. These tests run against the network_service copy specifically."""

    def test_exact_match(self):
        assert label_selector_matches(
            {"app": "nginx", "version": "v1"}, {"app": "nginx"}
        ) is True

    def test_no_match(self):
        assert label_selector_matches(
            {"app": "nginx"}, {"app": "redis"}
        ) is False

    def test_pod_extra_labels_ignored(self):
        assert label_selector_matches(
            {"app": "nginx", "tier": "frontend"}, {"app": "nginx"}
        ) is True

    def test_empty_selector(self):
        assert label_selector_matches({"app": "nginx"}, {}) is False

    def test_empty_pod_labels(self):
        assert label_selector_matches({}, {"app": "nginx"}) is False

    def test_multiple_keys_all_required(self):
        assert label_selector_matches(
            {"app": "nginx", "env": "prod"}, {"app": "nginx", "env": "staging"}
        ) is False

    def test_missing_key_in_pod(self):
        assert label_selector_matches(
            {"app": "nginx"}, {"app": "nginx", "extra": "value"}
        ) is False
