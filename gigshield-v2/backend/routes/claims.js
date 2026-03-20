const router = require('express').Router();
const db     = require('../models/db');
const { auth, adminOnly } = require('../middleware/auth');

const safe = w => { if (!w) return null; const { password: _, ...s } = w; return s; };
const upi  = () => 'UPI' + Math.random().toString(36).substr(2, 12).toUpperCase();

// GET /api/claims/my
router.get('/my', auth, (req, res) => {
  const claims = db.getClaimsByWorker(req.user.id).map(c => ({
    ...c, policy: db.getPolicyById(c.policyId),
  }));
  res.json({ claims });
});

// GET /api/claims  (admin)
router.get('/', auth, adminOnly, (req, res) => {
  const claims = db.getAllClaims().map(c => ({
    ...c,
    worker: safe(db.findWorkerById(c.workerId)),
    policy: db.getPolicyById(c.policyId),
  }));
  res.json({ claims });
});

// POST /api/claims/:id/approve  (admin) — credits worker wallet
router.post('/:id/approve', auth, adminOnly, (req, res) => {
  const ref = upi();
  const claim = db.updateClaim(req.params.id, {
    status: 'paid', paidAt: new Date().toISOString(), upiRef: ref,
  });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  // Credit the worker's wallet
  db.creditWallet(claim.workerId, claim.payoutAmount, `Claim payout: ${claim.triggerType} disruption`, {
    method:  'claim_payout',
    claimId: claim.id,
    ref,
  });

  res.json({ message: 'Claim approved and payout credited to wallet', claim });
});

// POST /api/claims/:id/reject  (admin)
router.post('/:id/reject', auth, adminOnly, (req, res) => {
  const { reason } = req.body;
  const claim = db.updateClaim(req.params.id, {
    status: 'rejected', rejectedReason: reason || 'Rejected by insurer',
  });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  res.json({ message: 'Claim rejected', claim });
});

module.exports = router;