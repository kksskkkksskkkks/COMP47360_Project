"""
Insert 50 placeholder (non-usable) users into the `users` table
(matches com.gemfinder.admin.entity.User).

These accounts are NOT meant to be logged into:
- is_active = 0  -- primary lockout. Make sure your auth code actually
  checks this (e.g. `if (!user.getIsActive()) throw new DisabledException();`
  or, with Spring Security's UserDetails, isEnabled() returns isActive).
- password_hash is a syntactically valid bcrypt hash of a random, unknown
  secret -- nobody knows the plaintext, and it won't be guessable even if
  the is_active check is ever bypassed.
- role = USER -- no elevated privileges.
- token_version = 0, matching the entity's default.

Before running, update:
- DB_CONFIG with your real connection details
- Add any other NOT NULL columns your table has that aren't covered here
  (run: SHOW COLUMNS FROM users;)
"""
import secrets
from datetime import datetime, timezone
import bcrypt
import mysql.connector

# ========== Database connection config -- update with your own ==========
DB_CONFIG = {
    "host": "db",
    "port": 3306,
    "user": "root",
    "password": "root",
    "database": "gem_finder",
}
TABLE_NAME = "users"
NUM_USERS = 50


def unusable_placeholder_hash() -> str:
    """A syntactically valid bcrypt hash of an unknown random secret.
    Safe to store, cannot be matched by any real password, and won't
    crash auth code that expects a well-formed hash."""
    random_secret = secrets.token_hex(32)
    return bcrypt.hashpw(random_secret.encode(), bcrypt.gensalt()).decode()


def build_user(i: int) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "username": f"placeholder_user_{i:03d}",
        "email": f"placeholder_user_{i:03d}@example.com",
        "password_hash": unusable_placeholder_hash(),
        "role": "USER",
        "is_active": 0,        # locked -- cannot log in
        "high_contrast": 0,
        "token_version": 0,
        "created_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "updated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
    }


def main(count: int = NUM_USERS):
    users = [build_user(i + 1) for i in range(count)]

    conn = mysql.connector.connect(**DB_CONFIG)
    try:
        cursor = conn.cursor()
        columns = list(users[0].keys())
        placeholders = ", ".join(["%s"] * len(columns))
        col_names = ", ".join(columns)
        sql = f"INSERT INTO {TABLE_NAME} ({col_names}) VALUES ({placeholders})"
        values = [tuple(u[c] for c in columns) for u in users]
        cursor.executemany(sql, values)
        conn.commit()
        print(f"Inserted {cursor.rowcount} placeholder users into `{TABLE_NAME}` "
              f"(is_active=0, role=USER, password unknown/unusable).")
        cursor.close()
    except mysql.connector.Error as e:
        conn.rollback()
        print(f"Insert failed, rolled back: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
