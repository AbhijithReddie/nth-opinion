"""
Apply pending SQL migrations, in order:   python -m db.migrate   (from backend/)

Migrations are plain .sql files in db/migrations/ named NNN_description.sql. Each one
runs in its own transaction and is recorded in schema_migrations, so running this again
only applies new files. Use --dry-run to list what would run without changing anything.
"""

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

MIGRATIONS = Path(__file__).parent / "migrations"


def pending(applied: set[str]) -> list[Path]:
    files = sorted(p for p in MIGRATIONS.glob("*.sql") if p.stem[:3].isdigit())
    return [p for p in files if p.stem not in applied]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="list pending migrations only")
    args = parser.parse_args()

    load_dotenv()
    import os

    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        print("DATABASE_URL isn't set (see backend/.env.example).", file=sys.stderr)
        return 1

    import psycopg

    with psycopg.connect(url, prepare_threshold=None, autocommit=True) as conn:
        conn.execute(
            "create table if not exists schema_migrations ("
            " version text primary key, applied_at timestamptz not null default now())"
        )
        # Supabase exposes the public schema through its APIs: keep this table private too.
        conn.execute("alter table schema_migrations enable row level security")
        applied = {row[0] for row in conn.execute("select version from schema_migrations")}
        todo = pending(applied)
        if not todo:
            print("Database is up to date.")
            return 0
        for path in todo:
            if args.dry_run:
                print(f"Would apply {path.name}")
                continue
            print(f"Applying {path.name} ...", end=" ", flush=True)
            with conn.transaction():
                conn.execute(path.read_text(encoding="utf-8"))
                conn.execute("insert into schema_migrations (version) values (%s)", (path.stem,))
            print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
