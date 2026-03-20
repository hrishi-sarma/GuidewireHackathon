"""
build_features.py
Transforms raw real-world weather + AQI data into ML-ready training datasets.

Pipeline:
  data/raw/weather_all_cities.csv  ─┐
                                    ├─► build_features.py ─► data/processed/*.csv
  data/raw/aqi_all_cities.csv      ─┘

Produces:
  data/processed/premium_features.csv  — one row per (worker, week)
  data/processed/fraud_features.csv    — one row per claim event
  data/processed/payout_features.csv   — one row per paid claim
"""

import pandas as pd
import numpy as np
import os
import random

random.seed(42)
np.random.seed(42)

os.makedirs("data/processed", exist_ok=True)

# ─── Zone metadata matching our delivery zones ────────────────────────────────
ZONE_CITY = {
    "z1": "Mumbai",     "z2": "Mumbai",     "z3": "Mumbai",
    "z4": "Delhi",      "z5": "Delhi",
    "z6": "Bengaluru",  "z7": "Bengaluru",
    "z8": "Chennai",    "z9": "Chennai",
    "z10": "Hyderabad", "z11": "Hyderabad",
}
ZONE_META = {
    "z1": {"risk": 0.82, "flood": 1}, "z2": {"risk": 0.91, "flood": 1},
    "z3": {"risk": 0.65, "flood": 0}, "z4": {"risk": 0.70, "flood": 0},
    "z5": {"risk": 0.68, "flood": 0}, "z6": {"risk": 0.55, "flood": 0},
    "z7": {"risk": 0.50, "flood": 0}, "z8": {"risk": 0.74, "flood": 1},
    "z9": {"risk": 0.80, "flood": 1}, "z10": {"risk": 0.61, "flood": 0},
    "z11": {"risk": 0.58, "flood": 0},
}
PLANS = {"basic": 29, "pro": 49, "max": 79}
PLATFORMS = ["zomato", "swiggy"]


def load_weather():
    path = "data/raw/weather_all_cities.csv"
    df = pd.read_csv(path, parse_dates=["date"])
    print(f"  Weather: {len(df)} rows, {df['city'].nunique()} cities, "
          f"{df['date'].min().date()} – {df['date'].max().date()}")
    return df


def load_aqi():
    path = "data/raw/aqi_all_cities.csv"
    df = pd.read_csv(path, parse_dates=["date"])
    print(f"  AQI:     {len(df)} rows, {df['city'].nunique()} cities")
    return df


def merge_weather_aqi(weather, aqi):
    """Join on date + city to get a unified daily environmental record."""
    aqi_slim = aqi[["date", "city", "aqi"]].copy()
    merged = weather.merge(aqi_slim, on=["date", "city"], how="left")
    merged["aqi"] = merged["aqi"].fillna(merged.groupby(["city", merged["date"].dt.month])["aqi"].transform("median"))
    merged["aqi"] = merged["aqi"].fillna(100)
    merged["month"]      = merged["date"].dt.month
    merged["month_idx"]  = merged["date"].dt.month - 1
    merged["year"]       = merged["date"].dt.year
    merged["day_of_week"]= merged["date"].dt.dayofweek
    merged["is_weekend"] = (merged["day_of_week"] >= 5).astype(int)
    merged["is_monsoon"] = merged["month"].isin([6, 7, 8, 9]).astype(int)
    print(f"  Merged:  {len(merged)} rows")
    return merged


# ═══════════════════════════════════════════════════════════════════════════════
# PREMIUM FEATURES
# One row = one worker buying insurance for one week
# We sample ~5,000 worker-weeks from the real weather calendar
# ═══════════════════════════════════════════════════════════════════════════════

SEASONAL_FACTOR = [1.0,1.0,1.05,1.1,1.15,1.3,1.45,1.45,1.3,1.15,1.1,1.0]

def build_premium_features(env):
    print("\n  Building premium features...")
    rows = []
    # Sample worker-weeks across the date range
    dates = env["date"].unique()
    week_starts = dates[::7]  # every 7th day as a "week start"

    for _ in range(5000):
        zone_id  = random.choice(list(ZONE_CITY.keys()))
        city     = ZONE_CITY[zone_id]
        meta     = ZONE_META[zone_id]
        plan     = random.choice(list(PLANS.keys()))
        platform = random.choice(PLATFORMS)
        hours_pw = max(10, min(84, np.random.normal(45, 12)))
        n_claims = np.random.poisson(0.8)
        n_fraud  = np.random.binomial(1, 0.05)
        age_wks  = random.randint(1, 200)

        # Pick a real week's weather for this city
        wk_start = random.choice(week_starts)
        city_env = env[(env["city"] == city) & (env["date"] == wk_start)]
        if city_env.empty:
            continue
        row = city_env.iloc[0]

        month   = int(row["month_idx"])
        sea_f   = SEASONAL_FACTOR[month]
        hr_r    = min(hours_pw / 50.0, 1.2)
        plat_f  = 1.02 if platform == "swiggy" else 1.0
        hist_f  = 1.3 if n_fraud > 0 else (0.95 if n_claims == 0 else 1.0)
        base    = PLANS[plan]

        # Real-data-informed risk: high rain week → higher zone risk
        rain_adj = min(0.08, row["precip_mm"] / 500)   # week rain adds up to 8%
        aqi_adj  = min(0.06, (row["aqi"] - 100) / 3000) if row["aqi"] > 100 else 0

        risk_score = (
            (meta["risk"] + rain_adj + aqi_adj) * 0.35 +
            sea_f   * 0.25 +
            hr_r    * 0.20 +
            plat_f  * 0.10 +
            hist_f  * 0.10
        )
        multiplier = float(np.clip(0.8 + (risk_score - 0.7) * (0.7/0.5), 0.8, 1.5))
        premium    = int(round(base * multiplier + np.random.normal(0, 1.2)))
        premium    = int(np.clip(premium, base * 0.75, base * 1.6))

        rows.append({
            # Real weather features
            "week_precip_mm":       round(float(row["precip_mm"]), 1),
            "week_rain_mm_per_hr":  round(float(row["rain_mm_per_hr"]), 2),
            "week_temp_max_c":      round(float(row["temp_max_c"]), 1),
            "week_aqi":             round(float(row["aqi"])),
            "is_monsoon":           int(row["is_monsoon"]),
            # Zone / worker features
            "zone_id":              zone_id,
            "zone_risk_score":      meta["risk"],
            "zone_flood_prone":     meta["flood"],
            "city":                 city,
            "platform":             platform,
            "plan_id":              plan,
            "base_premium":         base,
            "month":                month,
            "season_factor":        round(sea_f, 3),
            "avg_hours_per_week":   round(hours_pw, 1),
            "hours_ratio":          round(hr_r, 3),
            "n_past_claims":        int(n_claims),
            "n_fraud_claims":       int(n_fraud),
            "worker_age_weeks":     int(age_wks),
            "city_mumbai":          int(city == "Mumbai"),
            "city_delhi":           int(city == "Delhi"),
            "city_chennai":         int(city == "Chennai"),
            # Target
            "weekly_premium":       premium,
            "multiplier":           round(multiplier, 4),
        })

    df = pd.DataFrame(rows)
    df.to_csv("data/processed/premium_features.csv", index=False)
    print(f"  ✓ premium_features.csv — {len(df)} rows | "
          f"premium ₹{df.weekly_premium.min()}–₹{df.weekly_premium.max()}")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# FRAUD FEATURES
# One row = one claim event, with real weather context at time of trigger
# ═══════════════════════════════════════════════════════════════════════════════

TRIGGERS_AQI_THRESHOLD   = 300
TRIGGERS_RAIN_THRESHOLD  = 15    # mm/hr
TRIGGERS_TEMP_THRESHOLD  = 42    # °C

def build_fraud_features(env):
    print("\n  Building fraud features...")

    # Find all real trigger days across all cities
    trigger_days = env[
        (env["rain_mm_per_hr"] >= TRIGGERS_RAIN_THRESHOLD) |
        (env["aqi"] >= TRIGGERS_AQI_THRESHOLD) |
        (env["temp_max_c"] >= TRIGGERS_TEMP_THRESHOLD)
    ].copy()
    trigger_days["trigger_type"] = trigger_days.apply(_assign_trigger, axis=1)

    print(f"    Real trigger days found: {len(trigger_days)}")

    rows = []
    is_fraud_labels = []

    # Generate 4000 claim rows from real trigger days
    for _ in range(4000):
        is_fraud = np.random.binomial(1, 0.08)
        if len(trigger_days) == 0:
            continue
        trig_row = trigger_days.sample(1).iloc[0]

        city     = trig_row["city"]
        zone_id  = random.choice([z for z, c in ZONE_CITY.items() if c == city])
        base_h   = float(np.clip(np.random.normal(80, 12), 55, 130))
        dis_hrs  = float(np.clip(np.random.exponential(2.5), 0.5, 10.0))
        expected = base_h * dis_hrs

        if is_fraud:
            gps_match     = np.random.binomial(1, 0.15)
            was_active    = np.random.binomial(1, 0.20)
            dup           = np.random.binomial(1, 0.55)
            payout_ratio  = np.random.uniform(1.2, 2.5)
            orders_before = random.randint(0, 3)
        else:
            gps_match     = np.random.binomial(1, 0.95)
            was_active    = np.random.binomial(1, 0.92)
            dup           = np.random.binomial(1, 0.02)
            payout_ratio  = np.random.uniform(0.75, 1.05)
            orders_before = random.randint(6, 35)

        claimed   = round(expected * payout_ratio)
        deviation = (claimed - expected) / max(expected, 1)

        rows.append({
            # Real weather at trigger time
            "trigger_rain_mm_hr":   round(float(trig_row["rain_mm_per_hr"]), 2),
            "trigger_aqi":          round(float(trig_row["aqi"])),
            "trigger_temp_c":       round(float(trig_row["temp_max_c"]), 1),
            "trigger_month":        int(trig_row["month"]),
            "is_monsoon_trigger":   int(trig_row["is_monsoon"]),
            # Claim features
            "gps_zone_match":                int(gps_match),
            "was_active_on_platform":        int(was_active),
            "duplicate_claim_24h":           int(dup),
            "disruption_hours":              round(dis_hrs, 2),
            "claimed_payout":                int(claimed),
            "expected_payout":               int(expected),
            "payout_deviation_ratio":        round(float(deviation), 4),
            "base_hourly_earning":           round(base_h, 1),
            "trigger_type":                  str(trig_row["trigger_type"]),
            "zone_risk_score":               ZONE_META[zone_id]["risk"],
            "platform_orders_before_trigger": int(orders_before),
            "worker_claim_history":          int(random.randint(0, 8)),
            "hour_of_day":                   int(random.randint(6, 22)),
            "is_weekend":                    int(trig_row["is_weekend"]),
            # Target
            "is_fraud":                      int(is_fraud),
        })

    df = pd.DataFrame(rows)
    df.to_csv("data/processed/fraud_features.csv", index=False)
    print(f"  ✓ fraud_features.csv — {len(df)} rows | "
          f"fraud rate: {df.is_fraud.mean():.1%}")
    return df


def _assign_trigger(row):
    if row["rain_mm_per_hr"] >= TRIGGERS_RAIN_THRESHOLD:  return "rain"
    if row["aqi"] >= TRIGGERS_AQI_THRESHOLD:              return "aqi"
    if row["temp_max_c"] >= TRIGGERS_TEMP_THRESHOLD:      return "heat"
    return "other"


# ═══════════════════════════════════════════════════════════════════════════════
# PAYOUT FEATURES
# One row = one approved claim (post fraud-filter)
# ═══════════════════════════════════════════════════════════════════════════════

def build_payout_features(env):
    print("\n  Building payout features...")
    MAX_PAYOUTS = {"basic": 600, "pro": 1200, "max": 2000}
    rows = []

    trigger_days = env[
        (env["rain_mm_per_hr"] >= TRIGGERS_RAIN_THRESHOLD) |
        (env["aqi"] >= TRIGGERS_AQI_THRESHOLD) |
        (env["temp_max_c"] >= TRIGGERS_TEMP_THRESHOLD)
    ].copy()
    trigger_days["trigger_type"] = trigger_days.apply(_assign_trigger, axis=1)

    for _ in range(3000):
        plan      = random.choice(list(PLANS.keys()))
        max_pw    = MAX_PAYOUTS[plan]
        base_h    = float(np.clip(np.random.normal(80, 15), 55, 140))
        dis_hrs   = float(np.clip(np.random.exponential(2.8), 0.5, 12.0))

        trig_row  = trigger_days.sample(1).iloc[0] if len(trigger_days) > 0 else None
        trig_type = str(trig_row["trigger_type"]) if trig_row is not None else "rain"

        # Real weather severity boosts payout slightly
        if trig_row is not None and trig_type == "rain":
            severity_bonus = min(0.15, float(trig_row["rain_mm_per_hr"]) / 200)
        elif trig_row is not None and trig_type == "aqi":
            severity_bonus = min(0.1, (float(trig_row["aqi"]) - 300) / 1000)
        else:
            severity_bonus = 0.0

        if trig_type == "heat":
            raw = 200.0
        else:
            raw = base_h * dis_hrs * (1 + severity_bonus)

        event_cap = max_pw * 0.6
        final     = int(round(max(50, min(raw, event_cap))))

        rows.append({
            "trigger_type":          trig_type,
            "plan_id":               plan,
            "base_hourly_earning":   round(base_h, 1),
            "disruption_hours":      round(dis_hrs, 2),
            "max_weekly_payout":     max_pw,
            "event_cap_60pct":       round(event_cap),
            "is_heat_trigger":       int(trig_type == "heat"),
            "is_flat_rate":          int(trig_type == "heat"),
            "real_rain_mm_hr":       round(float(trig_row["rain_mm_per_hr"]) if trig_row is not None else 0, 2),
            "real_aqi":              round(float(trig_row["aqi"]) if trig_row is not None else 100),
            "payout_amount":         final,
        })

    df = pd.DataFrame(rows)
    df.to_csv("data/processed/payout_features.csv", index=False)
    print(f"  ✓ payout_features.csv — {len(df)} rows | "
          f"payout ₹{df.payout_amount.min()}–₹{df.payout_amount.max()}")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  GigShield — Feature Engineering Pipeline")
    print("=" * 60)

    print("\nLoading raw data...")
    weather = load_weather()
    aqi     = load_aqi()

    print("\nMerging weather + AQI...")
    env = merge_weather_aqi(weather, aqi)

    build_premium_features(env)
    build_fraud_features(env)
    build_payout_features(env)

    print("\n✓ All feature files written to data/processed/")
    print("  Run train_models.py next.")
