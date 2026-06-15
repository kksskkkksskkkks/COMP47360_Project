"""
Gem Finder — Import attractions from CSV into the attractions table.

Usage:
    python import_attractions.py

Requirements:
    pip install mysql-connector-python
"""

import sys
import csv
import os
import mysql.connector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

# ── hardcoded CSV path ─────────────────────────────────────────────────────
CSV_PATH = "output/attractions_final_v2.csv"

# ── database connection ────────────────────────────────────────────────────
_DB = {
    "host":     config.DB_CONFIG["host"],
    "port":     config.DB_CONFIG["port"],
    "database": config.DB_CONFIG["db_name"],
    "user":     config.DB_CONFIG["user"],
    "password": config.DB_CONFIG["password"],
    "charset":  "utf8mb4",
}

# ── column handling ────────────────────────────────────────────────────────

# CSV column → DB column (rename where names differ)
COLUMN_MAP = {
    "suggested_duration": "suggested_duration_min",
}

SKIP_COLUMNS = set()

FLOAT_COLUMNS      = {"lat", "lon", "avg_rating", "original_avg_rating"}
INT_COLUMNS        = {"zone_id", "suggested_duration_min", "rating_count", "original_rating_count"}
WHEELCHAIR_COLUMNS = {"wheelchair"}

# wheelchair TINYINT: yes → 2, limited → 1, no/other → 0
_WHEELCHAIR_MAP = {
    "yes":     2,
    "limited": 1,
    "no":      0,
}

def _to_wheelchair(val: str) -> int:
    return _WHEELCHAIR_MAP.get(str(val).strip().lower(), 0)


def coerce(col_db: str, raw: str):
    """Cast a raw CSV string to the correct Python type for the DB column."""
    if raw is None or raw.strip() == "":
        return None
    if col_db in WHEELCHAIR_COLUMNS:
        return _to_wheelchair(raw)
    if col_db in INT_COLUMNS:
        return int(float(raw))
    if col_db in FLOAT_COLUMNS:
        return float(raw)
    return raw.strip()


def build_row(csv_row: dict) -> dict | None:
    """
    Convert one CSV dict-row into a DB-ready dict.
    Returns None if osm_id is missing (row will be skipped).
    """
    db_row = {}
    for csv_col, raw_val in csv_row.items():
        csv_col = csv_col.strip()
        if csv_col in SKIP_COLUMNS:
            continue
        db_col = COLUMN_MAP.get(csv_col, csv_col)
        db_row[db_col] = coerce(db_col, raw_val)

    if not db_row.get("osm_id"):
        return None

    # Preserve original rating data — these values are never
    # overwritten by refreshRatingStats; they serve as the baseline for
    # the merged weighted average calculation.
    db_row["original_avg_rating"]   = db_row.get("avg_rating") or 0.0
    db_row["original_rating_count"] = db_row.get("rating_count") or 0

    return db_row


# ── insert ─────────────────────────────────────────────────────────────────

def insert_rows(rows: list[dict]) -> tuple[int, int, int]:
    """
    Bulk-insert with INSERT IGNORE — duplicates on osm_id are silently skipped.
    Returns (inserted, skipped_duplicates, errors).
    """
    if not rows:
        return 0, 0, 0

    cols         = list(rows[0].keys())
    col_list     = ", ".join([f"`{c}`" for c in cols])
    placeholders = ", ".join([f"%({c})s" for c in cols])
    sql = f"INSERT IGNORE INTO attractions ({col_list}) VALUES ({placeholders})"

    inserted = skipped = errors = 0

    cnx    = mysql.connector.connect(**_DB)
    cursor = cnx.cursor()

    for row in rows:
        try:
            cursor.execute(sql, row)
            if cursor.rowcount == 1:
                inserted += 1
            else:
                skipped += 1
        except mysql.connector.Error as err:
            errors += 1
            print(f"  ✗ Error on osm_id={row.get('osm_id')}: {err}")

    cnx.commit()
    cursor.close()
    cnx.close()
    return inserted, skipped, errors


# ── main ───────────────────────────────────────────────────────────────────

def main():
    print("=== Gem Finder — Attractions Import ===\n")
    print(f"  Source : {CSV_PATH}")
    print(f"  Target : {_DB['database']}@{_DB['host']}:{_DB['port']}\n")

    rows     = []
    bad_rows = []

    try:
        with open(CSV_PATH, newline="", encoding="utf-8-sig") as fh:
            # auto-detect tab vs comma delimiter
            reader = csv.DictReader(fh, delimiter="\t")
            if len(reader.fieldnames or []) == 1:
                fh.seek(0)
                reader = csv.DictReader(fh, delimiter=",")

            for line_num, csv_row in enumerate(reader, start=2):
                db_row = build_row(csv_row)
                if db_row is None:
                    bad_rows.append(line_num)
                    print(f"  ⚠ Line {line_num}: skipped — missing osm_id")
                else:
                    rows.append(db_row)

    except FileNotFoundError:
        print(f"  ✗ File not found: {CSV_PATH}")
        sys.exit(1)

    print(f"  Parsed  : {len(rows)} valid rows, {len(bad_rows)} skipped\n")

    inserted, skipped, errors = insert_rows(rows)

    print(f"  ✓ Inserted  : {inserted}")
    print(f"  ↷ Duplicates: {skipped}  (osm_id already exists — safely ignored)")
    print(f"  ✗ Errors    : {errors}")
    print("\n=== Done ===")


if __name__ == "__main__":
    main()