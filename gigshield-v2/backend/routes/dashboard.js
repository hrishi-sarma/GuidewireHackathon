const router = require('express').Router();
const db     = require('../models/db');
const { auth, adminOnly } = require('../middleware/auth');

const safe = w => { if (!w) return null; const { password: _, ...s } = w; return s; };

const { getWeather } = require('../services/weather');

// GET /api/dashboard/worker
router.get('/worker', auth, async (req, res) => {
  try {
    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Not found' });

    const policy  = db.getActivePolicy(req.user.id);
    const claims  = db.getClaimsByWorker(req.user.id);
    const paid    = claims.filter(c => c.status === 'paid');
    const week    = Date.now() - 7 * 86400000;
    const wkPaid  = paid.filter(c => new Date(c.triggeredAt).getTime() > week);
    const weekEarnings = (worker.baseHourlyEarning || 80) * (worker.avgHoursPerWeek || 45);

    const totalProtected = paid.reduce((s, c) => s + c.payoutAmount, 0);

    const zone = db.getZone(worker.zoneId);
    let liveWeather = null;
    if (zone) {
      try { liveWeather = await getWeather(zone); } catch (e) { /* ignore */ }
    }

    res.json({
      worker: { ...safe(worker), zone },
      policy: policy ? { ...policy, plan: db.getPlan(policy.planId), zone } : null,
      liveWeather,
      alerts: db.getZoneAlerts(zone),
      stats: {
        totalProtected,
        weeklyProtected:         wkPaid.reduce((s, c) => s + c.payoutAmount, 0),
        protectionRate:          weekEarnings > 0 ? Math.round(wkPaid.reduce((s,c)=>s+c.payoutAmount,0) / weekEarnings * 100) : 0,
        totalClaims:             claims.length,
        paidClaims:              paid.length,
        estimatedWeeklyEarnings: weekEarnings,
      },
      walletBalance: worker.walletBalance || 0,
      recentClaims: claims.slice(0, 5),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/admin
router.get('/admin', auth, adminOnly, (req, res) => {
  const allClaims   = db.getAllClaims();
  const allPolicies = db.getPolicies();
  const allWorkers  = db.getWorkers();

  const premiumIn  = allPolicies.reduce((s, p) => s + (p.totalPaidIn  || 0), 0);
  const paidOut    = allClaims.filter(c => c.status === 'paid').reduce((s, c) => s + c.payoutAmount, 0);
  const lossRatio  = premiumIn > 0 ? parseFloat((paidOut / premiumIn * 100).toFixed(1)) : 0;
  const fraudQueue = allClaims.filter(c => c.status === 'fraud_review');

  const byTrigger = allClaims.reduce((acc, c) => {
    acc[c.triggerType] = (acc[c.triggerType] || 0) + 1; return acc;
  }, {});

  const weeklyTrend = Array.from({ length: 4 }, (_, i) => {
    const from = Date.now() - (i + 1) * 7 * 86400000;
    const to   = Date.now() -  i      * 7 * 86400000;
    const wk   = allClaims.filter(c => {
      const t = new Date(c.triggeredAt).getTime();
      return t >= from && t < to;
    });
    return {
      week:   `W-${i + 1}`,
      claims: wk.length,
      payout: wk.filter(c => c.status === 'paid').reduce((s, c) => s + c.payoutAmount, 0),
    };
  }).reverse();

  const zoneStats = db.getZones().map(z => ({
    ...z,
    activePolicies: allPolicies.filter(p => p.zoneId === z.id && p.status === 'active').length,
    totalClaims:    allClaims.filter(c => db.getPolicyById(c.policyId)?.zoneId === z.id).length,
  }));

  res.json({
    summary: {
      totalWorkers:    allWorkers.length,
      activePolicies:  allPolicies.filter(p => p.status === 'active').length,
      premiumIn, paidOut, lossRatio,
      fraudQueueCount: fraudQueue.length,
      totalClaims:     allClaims.length,
    },
    byTrigger, weeklyTrend, zoneStats,
    recentClaims: allClaims.slice(0, 15).map(c => ({
      ...c, worker: safe(db.findWorkerById(c.workerId)),
    })),
    fraudQueue: fraudQueue.map(c => ({
      ...c, worker: safe(db.findWorkerById(c.workerId)),
    })),
  });
});

module.exports = router;