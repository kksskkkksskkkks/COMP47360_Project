"""
Gem Finder - Database Initialization Script
Creates all tables and triggers using SQLAlchemy Core.

Requirements:
    pip install sqlalchemy pymysql

Usage:
    python create_tables.py
"""

import sys
from sqlalchemy import (
    create_engine,
    MetaData,
    Table,
    Column,
    BigInteger,
    Integer,
    SmallInteger,
    Float,
    Boolean,
    Text,
    Date,
    DateTime,
    Enum,
    String,
    TIMESTAMP,
    Index,
    UniqueConstraint,
    ForeignKey,
    text,
    DDL,
    event,
)

import config

# ============================================================
# Database connection
# ============================================================
DB_CONFIG    = config.DB_CONFIG
DATABASE_URL = config.DATABASE_URL


# ============================================================
# Table definitions
# ============================================================
metadata = MetaData()

# --- attractions -------------------------------------------------
attractions = Table(
    "attractions", metadata,

    Column("id",                     BigInteger,  primary_key=True, autoincrement=True),
    Column("osm_id",                 String(64),  nullable=False, unique=True,
           comment="Original OSM ID, prevents duplicate imports"),
    Column("name",                   String(255), nullable=False),
    Column("category",               String(64),  nullable=False,
           comment="e.g. museum, park, landmark"),
    Column("osm_group",              String(64),  nullable=True),
    Column("lat",                    Float,       nullable=False,
           comment="Latitude in decimal degrees, constrained to -90.0 .. 90.0"),
    Column("lon",                    Float,       nullable=False,
           comment="Longitude in decimal degrees, constrained to -180.0 .. 180.0"),
    Column("opening_hours",          String(512), nullable=True,
           comment="Raw OSM opening hours format"),
    Column("opening_hours_source",   String(32),  nullable=True,
           comment="osm | manual"),
    Column("wheelchair",             Boolean,     nullable=False, server_default=text("FALSE"),
           comment="Wheelchair accessibility flag from OSM"),
    Column("avg_rating",             Float,       nullable=False, server_default=text("0.0"),
           comment="Current average rating, maintained by database triggers"),
    Column("rating_count",           Integer,     nullable=False, server_default=text("0"),
           comment="Total number of ratings, maintained by database triggers"),
    Column("zone_id",                Integer,     nullable=False,
           comment="TLC Manhattan zone ID, used to JOIN with busyness_forecast"),
    Column("suggested_duration_min", Integer,     nullable=True,
           comment="Suggested visit duration in minutes"),
    Column("image_path",             String(512), nullable=True,
           comment="Local file path, e.g. /images/met_001.jpg"),
    Column("image_source",           String(32),  nullable=True,
           comment="pexels | pixabay | manual"),
    Column("image_is_fallback",      Boolean,     nullable=False, server_default=text("FALSE"),
           comment="True if a category-level fallback image was used instead of a direct match"),
    Column("created_at",             TIMESTAMP,   nullable=False,
           server_default=text("CURRENT_TIMESTAMP"),
           comment="Import timestamp, written once and never updated"),
    Column("updated_at",             TIMESTAMP,   nullable=False,
           server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
           comment="Last modification timestamp, auto-refreshed on any UPDATE"),

    Index("idx_attractions_zone_id",  "zone_id"),
    Index("idx_attractions_category", "category"),

    mysql_engine="InnoDB",
    mysql_charset="utf8mb4",
    mysql_collate="utf8mb4_unicode_ci",
)

# --- users -------------------------------------------------------
users = Table(
    "users", metadata,

    Column("id",            BigInteger,            primary_key=True, autoincrement=True),
    Column("username",      String(64),            nullable=False, unique=True),
    Column("email",         String(255),           nullable=False, unique=True),
    Column("password_hash", String(255),           nullable=False,
           comment="BCrypt hashed password"),
    Column("role",          Enum("USER", "ADMIN"), nullable=False, server_default="USER",
           comment="USER = regular user, ADMIN = administrator"),
    Column("is_active",     Boolean,               nullable=False, server_default=text("TRUE"),
           comment="Account enabled flag, admins can deactivate accounts"),
    Column("high_contrast", Boolean,               nullable=False, server_default=text("FALSE"),
           comment="High contrast mode preference, synced across devices on login"),
    Column("created_at",    TIMESTAMP,             nullable=False,
           server_default=text("CURRENT_TIMESTAMP"),
           comment="Account registration timestamp, written once and never updated"),
    Column("updated_at",    TIMESTAMP,             nullable=False,
           server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
           comment="Last profile modification timestamp"),

    mysql_engine="InnoDB",
    mysql_charset="utf8mb4",
    mysql_collate="utf8mb4_unicode_ci",
)

# --- user_favorites ----------------------------------------------
user_favorites = Table(
    "user_favorites", metadata,

    Column("id",            BigInteger, primary_key=True, autoincrement=True),
    Column("user_id",       BigInteger, ForeignKey("users.id",       ondelete="CASCADE"), nullable=False),
    Column("attraction_id", BigInteger, ForeignKey("attractions.id", ondelete="CASCADE"), nullable=False),
    Column("created_at",    TIMESTAMP,  nullable=False,
           server_default=text("CURRENT_TIMESTAMP"),
           comment="Timestamp when the user saved the attraction, set by server"),

    UniqueConstraint("user_id", "attraction_id", name="uq_favorites_user_attraction"),

    mysql_engine="InnoDB",
    mysql_charset="utf8mb4",
    mysql_collate="utf8mb4_unicode_ci",
)

# --- user_checkins -----------------------------------------------
user_checkins = Table(
    "user_checkins", metadata,

    Column("id",                BigInteger,   primary_key=True, autoincrement=True),
    Column("user_id",           BigInteger,   ForeignKey("users.id",       ondelete="CASCADE"), nullable=False),
    Column("attraction_id",     BigInteger,   ForeignKey("attractions.id", ondelete="CASCADE"), nullable=False),
    Column("busyness_at_visit", SmallInteger, nullable=True,
           comment="Busyness level snapshot at time of check-in (0-5), read from busyness_forecast"),
    Column("note",              Text,         nullable=True,
           comment="Optional user note attached to the check-in"),
    Column("visited_at",        TIMESTAMP,    nullable=False,
           server_default=text("CURRENT_TIMESTAMP"),
           comment="Check-in timestamp, always set by the server, never accepted from the frontend"),

    Index("idx_checkins_user_id",       "user_id"),
    Index("idx_checkins_attraction_id", "attraction_id"),

    mysql_engine="InnoDB",
    mysql_charset="utf8mb4",
    mysql_collate="utf8mb4_unicode_ci",
)

# --- user_ratings ------------------------------------------------
# avg_rating and rating_count on attractions are maintained
# automatically by three database triggers defined below.
user_ratings = Table(
    "user_ratings", metadata,

    Column("id",            BigInteger, primary_key=True, autoincrement=True),
    Column("user_id",       BigInteger, ForeignKey("users.id",       ondelete="CASCADE"), nullable=False),
    Column("attraction_id", BigInteger, ForeignKey("attractions.id", ondelete="CASCADE"), nullable=False),
    Column("rating",        Float,      nullable=False,
           comment="Rating value between 0.0 and 5.0"),
    Column("comment",       Text,       nullable=True,
           comment="Optional review text"),
    Column("created_at",    TIMESTAMP,  nullable=False,
           server_default=text("CURRENT_TIMESTAMP"),
           comment="First submission timestamp, immutable"),
    Column("updated_at",    TIMESTAMP,  nullable=False,
           server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
           comment="Last edit timestamp, auto-refreshed whenever the rating is modified"),

    UniqueConstraint("user_id", "attraction_id", name="uq_ratings_user_attraction"),

    mysql_engine="InnoDB",
    mysql_charset="utf8mb4",
    mysql_collate="utf8mb4_unicode_ci",
)

# --- busyness_forecast -------------------------------------------
busyness_forecast = Table(
    "busyness_forecast", metadata,

    Column("zone_id",     Integer,  primary_key=True, comment="TLC taxi zone ID"),
    Column("time_bucket", DateTime, primary_key=True,
           comment="30-minute time slot, e.g. 2026-06-08 14:00:00"),
    Column("predicted_dropoffs",      Float,        nullable=False,
           comment="Model-predicted taxi drop-off count"),
    Column("busyness_level",          SmallInteger, nullable=False,
           comment="Global normalised busyness level (0-5), comparable across zones"),
    Column("busyness_level_relative", SmallInteger, nullable=False,
           comment="Zone-relative busyness level (0-5), based on that zone own history"),
    Column("temperature_2m",          Float,        nullable=True,
           comment="Forecast air temperature in Celsius, retained for debugging"),
    Column("precipitation",           Float,        nullable=True,
           comment="Forecast precipitation in mm, retained for debugging"),
    Column("weathercode",             SmallInteger, nullable=True,
           comment="WMO weather code used as model input"),
    Column("windspeed_10m",           Float,        nullable=True,
           comment="Forecast wind speed in m/s, retained for debugging"),
    Column("updated_at",              TIMESTAMP,    nullable=False,
           server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
           comment="Timestamp of the cron run that wrote this batch"),

    Index("idx_time_bucket", "time_bucket"),
    Index("idx_updated_at",  "updated_at"),

    mysql_engine="InnoDB",
    mysql_charset="utf8mb4",
    mysql_collate="utf8mb4_unicode_ci",
    mysql_comment="48-hour busyness forecast written nightly by predict.py",
)

# --- gem_periods -------------------------------------------------
gem_periods = Table(
    "gem_periods", metadata,

    Column("id",             BigInteger,   primary_key=True, autoincrement=True),
    Column("attraction_id",  BigInteger,   ForeignKey("attractions.id", ondelete="CASCADE"), nullable=False),
    Column("start_time",     DateTime,     nullable=False,
           comment="Start of the recommended low-busyness window"),
    Column("end_time",       DateTime,     nullable=False,
           comment="End of the recommended low-busyness window"),
    Column("busyness_level", SmallInteger, nullable=False,
           comment="Busyness level for this window (0-5)"),
    Column("gem_score",      Float,        nullable=False,
           comment="Composite score (high rating x low busyness), used for frontend ranking"),
    Column("forecast_date",  Date,         nullable=False,
           comment="The date this record was generated from; old rows are deleted on each daily refresh"),
    Column("created_at",     TIMESTAMP,    nullable=False,
           server_default=text("CURRENT_TIMESTAMP"),
           comment="Row generation timestamp"),

    Index("idx_gem_periods_attraction_id", "attraction_id"),
    Index("idx_gem_periods_forecast_date", "forecast_date"),
    Index("idx_gem_attraction_time", "attraction_id", "start_time"),

    mysql_engine="InnoDB",
    mysql_charset="utf8mb4",
    mysql_collate="utf8mb4_unicode_ci",
)


# ============================================================
# CHECK constraints — ADD only, no DROP
# Tables are freshly created above so no prior constraints exist.
# ============================================================

event.listen(
    attractions, "after_create",
    DDL("ALTER TABLE attractions "
        "ADD CONSTRAINT chk_lat CHECK (lat  BETWEEN -90.0  AND  90.0), "
        "ADD CONSTRAINT chk_lon CHECK (lon  BETWEEN -180.0 AND 180.0)")
)

event.listen(
    user_checkins, "after_create",
    DDL("ALTER TABLE user_checkins "
        "ADD CONSTRAINT chk_busyness_at_visit "
        "    CHECK (busyness_at_visit IS NULL OR busyness_at_visit BETWEEN 0 AND 5)")
)

event.listen(
    user_ratings, "after_create",
    DDL("ALTER TABLE user_ratings "
        "ADD CONSTRAINT chk_rating_range CHECK (rating BETWEEN 0.0 AND 5.0)")
)

event.listen(
    busyness_forecast, "after_create",
    DDL("ALTER TABLE busyness_forecast "
        "ADD CONSTRAINT chk_busyness_level          CHECK (busyness_level          BETWEEN 0 AND 5), "
        "ADD CONSTRAINT chk_busyness_level_relative CHECK (busyness_level_relative BETWEEN 0 AND 5)")
)

event.listen(
    gem_periods, "after_create",
    DDL("ALTER TABLE gem_periods "
        "ADD CONSTRAINT chk_gem_time            CHECK (end_time > start_time), "
        "ADD CONSTRAINT chk_gem_busyness_level  CHECK (busyness_level BETWEEN 0 AND 5)")
)


# ============================================================
# Triggers — keep avg_rating / rating_count in sync
#
# Each trigger is registered as two separate DDL objects because
# SQLAlchemy executes one SQL statement per DDL call — DROP and
# CREATE cannot be combined in the same DDL string.
# ============================================================

# --- INSERT trigger ----------------------------------------------
event.listen(user_ratings, "after_create",
    DDL("DROP TRIGGER IF EXISTS trg_rating_insert"))
event.listen(user_ratings, "after_create",
    DDL("""
CREATE TRIGGER trg_rating_insert
AFTER INSERT ON user_ratings
FOR EACH ROW
BEGIN
    UPDATE attractions
    SET avg_rating   = (avg_rating * rating_count + NEW.rating) / (rating_count + 1),
        rating_count = rating_count + 1
    WHERE id = NEW.attraction_id;
END
"""))

# --- UPDATE trigger ----------------------------------------------
event.listen(user_ratings, "after_create",
    DDL("DROP TRIGGER IF EXISTS trg_rating_update"))
event.listen(user_ratings, "after_create",
    DDL("""
CREATE TRIGGER trg_rating_update
AFTER UPDATE ON user_ratings
FOR EACH ROW
BEGIN
    UPDATE attractions
    SET avg_rating = (avg_rating * rating_count - OLD.rating + NEW.rating) / rating_count
    WHERE id = NEW.attraction_id;
END
"""))

# --- DELETE trigger ----------------------------------------------
event.listen(user_ratings, "after_create",
    DDL("DROP TRIGGER IF EXISTS trg_rating_delete"))
event.listen(user_ratings, "after_create",
    DDL("""
CREATE TRIGGER trg_rating_delete
AFTER DELETE ON user_ratings
FOR EACH ROW
BEGIN
    UPDATE attractions
    SET avg_rating   = CASE
                           WHEN rating_count <= 1 THEN 0.0
                           ELSE (avg_rating * rating_count - OLD.rating) / (rating_count - 1)
                       END,
        rating_count = GREATEST(rating_count - 1, 0)
    WHERE id = OLD.attraction_id;
END
"""))


# ============================================================
# Main
# ============================================================
def main():
    print("=== Gem Finder — Database Initialization ===\n")

    # Step 1: create database if it does not exist
    root_url = (
        f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}"
        f"@{DB_CONFIG['host']}:{DB_CONFIG['port']}?charset=utf8mb4"
    )
    try:
        root_engine = create_engine(root_url)
        with root_engine.connect() as conn:
            conn.execute(text(
                f"CREATE DATABASE IF NOT EXISTS `{DB_CONFIG['db_name']}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            ))
            conn.commit()
        print(f"  ✓ Database '{DB_CONFIG['db_name']}' is ready")
        root_engine.dispose()
    except Exception as e:
        print(f"  ✗ Failed to create database: {e}")
        sys.exit(1)

    # Step 2: create all tables, constraints, and triggers
    try:
        engine = create_engine(DATABASE_URL)
        metadata.create_all(engine)

        print(f"  ✓ {len(metadata.tables)} tables created successfully\n")
        for table_name in metadata.tables:
            print(f"    · {table_name}")

        print()
        print("  ✓ CHECK constraints applied")
        print("    · chk_lat / chk_lon                      (attractions)")
        print("    · chk_busyness_at_visit                  (user_checkins)")
        print("    · chk_rating_range                       (user_ratings)")
        print("    · chk_busyness_level / _relative         (busyness_forecast)")
        print("    · chk_gem_time / chk_gem_busyness_level  (gem_periods)")

        print()
        print("  ✓ Triggers created successfully")
        print("    · trg_rating_insert  (AFTER INSERT ON user_ratings)")
        print("    · trg_rating_update  (AFTER UPDATE ON user_ratings)")
        print("    · trg_rating_delete  (AFTER DELETE ON user_ratings)")

        print("\n=== Done ===")
        engine.dispose()
    except Exception as e:
        print(f"  ✗ Failed to create tables / triggers: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()