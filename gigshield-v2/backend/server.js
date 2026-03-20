require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/policies',  require('./routes/policies'));
app.use('/api/claims',    require('./routes/claims'));
app.use('/api/triggers',  require('./routes/triggers'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/workers',   require('./routes/workers'));
app.use('/api/wallet',    require('./routes/wallet'));   // ← NEW

// Health & status
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.get('/api/status', async (_, res) => {
  const { isMlUp }  = require('./services/ml');
  const { LIVE }    = require('./services/weather');
  const mlUp        = await isMlUp();
  res.json({
    api: 'ok',
    openweathermap: LIVE ? 'live' : 'mock (no key)',
    ml_service:     mlUp ? 'connected' : 'offline (local formulas)',
    ts: new Date().toISOString(),
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n🛡️  GigShield API   →  http://localhost:${PORT}`);
  console.log(`   Status          →  http://localhost:${PORT}/api/status`);
  console.log(`   Demo login      →  9876543210 / password123\n`);
  require('./services/triggers').start();
});

module.exports = app;