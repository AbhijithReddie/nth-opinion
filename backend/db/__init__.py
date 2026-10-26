"""
The database (Supabase Postgres), used only by the backend for optional accounts.

DATABASE_URL is a Supabase *session pooler* connection string. When it isn't set,
account features are off and everything else works as before (`enabled()`).

A small synchronous psycopg 3 pool: the account endpoints are plain `def` routes, so
FastAPI runs them in its thread pool, and this works the same on Windows and Linux
(psycopg's async mode needs a selector event loop, which Windows doesn't use by default).
"""

import logging
import os
import threading

logger = logging.getLogger("nth_opinion.db")

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

_pool = None
_lock = threading.Lock()


def enabled() -> bool:
    return bool(DATABASE_URL)


def pool():
    """The shared connection pool, opened on first use."""
    global _pool
    if _pool is None:
        with _lock:
            if _pool is None:
                from psycopg.rows import dict_row
                from psycopg_pool import ConnectionPool

                _pool = ConnectionPool(
                    DATABASE_URL,
                    min_size=1,
                    max_size=int(os.getenv("DATABASE_POOL_SIZE", "5")),
                    # No server-side prepared statements: safe behind any Supabase pooler mode.
                    kwargs={"prepare_threshold": None, "row_factory": dict_row, "connect_timeout": 10},
                    timeout=15,  # seconds to wait for a free connection
                    check=ConnectionPool.check_connection,  # drop connections the pooler closed
                    open=True,
                    name="nth-opinion",
                )
                logger.info("Database pool opened (max %s connections)", _pool.max_size)
    return _pool
