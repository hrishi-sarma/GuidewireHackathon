"""
predict.py  (v2 — real-data features)
Clean inference interface for all three GigShield ML models.

Usage:
    from predict import PremiumPredictor, FraudPredictor, PayoutPredictor

    premium = PremiumPredictor()
    fraud   = FraudPredictor()
    payout  = PayoutPredictor()

    result  = premium.predict({...})
    score   = fraud.score({...})
    amount  = payout.calculate({...})
"""

import joblib
import pandas as pd
import numpy as np
import os
from datetime import datetime

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")


def _load(filename):
    path = os.path.join(MODEL_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Model not found: {path}\n"
            "Run: python3 fetch_real_data.py && python3 build_features.py && python3 train_models.py"
        )
    return joblib.load(path)


# ═══════════════════════════════════════════════════════════════════════════════
# PREMIUM PREDICTOR
# ═══════════════════════════════════════════════════════════════════════════════

class PremiumPredictor:
    """
    Predicts dynamic weekly premium, incorporating real weather context.

    Core inputs (required):
        zone_risk_score      float   0.0-1.0
        zone_flood_prone     int     0 or 1
        platform             str     "zomato" | "swiggy"
        plan_id              str     "basic" | "pro" | "max"
        month                int     0-11 (current calendar month)
        avg_hours_per_week   float

    Real-weather inputs (provide if available, else defaults are used):
        week_precip_mm       float   total rainfall this week in mm
        week_rain_mm_per_hr  float   peak rain rate mm/hr
        week_temp_max_c      float   max temperature this week in C
        week_aqi             float   current AQI reading
        is_monsoon           int     1 if monsoon season (Jun-Sep)

    Optional:
        n_past_claims, n_fraud_claims, worker_age_weeks
        city_mumbai, city_delhi, city_chennai  (int flags)
    """

    SEASONAL = [1.0,1.0,1.05,1.1,1.15,1.3,1.45,1.45,1.3,1.15,1.1,1.0]
    BASE_PREMIUMS = {"basic": 29, "pro": 49, "max": 79}

    def __init__(self):
        self._model = _load("premium_model.joblib")

    def predict(self, data: dict) -> dict:
        month    = int(data.get("month", datetime.now().month - 1))
        hours_pw = float(data.get("avg_hours_per_week", 45))
        base     = self.BASE_PREMIUMS.get(data.get("plan_id", "pro"), 49)

        row = {
            "zone_risk_score":    float(data.get("zone_risk_score", 0.7)),
            "zone_flood_prone":   int(data.get("zone_flood_prone", 0)),
            "platform":           str(data.get("platform", "swiggy")),
            "plan_id":            str(data.get("plan_id", "pro")),
            "base_premium":       base,
            "month":              month,
            "season_factor":      self.SEASONAL[month],
            "avg_hours_per_week": hours_pw,
            "hours_ratio":        min(hours_pw / 50.0, 1.2),
            "n_past_claims":      int(data.get("n_past_claims", 0)),
            "n_fraud_claims":     int(data.get("n_fraud_claims", 0)),
            "worker_age_weeks":   int(data.get("worker_age_weeks", 4)),
            "city_mumbai":        int(data.get("city_mumbai", 0)),
            "city_delhi":         int(data.get("city_delhi", 0)),
            "city_chennai":       int(data.get("city_chennai", 0)),
            "week_precip_mm":     float(data.get("week_precip_mm", 2.0)),
            "week_rain_mm_per_hr":float(data.get("week_rain_mm_per_hr", 0.5)),
            "week_temp_max_c":    float(data.get("week_temp_max_c", 33.0)),
            "week_aqi":           float(data.get("week_aqi", 100.0)),
            "is_monsoon":         int(data.get("is_monsoon", month in [5,6,7,8])),
        }

        df      = pd.DataFrame([row])
        pred    = float(self._model.predict(df)[0])
        pred    = max(base * 0.75, min(base * 1.6, pred))
        dynamic = round(pred)
        mult    = round(dynamic / base, 2)

        if mult >= 1.25:   risk_label = "High Risk Zone"
        elif mult >= 1.05: risk_label = "Moderate Risk"
        else:              risk_label = "Low Risk"

        return {
            "dynamic_premium": dynamic,
            "base_premium":    base,
            "multiplier":      mult,
            "risk_label":      risk_label,
            "weather_context": {
                "week_precip_mm":  row["week_precip_mm"],
                "week_aqi":        row["week_aqi"],
                "week_temp_max_c": row["week_temp_max_c"],
                "is_monsoon":      bool(row["is_monsoon"]),
            },
        }

    @classmethod
    def build_input(cls, worker: dict, plan_id: str, zone: dict,
                    weather: dict = None) -> dict:
        """Helper: build input dict from worker/zone/plan/weather dicts."""
        month = datetime.now().month - 1
        city  = zone.get("city", "")
        w     = weather or {}
        return {
            "zone_risk_score":    zone.get("riskScore", 0.7),
            "zone_flood_prone":   int(zone.get("floodProne", False)),
            "platform":           worker.get("platform", "swiggy"),
            "plan_id":            plan_id,
            "month":              month,
            "avg_hours_per_week": worker.get("avgHoursPerWeek", 45),
            "n_past_claims":      worker.get("n_past_claims", 0),
            "n_fraud_claims":     worker.get("n_fraud_claims", 0),
            "worker_age_weeks":   worker.get("worker_age_weeks", 4),
            "city_mumbai":        int(city == "Mumbai"),
            "city_delhi":         int(city == "Delhi"),
            "city_chennai":       int(city == "Chennai"),
            "week_precip_mm":     w.get("precip_mm", 2.0),
            "week_rain_mm_per_hr":w.get("rain_mm_per_hr", 0.5),
            "week_temp_max_c":    w.get("temp_max_c", 33.0),
            "week_aqi":           w.get("aqi", 100.0),
            "is_monsoon":         int(month in [5, 6, 7, 8]),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# FRAUD PREDICTOR
# ═══════════════════════════════════════════════════════════════════════════════

class FraudPredictor:
    """
    Scores a claim for fraud (0-100). Higher = more suspicious.

    Core inputs:
        gps_zone_match                int     1=in zone, 0=mismatch
        was_active_on_platform        int     1=active, 0=offline
        duplicate_claim_24h           int     1=duplicate detected
        disruption_hours              float
        claimed_payout / expected_payout  float
        base_hourly_earning           float
        trigger_type                  str     rain|aqi|heat|curfew|flood
        zone_risk_score               float
        platform_orders_before_trigger int
        worker_claim_history          int
        hour_of_day                   int     0-23
        is_weekend                    int

    Real-weather inputs (boosts detection accuracy):
        trigger_rain_mm_hr   float   actual rainfall at trigger time
        trigger_aqi          float   actual AQI at trigger time
        trigger_temp_c       float   actual temperature at trigger time
        trigger_month        int     0-11
        is_monsoon_trigger   int

    Returns:
        fraud_score  int    0-100
        fraud_proba  float  raw probability
        risk_level   str    low | medium | high
        action       str    auto_approve | review | auto_reject
        flags        list   human-readable explanations
    """

    def __init__(self):
        self._model     = _load("fraud_model.joblib")
        meta            = _load("fraud_threshold.joblib")
        self._threshold = meta.get("optimal_threshold", 0.35)

    def score(self, data: dict) -> dict:
        base_h    = float(data.get("base_hourly_earning", 80))
        dis_hrs   = float(data.get("disruption_hours", 2))
        claimed   = float(data.get("claimed_payout",  base_h * dis_hrs))
        expected  = float(data.get("expected_payout", base_h * dis_hrs))
        deviation = (claimed - expected) / max(expected, 1)
        month     = int(data.get("trigger_month", datetime.now().month - 1))

        row = {
            "gps_zone_match":                int(data.get("gps_zone_match", 1)),
            "was_active_on_platform":        int(data.get("was_active_on_platform", 1)),
            "duplicate_claim_24h":           int(data.get("duplicate_claim_24h", 0)),
            "disruption_hours":              dis_hrs,
            "claimed_payout":                claimed,
            "expected_payout":               expected,
            "payout_deviation_ratio":        round(deviation, 4),
            "base_hourly_earning":           base_h,
            "trigger_type":                  str(data.get("trigger_type", "rain")),
            "zone_risk_score":               float(data.get("zone_risk_score", 0.7)),
            "platform_orders_before_trigger":int(data.get("platform_orders_before_trigger", 10)),
            "worker_claim_history":          int(data.get("worker_claim_history", 0)),
            "hour_of_day":                   int(data.get("hour_of_day", 12)),
            "is_weekend":                    int(data.get("is_weekend", 0)),
            "trigger_rain_mm_hr":   float(data.get("trigger_rain_mm_hr", 0)),
            "trigger_aqi":          float(data.get("trigger_aqi", 100)),
            "trigger_temp_c":       float(data.get("trigger_temp_c", 30)),
            "trigger_month":        month,
            "is_monsoon_trigger":   int(data.get("is_monsoon_trigger", month in [5,6,7,8])),
        }

        df    = pd.DataFrame([row])
        proba = float(self._model.predict_proba(df)[0][1])
        score = round(proba * 100)

        flags = []
        if not row["gps_zone_match"]:
            flags.append("GPS location does not match disruption zone")
        if not row["was_active_on_platform"]:
            flags.append("Worker was offline during trigger window")
        if row["duplicate_claim_24h"]:
            flags.append(f"Duplicate {row['trigger_type']} claim within 24 hours")
        if deviation > 0.2:
            flags.append(f"Payout {deviation:.0%} above expected (expected ₹{expected:.0f})")

        # Real-weather cross-checks
        tt = row["trigger_type"]
        if tt == "rain" and row["trigger_rain_mm_hr"] < 5:
            flags.append(f"Rain trigger claimed but API shows only {row['trigger_rain_mm_hr']} mm/hr")
        if tt == "aqi" and row["trigger_aqi"] < 200:
            flags.append(f"AQI trigger claimed but API shows AQI only {row['trigger_aqi']}")
        if tt == "heat" and row["trigger_temp_c"] < 38:
            flags.append(f"Heat trigger claimed but temperature was only {row['trigger_temp_c']}°C")

        if proba < self._threshold * 0.6:
            risk_level = "low";    action = "auto_approve"
        elif proba < self._threshold:
            risk_level = "medium"; action = "review"
        else:
            risk_level = "high";   action = "auto_reject"

        return {
            "fraud_score": score,
            "fraud_proba": round(proba, 4),
            "risk_level":  risk_level,
            "action":      action,
            "flags":       flags,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# PAYOUT PREDICTOR
# ═══════════════════════════════════════════════════════════════════════════════

class PayoutPredictor:
    """
    Predicts the payout for an approved claim.

    Inputs:
        trigger_type         str     rain|aqi|heat|curfew|flood
        plan_id              str     basic|pro|max
        base_hourly_earning  float
        disruption_hours     float
        real_rain_mm_hr      float   actual rainfall intensity (0 if not rain)
        real_aqi             float   actual AQI (100 if not AQI)

    Returns:
        payout_amount   int    final payout in rupees
        breakdown       dict   full calculation detail
    """

    MAX_PAYOUTS = {"basic": 600, "pro": 1200, "max": 2000}

    def __init__(self):
        self._model = _load("payout_model.joblib")

    def calculate(self, data: dict) -> dict:
        plan_id      = str(data.get("plan_id", "pro"))
        max_pw       = self.MAX_PAYOUTS.get(plan_id, 1200)
        trigger_type = str(data.get("trigger_type", "rain"))
        base_h       = float(data.get("base_hourly_earning", 80))
        dis_hrs      = float(data.get("disruption_hours", 2))
        event_cap    = round(max_pw * 0.6)

        row = {
            "trigger_type":        trigger_type,
            "plan_id":             plan_id,
            "base_hourly_earning": base_h,
            "disruption_hours":    dis_hrs,
            "max_weekly_payout":   max_pw,
            "event_cap_60pct":     event_cap,
            "is_heat_trigger":     int(trigger_type == "heat"),
            "is_flat_rate":        int(trigger_type == "heat"),
            "real_rain_mm_hr":     float(data.get("real_rain_mm_hr", 0)),
            "real_aqi":            float(data.get("real_aqi", 100)),
        }

        df     = pd.DataFrame([row])
        pred   = float(self._model.predict(df)[0])
        amount = max(50, min(round(pred), event_cap))

        if trigger_type == "heat":
            breakdown = {
                "method": "flat_rate",
                "flat_amount": 200,
                "note": "Extreme heat advisory = fixed Rs 200/day",
            }
        else:
            raw = base_h * dis_hrs
            breakdown = {
                "method":           "hourly_rate",
                "hourly_rate":      base_h,
                "disruption_hours": dis_hrs,
                "raw_amount":       round(raw),
                "event_cap":        event_cap,
                "cap_applied":      amount < raw,
                "real_trigger_intensity": {
                    "rain_mm_hr": row["real_rain_mm_hr"],
                    "aqi":        row["real_aqi"],
                },
            }

        return {"payout_amount": amount, "breakdown": breakdown}


# ═══════════════════════════════════════════════════════════════════════════════
# DEMO
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  GigShield ML v2 - Real-Data Inference Demo")
    print("=" * 60)

    premium = PremiumPredictor()
    fraud   = FraudPredictor()
    payout  = PayoutPredictor()

    # Scenario A: Monsoon vs dry season comparison
    print("\n[A] Same worker, same zone - monsoon vs dry season")
    base_worker = {
        "zone_risk_score": 0.91, "zone_flood_prone": 1,
        "platform": "swiggy", "plan_id": "pro",
        "avg_hours_per_week": 52, "city_mumbai": 1,
        "n_past_claims": 2, "worker_age_weeks": 20,
    }
    r_jul = premium.predict({**base_worker, "month": 6,
        "week_precip_mm": 28, "week_rain_mm_per_hr": 4.2,
        "week_temp_max_c": 31, "week_aqi": 82, "is_monsoon": 1})
    r_feb = premium.predict({**base_worker, "month": 1,
        "week_precip_mm": 0.1, "week_rain_mm_per_hr": 0,
        "week_temp_max_c": 32, "week_aqi": 145, "is_monsoon": 0})

    print(f"  July  (28mm rain, AQI 82)  : Rs {r_jul['dynamic_premium']}/week  [{r_jul['risk_label']}]")
    print(f"  Feb   (0mm rain, AQI 145)  : Rs {r_feb['dynamic_premium']}/week  [{r_feb['risk_label']}]")
    print(f"  Monsoon surcharge          : Rs {r_jul['dynamic_premium'] - r_feb['dynamic_premium']}/week")

    # Scenario B: Clean claim - real weather confirms the trigger
    print("\n[B] Fraud score - CLEAN claim (API confirms 22mm/hr rain)")
    s = fraud.score({
        "gps_zone_match": 1, "was_active_on_platform": 1,
        "duplicate_claim_24h": 0, "disruption_hours": 3.5,
        "claimed_payout": 280, "expected_payout": 280,
        "base_hourly_earning": 80, "trigger_type": "rain",
        "zone_risk_score": 0.91, "platform_orders_before_trigger": 18,
        "worker_claim_history": 2, "hour_of_day": 19, "is_weekend": 0,
        "trigger_rain_mm_hr": 22.4, "trigger_aqi": 82,
        "trigger_temp_c": 31, "is_monsoon_trigger": 1,
    })
    print(f"  Score: {s['fraud_score']}/100  Action: {s['action']}")
    print(f"  Flags: {s['flags'] or 'None - clean claim'}")

    # Scenario C: Fraud - claims rain but API shows 2mm/hr
    print("\n[C] Fraud score - FAKE rain claim (API shows only 2mm/hr)")
    s2 = fraud.score({
        "gps_zone_match": 0, "was_active_on_platform": 0,
        "duplicate_claim_24h": 1, "disruption_hours": 3.5,
        "claimed_payout": 600, "expected_payout": 280,
        "base_hourly_earning": 80, "trigger_type": "rain",
        "zone_risk_score": 0.91, "platform_orders_before_trigger": 1,
        "worker_claim_history": 5, "hour_of_day": 3, "is_weekend": 1,
        "trigger_rain_mm_hr": 2.1, "trigger_aqi": 90,
        "trigger_temp_c": 30, "is_monsoon_trigger": 0,
    })
    print(f"  Score: {s2['fraud_score']}/100  Action: {s2['action']}")
    for f in s2["flags"]: print(f"    - {f}")

    # Scenario D: Payout calculation
    print("\n[D] Payout - Heavy rain (28mm/hr), Pro plan, 3.5h disruption")
    p = payout.calculate({
        "trigger_type": "rain", "plan_id": "pro",
        "base_hourly_earning": 80, "disruption_hours": 3.5,
        "real_rain_mm_hr": 28.0, "real_aqi": 82,
    })
    print(f"  Payout: Rs {p['payout_amount']}")
    b = p["breakdown"]
    print(f"  Raw: Rs {b.get('raw_amount')}  Cap: Rs {b.get('event_cap')}  Capped: {b.get('cap_applied')}")

    # Scenario E: Delhi winter AQI, Basic plan
    print("\n[E] Premium - Delhi winter, Basic plan (AQI 330)")
    r3 = premium.predict({
        "zone_risk_score": 0.70, "zone_flood_prone": 0,
        "platform": "zomato", "plan_id": "basic",
        "month": 11, "avg_hours_per_week": 40,
        "city_delhi": 1,
        "week_precip_mm": 0.5, "week_rain_mm_per_hr": 0.1,
        "week_temp_max_c": 22, "week_aqi": 330, "is_monsoon": 0,
    })
    print(f"  Premium: Rs {r3['dynamic_premium']}/week  [{r3['risk_label']}]")
    print(f"  (Base Rs 29, winter AQI pushes multiplier to {r3['multiplier']}x)")

    print("\n" + "=" * 60)
