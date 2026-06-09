import sys
import json
import logging
import os
import numpy as np
import pandas as pd
import lightgbm as lgb
import mysql.connector
from flask import Flask, request, jsonify
from datetime import timedelta
import holidays

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from config import DB_CONFIG

app = Flask(__name__)
log = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════
# Config
# ═══════════════════════════════════════════════════════════════════

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# mysql.connector requires 'database' key, config.py uses 'db_name'
_DB = {
    'host':     DB_CONFIG['host'],
    'port':     DB_CONFIG['port'],
    'database': DB_CONFIG['db_name'],
    'user':     DB_CONFIG['user'],
    'password': DB_CONFIG['password'],
    'charset':  'utf8mb4',
}

# ═══════════════════════════════════════════════════════════════════
# Load on startup (once only)
# ═══════════════════════════════════════════════════════════════════

model = lgb.Booster(model_file=os.path.join(BASE_DIR, '../ML/output/lgb_model.txt'))

with open(os.path.join(BASE_DIR, '../ML/output/feature_cols.json')) as f:
    FEATURE_COLS = json.load(f)

# ── Historical data ───────────────────────────────────────────────
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

# ── Busyness normalisation baseline ──────────────────────────────
zone_max = (
    historical_df.groupby('zone_id')['total_dropoffs']
    .quantile(0.95)
    .to_dict()
)
GLOBAL_MAX = float(pd.Series(list(zone_max.values())).quantile(0.95)) or 1.0

us_holidays = holidays.US(state='NY', years=[2025, 2026, 2027])


# ═══════════════════════════════════════════════════════════════════
# DB query
# ═══════════════════════════════════════════════════════════════════

def query_db(zone_id: int, time_bucket: str):
    """Query busyness_forecast for a pre-computed result. Returns None if not found."""
    sql = """
        SELECT predicted_dropoffs, busyness_level, busyness_level_relative
        FROM busyness_forecast
        WHERE zone_id = %s AND time_bucket = %s
        LIMIT 1
    """
    try:
        conn   = mysql.connector.connect(**_DB)
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, (zone_id, time_bucket))
        return cursor.fetchone()
    except Exception as e:
        log.warning(f"DB query failed: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


# ═══════════════════════════════════════════════════════════════════
# Fallback: real-time inference
# ═══════════════════════════════════════════════════════════════════

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
    """
    Reproduce notebook Cell 19 rolling_mean_4w:
    shift(336).rolling(window=4*336, min_periods=1).mean()
    i.e. from anchor-1w back 4 weeks (1344 slots), take the mean.
    """
    if anchor_ts is None:
        return 0.0
    anchor = pd.Timestamp(anchor_ts)
    end    = anchor - timedelta(weeks=1)   # anchor-1w (exclusive)
    start  = anchor - timedelta(weeks=5)   # anchor-5w (inclusive)
    mask = (
        (historical_df['zone_id']     == zone_id) &
        (historical_df['time_bucket'] >  start)   &
        (historical_df['time_bucket'] <= end)
    )
    vals = historical_df.loc[mask, 'total_dropoffs']
    return float(vals.mean()) if len(vals) > 0 else 0.0


def to_busyness_level_global(predicted: float) -> int:
    ratio = predicted / GLOBAL_MAX
    if   ratio < 0.20: return 1
    elif ratio < 0.40: return 2
    elif ratio < 0.60: return 3
    elif ratio < 0.80: return 4
    else:              return 5


def to_busyness_level_relative(predicted: float, zone_id: int) -> int:
    z_max = zone_max.get(zone_id, 0)
    if z_max == 0:
        return 1
    ratio = predicted / z_max
    if   ratio < 0.20: return 1
    elif ratio < 0.40: return 2
    elif ratio < 0.60: return 3
    elif ratio < 0.80: return 4
    else:              return 5


def realtime_predict(zone_id: int, ts: pd.Timestamp, weather: dict) -> dict:
    """Fallback when DB has no pre-computed result — runs model inference directly."""
    anchor = _get_anchor(zone_id, ts)
    row = {
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
        'temperature_2m':  float(weather.get('temperature_2m', 15)),
        'precipitation':   float(weather.get('precipitation', 0)),
        'weathercode':     float(weather.get('weathercode', 1)),
        'windspeed_10m':   float(weather.get('windspeed_10m', 5)),
        'is_raining':      int(float(weather.get('precipitation', 0)) > 0.2),
    }
    X         = pd.DataFrame([row])[FEATURE_COLS]
    predicted = float(np.clip(model.predict(X)[0], 0, None))
    return {
        'predicted_dropoffs':      round(predicted, 1),
        'busyness_level':          to_busyness_level_global(predicted),
        'busyness_level_relative': to_busyness_level_relative(predicted, zone_id),
        'source':                  'realtime',
    }


# ═══════════════════════════════════════════════════════════════════
# Flask routes
# ═══════════════════════════════════════════════════════════════════

@app.route('/predict', methods=['POST'])
def predict():
    """
    Single-point prediction. Reads from DB first, falls back to real-time inference.

    Request:
        {"zone_id": 161, "time_bucket": "2026-06-01T14:00:00",
         "temperature_2m": 22.1, "precipitation": 0.0,
         "weathercode": 1, "windspeed_10m": 5.2}

    Response:
        {"zone_id": 161, "time_bucket": "...",
         "predicted_dropoffs": 87.3,
         "busyness_level": 3,
         "busyness_level_relative": 4,
         "source": "db" | "realtime"}
    """
    data    = request.json
    zone_id = int(data['zone_id'])
    ts      = pd.Timestamp(data['time_bucket']).floor('30min')
    ts_str  = ts.strftime('%Y-%m-%d %H:%M:%S')

    db_row = query_db(zone_id, ts_str)
    if db_row:
        return jsonify({
            'zone_id':                 zone_id,
            'time_bucket':             data['time_bucket'],
            'predicted_dropoffs':      round(float(db_row['predicted_dropoffs']), 1),
            'busyness_level':          int(db_row['busyness_level']),
            'busyness_level_relative': int(db_row['busyness_level_relative']),
            'source': 'db',
        })

    log.info(f"DB miss for zone={zone_id} ts={ts_str}, falling back to realtime")
    result = realtime_predict(zone_id, ts, data)
    return jsonify({'zone_id': zone_id, 'time_bucket': data['time_bucket'], **result})


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """
    Batch prediction, suitable for heat map queries.

    Request:  {"requests": [<single request>, ...]}
    Response: {"results":  [<single response>, ...]}
    """
    items   = request.json.get('requests', [])
    results = []
    for data in items:
        zone_id = int(data['zone_id'])
        ts      = pd.Timestamp(data['time_bucket']).floor('30min')
        ts_str  = ts.strftime('%Y-%m-%d %H:%M:%S')

        db_row = query_db(zone_id, ts_str)
        if db_row:
            results.append({
                'zone_id':                 zone_id,
                'time_bucket':             data['time_bucket'],
                'predicted_dropoffs':      round(float(db_row['predicted_dropoffs']), 1),
                'busyness_level':          int(db_row['busyness_level']),
                'busyness_level_relative': int(db_row['busyness_level_relative']),
                'source': 'db',
            })
        else:
            result = realtime_predict(zone_id, ts, data)
            results.append({'zone_id': zone_id, 'time_bucket': data['time_bucket'], **result})

    return jsonify({'results': results})


@app.route('/health', methods=['GET'])
def health():
    try:
        conn = mysql.connector.connect(**_DB)
        conn.close()
        db_status = 'ok'
    except Exception as e:
        db_status = str(e)
    return jsonify({
        'status':     'ok',
        'db':         db_status,
        'global_max': round(GLOBAL_MAX, 2),
    })


@app.route('/debug/normalization', methods=['GET'])
def debug_normalization():
    return jsonify({
        'global_max': round(GLOBAL_MAX, 2),
        'thresholds': {
            'level_1_max': round(GLOBAL_MAX * 0.20, 2),
            'level_2_max': round(GLOBAL_MAX * 0.40, 2),
            'level_3_max': round(GLOBAL_MAX * 0.60, 2),
            'level_4_max': round(GLOBAL_MAX * 0.80, 2),
            'level_5_min': round(GLOBAL_MAX * 0.80, 2),
        },
    })


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001)