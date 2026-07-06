"""Shared utility functions for CNI Command Center services."""

from typing import Dict


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
