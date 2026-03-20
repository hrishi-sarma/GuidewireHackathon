const router = require('express').Router();
const db     = require('../models/db');
const { auth } = require('../middleware/auth');
const { runCheck } = require('../services/triggers');

// GET /api/triggers/recent
router.get('/recent', auth, (req, res) => {
  res.json({ triggers: db.getRecentTriggers() });
});

// POST /api/triggers/simulate  (workers + admins — demo)
router.post('/simulate', auth, async (req, res) => {
  try {
    const { type = 'rain' } = req.body;
    const valid = ['rain','aqi','heat','curfew','flood'];
    if (!valid.includes(type))
      return res.status(400).json({ error: `type must be one of: ${valid.join(', ')}` });

    global.SIMULATE_DISRUPTION = true;
    global.SIMULATE_TYPE       = type;
    const triggers = await runCheck();
    global.SIMULATE_DISRUPTION = false;
    global.SIMULATE_TYPE       = null;

    res.json({ message: `${type} disruption simulated`, triggers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
