"""
GigShield ML Service  —  main.py
FastAPI microservice exposing premium, fraud, payout, and forecast endpoints.

Startup:
    cd ml-service
    pip install -r requirements.txt
    uvicorn main:app --reload --port 5000

If trained models are not present, run the pipeline first:
    python3 fetch_real_data.py   # fetch ERA5 weather + CPCB AQI
    python3 build_features.py    # engineer features
    python3 train_models.py      # train and save models to models/

Swagger UI: http://localhost:5000/docs
"""

import os
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import prediction classes from predict.py
from predict import PremiumPredictor, FraudPredictor, PayoutPredictor

# ─── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="GigShield ML Service",
    description="Premium pricing, fraud detection, and payout calculation for GigShield",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Load models once at startup ─────────────────────────────────────────────

_premium = None
_fraud   = None
_payout  = None

@app.on_event("startup")
def load_models():
    global _premium, _fraud, _payout
    try:
        _premium = PremiumPredictor()
        _fraud   = FraudPredictor()
        _payout  = PayoutPredictor()
        print("✅  All ML models loaded")
    except FileNotFoundError as e:
        print(f"⚠️  {e}")
        print("   Run the training pipeline first — see README.")


# ─── Request / Response models ────────────────────────────────────────────────

class PremiumRequest(BaseModel):
    worker_id:           str
    zone_risk_score:     float
    zone_flood_prone:    int
    platform:            str
    plan_id:             str
    month:               int
    avg_hours_per_week:  float
    hours_ratio:         float = 0.9
    n_past_claims:       int   = 0
    fraud_claim_count:   int   = 0
    worker_age_weeks:    int   = 4
    city_mumbai:         int   = 0
    city_delhi:          int   = 0
    city_chennai:        int   = 0
    # Real-weather features (optional — defaults used if omitted)
    week_precip_mm:      float = 2.0
    week_rain_mm_per_hr: float = 0.5
    week_temp_max_c:     float = 33.0
    week_aqi:            float = 100.0
    is_monsoon:          int   = 0

class PremiumResponse(BaseModel):
    dynamic_premium: int
    base_premium:    int
    multiplier:      float
    risk_label:      str
    weather_context: dict

class FraudRequest(BaseModel):
    worker_id:                        str
    gps_zone_match:                   int
    was_active_on_platform:           int
    duplicate_claim_24h:              int   = 0
    disruption_hours:                 float
    claimed_payout:                   float
    expected_payout:                  float
    payout_deviation_ratio:           float = 0.0
    base_hourly_earning:              float
    trigger_type:                     str
    zone_risk_score:                  float
    platform_orders_before_trigger:   int   = 10
    worker_claim_history:             int   = 0
    hour_of_day:                      int   = 12
    is_weekend:                       int   = 0
    # Real weather cross-check (optional)
    trigger_rain_mm_hr:               float = 0.0
    trigger_aqi:                      float = 100.0
    trigger_temp_c:                   float = 30.0
    trigger_month:                    int   = 0
    is_monsoon_trigger:               int   = 0

class FraudResponse(BaseModel):
    fraud_score: int
    fraud_proba: float
    risk_level:  str
    action:      str
    flags:       List[str]

class PayoutRequest(BaseModel):
    trigger_type:        str
    plan_id:             str
    base_hourly_earning: float
    disruption_hours:    float
    max_weekly_payout:   int   = 1200
    real_rain_mm_hr:     float = 0.0
    real_aqi:            float = 100.0

class PayoutResponse(BaseModel):
    payout_amount: int
    breakdown:     dict

class ForecastDay(BaseModel):
    date:           str
    rain_risk:      float
    aqi_risk:       float
    heat_risk:      float
    overall_risk:   str
    recommendation: str

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    models_loaded = all([_premium, _fraud, _payout])
    return {
        "status":        "ok" if models_loaded else "degraded",
        "models_loaded": models_loaded,
        "service":       "GigShield ML Service",
        "version":       "2.0.0",
        "timestamp":     datetime.now().isoformat(),
    }


@app.post("/premium/calculate", response_model=PremiumResponse)
def calculate_premium(req: PremiumRequest):
    if not _premium:
        raise HTTPException(503, "Premium model not loaded — run training pipeline")
    result = _premium.predict(req.model_dump())
    return PremiumResponse(**result)


@app.post("/fraud/score", response_model=FraudResponse)
def score_fraud(req: FraudRequest):
    if not _fraud:
        raise HTTPException(503, "Fraud model not loaded — run training pipeline")
    # Build the dict predict.py expects (snake_case keys)
    data = req.model_dump()
    # Map API names → predict.py names
    data["gps_zone_match"]                 = data.pop("gps_zone_match")
    data["was_active_on_platform"]         = data.pop("was_active_on_platform")
    data["platform_orders_before_trigger"] = data.pop("platform_orders_before_trigger")
    result = _fraud.score(data)
    return FraudResponse(**result)


@app.post("/payout/calculate", response_model=PayoutResponse)
def calculate_payout(req: PayoutRequest):
    if not _payout:
        raise HTTPException(503, "Payout model not loaded — run training pipeline")
    result = _payout.calculate(req.model_dump())
    return PayoutResponse(**result)


@app.post("/forecast/weekly", response_model=List[ForecastDay])
def weekly_forecast(zone_risk_score: float = 0.7, days_ahead: int = 7):
    """
    7-day disruption risk forecast for a zone.
    In production: replace body with real ERA5/IMD forecast data.
    """
    import random, math
    random.seed(42)
    month    = datetime.now().month - 1
    seasonal = [1.0,1.0,1.05,1.1,1.15,1.3,1.45,1.45,1.3,1.15,1.1,1.0][month]
    results  = []

    for i in range(days_ahead):
        rain_r = min(1.0, zone_risk_score * seasonal * (0.7 + random.random() * 0.6))
        aqi_r  = min(1.0, 0.3 + zone_risk_score * random.random() * 0.8)
        heat_r = min(1.0, 0.2 + (month in [3,4,5]) * 0.5 + random.random() * 0.3)
        overall = max(rain_r, aqi_r, heat_r)

        if overall > 0.7:
            level = "high";     rec = "Consider upgrading to Max Shield this week"
        elif overall > 0.4:
            level = "moderate"; rec = "Pro Shield recommended for this forecast"
        else:
            level = "low";      rec = "Basic Shield sufficient"

        date = datetime.fromtimestamp(
            datetime.now().timestamp() + i * 86400
        ).strftime("%Y-%m-%d")

        results.append(ForecastDay(
            date=date, rain_risk=round(rain_r,2), aqi_risk=round(aqi_r,2),
            heat_risk=round(heat_r,2), overall_risk=level, recommendation=rec,
        ))

    return results
