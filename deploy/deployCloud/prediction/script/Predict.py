"""
Predict.py — daily batch inference, writes results to MySQL busyness_forecast table.

Usage:
    python Predict.py        # run once on startup, then loop on daily schedule
    python Predict.py --now  # run once and exit (for manual testing)

Dependencies:
    pip install lightgbm pandas numpy requests mysql-connector-python schedule holidays

Optimization notes (vs. original version):
    1. Memory: historical_df is read with compact dtypes (int32/float32)
       instead of pandas' default int64/float64 — halves the footprint of
       these two columns, no precision impact for this use case. The
       derived calendar columns (iso_week/dayofweek/hour/minute) are also
       stored as int8 — their value ranges fit comfortably (e.g. hour is
       0-23), this only shrinks the index tables built from them, no
       effect on any computed value.
    2. Memory: _ts_lookup is kept as a sorted pandas Series (MultiIndex)
       instead of being converted to a Python dict — avoids the large
       per-row Python object overhead that dict conversion incurs on a
       ~27M-row table. This was the single largest memory cost in the
       original script.
    3. Speed: _get_anchor() previously ran a full boolean-mask scan over
       the entire ~27M-row historical_df on every single call (one call
       per zone per forecast time slot). It's replaced with two
       pre-built groupby lookup tables (built once, at startup) so each
       call becomes an indexed lookup instead of a full scan.
    4. Speed: _rolling_mean_from_anchor() had the same full-table-scan
       problem as _get_anchor() — same call frequency, same O(n) cost
       per call — and became the dominant bottleneck once (3) was fixed.
       It's replaced with a per-zone sorted-array + cumulative-sum
       structure (built once, at startup): each call now finds the
       window boundaries with binary search (np.searchsorted) and reads
       the window sum as a difference of two cumulative-sum lookups,
       turning an O(n) per-call scan into O(log n).

    All of the above only change *how* the same values are looked up /
    computed — the (key -> value) relationships, the rolling-window
    definition (time_bucket > start AND <= end, where start/end are
    anchor - 5/1 weeks), and therefore every feature value fed into the
    model, are unchanged. Output should be identical to the original
    implementation (verify with a before/after diff of the
    busyness_forecast table after deploying).
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

GEM_GENERATE_URL = 'http://backend:8080/api/recommendations/generate'
# GEM_GENERATE_URL    = 'http://localhost:8080/api/recommendations/generate'
GEM_INTERNAL_SECRET = os.environ.get('INTERNAL_SECRET', 'dev-secret-change-in-prod')

# ── Model & features ────────────────────────────────────────────────
model = lgb.Booster(model_file=os.path.join(BASE_DIR, '../ML/output/lgb_model.txt'))

with open(os.path.join(BASE_DIR, '../ML/output/feature_cols.json')) as f:
    FEATURE_COLS = json.load(f)

# ── Historical data ──────────────────────────────────────────────────
# Memory optimization: explicit compact dtypes (int32/float32 instead of
# pandas' default int64/float64). zone_id is a small integer ID — no risk
# of overflow. total_dropoffs is a count-like business metric; float32's
# ~7 significant digits of precision is far beyond what matters for this
# value or for the downstream LightGBM model. No effect on prediction
# output, roughly halves the memory of these two columns.
historical_df = pd.read_csv(
    os.path.join(BASE_DIR, '../ML/output/combined_dropoffs.csv'),
    parse_dates=['time_bucket'],
    dtype={'zone_id': 'int32', 'total_dropoffs': 'float32'}
)
# int8 is plenty for these (hour: 0-23, minute: 0/30, dayofweek: 0-6,
# iso_week: 1-53) — only shrinks the lookup index tables built below,
# does not change any value.
historical_df['iso_week']  = historical_df['time_bucket'].dt.isocalendar().week.astype('int8')
historical_df['dayofweek'] = historical_df['time_bucket'].dt.dayofweek.astype('int8')
historical_df['hour']      = historical_df['time_bucket'].dt.hour.astype('int8')
historical_df['minute']    = historical_df['time_bucket'].dt.minute.astype('int8')

# Memory optimization: keep this as a sorted pandas Series (MultiIndex on
# zone_id + time_bucket) instead of calling .to_dict(). Converting ~27M
# rows to a Python dict was the single largest memory cost in the whole
# script (each row becomes an individual Python object with its own
# overhead). A sorted Series supports the same "look up by (zone_id,
# time_bucket) key" access pattern via .loc[], with comparable lookup
# speed (binary search on a sorted index) and a much smaller memory
# footprint. See _lag_from_anchor() below for the corresponding lookup
# code — the (key -> value, default 0.0 if missing) semantics are
# unchanged, so prediction output is identical to the original dict-based
# implementation.
_ts_lookup = (
    historical_df
    .set_index(['zone_id', 'time_bucket'])['total_dropoffs']
    .sort_index()
)

# Speed optimization: pre-built lookup tables for _get_anchor(), built
# once at startup. The original implementation re-scanned the entire
# ~27M-row historical_df with a boolean mask on every single call (one
# call per zone per forecast time slot), which was by far the dominant
# cost on a single CPU core. These two groupby Series let each call
# become an indexed lookup instead.
#
# .first() picks the first matching row per group, which is the same
# row .iloc[0] would have picked from the original boolean-mask result
# (both preserve the original row order of historical_df), so the
# returned time_bucket values are identical to the original
# implementation for every (zone_id, ...) combination that has a match.
_anchor_lookup_exact = (
    historical_df
    .groupby(['zone_id', 'iso_week', 'dayofweek', 'hour', 'minute'])['time_bucket']
    .first()
)
_anchor_lookup_fallback = (
    historical_df
    .groupby(['zone_id', 'dayofweek', 'hour', 'minute'])['time_bucket']
    .first()
)

# Speed optimization: per-zone sorted timestamp array + cumulative-sum
# array for _rolling_mean_from_anchor(). The original implementation
# re-scanned the entire ~27M-row historical_df with a boolean mask on
# every single call — same call frequency, same O(n) cost as the old
# _get_anchor() — and became the new bottleneck once _get_anchor() was
# fixed. Built once at startup; each call then does two binary searches
# (np.searchsorted) to find the window boundaries and reads the window
# sum as a difference of two cumulative-sum values, turning an O(n)
# per-call scan into O(log n). The window definition (time_bucket >
# start AND <= end) is preserved exactly — see _rolling_mean_from_anchor()
# below for the boundary-matching searchsorted calls.
_zone_time_index = {}
for _zone_id, _group in historical_df.groupby('zone_id'):
    _g = _group.sort_values('time_bucket')
    _times = _g['time_bucket'].values.astype('datetime64[ns]')
    _vals = _g['total_dropoffs'].values.astype('float64')
    _cumsum = np.concatenate(([0.0], np.cumsum(_vals)))
    _zone_time_index[_zone_id] = (_times, _cumsum)
del _zone_id, _group, _g, _times, _vals, _cumsum

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
    """
    Returns the historical time_bucket matching the same
    (zone_id, iso_week, dayofweek, hour, minute) as target_time, falling
    back to matching on (zone_id, dayofweek, hour, minute) only if no
    exact-week match exists. Returns None if neither matches.

    Indexed-lookup version of the original boolean-mask scan — same
    matching rules, same fallback order, same result for every input;
    just avoids re-scanning the full ~27M-row table on every call.
    """
    tw  = target_time.isocalendar().week
    dow = target_time.dayofweek
    hr  = target_time.hour
    mn  = target_time.minute

    try:
        return _anchor_lookup_exact.loc[(zone_id, tw, dow, hr, mn)]
    except KeyError:
        pass

    try:
        return _anchor_lookup_fallback.loc[(zone_id, dow, hr, mn)]
    except KeyError:
        return None


def _lag_from_anchor(zone_id, anchor_ts, lag_weeks):
    if anchor_ts is None:
        return 0.0
    lag_ts = pd.Timestamp(anchor_ts) - timedelta(weeks=lag_weeks)
    # Equivalent to the original dict.get((zone_id, lag_ts), 0.0): look up
    # by the same (zone_id, time_bucket) key, return 0.0 if not found.
    try:
        return float(_ts_lookup.loc[(zone_id, lag_ts)])
    except KeyError:
        return 0.0


def _rolling_mean_from_anchor(zone_id, anchor_ts):
    """
    Mean of total_dropoffs for this zone over (anchor - 5 weeks,
    anchor - 1 week] — same window definition as the original
    implementation. Uses a per-zone sorted-timestamp + cumulative-sum
    structure (built once at startup) and two binary searches instead of
    re-scanning the full historical_df on every call.
    """
    if anchor_ts is None:
        return 0.0

    entry = _zone_time_index.get(zone_id)
    if entry is None:
        return 0.0
    times, cumsum = entry

    anchor = pd.Timestamp(anchor_ts)
    start  = np.datetime64(anchor - timedelta(weeks=5))
    end    = np.datetime64(anchor - timedelta(weeks=1))

    # left  = first index with times > start   (matches "> start")
    # right = first index with times > end     (matches "<= end" as the
    #         exclusive upper bound of the [left:right) slice)
    left  = np.searchsorted(times, start, side='right')
    right = np.searchsorted(times, end, side='right')

    count = right - left
    if count <= 0:
        return 0.0
    return float((cumsum[right] - cumsum[left]) / count)


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
        resp = requests.post(
            GEM_GENERATE_URL,
            headers={"X-Internal-Secret": GEM_INTERNAL_SECRET},
            timeout=300
        )
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
