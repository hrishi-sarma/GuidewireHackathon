const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../models/db');
const { auth, SECRET } = require('../middleware/auth');

const sign = (id, role) => jwt.sign({ id, role }, SECRET, { expiresIn: '7d' });
const safe = w => { const { password: _, ...s } = w; return s; };

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, platform, zoneId, avgHoursPerWeek } = req.body;
    if (!name || !phone || !password || !platform || !zoneId)
      return res.status(400).json({ error: 'name, phone, password, platform, zoneId are required' });
    if (db.findWorkerByPhone(phone))
      return res.status(409).json({ error: 'Phone number already registered' });
    if (!db.getZone(zoneId))
      return res.status(400).json({ error: 'Invalid zone' });

    const worker = db.createWorker({
      name, phone, email: email || '',
      password: await bcrypt.hash(password, 10),
      platform, zoneId,
      baseHourlyEarning: platform === 'swiggy' ? 82 : 78,
      avgHoursPerWeek:   Number(avgHoursPerWeek) || 45,
    });

    res.status(201).json({ worker: safe(worker), token: sign(worker.id, 'worker') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const worker = db.findWorkerByPhone(phone);
    if (!worker || !(await bcrypt.compare(password, worker.password)))
      return res.status(401).json({ error: 'Invalid phone or password' });
    res.json({ worker: safe(worker), token: sign(worker.id, 'worker') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/admin/login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = db.findAdminByEmail(email);
    if (!admin || !(await bcrypt.compare(password, admin.password)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const { password: _, ...s } = admin;
    res.json({ admin: s, token: sign(admin.id, 'admin') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  const w = db.findWorkerById(req.user.id);
  if (!w) return res.status(404).json({ error: 'Not found' });
  res.json({ worker: safe(w), zone: db.getZone(w.zoneId) });
});

module.exports = router;
