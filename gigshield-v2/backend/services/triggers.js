/**
 * Parametric trigger engine
 * Polls weather every 10 minutes, auto-creates claims when thresholds crossed.
 */

const cron      = require('node-cron');
const db        = require('../models/db');
const { getWeather } = require('./weather');
const { scoreFraud, calculatePayout } = require('./ml');

const THRESHOLDS = {
  rain:   { field: 'rainfall_mm_hr',   min: 15,  label: 'Heavy Rain',    unit: 'mm/hr' },
  aqi:    { field: 'aqi',              min: 300,  label: 'Severe AQI',    unit: ' AQI'  },
  heat:   { field: 'temp_celsius',     min: 42,   label: 'Extreme Heat',  unit: '°C'    },
  curfew: { field: 'curfew_active',    min: 1,    label: 'Curfew/Strike', unit: ''      },
  flood:  { field: 'road_blocked_pct', min: 70,   label: 'Road Flooding', unit: '%'     },
};

function estimateHours(type, value, threshold) {
  const severity = (value - threshold) / threshold;
  const base = { rain: 2.5, aqi: 4, heat: 4, curfew: 3, flood: 3 }[type] || 2;
  return parseFloat((base + severity * 1.5).toFixed(1));
}

async function processPayout(claimId) {
  const ref = 'UPI' + Math.random().toString(36).substr(2, 12).toUpperCase();
  const claim = db.updateClaim(claimId, { status: 'paid', paidAt: new Date().toISOString(), upiRef: ref });
  if (claim) {
    // Credit the worker's wallet automatically
    db.creditWallet(claim.workerId, claim.payoutAmount, `Auto-payout: ${claim.triggerType} disruption`, {
      method:  'claim_payout',
      claimId: claim.id,
      ref,
    });
    console.log(`💸 Wallet credited | worker=${claim.workerId} amount=₹${claim.payoutAmount} ref=${ref}`);
  }
  console.log(`💸 Payout sent | claim=${claimId} ref=${ref}`);
}

async function checkZone(zone) {
  const weather   = await getWeather(zone);
  const triggered = [];

  for (const [type, cfg] of Object.entries(THRESHOLDS)) {
    const val = weather[cfg.field];
    if (val != null && val >= cfg.min) {
      triggered.push({ type, value: val, threshold: cfg.min, label: cfg.label, unit: cfg.unit });
    }
  }

  if (!triggered.length) return;

  const event = db.addTriggerEvent({ zoneId: zone.id, zoneName: zone.name, triggers: triggered, weather });
  console.log(`⚡ [${weather.source}] Trigger in ${zone.name}:`, triggered.map(t => t.label).join(', '));

  const active = db.getPolicies().filter(p => p.status === 'active' && p.zoneId === zone.id);

  for (const policy of active) {
    const plan   = db.getPlan(policy.planId);
    const worker = db.findWorkerById(policy.workerId);
    if (!plan || !worker) continue;

    for (const trig of triggered) {
      if (!plan.triggers.includes(trig.type)) continue;

      const hours   = estimateHours(trig.type, trig.value, trig.threshold);
      const payout  = await calculatePayout(worker, policy, trig.type, hours);
      if (payout <= 0) continue;

      const gpsMatch     = Math.random() > 0.05;
      const activeStatus = Math.random() > 0.03;

      const fraudScore = await scoreFraud({
        gpsZoneMatch:     gpsMatch,
        wasActive:        activeStatus,
        disruptionHours:  hours,
        payoutAmount:     payout,
        triggerType:      trig.type,
        triggerRainMmHr:  weather.rainfall_mm_hr || 0,
        triggerAqi:       weather.aqi || 100,
        triggerTempC:     weather.temp_celsius || 30,
      }, worker);

      const claim = db.createClaim({
        workerId:       worker.id,
        policyId:       policy.id,
        triggerEventId: event.id,
        triggerType:    trig.type,
        triggerValue:   `${Number(trig.value).toFixed(1)}${trig.unit}`,
        disruptionHours: hours,
        payoutAmount:   payout,
        fraudScore,
        status:         fraudScore > 75 ? 'fraud_review' : 'processing',
        fraudReason:    fraudScore > 75 ? 'Anomalous activity detected — flagged for audit' : null,
        triggeredAt:    new Date().toISOString(),
        weatherSource:  weather.source,
      });

      // Auto-payout (and wallet credit) if verified
      if (fraudScore <= 75) {
        setTimeout(() => processPayout(claim.id), 5000 + Math.random() * 5000);
      }

      console.log(`📋 Claim ${claim.id.split('-')[0]} | ${worker.name} | ₹${payout} | fraud=${fraudScore} | src=${weather.source}`);
    }
  }
}

async function runCheck() {
  for (const zone of db.getZones()) await checkZone(zone);
  return db.getRecentTriggers();
}

function start() {
  const { LIVE } = require('./weather');
  console.log(`🔍 [Real-Life Monitor] Active — Source: ${LIVE ? 'OpenWeatherMap' : 'Mock (Demo Only)'}`);
  cron.schedule('*/10 * * * *', async () => {
    console.log(`🔄 Trigger check: ${new Date().toLocaleTimeString()}`);
    await runCheck();
  });
}

module.exports = { start, runCheck };