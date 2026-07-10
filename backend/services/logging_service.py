"""Structured logging for CNI Command Center.

Replaces bare print() calls with stdlib logging throughout the backend.
Configure with LOG_LEVEL env var (default: INFO).

Usage:
    from services.logging_service import get_logger
    logger = get_logger(__name__)
    logger.info("Query succeeded", extra={"query": query})
    logger.error("Query failed", extra={"error": str(e)})
"""

import logging
import os
import sys

_LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
_LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()


def _configure() -> None:
    """Configure the root logger once."""
    logging.basicConfig(
        level=getattr(logging, _LOG_LEVEL, logging.INFO),
        format=_LOG_FORMAT,
        stream=sys.stdout,
        force=True,
    )


_configure()


def get_logger(name: str) -> logging.Logger:
    """Get a structured logger for the given module name."""
    return logging.getLogger(name)
