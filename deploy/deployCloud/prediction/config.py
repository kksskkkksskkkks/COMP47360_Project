import os


DB_CONFIG = {
    "host":     "db",
    "port":     3306,
    "user":     "root",
    "password":  os.environ.get("DB_PASSWORD", "root"),
    "db_name":  "gem_finder",
}



DATABASE_URL = (
    f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}"
    f"@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['db_name']}"
    f"?charset=utf8mb4"
)

SCHEDULE_CONFIG = {
    "hour":           3,   # daily cron run hour (24h)
    "forecast_hours": 48,  # how many hours ahead to forecast
}

WEATHER_CONFIG = {
    "latitude":  40.7580,          # Manhattan centre
    "longitude": -73.9855,
    "timezone":  "America/New_York",
}