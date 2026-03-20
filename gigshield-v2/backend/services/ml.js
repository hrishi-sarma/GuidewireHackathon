/**
 * ML Service client
 * Calls the Python FastAPI service for premium, fraud, and payout.
 * Falls back to deterministic local formulas if service is unreachable.
 */

const axios = require('axios');
const db    = require('../models/db');

const ML_URL     = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const TIMEOUT_MS = 5000;

// Health-check state — probe once at startup, retry after failures
let mlUp         = null;
let nextProbeAt  = 0;
let failCount    = 0;
let warnedOnce   = false;

async function isMlUp() {
  const now = Date.now();
  if (mlUp !== null && now < nextProbeAt) return mlUp;
  try {
    await axios.get(`${ML_URL}/health`, { timeout: 3000 });
    if (!mlUp) console.log(`✅  ML service connected at ${ML_URL}`);
    mlUp = true; failCount = 0; nextProbeAt = 0;
  } catch {
    failCount++;
    nextProbeAt = now + Math.min(60000, 5000 * failCount);
    if (!warnedOnce) {
      console.warn(`⚠️  ML service unreachable at ${ML_URL} — using local formulas`);
      console.warn('   To activate: cd ml-service && uvicorn main:app --port 5000');
      warnedOnce = true;
    }
    mlUp = false;
  }
  return mlUp;
}

isMlUp().catch(() => {}); // non-blocking startup probe

async function mlPost(path, body) {
  const { data } = await axios.post(`${ML_URL}${path}`, body, { timeout: TIMEOUT_MS });
  return data;
}

// ---------------------------------------------------------------------------
// Local fallback constants
// ---------------------------------------------------------------------------

const SEASONAL = [1.0,1.0,1.05,1.1,1.15,1.3,1.45,1.45,1.3,1.15,1.1,1.0];
const PLATFORM = { zomato: 1.0, swiggy: 1.02 };

function historyMultiplier(workerId) {
  const cs = db.getClaimsByWorker(workerId);
  if (cs.some(c => c.status === 'fraud_review')) return 1.3;
  if (cs.length === 0) return 0.95;
  return 1.0;
}

// ---------------------------------------------------------------------------
// calculatePremium
// ---------------------------------------------------------------------------

async function calculatePremium(worker, plan) {
  const zone   = db.getZone(worker.zoneId);
  const month  = new Date().getMonth();
  const hoursR = Math.min((worker.avgHoursPerWeek || 45) / 50, 1.2);
  const claims = db.getClaimsByWorker(worker.id);

  if (await isMlUp()) {
    try {
      const city = zone?.city || '';
      const r = await mlPost('/premium/calculate', {
        worker_id:           worker.id,
        zone_risk_score:     zone?.riskScore ?? 0.7,
        zone_flood_prone:    zone?.floodProne ? 1 : 0,
        platform:            worker.platform || 'swiggy',
        plan_id:             plan.id,
        month,
        avg_hours_per_week:  worker.avgHoursPerWeek || 45,
        hours_ratio:         hoursR,
        n_past_claims:       claims.length,
        fraud_claim_count:   claims.filter(c => c.status === 'fraud_review').length,
        worker_age_weeks:    4,
        city_mumbai:         city === 'Mumbai'    ? 1 : 0,
        city_delhi:          city === 'Delhi'     ? 1 : 0,
        city_chennai:        city === 'Chennai'   ? 1 : 0,
        week_precip_mm:      2.0,
        week_rain_mm_per_hr: 0.5,
        week_temp_max_c:     33.0,
        week_aqi:            100.0,
        is_monsoon:          [5,6,7,8].includes(month) ? 1 : 0,
      });
      return {
        baseWeeklyPremium:    plan.baseWeeklyPremium,
        dynamicWeeklyPremium: r.dynamic_premium,
        multiplier:           r.multiplier,
        riskLabel:            r.risk_label,
        source:               'ml_service',
        zone:                 zone?.name,
      };
    } catch (e) {
      console.error('ML premium failed:', e.message, '— using fallback');
      mlUp = false;
    }
  }

  // Local fallback
  const zr  = zone?.riskScore ?? 0.7;
  const sf  = SEASONAL[month] || 1.0;
  const pf  = PLATFORM[worker.platform] || 1.0;
  const hf  = historyMultiplier(worker.id);
  const rs  = zr*0.35 + sf*0.25 + hoursR*0.20 + pf*0.10 + hf*0.10;
  const mul = Math.max(0.8, Math.min(1.5, 0.8 + (rs - 0.7) * 1.4));

  return {
    baseWeeklyPremium:    plan.baseWeeklyPremium,
    dynamicWeeklyPremium: Math.round(plan.baseWeeklyPremium * mul),
    multiplier:           parseFloat(mul.toFixed(2)),
    riskLabel:            rs > 1.1 ? 'High Risk Zone' : rs > 0.9 ? 'Moderate Risk' : 'Low Risk',
    source:               'local_fallback',
    zone:                 zone?.name,
    breakdown: {
      zoneRisk:    parseFloat((zr*0.35).toFixed(3)),
      seasonal:    parseFloat((sf*0.25).toFixed(3)),
      hours:       parseFloat((hoursR*0.20).toFixed(3)),
      platform:    parseFloat((pf*0.10).toFixed(3)),
      history:     parseFloat((hf*0.10).toFixed(3)),
    },
  };
}

// ---------------------------------------------------------------------------
// scoreFraud
// ---------------------------------------------------------------------------

async function scoreFraud(claim, worker) {
  const base     = worker.baseHourlyEarning || 80;
  const hours    = claim.disruptionHours || 2;
  const expected = base * hours;
  const claimed  = claim.payoutAmount || expected;
  const deviation = (claimed - expected) / Math.max(expected, 1);
  const month    = new Date().getMonth();

  if (await isMlUp()) {
    try {
      const r = await mlPost('/fraud/score', {
        worker_id:                        worker.id,
        gps_zone_match:                   claim.gpsZoneMatch !== false ? 1 : 0,
        was_active_on_platform:           claim.wasActive !== false ? 1 : 0,
        duplicate_claim_24h:              0,
        disruption_hours:                 hours,
        claimed_payout:                   claimed,
        expected_payout:                  expected,
        payout_deviation_ratio:           parseFloat(deviation.toFixed(4)),
        base_hourly_earning:              base,
        trigger_type:                     claim.triggerType || 'rain',
        zone_risk_score:                  db.getZone(worker.zoneId)?.riskScore ?? 0.7,
        platform_orders_before_trigger:   10,
        worker_claim_history:             db.getClaimsByWorker(worker.id).length,
        hour_of_day:                      new Date().getHours(),
        is_weekend:                       [0,6].includes(new Date().getDay()) ? 1 : 0,
        trigger_rain_mm_hr:               claim.triggerRainMmHr  ?? 0,
        trigger_aqi:                      claim.triggerAqi       ?? 100,
        trigger_temp_c:                   claim.triggerTempC     ?? 30,
        trigger_month:                    month,
        is_monsoon_trigger:               [5,6,7,8].includes(month) ? 1 : 0,
      });
      return r.fraud_score;
    } catch (e) {
      console.error('ML fraud failed:', e.message, '— using fallback');
      mlUp = false;
    }
  }

  // Local fallback
  let score = 0;
  if (claim.gpsZoneMatch === false)                             score += 40;
  if (!claim.wasActive)                                         score += 25;
  if (claim.triggerType === 'rain' && (claim.triggerRainMmHr ?? 99) < 5) score += 20;
  if (claim.triggerType === 'aqi'  && (claim.triggerAqi ?? 999) < 200)   score += 20;
  const dups = db.getClaimsByWorker(worker.id).filter(c => {
    const diff = Math.abs(new Date(c.triggeredAt) - Date.now());
    return c.triggerType === claim.triggerType && diff < 86400000;
  });
  if (dups.length > 0) score += 30;
  score += Math.floor(Math.random() * 8);
  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// calculatePayout
// ---------------------------------------------------------------------------

async function calculatePayout(worker, policy, triggerType, disruptionHours) {
  const plan = db.getPlan(policy.planId);
  if (!plan) return 0;

  if (await isMlUp()) {
    try {
      const r = await mlPost('/payout/calculate', {
        trigger_type:        triggerType,
        plan_id:             policy.planId,
        base_hourly_earning: worker.baseHourlyEarning || 80,
        disruption_hours:    disruptionHours,
        max_weekly_payout:   policy.maxWeeklyPayout,
        real_rain_mm_hr:     0,
        real_aqi:            100,
      });
      return r.payout_amount;
    } catch (e) {
      console.error('ML payout failed:', e.message, '— using fallback');
      mlUp = false;
    }
  }

  // Local fallback
  if (triggerType === 'heat') return Math.min(200, policy.maxWeeklyPayout);
  const raw = (worker.baseHourlyEarning || 80) * disruptionHours;
  return Math.round(Math.min(raw, policy.maxWeeklyPayout * 0.6));
}

module.exports = { calculatePremium, scoreFraud, calculatePayout, isMlUp };
