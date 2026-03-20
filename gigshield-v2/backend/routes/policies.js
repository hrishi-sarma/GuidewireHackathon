const router = require('express').Router();
const db     = require('../models/db');
const { auth } = require('../middleware/auth');
const { calculatePremium } = require('../services/ml');

// GET /api/policies/plans
router.get('/plans', auth, async (req, res) => {
  try {
    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    const plans = await Promise.all(
      db.getPlans().map(async plan => ({ ...plan, pricing: await calculatePremium(worker, plan) }))
    );
    res.json({ plans });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/policies/active
router.get('/active', auth, (req, res) => {
  const policy = db.getActivePolicy(req.user.id);
  if (!policy) return res.json({ policy: null });
  res.json({ policy: { ...policy, plan: db.getPlan(policy.planId), zone: db.getZone(policy.zoneId) } });
});

// GET /api/policies/my
router.get('/my', auth, (req, res) => {
  const list = db.getPoliciesByWorker(req.user.id).map(p => ({
    ...p, plan: db.getPlan(p.planId), zone: db.getZone(p.zoneId),
  }));
  res.json({ policies: list });
});

// POST /api/policies — purchase weekly plan (deducts from wallet)
router.post('/', auth, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan   = db.getPlan(planId);
    const worker = db.findWorkerById(req.user.id);
    if (!plan)   return res.status(400).json({ error: 'Invalid plan' });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const pricing = await calculatePremium(worker, plan);
    const premium = pricing.dynamicWeeklyPremium;

    // Check wallet balance
    const balance = worker.walletBalance || 0;
    if (balance < premium) {
      return res.status(402).json({
        error: `Insufficient wallet balance. You need ₹${premium} but have ₹${balance}. Please add money to your wallet first.`,
        required: premium,
        balance,
      });
    }

    // Deduct from wallet
    db.debitWallet(worker.id, premium, `Premium for ${plan.name}`, {
      method:  'wallet',
      planId,
      ref:     'POL' + Date.now().toString(36).toUpperCase(),
    });

    // Expire existing active policy
    const existing = db.getActivePolicy(worker.id);
    if (existing) db.updatePolicy(existing.id, { status: 'expired' });

    const now = new Date();
    const end = new Date(now.getTime() + 7 * 86400000);

    const policy = db.createPolicy({
      workerId:        worker.id,
      planId,
      zoneId:          worker.zoneId,
      weeklyPremium:   premium,
      maxWeeklyPayout: plan.maxWeeklyPayout,
      status:          'active',
      startDate:       now.toISOString(),
      endDate:         end.toISOString(),
      totalPaidIn:     premium,
      totalPaidOut:    0,
      claimCount:      0,
      pricingBreakdown: pricing,
    });

    res.status(201).json({
      policy: { ...policy, plan, zone: db.getZone(worker.zoneId) },
      message: `Policy activated! ₹${premium} deducted from your GigShield Wallet.`,
      walletBalance: worker.walletBalance,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/policies/active — cancel current plan
router.delete('/active', auth, (req, res) => {
  const success = db.cancelPolicy(req.user.id);
  if (success) res.json({ message: 'Policy cancelled successfully' });
  else res.status(404).json({ error: 'No active policy found' });
});

module.exports = router;