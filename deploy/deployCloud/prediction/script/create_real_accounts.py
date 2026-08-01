"""
Insert 4 ready-to-use accounts into the `users` table
(matches com.gemfinder.admin.entity.User):
  - 2x SUPERADMIN
  - 1x ADMIN
  - 1x USER

Usage:
1. Edit ACCOUNTS below with your real username/email/password/role.
2. Edit DB_CONFIG with your real connection details.
3. Run: python create_real_accounts.py
4. Passwords are hashed with bcrypt before insertion -- only the hash
   is ever written to the database or printed.
5. Afterwards, clear the plaintext passwords out of this file (or delete
   the file) and make sure it was never committed to git.

Before running, check:
- Role.SUPERADMIN exists in your Java enums.Role class
- The `role` column in MySQL allows SUPERADMIN if it's a native ENUM type
  (run: SHOW COLUMNS FROM users LIKE 'role';)
"""
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

# ========== Fill in real account details here ==========
ACCOUNTS = [
    {"username": "Test_superadmin", "email": "Test@superadmin.com", "password": "Real_Pass_word", "role": "SUPERADMIN"},
]
# =========================================================


def build_user(account: dict) -> dict:
    now = datetime.now(timezone.utc)
    password_hash = bcrypt.hashpw(account["password"].encode(), bcrypt.gensalt()).decode()
    return {
        "username": account["username"],
        "email": account["email"],
        "password_hash": password_hash,
        "role": account["role"],
        "is_active": 1,
        "high_contrast": 0,
        "token_version": 0,
        "created_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "updated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
    }


def main():
    users = [build_user(a) for a in ACCOUNTS]

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
        print(f"Inserted {cursor.rowcount} accounts:")
        for u in users:
            print(f"  - {u['username']} ({u['role']})  email: {u['email']}")
        cursor.close()
    except mysql.connector.Error as e:
        conn.rollback()
        print(f"Insert failed, rolled back: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
