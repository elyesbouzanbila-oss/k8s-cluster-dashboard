"""
Tests for calico_service.py — focuses on pure helper functions
that don't require a live Kubernetes API.
"""

from typing import Dict, Any

from services.calico_service import (
    _count_policy_rules,
    _extract_rule_actions,
    _label_selector_matches,
)


# ───── _count_policy_rules ─────────────────────────────────────────

class TestCountPolicyRules:
    def test_empty_spec(self):
        """A spec with no ingress/egress should count 0 rules."""
        assert _count_policy_rules({}) == 0

    def test_ingress_only(self):
        spec = {"ingress": [{"action": "Allow"}]}
        assert _count_policy_rules(spec) == 1

    def test_egress_only(self):
        spec = {"egress": [{"action": "Deny"}, {"action": "Allow"}]}
        assert _count_policy_rules(spec) == 2

    def test_both_directions(self):
        spec = {
            "ingress": [{"action": "Allow"}],
            "egress": [{"action": "Deny"}, {"action": "Log"}],
        }
        assert _count_policy_rules(spec) == 3  # 1 ingress + 2 egress

    def test_ingress_is_not_a_list(self):
        """If ingress is a dict instead of list, it should be skipped."""
        spec = {"ingress": {"action": "Allow"}}  # not a list
        assert _count_policy_rules(spec) == 0

    def test_large_policy(self):
        spec = {
            "ingress": [{"action": "Allow"}] * 50,
            "egress": [{"action": "Deny"}] * 50,
        }
        assert _count_policy_rules(spec) == 100


# ───── _extract_rule_actions ───────────────────────────────────────

class TestExtractRuleActions:
    def test_no_rules(self):
        assert _extract_rule_actions({}) == []

    def test_single_action(self):
        spec = {"ingress": [{"action": "Allow"}]}
        assert _extract_rule_actions(spec) == ["Allow"]

    def test_multiple_unique_actions(self):
        spec = {
            "ingress": [{"action": "Allow"}],
            "egress": [{"action": "Deny"}, {"action": "Log"}],
        }
        actions = _extract_rule_actions(spec)
        assert actions == sorted(["Allow", "Deny", "Log"])

    def test_duplicate_actions_are_deduplicated(self):
        spec = {
            "ingress": [{"action": "Allow"}, {"action": "Allow"}],
            "egress": [{"action": "Allow"}],
        }
        assert _extract_rule_actions(spec) == ["Allow"]

    def test_rule_without_action_defaults_to_allow(self):
        spec = {"ingress": [{}]}
        assert _extract_rule_actions(spec) == ["Allow"]

    def test_passthrough_action(self):
        spec = {"ingress": [{"action": "Pass"}]}
        assert _extract_rule_actions(spec) == ["Pass"]

    def test_ingress_is_not_a_list(self):
        """Non-list ingress should not crash; no actions extracted."""
        spec = {"ingress": "not-a-list"}
        assert _extract_rule_actions(spec) == []


# ───── _label_selector_matches ─────────────────────────────────────

class TestLabelSelectorMatches:
    def test_exact_match(self):
        pod_labels = {"app": "nginx", "version": "v1"}
        selector = {"app": "nginx"}
        assert _label_selector_matches(pod_labels, selector) is True

    def test_no_match(self):
        pod_labels = {"app": "nginx"}
        selector = {"app": "redis"}
        assert _label_selector_matches(pod_labels, selector) is False

    def test_pod_has_extra_labels(self):
        """Extra pod labels beyond the selector should not matter."""
        pod_labels = {"app": "nginx", "tier": "frontend", "env": "prod"}
        selector = {"app": "nginx", "tier": "frontend"}
        assert _label_selector_matches(pod_labels, selector) is True

    def test_empty_selector_returns_false(self):
        assert _label_selector_matches({"app": "nginx"}, {}) is False

    def test_empty_pod_labels(self):
        assert _label_selector_matches({}, {"app": "nginx"}) is False

    def test_empty_both(self):
        assert _label_selector_matches({}, {}) is False

    def test_multiple_selector_keys_all_must_match(self):
        pod_labels = {"app": "nginx", "env": "prod"}
        selector = {"app": "nginx", "env": "staging"}
        assert _label_selector_matches(pod_labels, selector) is False

    def test_selector_key_missing_from_pod(self):
        pod_labels = {"app": "nginx"}
        selector = {"app": "nginx", "tier": "frontend"}
        assert _label_selector_matches(pod_labels, selector) is False
