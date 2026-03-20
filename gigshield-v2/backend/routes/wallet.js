const router = require('express').Router();
const db     = require('../models/db');
const { auth } = require('../middleware/auth');

// GET /api/wallet/balance
router.get('/balance', auth, (req, res) => {
  const worker = db.findWorkerById(req.user.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  res.json({
    balance:      worker.walletBalance || 0,
    transactions: db.getWalletTransactions(req.user.id, 30),
  });
});

// GET /api/wallet/transactions
router.get('/transactions', auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ transactions: db.getWalletTransactions(req.user.id, limit) });
});

// POST /api/wallet/add
router.post('/add', auth, async (req, res) => {
  try {
    const { amount, method = 'card', cardLast4, upiId } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (amount > 50000) return res.status(400).json({ error: 'Maximum top-up is ₹50,000 per transaction' });

    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    await new Promise(r => setTimeout(r, 800));

    const ref = 'PAY' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();

    const methodLabel = method === 'upi'
      ? `UPI (${upiId || 'user@upi'})`
      : method === 'netbanking'
        ? 'Net Banking'
        : `Card ••••${cardLast4 || '0000'}`;

    // creditWallet mutates worker.walletBalance in place
    db.creditWallet(req.user.id, Number(amount), `Added via ${methodLabel}`, {
      method, ref,
      cardLast4: cardLast4 || null,
      upiId:     upiId     || null,
    });

    // Read AFTER the credit so the value is updated
    res.json({
      success: true,
      message: `₹${amount} added to your GigShield Wallet`,
      ref,
      balance: worker.walletBalance,   // now reflects the credited amount
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/wallet/withdraw
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount, upiId } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!upiId) return res.status(400).json({ error: 'UPI ID is required for withdrawal' });

    const worker = db.findWorkerById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    if ((worker.walletBalance || 0) < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    await new Promise(r => setTimeout(r, 600));

    const ref = 'WDR' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();

    const tx = db.debitWallet(req.user.id, Number(amount), `Withdrawn to ${upiId}`, {
      method: 'upi_withdrawal', ref, upiId,
    });

    if (tx?.error) return res.status(400).json({ error: tx.error });

    // Read AFTER the debit
    res.json({
      success: true,
      message: `₹${amount} sent to ${upiId}`,
      ref,
      balance: worker.walletBalance,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;