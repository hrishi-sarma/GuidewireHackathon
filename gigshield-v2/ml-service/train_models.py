"""
train_models.py
Trains all three GigShield ML models:
  1. Premium Model    — GradientBoostingRegressor  → models/premium_model.joblib
  2. Fraud Model      — RandomForestClassifier      → models/fraud_model.joblib
  3. Payout Model     — GradientBoostingRegressor  → models/payout_model.joblib

Also saves:
  models/feature_names.json   — feature lists per model
  models/model_metadata.json  — thresholds, version, training stats

Run: python3 train_models.py
"""

import numpy as np
import pandas as pd
import joblib
import json
import os
from datetime import datetime

# sklearn
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import (
    mean_absolute_error, r2_score,
    classification_report, roc_auc_score,
    confusion_matrix, precision_recall_curve,
)
import warnings
warnings.filterwarnings("ignore")

os.makedirs("models", exist_ok=True)
os.makedirs("data",   exist_ok=True)

DIVIDER = "─" * 60


# ═══════════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def section(title):
    print(f"\n{DIVIDER}\n  {title}\n{DIVIDER}")


def save_artifact(obj, path):
    joblib.dump(obj, path)
    size_kb = os.path.getsize(path) / 1024
    print(f"  ✓ Saved {path} ({size_kb:.1f} KB)")


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL 1 — PREMIUM (GradientBoostingRegressor)
# ═══════════════════════════════════════════════════════════════════════════════

def train_premium_model():
    section("MODEL 1: Dynamic Premium Predictor")

    df = pd.read_csv("data/processed/premium_features.csv")
    print(f"  Loaded {len(df)} samples")

    # ── Features ──────────────────────────────────────────────────────────────
    NUMERIC_FEATURES = [
        "zone_risk_score", "zone_flood_prone", "base_premium",
        "month", "season_factor", "avg_hours_per_week", "hours_ratio",
        "n_past_claims", "n_fraud_claims", "worker_age_weeks",
        "city_mumbai", "city_delhi", "city_chennai",
        "week_precip_mm", "week_rain_mm_per_hr", "week_temp_max_c",
        "week_aqi", "is_monsoon",
    ]
    CAT_FEATURES = ["platform", "plan_id"]
    TARGET = "weekly_premium"

    X = df[NUMERIC_FEATURES + CAT_FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # ── Pipeline ───────────────────────────────────────────────────────────────
    preprocessor = ColumnTransformer([
        ("num", StandardScaler(), NUMERIC_FEATURES),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CAT_FEATURES),
    ])

    model = Pipeline([
        ("prep", preprocessor),
        ("gbm", GradientBoostingRegressor(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.85,
            min_samples_leaf=10,
            random_state=42,
        )),
    ])

    print("  Training GradientBoostingRegressor...")
    model.fit(X_train, y_train)

    # ── Evaluation ─────────────────────────────────────────────────────────────
    y_pred = model.predict(X_test)
    mae  = mean_absolute_error(y_test, y_pred)
    r2   = r2_score(y_test, y_pred)
    pct_within_2 = np.mean(np.abs(y_pred - y_test) <= 2) * 100
    pct_within_5 = np.mean(np.abs(y_pred - y_test) <= 5) * 100

    print(f"\n  Test Results:")
    print(f"    MAE            : ₹{mae:.2f} per week")
    print(f"    R²             : {r2:.4f}")
    print(f"    Within ₹2      : {pct_within_2:.1f}% of predictions")
    print(f"    Within ₹5      : {pct_within_5:.1f}% of predictions")

    # Cross-validation MAE
    cv_scores = cross_val_score(model, X, y, cv=5, scoring="neg_mean_absolute_error")
    print(f"    5-Fold CV MAE  : ₹{-cv_scores.mean():.2f} ± ₹{cv_scores.std():.2f}")

    # ── Feature importance ─────────────────────────────────────────────────────
    gbm = model.named_steps["gbm"]
    enc_cat_names = model.named_steps["prep"].transformers_[1][1].get_feature_names_out(CAT_FEATURES).tolist()
    all_feature_names = NUMERIC_FEATURES + enc_cat_names
    importances = sorted(
        zip(all_feature_names, gbm.feature_importances_),
        key=lambda x: x[1], reverse=True
    )
    print("\n  Top 8 Feature Importances:")
    for name, imp in importances[:8]:
        bar = "█" * int(imp * 300)
        print(f"    {name:<30} {imp:.4f}  {bar}")

    # ── Save ───────────────────────────────────────────────────────────────────
    save_artifact(model, "models/premium_model.joblib")

    return {
        "model": "premium",
        "algorithm": "GradientBoostingRegressor",
        "n_train": len(X_train),
        "n_test": len(X_test),
        "mae": round(mae, 3),
        "r2": round(r2, 4),
        "pct_within_5_rupees": round(pct_within_5, 1),
        "numeric_features": NUMERIC_FEATURES,
        "cat_features": CAT_FEATURES,
        "target": TARGET,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL 2 — FRAUD DETECTION (RandomForestClassifier)
# ═══════════════════════════════════════════════════════════════════════════════

def train_fraud_model():
    section("MODEL 2: Fraud Detector")

    df = pd.read_csv("data/processed/fraud_features.csv")
    print(f"  Loaded {len(df)} samples | Fraud rate: {df.is_fraud.mean():.1%}")

    # ── Features ──────────────────────────────────────────────────────────────
    NUMERIC_FEATURES = [
        "gps_zone_match", "was_active_on_platform", "duplicate_claim_24h",
        "disruption_hours", "claimed_payout", "expected_payout",
        "payout_deviation_ratio", "base_hourly_earning",
        "zone_risk_score", "platform_orders_before_trigger",
        "worker_claim_history", "hour_of_day", "is_weekend",
        "trigger_rain_mm_hr", "trigger_aqi", "trigger_temp_c",
        "trigger_month", "is_monsoon_trigger",
    ]
    CAT_FEATURES = ["trigger_type"]
    TARGET = "is_fraud"

    X = df[NUMERIC_FEATURES + CAT_FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # ── Pipeline (with class_weight to handle imbalance) ──────────────────────
    preprocessor = ColumnTransformer([
        ("num", StandardScaler(), NUMERIC_FEATURES),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CAT_FEATURES),
    ])

    model = Pipeline([
        ("prep", preprocessor),
        ("rf", RandomForestClassifier(
            n_estimators=300,
            max_depth=12,
            min_samples_leaf=5,
            class_weight="balanced",   # handles 8% fraud imbalance
            random_state=42,
            n_jobs=-1,
        )),
    ])

    print("  Training RandomForestClassifier (balanced class weights)...")
    model.fit(X_train, y_train)

    # ── Evaluation ─────────────────────────────────────────────────────────────
    y_pred      = model.predict(X_test)
    y_proba     = model.predict_proba(X_test)[:, 1]
    auc         = roc_auc_score(y_test, y_proba)
    cm          = confusion_matrix(y_test, y_pred)

    print(f"\n  Test Results:")
    print(f"    ROC-AUC        : {auc:.4f}")
    print(f"\n  Classification Report:")
    report = classification_report(y_test, y_pred, target_names=["Legitimate", "Fraud"])
    for line in report.splitlines():
        print("    " + line)

    tn, fp, fn, tp = cm.ravel()
    print(f"  Confusion Matrix:")
    print(f"    True Neg  (correct legit)  : {tn}")
    print(f"    False Pos (legit → fraud)  : {fp}  ← workers wrongly flagged")
    print(f"    False Neg (fraud → legit)  : {fn}  ← fraud missed")
    print(f"    True Pos  (caught fraud)   : {tp}")

    # Find optimal threshold (maximise F1 for fraud class)
    precisions, recalls, thresholds = precision_recall_curve(y_test, y_proba)
    f1_scores = 2 * precisions * recalls / (precisions + recalls + 1e-9)
    best_idx  = np.argmax(f1_scores)
    best_thr  = thresholds[best_idx] if best_idx < len(thresholds) else 0.5

    print(f"\n  Optimal fraud threshold : {best_thr:.3f}  (maximises F1)")
    print(f"  → Scores above {best_thr:.2f}  → 'fraud_review'")
    print(f"  → Scores below {best_thr:.2f}  → 'auto_approve'")

    # ── Feature importance ─────────────────────────────────────────────────────
    rf = model.named_steps["rf"]
    enc_cat_names = model.named_steps["prep"].transformers_[1][1].get_feature_names_out(CAT_FEATURES).tolist()
    all_feature_names = NUMERIC_FEATURES + enc_cat_names
    importances = sorted(
        zip(all_feature_names, rf.feature_importances_),
        key=lambda x: x[1], reverse=True
    )
    print("\n  Top 8 Feature Importances:")
    for name, imp in importances[:8]:
        bar = "█" * int(imp * 300)
        print(f"    {name:<35} {imp:.4f}  {bar}")

    # ── Save model + threshold ─────────────────────────────────────────────────
    save_artifact(model, "models/fraud_model.joblib")
    save_artifact({"optimal_threshold": float(best_thr), "auc": float(auc)},
                  "models/fraud_threshold.joblib")

    return {
        "model": "fraud",
        "algorithm": "RandomForestClassifier (balanced)",
        "n_train": len(X_train),
        "n_test": len(X_test),
        "roc_auc": round(auc, 4),
        "fraud_rate_train": round(y_train.mean(), 4),
        "optimal_threshold": round(float(best_thr), 3),
        "numeric_features": NUMERIC_FEATURES,
        "cat_features": CAT_FEATURES,
        "target": TARGET,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL 3 — PAYOUT (GradientBoostingRegressor)
# ═══════════════════════════════════════════════════════════════════════════════

def train_payout_model():
    section("MODEL 3: Payout Calculator")

    df = pd.read_csv("data/processed/payout_features.csv")
    print(f"  Loaded {len(df)} samples")

    NUMERIC_FEATURES = [
        "base_hourly_earning", "disruption_hours",
        "max_weekly_payout", "event_cap_60pct",
        "is_heat_trigger", "is_flat_rate",
    ]
    CAT_FEATURES = ["trigger_type", "plan_id"]
    TARGET = "payout_amount"

    X = df[NUMERIC_FEATURES + CAT_FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    preprocessor = ColumnTransformer([
        ("num", StandardScaler(), NUMERIC_FEATURES),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CAT_FEATURES),
    ])

    model = Pipeline([
        ("prep", preprocessor),
        ("gbm", GradientBoostingRegressor(
            n_estimators=150,
            max_depth=4,
            learning_rate=0.1,
            subsample=0.9,
            random_state=42,
        )),
    ])

    print("  Training GradientBoostingRegressor...")
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae    = mean_absolute_error(y_test, y_pred)
    r2     = r2_score(y_test, y_pred)
    pct_within_10 = np.mean(np.abs(y_pred - y_test) <= 10) * 100

    print(f"\n  Test Results:")
    print(f"    MAE            : ₹{mae:.2f} per claim")
    print(f"    R²             : {r2:.4f}")
    print(f"    Within ₹10     : {pct_within_10:.1f}% of predictions")

    cv_scores = cross_val_score(model, X, y, cv=5, scoring="neg_mean_absolute_error")
    print(f"    5-Fold CV MAE  : ₹{-cv_scores.mean():.2f} ± ₹{cv_scores.std():.2f}")

    save_artifact(model, "models/payout_model.joblib")

    return {
        "model": "payout",
        "algorithm": "GradientBoostingRegressor",
        "n_train": len(X_train),
        "n_test": len(X_test),
        "mae": round(mae, 3),
        "r2": round(r2, 4),
        "pct_within_10_rupees": round(pct_within_10, 1),
        "numeric_features": NUMERIC_FEATURES,
        "cat_features": CAT_FEATURES,
        "target": TARGET,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  GigShield ML Training Pipeline")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    results = {}
    results["premium"] = train_premium_model()
    results["fraud"]   = train_fraud_model()
    results["payout"]  = train_payout_model()

    # Save combined metadata
    metadata = {
        "trained_at": datetime.now().isoformat(),
        "models": results,
        "version": "1.0.0",
    }
    with open("models/model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    print("\n  ✓ Saved models/model_metadata.json")

    section("TRAINING COMPLETE")
    print("  Models saved to models/")
    for name, m in results.items():
        print(f"\n  [{name.upper()}]  {m['algorithm']}")
        if "mae" in m:
            print(f"    MAE : ₹{m['mae']}")
        if "r2" in m:
            print(f"    R²  : {m['r2']}")
        if "roc_auc" in m:
            print(f"    AUC : {m['roc_auc']}")
    print()
