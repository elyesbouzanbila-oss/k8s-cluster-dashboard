"""Shared utility functions for CNI Command Center services."""

import re
from typing import Dict, Set


def label_selector_matches(pod_labels: Dict[str, str], selector: Dict[str, str]) -> bool:
    """Check if pod labels match a service's label selector.

    Returns True only when every key in *selector* has an identical value in
    *pod_labels*. An empty selector returns False.
    """
    if not selector:
        return False
    for key, value in selector.items():
        if pod_labels.get(key) != value:
            return False
    return True


def calico_selector_matches(pod_labels: Dict[str, str], selector: str) -> bool:
    """Check if pod labels match a Calico policy selector expression.

    Handles common Calico selector patterns:
      - ``all()`` — matches everything
      - ``has(label)`` — pod has the label key
      - ``!has(label)`` — pod does not have the label key
      - ``label == 'value'`` — exact match
      - ``label != 'value'`` — exact mismatch
      - ``label in {'v1', 'v2'}`` — value in set
      - ``label not in {'v1', 'v2'}`` — value not in set
      - Combinations with ``&&`` (AND) — all must match
      - Combinations with ``||`` (OR) — any must match

    Returns True if the pod labels satisfy the selector, False otherwise.
    An empty or ``all()`` selector returns True (matches everything).
    """
    if not selector or selector.strip() == "all()":
        return True

    selector = selector.strip()

    # Split on || (OR) — if any alternative matches, return True
    if "||" in selector:
        parts = _split_logical_or(selector)
        return any(calico_selector_matches(pod_labels, p.strip()) for p in parts)

    # Split on && (AND) — all must match
    if "&&" in selector:
        parts = [p.strip() for p in selector.split("&&")]
        return all(calico_selector_matches(pod_labels, p) for p in parts)

    # Single expression
    selector = selector.strip()

    # ``all()`` — already handled above, but check again for nested cases
    if selector == "all()":
        return True

    # ``has(label)`` — key exists with any value
    m_has = re.match(r"has\s*\(\s*([^\s)]+)\s*\)", selector)
    if m_has:
        return m_has.group(1) in pod_labels

    # ``!has(label)`` — key does not exist
    m_nothas = re.match(r"!has\s*\(\s*([^\s)]+)\s*\)", selector)
    if m_nothas:
        return m_nothas.group(1) not in pod_labels

    # ``label in {'v1', 'v2', ...}`` — set membership
    m_in = re.match(r"([^\s]+)\s+in\s+\{([^}]+)\}", selector)
    if m_in:
        key = m_in.group(1).strip()
        values = {v.strip().strip("'\"") for v in m_in.group(2).split(",")}
        return pod_labels.get(key) in values

    # ``label not in {'v1', 'v2', ...}`` — set non-membership
    m_notin = re.match(r"([^\s]+)\s+not\s+in\s+\{([^}]+)\}", selector)
    if m_notin:
        key = m_notin.group(1).strip()
        values = {v.strip().strip("'\"") for v in m_notin.group(2).split(",")}
        return pod_labels.get(key) not in values

    # ``label == 'value'`` or ``label = 'value'``
    m_eq = re.match(r"([^\s]+)\s*==?\s*'([^']*)'", selector)
    if m_eq:
        return pod_labels.get(m_eq.group(1).strip()) == m_eq.group(2)

    # ``label != 'value'``
    m_neq = re.match(r"([^\s]+)\s*!=\s*'([^']*)'", selector)
    if m_neq:
        return pod_labels.get(m_neq.group(1).strip()) != m_neq.group(2)

    # Fallback for simple ``label`` presence check
    return selector in pod_labels


def _split_logical_or(selector: str):
    """Split a selector on ||, respecting quoted strings.

    Calico selectors like ``app == 'a' || app == 'b'`` need to split on ``||``
    but not on ``||`` inside quotes. This simple split handles it.
    """
    parts = []
    depth = 0
    current = []
    for ch in selector:
        if ch == "'":
            depth ^= 1
        if ch == "|" and depth == 0:
            continue
        if ch == "|":
            current.append(ch)
            continue
        current.append(ch)
    # Rebuild from the remaining string
    result = []
    buf = []
    in_str = False
    for ch in selector:
        if ch == "'":
            in_str = not in_str
        if ch == "|" and not in_str and buf and buf[-1] == "|":
            buf.pop()
            result.append("".join(buf).strip())
            buf = []
            continue
        buf.append(ch)
    if buf:
        result.append("".join(buf).strip())
    return result


def compute_policy_coverage(pods: list, policies: list) -> list:
    """Compute per-pod policy coverage.

    For each pod, determine which policies select it and whether it is
    exposed (no policies select it).

    Args:
        pods: List of dicts with keys ``name``, ``namespace``, ``labels``
        policies: List of dicts with keys ``name``, ``namespace``, ``type``, ``selector``

    Returns:
        List of dicts with keys ``pod_name``, ``namespace``, ``labels``,
        ``selecting_policies`` (list of policy names), ``exposed`` (bool)
    """
    coverage = []
    for pod in pods:
        pod_labels = pod.get("labels", {}) or {}
        selecting = []
        for policy in policies:
            policy_selector = policy.get("selector", "")
            if policy_selector and calico_selector_matches(pod_labels, policy_selector):
                selecting.append(policy["name"])
        coverage.append({
            "pod_name": pod["name"],
            "namespace": pod["namespace"],
            "labels": pod_labels,
            "selecting_policies": selecting,
            "exposed": len(selecting) == 0,
        })
    return coverage
