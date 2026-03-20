"""
evaluate_models.py
Generates evaluation charts for all three models.
Run: python3 evaluate_models.py
Outputs: plots/*.png
"""

import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    roc_curve, roc_auc_score, precision_recall_curve,
    confusion_matrix, mean_absolute_error, r2_score,
)
import os

os.makedirs("plots", exist_ok=True)

# ── Style ─────────────────────────────────────────────────────────────────────
plt.rcParams.update({
    "figure.facecolor": "#0f1117",
    "axes.facecolor":   "#1a1d27",
    "axes.edgecolor":   "#2e3142",
    "axes.labelcolor":  "#c8cad8",
    "text.color":       "#c8cad8",
    "xtick.color":      "#7a7c94",
    "ytick.color":      "#7a7c94",
    "grid.color":       "#2e3142",
    "grid.linestyle":   "--",
    "grid.alpha":       0.5,
    "font.family":      "sans-serif",
    "axes.spines.top":  False,
    "axes.spines.right":False,
})

ACCENT  = "#4f7fff"
GREEN   = "#22c55e"
RED     = "#ef4444"
AMBER   = "#f59e0b"
PURPLE  = "#8b5cf6"

def load(fname):
    return joblib.load(f"models/{fname}")


# ═══════════════════════════════════════════════════════════════════════════════
# CHART 1 — Premium Model: Predicted vs Actual + Residuals
# ═══════════════════════════════════════════════════════════════════════════════

def plot_premium():
    df    = pd.read_csv("data/processed/premium_features.csv")
    model = load("premium_model.joblib")

    NUM = ["zone_risk_score","zone_flood_prone","base_premium","month","season_factor",
           "avg_hours_per_week","hours_ratio","n_past_claims","n_fraud_claims",
           "worker_age_weeks","city_mumbai","city_delhi","city_chennai",
           "week_precip_mm","week_rain_mm_per_hr","week_temp_max_c","week_aqi","is_monsoon"]
    CAT = ["platform","plan_id"]
    X = df[NUM+CAT]; y = df["weekly_premium"]
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    y_pred = model.predict(X_test)
    residuals = y_pred - y_test

    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    fig.suptitle("Premium Model — GradientBoostingRegressor", color="white", fontsize=14, y=1.02)

    # Scatter: predicted vs actual
    ax = axes[0]
    ax.scatter(y_test, y_pred, alpha=0.3, s=8, color=ACCENT)
    mn, mx = y_test.min(), y_test.max()
    ax.plot([mn, mx], [mn, mx], color=GREEN, lw=1.5, ls="--", label="Perfect fit")
    ax.set_xlabel("Actual Premium (₹)"); ax.set_ylabel("Predicted Premium (₹)")
    ax.set_title(f"Predicted vs Actual\nMAE=₹{mean_absolute_error(y_test,y_pred):.2f}  R²={r2_score(y_test,y_pred):.4f}")
    ax.legend(); ax.grid(True)

    # Residuals histogram
    ax = axes[1]
    ax.hist(residuals, bins=40, color=ACCENT, edgecolor="none", alpha=0.85)
    ax.axvline(0, color=GREEN, lw=1.5, ls="--")
    ax.set_xlabel("Residual (₹)"); ax.set_ylabel("Count")
    ax.set_title(f"Residual Distribution\nMean={residuals.mean():.2f}  Std={residuals.std():.2f}")
    ax.grid(True)

    # Feature importances
    ax = axes[2]
    gbm = model.named_steps["gbm"]
    enc_names = model.named_steps["prep"].transformers_[1][1].get_feature_names_out(CAT).tolist()
    feat_names = NUM + enc_names
    imps = list(zip(feat_names, gbm.feature_importances_))
    imps.sort(key=lambda x: x[1], reverse=True)
    top = imps[:10]
    names, vals = zip(*top)
    colors = [ACCENT if v > 0.05 else "#3a3f58" for v in vals]
    ax.barh(range(len(top)), vals[::-1], color=colors[::-1], edgecolor="none")
    ax.set_yticks(range(len(top)))
    ax.set_yticklabels([n.replace("_", " ")[:22] for n in names[::-1]], fontsize=8)
    ax.set_xlabel("Importance"); ax.set_title("Feature Importances (Top 10)")
    ax.grid(True, axis="x")

    plt.tight_layout()
    plt.savefig("plots/premium_model_eval.png", dpi=150, bbox_inches="tight", facecolor="#0f1117")
    plt.close()
    print("  ✓ plots/premium_model_eval.png")


# ═══════════════════════════════════════════════════════════════════════════════
# CHART 2 — Fraud Model: ROC, PR Curve, Confusion Matrix, Feature Importance
# ═══════════════════════════════════════════════════════════════════════════════

def plot_fraud():
    df    = pd.read_csv("data/processed/fraud_features.csv")
    model = load("fraud_model.joblib")
    meta  = load("fraud_threshold.joblib")
    thr   = meta["optimal_threshold"]

    NUM = ["gps_zone_match","was_active_on_platform","duplicate_claim_24h","disruption_hours",
           "claimed_payout","expected_payout","payout_deviation_ratio","base_hourly_earning",
           "zone_risk_score","platform_orders_before_trigger","worker_claim_history","hour_of_day","is_weekend",
           "trigger_rain_mm_hr","trigger_aqi","trigger_temp_c","trigger_month","is_monsoon_trigger"]
    CAT = ["trigger_type"]
    X = df[NUM+CAT]; y = df["is_fraud"]
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    y_proba = model.predict_proba(X_test)[:,1]
    y_pred  = (y_proba >= thr).astype(int)

    fig, axes = plt.subplots(1, 4, figsize=(20, 5))
    fig.suptitle("Fraud Detection Model — RandomForestClassifier (balanced weights)", color="white", fontsize=13, y=1.02)

    # ROC curve
    ax = axes[0]
    fpr, tpr, _ = roc_curve(y_test, y_proba)
    auc = roc_auc_score(y_test, y_proba)
    ax.plot(fpr, tpr, color=ACCENT, lw=2, label=f"ROC AUC = {auc:.4f}")
    ax.plot([0,1],[0,1], ls="--", color="#3a3f58")
    ax.fill_between(fpr, tpr, alpha=0.15, color=ACCENT)
    ax.set_xlabel("False Positive Rate"); ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC Curve"); ax.legend(); ax.grid(True)

    # Precision-Recall curve
    ax = axes[1]
    prec, rec, thrs = precision_recall_curve(y_test, y_proba)
    f1 = 2*prec*rec/(prec+rec+1e-9)
    best = np.argmax(f1)
    ax.plot(rec, prec, color=PURPLE, lw=2)
    ax.scatter(rec[best], prec[best], color=AMBER, s=80, zorder=5, label=f"Best F1={f1[best]:.3f} @ thr={thr:.2f}")
    ax.fill_between(rec, prec, alpha=0.1, color=PURPLE)
    ax.set_xlabel("Recall"); ax.set_ylabel("Precision")
    ax.set_title("Precision-Recall Curve"); ax.legend(); ax.grid(True)

    # Confusion matrix
    ax = axes[2]
    cm = confusion_matrix(y_test, y_pred)
    im = ax.imshow(cm, cmap="Blues", aspect="auto")
    labels = ["Legit", "Fraud"]
    ax.set_xticks([0,1]); ax.set_yticks([0,1])
    ax.set_xticklabels(labels); ax.set_yticklabels(labels)
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    ax.set_title(f"Confusion Matrix\n(threshold = {thr:.2f})")
    for i in range(2):
        for j in range(2):
            color = "white" if cm[i,j] > cm.max()/2 else "#c8cad8"
            ax.text(j, i, str(cm[i,j]), ha="center", va="center", color=color, fontsize=14, fontweight="bold")

    # Feature importances
    ax = axes[3]
    rf = model.named_steps["rf"]
    enc_names = model.named_steps["prep"].transformers_[1][1].get_feature_names_out(CAT).tolist()
    feat_names = NUM + enc_names
    imps = sorted(zip(feat_names, rf.feature_importances_), key=lambda x: x[1], reverse=True)[:10]
    names, vals = zip(*imps)
    colors = [RED if "gps" in n or "active" in n or "dup" in n or "deviation" in n else ACCENT for n in names]
    ax.barh(range(len(imps)), list(reversed(vals)), color=list(reversed(colors)), edgecolor="none")
    ax.set_yticks(range(len(imps)))
    ax.set_yticklabels([n.replace("_", " ")[:28] for n in reversed(names)], fontsize=8)
    ax.set_xlabel("Importance"); ax.set_title("Feature Importances (Top 10)")
    ax.grid(True, axis="x")

    plt.tight_layout()
    plt.savefig("plots/fraud_model_eval.png", dpi=150, bbox_inches="tight", facecolor="#0f1117")
    plt.close()
    print("  ✓ plots/fraud_model_eval.png")


# ═══════════════════════════════════════════════════════════════════════════════
# CHART 3 — Payout Model + Summary Dashboard
# ═══════════════════════════════════════════════════════════════════════════════

def plot_payout_and_summary():
    df    = pd.read_csv("data/processed/payout_features.csv")
    model = load("payout_model.joblib")

    NUM = ["base_hourly_earning","disruption_hours","max_weekly_payout","event_cap_60pct",
           "is_heat_trigger","is_flat_rate","real_rain_mm_hr","real_aqi"]
    CAT = ["trigger_type","plan_id"]
    X = df[NUM+CAT]; y = df["payout_amount"]
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    y_pred = model.predict(X_test)

    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    fig.suptitle("Payout Model — GradientBoostingRegressor", color="white", fontsize=13, y=1.02)

    # Predicted vs actual
    ax = axes[0]
    ax.scatter(y_test, y_pred, alpha=0.3, s=8, color=GREEN)
    mn, mx = y_test.min(), y_test.max()
    ax.plot([mn,mx],[mn,mx], color=AMBER, lw=1.5, ls="--")
    mae = mean_absolute_error(y_test, y_pred)
    r2  = r2_score(y_test, y_pred)
    ax.set_xlabel("Actual Payout (₹)"); ax.set_ylabel("Predicted Payout (₹)")
    ax.set_title(f"Predicted vs Actual\nMAE=₹{mae:.2f}  R²={r2:.4f}"); ax.grid(True)

    # Payout distribution by trigger type
    ax = axes[1]
    trigger_types = df["trigger_type"].unique()
    colors = [ACCENT, GREEN, RED, AMBER, PURPLE]
    for i, t in enumerate(trigger_types):
        vals = df[df.trigger_type==t]["payout_amount"]
        ax.hist(vals, bins=30, alpha=0.6, label=t, color=colors[i % len(colors)], edgecolor="none")
    ax.set_xlabel("Payout (₹)"); ax.set_ylabel("Count")
    ax.set_title("Payout Distribution by Trigger"); ax.legend(fontsize=8); ax.grid(True)

    # Error distribution
    ax = axes[2]
    errors = np.abs(y_pred - y_test)
    ax.hist(errors, bins=40, color=GREEN, edgecolor="none", alpha=0.85)
    ax.axvline(errors.mean(), color=AMBER, lw=2, ls="--", label=f"Mean error ₹{errors.mean():.1f}")
    ax.axvline(np.percentile(errors, 90), color=RED, lw=1.5, ls="--", label=f"P90 error ₹{np.percentile(errors,90):.1f}")
    ax.set_xlabel("Absolute Error (₹)"); ax.set_ylabel("Count")
    ax.set_title("Absolute Error Distribution"); ax.legend(); ax.grid(True)

    plt.tight_layout()
    plt.savefig("plots/payout_model_eval.png", dpi=150, bbox_inches="tight", facecolor="#0f1117")
    plt.close()
    print("  ✓ plots/payout_model_eval.png")


# ═══════════════════════════════════════════════════════════════════════════════
# CHART 4 — Premium vs Zone Risk + Seasonal heatmap (business insights)
# ═══════════════════════════════════════════════════════════════════════════════

def plot_business_insights():
    df_p = pd.read_csv("data/processed/premium_features.csv")
    df_w = pd.read_csv("data/raw/weather_all_cities.csv", parse_dates=["date"])

    fig, axes = plt.subplots(2, 3, figsize=(18, 10))
    fig.suptitle("Real-World Data Insights — ERA5 Weather + CPCB AQI (2019–2024)",
                 color="white", fontsize=14, y=1.01)

    # ── 1. Monthly avg rainfall per city ─────────────────────────────────────
    ax = axes[0, 0]
    city_colors = {"Mumbai": ACCENT, "Delhi": GREEN, "Chennai": AMBER,
                   "Bengaluru": PURPLE, "Hyderabad": RED}
    df_w["month"] = df_w["date"].dt.month
    for city, color in city_colors.items():
        sub = df_w[df_w.city == city].groupby("month")["precip_mm"].mean()
        ax.plot(sub.index, sub.values, color=color, lw=2, label=city, marker="o", ms=4)
    ax.set_xlabel("Month"); ax.set_ylabel("Avg Daily Rainfall (mm)")
    ax.set_title("Monthly Rainfall Pattern by City\n(ERA5 Real Data)")
    ax.set_xticks(range(1,13))
    ax.set_xticklabels(["J","F","M","A","M","J","J","A","S","O","N","D"], fontsize=9)
    ax.legend(fontsize=8); ax.grid(True)

    # ── 2. Real trigger day distribution ────────────────────────────────────
    ax = axes[0, 1]
    df_w["rain_mm_per_hr"] = df_w["rain_mm_per_hr"].fillna(0)
    trigger_counts = {}
    for city in df_w.city.unique():
        s = df_w[df_w.city == city]
        trigger_counts[city] = {
            "Rain >15mm/hr": (s["rain_mm_per_hr"] >= 15).sum(),
            "Heat >42°C":    (s["temp_max_c"] >= 42).sum(),
        }
    cities = list(trigger_counts.keys())
    x = np.arange(len(cities))
    w = 0.35
    rain_vals = [trigger_counts[c]["Rain >15mm/hr"] for c in cities]
    heat_vals = [trigger_counts[c]["Heat >42°C"] for c in cities]
    ax.bar(x - w/2, rain_vals, w, label="Rain >15mm/hr", color=ACCENT, alpha=0.85)
    ax.bar(x + w/2, heat_vals, w, label="Heat >42°C",    color=RED,   alpha=0.85)
    ax.set_xticks(x); ax.set_xticklabels([c[:3] for c in cities])
    ax.set_ylabel("Days (2019–2024)")
    ax.set_title("Real Trigger Days per City\n(2019–2024, ERA5)")
    ax.legend(fontsize=8); ax.grid(True, axis="y")

    # ── 3. Premium vs actual weekly rainfall (scatter, colour=plan) ─────────
    ax = axes[0, 2]
    plan_colors = {"basic": GREEN, "pro": ACCENT, "max": PURPLE}
    for plan, color in plan_colors.items():
        sub = df_p[df_p.plan_id == plan]
        ax.scatter(sub["week_precip_mm"], sub["weekly_premium"],
                   alpha=0.2, s=6, color=color, label=plan.capitalize())
    ax.set_xlabel("Real Week Precipitation (mm)")
    ax.set_ylabel("Dynamic Premium (₹/week)")
    ax.set_title("Rainfall → Premium Relationship\n(trained on real ERA5 data)")
    ax.legend(fontsize=8); ax.grid(True)

    # ── 4. Monsoon vs dry season premium gap ────────────────────────────────
    ax = axes[1, 0]
    for plan, color in plan_colors.items():
        sub = df_p[df_p.plan_id == plan]
        monsoon = sub[sub.is_monsoon == 1]["weekly_premium"]
        dry     = sub[sub.is_monsoon == 0]["weekly_premium"]
        ax.bar([f"{plan}\ndry"], [dry.mean()],    color=color, alpha=0.55, edgecolor="none")
        ax.bar([f"{plan}\nmonsoon"], [monsoon.mean()], color=color, alpha=0.95, edgecolor="none")
    ax.set_ylabel("Avg Weekly Premium (₹)")
    ax.set_title("Monsoon vs Dry Season Premium\n(real seasonal split)")
    ax.grid(True, axis="y")

    # ── 5. AQI impact — Delhi premium vs AQI (real data) ───────────────────
    ax = axes[1, 1]
    delhi = df_p[df_p.city == "Delhi"].copy()
    aqi_bins = pd.cut(delhi["week_aqi"], bins=[0,100,200,300,400,600],
                      labels=["<100","100–200","200–300","300–400",">400"])
    aqi_premium = delhi.groupby(aqi_bins, observed=True)["weekly_premium"].agg(["mean","std"]).reset_index()
    colors_aqi = [GREEN, AMBER, AMBER, RED, RED]
    ax.bar(aqi_premium["week_aqi"].astype(str), aqi_premium["mean"],
           yerr=aqi_premium["std"], color=colors_aqi, alpha=0.85,
           capsize=4, error_kw={"color":"#666","linewidth":1})
    ax.set_xlabel("Real AQI Bucket (CPCB)")
    ax.set_ylabel("Avg Premium (₹/week)")
    ax.set_title("Delhi: AQI Level → Premium\n(CPCB real AQI data)")
    ax.grid(True, axis="y")

    # ── 6. Year-on-year trigger frequency trend ──────────────────────────────
    ax = axes[1, 2]
    df_w["year"] = df_w["date"].dt.year
    yearly = df_w.groupby("year").apply(
        lambda x: pd.Series({
            "rain_triggers": (x["rain_mm_per_hr"] >= 15).sum(),
            "heat_triggers": (x["temp_max_c"] >= 42).sum(),
        })
    ).reset_index()
    ax.plot(yearly["year"], yearly["rain_triggers"], color=ACCENT, lw=2,
            marker="o", ms=5, label="Rain triggers")
    ax.plot(yearly["year"], yearly["heat_triggers"], color=RED,   lw=2,
            marker="s", ms=5, label="Heat triggers")
    ax.fill_between(yearly["year"], yearly["rain_triggers"], alpha=0.1, color=ACCENT)
    ax.fill_between(yearly["year"], yearly["heat_triggers"], alpha=0.1, color=RED)
    ax.set_xlabel("Year"); ax.set_ylabel("Trigger Days (all cities)")
    ax.set_title("Annual Trigger Frequency Trend\n(ERA5 2019–2024)")
    ax.legend(fontsize=8); ax.grid(True)

    plt.tight_layout()
    plt.savefig("plots/real_data_insights.png", dpi=150,
                bbox_inches="tight", facecolor="#0f1117")
    plt.close()
    print("  ✓ plots/real_data_insights.png")


if __name__ == "__main__":
    print("Generating evaluation charts...\n")
    plot_premium()
    plot_fraud()
    plot_payout_and_summary()
    plot_business_insights()
    print("\nAll charts saved to plots/")
