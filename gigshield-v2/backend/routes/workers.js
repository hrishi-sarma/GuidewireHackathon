const router = require('express').Router();
const db     = require('../models/db');
const { auth } = require('../middleware/auth');
const { calculatePremium } = require('../services/ml');

// GET /api/workers/zones  (public — needed for register form)
router.get('/zones', (req, res) => {
  res.json({ zones: db.getZones() });
});

// GET /api/workers/risk-profile
router.get('/risk-profile', auth, async (req, res) => {
  try {
    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Not found' });
    const zone   = db.getZone(worker.zoneId);
    const plans  = await Promise.all(
      db.getPlans().map(async p => ({ planId: p.id, pricing: await calculatePremium(worker, p) }))
    );
    res.json({ zone, riskProfile: plans[1].pricing, allPlanPricing: plans });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/workers/profile — update zone
router.patch('/profile', auth, (req, res) => {
  const { zoneId } = req.body;
  if (!zoneId) return res.status(400).json({ error: 'zoneId required' });
  
  const worker = db.findWorkerById(req.user.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  
  Object.assign(worker, { zoneId });
  db.save();
  
  res.json({ message: 'Zone updated successfully', worker });
});

module.exports = router;
