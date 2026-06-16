"""
Predict.py — daily batch inference, writes results to MySQL busyness_forecast table.

Usage:
    python Predict.py        # run once on startup, then loop on daily schedule
    python Predict.py --now  # run once and exit (for manual testing)

Dependencies:
    pip install lightgbm pandas numpy requests mysql-connector-python schedule holidays
"""

import multiprocessing
multiprocessing.set_start_method('fork')

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta

import holidays
import mysql.connector
import numpy as np
import pandas as pd
import requests
import schedule
import lightgbm as lgb

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from config import DB_CONFIG, SCHEDULE_CONFIG, WEATHER_CONFIG

# ── Logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger(__name__)

# ── Config ──────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

_DB = {
    'host':     DB_CONFIG['host'],
    'port':     DB_CONFIG['port'],
    'database': DB_CONFIG['db_name'],
    'user':     DB_CONFIG['user'],
    'password': DB_CONFIG['password'],
    'charset':  'utf8mb4',
}

SCHEDULE_HOUR  = SCHEDULE_CONFIG['hour']
FORECAST_HOURS = SCHEDULE_CONFIG['forecast_hours']
WX_LAT         = WEATHER_CONFIG['latitude']
WX_LON         = WEATHER_CONFIG['longitude']
WX_TZ          = WEATHER_CONFIG['timezone']

GEM_GENERATE_URL = 'http://localhost:8080/api/recommendations/generate'

# ── Model & features ────────────────────────────────────────────────
model = lgb.Booster(model_file=os.path.join(BASE_DIR, '../ML/output/lgb_model.txt'))

with open(os.path.join(BASE_DIR, '../ML/output/feature_cols.json')) as f:
    FEATURE_COLS = json.load(f)

# ── Historical data ──────────────────────────────────────────────────
historical_df = pd.read_csv(
    os.path.join(BASE_DIR, '../ML/output/combined_dropoffs.csv'),
    parse_dates=['time_bucket']
)
historical_df['iso_week']  = historical_df['time_bucket'].dt.isocalendar().week.astype(int)
historical_df['dayofweek'] = historical_df['time_bucket'].dt.dayofweek
historical_df['hour']      = historical_df['time_bucket'].dt.hour
historical_df['minute']    = historical_df['time_bucket'].dt.minute

_ts_lookup = (
    historical_df
    .set_index(['zone_id', 'time_bucket'])['total_dropoffs']
    .to_dict()
)

ZONE_IDS = sorted(historical_df['zone_id'].unique().tolist())
log.info(f"Loaded {len(ZONE_IDS)} zones from historical data")

# ── Busyness normalisation baseline ─────────────────────────────────
zone_max = (
    historical_df.groupby('zone_id')['total_dropoffs']
    .quantile(0.95)
    .to_dict()
)
GLOBAL_MAX = float(pd.Series(list(zone_max.values())).quantile(0.95)) or 1.0
log.info(f"GLOBAL_MAX = {GLOBAL_MAX:.1f}")

us_holidays = holidays.US(state='NY', years=[2025, 2026, 2027])


# ════════════════════════════════════════════════════════════════════
# Weather forecast
# ════════════════════════════════════════════════════════════════════

def fetch_forecast_weather(forecast_hours: int) -> pd.DataFrame:
    url = 'https://api.open-meteo.com/v1/forecast'
    params = {
        'latitude':      WX_LAT,
        'longitude':     WX_LON,
        'hourly':        'temperature_2m,precipitation,weathercode,windspeed_10m',
        'timezone':      WX_TZ,
        'forecast_days': (forecast_hours // 24) + 2,
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()['hourly']

    wx = pd.DataFrame(data)
    wx['hour_bucket'] = pd.to_datetime(wx['time']).dt.floor('h')
    wx = wx.drop(columns=['time'])

    now    = pd.Timestamp.now().floor('h')
    cutoff = now + timedelta(hours=forecast_hours)
    wx     = wx[(wx['hour_bucket'] >= now) & (wx['hour_bucket'] < cutoff)]

    log.info(f"Weather forecast: {len(wx)} hours "
             f"({wx['hour_bucket'].min()} → {wx['hour_bucket'].max()})")
    return wx.reset_index(drop=True)


# ════════════════════════════════════════════════════════════════════
# Lag helper functions
# ════════════════════════════════════════════════════════════════════

def _get_anchor(zone_id: int, target_time: pd.Timestamp):
    tw  = target_time.isocalendar().week
    dow = target_time.dayofweek
    hr  = target_time.hour
    mn  = target_time.minute

    mask = (
        (historical_df['zone_id']   == zone_id) &
        (historical_df['iso_week']  == tw) &
        (historical_df['dayofweek'] == dow) &
        (historical_df['hour']      == hr) &
        (historical_df['minute']    == mn)
    )
    hit = historical_df.loc[mask, 'time_bucket']
    if len(hit):
        return hit.iloc[0]

    mask2 = (
        (historical_df['zone_id']   == zone_id) &
        (historical_df['dayofweek'] == dow) &
        (historical_df['hour']      == hr) &
        (historical_df['minute']    == mn)
    )
    hit2 = historical_df.loc[mask2, 'time_bucket']
    return hit2.iloc[0] if len(hit2) else None


def _lag_from_anchor(zone_id, anchor_ts, lag_weeks):
    if anchor_ts is None:
        return 0.0
    lag_ts = pd.Timestamp(anchor_ts) - timedelta(weeks=lag_weeks)
    return float(_ts_lookup.get((zone_id, lag_ts), 0.0))


def _rolling_mean_from_anchor(zone_id, anchor_ts):
    if anchor_ts is None:
        return 0.0
    anchor = pd.Timestamp(anchor_ts)
    end    = anchor - timedelta(weeks=1)
    start  = anchor - timedelta(weeks=5)
    mask = (
        (historical_df['zone_id']     == zone_id) &
        (historical_df['time_bucket'] >  start)   &
        (historical_df['time_bucket'] <= end)
    )
    vals = historical_df.loc[mask, 'total_dropoffs']
    return float(vals.mean()) if len(vals) > 0 else 0.0


# ════════════════════════════════════════════════════════════════════
# Feature matrix (batch)
# ════════════════════════════════════════════════════════════════════

from multiprocessing import Pool, cpu_count

def _build_zone_features(args):
    zone_id, time_slots, wx_lookup = args
    rows = []
    for ts in time_slots:
        wx     = wx_lookup.get(ts.floor('h'), {})
        anchor = _get_anchor(zone_id, ts)
        rows.append({
            'zone_id':         zone_id,
            'slot_of_day':     ts.hour * 2 + int(ts.minute >= 30),
            'dayofweek':       ts.dayofweek,
            'is_weekend':      int(ts.dayofweek >= 5),
            'month':           ts.month,
            'is_holiday':      int(ts.date() in us_holidays),
            'hour_sin':        np.sin(2 * np.pi * ts.hour / 24),
            'hour_cos':        np.cos(2 * np.pi * ts.hour / 24),
            'dow_sin':         np.sin(2 * np.pi * ts.dayofweek / 7),
            'dow_cos':         np.cos(2 * np.pi * ts.dayofweek / 7),
            'month_sin':       np.sin(2 * np.pi * ts.month / 12),
            'month_cos':       np.cos(2 * np.pi * ts.month / 12),
            'lag_1w':          _lag_from_anchor(zone_id, anchor, 1),
            'lag_2w':          _lag_from_anchor(zone_id, anchor, 2),
            'lag_3w':          _lag_from_anchor(zone_id, anchor, 3),
            'rolling_mean_4w': _rolling_mean_from_anchor(zone_id, anchor),
            'temperature_2m':  float(wx.get('temperature_2m', 15)),
            'precipitation':   float(wx.get('precipitation', 0)),
            'weathercode':     float(wx.get('weathercode', 1)),
            'windspeed_10m':   float(wx.get('windspeed_10m', 5)),
            'is_raining':      int(float(wx.get('precipitation', 0)) > 0.2),
            '_time_bucket':    ts,
            '_temperature_2m': float(wx.get('temperature_2m', 15)),
            '_precipitation':  float(wx.get('precipitation', 0)),
            '_weathercode':    int(wx.get('weathercode', 1)),
            '_windspeed_10m':  float(wx.get('windspeed_10m', 5)),
        })
    return rows


def build_feature_matrix(zone_ids: list, time_slots: list,
                         wx_df: pd.DataFrame) -> pd.DataFrame:
    wx_lookup = wx_df.set_index('hour_bucket').to_dict('index')
    args = [(zone_id, time_slots, wx_lookup) for zone_id in zone_ids]

    workers = min(cpu_count() - 2, len(zone_ids))
    log.info(f"Using {workers} parallel workers")

    with Pool(processes=workers) as pool:
        results = pool.map(_build_zone_features, args)

    rows = [row for zone_rows in results for row in zone_rows]
    return pd.DataFrame(rows)


# ════════════════════════════════════════════════════════════════════
# Busyness level
# ════════════════════════════════════════════════════════════════════

def to_level_global(predicted: float) -> int:
    ratio = predicted / GLOBAL_MAX
    if   ratio < 0.20: return 1
    elif ratio < 0.40: return 2
    elif ratio < 0.60: return 3
    elif ratio < 0.80: return 4
    else:              return 5


def to_level_relative(predicted: float, zone_id: int) -> int:
    z_max = zone_max.get(zone_id, 0)
    if z_max == 0:
        return 1
    ratio = predicted / z_max
    if   ratio < 0.20: return 1
    elif ratio < 0.40: return 2
    elif ratio < 0.60: return 3
    elif ratio < 0.80: return 4
    else:              return 5


# ════════════════════════════════════════════════════════════════════
# Gem generation trigger
# ════════════════════════════════════════════════════════════════════

def trigger_gem_generation():
    """Calls Spring Boot to regenerate gem periods after busyness data is ready."""
    try:
        log.info("Triggering gem period generation...")
        resp = requests.post(GEM_GENERATE_URL, timeout=300)
        if resp.status_code == 200:
            log.info("Gem generation completed successfully")
        else:
            log.warning(f"Gem generation returned status {resp.status_code}")
    except Exception as e:
        log.error(f"Failed to trigger gem generation: {e}")


# ════════════════════════════════════════════════════════════════════
# Main job
# ════════════════════════════════════════════════════════════════════

def run_forecast():
    log.info("=== forecast job started ===")
    t0 = time.time()

    # 1. Fetch weather forecast
    try:
        wx_df = fetch_forecast_weather(FORECAST_HOURS)
    except Exception as e:
        log.error(f"Weather fetch failed: {e}")
        return

    # 2. Generate 30-minute slots for the next 48h
    now   = pd.Timestamp.now().floor('30min')
    slots = [now + timedelta(minutes=30 * i) for i in range(FORECAST_HOURS * 2)]

    # 3. Build feature matrix and run inference
    log.info(f"Building matrix: {len(ZONE_IDS)} zones × {len(slots)} slots "
             f"= {len(ZONE_IDS) * len(slots)} rows")
    df        = build_feature_matrix(ZONE_IDS, slots, wx_df)
    predicted = np.clip(model.predict(df[FEATURE_COLS]), 0, None)

    df['predicted_dropoffs']      = predicted
    df['busyness_level']          = [to_level_global(p) for p in predicted]
    df['busyness_level_relative'] = [
        to_level_relative(p, z) for p, z in zip(predicted, df['zone_id'])
    ]
    log.info(f"Inference done in {time.time() - t0:.1f}s")

    # 4. Write to MySQL
    updated_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    sql = """
        INSERT INTO busyness_forecast
            (zone_id, time_bucket, predicted_dropoffs,
             busyness_level, busyness_level_relative,
             temperature_2m, precipitation, weathercode, windspeed_10m,
             updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            predicted_dropoffs      = VALUES(predicted_dropoffs),
            busyness_level          = VALUES(busyness_level),
            busyness_level_relative = VALUES(busyness_level_relative),
            temperature_2m          = VALUES(temperature_2m),
            precipitation           = VALUES(precipitation),
            weathercode             = VALUES(weathercode),
            windspeed_10m           = VALUES(windspeed_10m),
            updated_at              = VALUES(updated_at)
    """
    records = [
        (
            int(row['zone_id']),
            row['_time_bucket'].strftime('%Y-%m-%d %H:%M:%S'),
            round(float(row['predicted_dropoffs']), 1),
            int(row['busyness_level']),
            int(row['busyness_level_relative']),
            round(float(row['_temperature_2m']), 2),
            round(float(row['_precipitation']), 2),
            int(row['_weathercode']),
            round(float(row['_windspeed_10m']), 2),
            updated_at,
        )
        for _, row in df.iterrows()
    ]

    try:
        conn   = mysql.connector.connect(**_DB)
        cursor = conn.cursor()
        cursor.executemany(sql, records)
        conn.commit()
        log.info(f"DB write done: {len(records)} rows upserted")
    except Exception as e:
        log.error(f"DB write failed: {e}")
        return  # Don't trigger gem generation if busyness write failed
    finally:
        cursor.close()
        conn.close()

    log.info(f"=== forecast job finished in {time.time() - t0:.1f}s ===")

    # 5. Trigger gem period generation now that busyness data is ready
    trigger_gem_generation()


# ════════════════════════════════════════════════════════════════════
# Entry point
# ════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--now', action='store_true',
                        help='Run once immediately and exit, skip the daily scheduler')
    args = parser.parse_args()

    if args.now:
        run_forecast()
    else:
        log.info("Running initial forecast on startup...")
        run_forecast()

        schedule_time = f"{SCHEDULE_HOUR:02d}:00"
        schedule.every().day.at(schedule_time).do(run_forecast)
        log.info(f"Scheduler started: will run daily at {schedule_time}")

        while True:
            schedule.run_pending()
            time.sleep(60)