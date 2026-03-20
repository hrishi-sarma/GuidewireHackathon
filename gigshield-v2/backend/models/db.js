const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../data/db.json');

// ---------------------------------------------------------------------------
// STATIC REFERENCE DATA (Constants)
// ---------------------------------------------------------------------------

const ZONES = [
  { id: 'z1', name: 'Andheri West',  city: 'Mumbai', riskScore: 0.82, floodProne: true, lat: 19.1136, lon: 72.8697 },
  { id: 'z2', name: 'Kurla',          city: 'Mumbai', riskScore: 0.91, floodProne: true, lat: 19.0728, lon: 72.8826 },
  { id: 'z3', name: 'Bandra',         city: 'Mumbai', riskScore: 0.65, floodProne: false, lat: 19.0544, lon: 72.8405 },
  { id: 'z4', name: 'Powai',          city: 'Mumbai', riskScore: 0.72, floodProne: false, lat: 19.1176, lon: 72.9060 },
  { id: 'z5', name: 'Dwarka',         city: 'Delhi', riskScore: 0.70, floodProne: false, lat: 28.5921, lon: 77.0460 },
  { id: 'z6', name: 'Lajpat Nagar',   city: 'Delhi', riskScore: 0.68, floodProne: false, lat: 28.5708, lon: 77.2435 },
  { id: 'z7', name: 'Rohini',         city: 'Delhi', riskScore: 0.75, floodProne: false, lat: 28.7041, lon: 77.1025 },
  { id: 'z8', name: 'Cyber City',     city: 'Gurgaon', riskScore: 0.60, floodProne: true, lat: 28.4950, lon: 77.0878 },
  { id: 'z9', name: 'Sector 62',      city: 'Noida', riskScore: 0.62, floodProne: false, lat: 28.6258, lon: 77.3685 },
  { id: 'z10', name: 'Koramangala',   city: 'Bengaluru', riskScore: 0.55, floodProne: false, lat: 12.9352, lon: 77.6245 },
  { id: 'z11', name: 'Whitefield',    city: 'Bengaluru', riskScore: 0.50, floodProne: false, lat: 12.9698, lon: 77.7499 },
  { id: 'z12', name: 'Indiranagar',   city: 'Bengaluru', riskScore: 0.52, floodProne: false, lat: 12.9716, lon: 77.6412 },
  { id: 'z13', name: 'Electronic City', city: 'Bengaluru', riskScore: 0.48, floodProne: false, lat: 12.8452, lon: 77.6632 },
  { id: 'z14', name: 'T Nagar',       city: 'Chennai', riskScore: 0.74, floodProne: true, lat: 13.0418, lon: 80.2341 },
  { id: 'z15', name: 'Velachery',     city: 'Chennai', riskScore: 0.80, floodProne: true, lat: 12.9816, lon: 80.2180 },
  { id: 'z16', name: 'Adyar',         city: 'Chennai', riskScore: 0.68, floodProne: false, lat: 13.0012, lon: 80.2565 },
  { id: 'z17', name: 'Hitech City',   city: 'Hyderabad', riskScore: 0.58, floodProne: false, lat: 17.4483, lon: 78.3915 },
  { id: 'z18', name: 'Gachibowli',    city: 'Hyderabad', riskScore: 0.54, floodProne: false, lat: 17.4401, lon: 78.3489 },
  { id: 'z19', name: 'Banjara Hills', city: 'Hyderabad', riskScore: 0.60, floodProne: false, lat: 17.4156, lon: 78.4347 },
  { id: 'z20', name: 'Hinjewadi',     city: 'Pune', riskScore: 0.52, floodProne: false, lat: 18.5913, lon: 73.7389 },
  { id: 'z21', name: 'Viman Nagar',   city: 'Pune', riskScore: 0.50, floodProne: false, lat: 18.5679, lon: 73.9143 },
  { id: 'z22', name: 'Kothrud',       city: 'Pune', riskScore: 0.48, floodProne: false, lat: 18.5074, lon: 73.8077 },
  { id: 'z23', name: 'Salt Lake',     city: 'Kolkata', riskScore: 0.85, floodProne: true, lat: 22.5868, lon: 88.4178 },
  { id: 'z24', name: 'New Town',      city: 'Kolkata', riskScore: 0.82, floodProne: true, lat: 22.5769, lon: 88.4727 },
  { id: 'z25', name: 'Park Street',   city: 'Kolkata', riskScore: 0.78, floodProne: false, lat: 22.5529, lon: 88.3518 },
  { id: 'z26', name: 'Satellite',     city: 'Ahmedabad', riskScore: 0.58, floodProne: false, lat: 23.0305, lon: 72.5075 },
  { id: 'z27', name: 'Navrangpura',   city: 'Ahmedabad', riskScore: 0.55, floodProne: false, lat: 23.0350, lon: 72.5600 },
  { id: 'z28', name: 'Gomti Nagar',   city: 'Lucknow', riskScore: 0.62, floodProne: true, lat: 26.8467, lon: 80.9462 },
  { id: 'z29', name: 'Indira Nagar',  city: 'Lucknow', riskScore: 0.60, floodProne: false, lat: 26.8797, lon: 80.9847 },
  { id: 'z30', name: 'Malviya Nagar', city: 'Jaipur', riskScore: 0.50, floodProne: false, lat: 26.8531, lon: 75.8050 },
];

const PLANS = [
  {
    id: 'basic', name: 'Basic Shield',
    baseWeeklyPremium: 29, maxWeeklyPayout: 600,
    triggers: ['rain', 'aqi'],
    popular: false,
  },
  {
    id: 'pro', name: 'Pro Shield',
    baseWeeklyPremium: 49, maxWeeklyPayout: 1200,
    triggers: ['rain', 'aqi', 'heat', 'curfew'],
    popular: true,
  },
  {
    id: 'max', name: 'Max Shield',
    baseWeeklyPremium: 79, maxWeeklyPayout: 2000,
    triggers: ['rain', 'aqi', 'heat', 'curfew', 'flood'],
    popular: false,
  },
  {
    id: 'ultimate', name: 'Ultimate Shield',
    baseWeeklyPremium: 99, maxWeeklyPayout: 3000,
    triggers: ['rain', 'aqi', 'heat', 'curfew', 'flood'],
    popular: false,
  },
];

// ---------------------------------------------------------------------------
// DATA STORE
// ---------------------------------------------------------------------------

let workers = [];
let admins = [];
let policies = [];
let claims = [];
let triggerEvents = [];
let walletTransactions = []; // NEW

function save() {
  try {
    const data = { workers, admins, policies, claims, triggerEvents, walletTransactions };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ DB Save failed:', err.message);
  }
}

function load() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      workers = data.workers || [];
      admins = data.admins || [];
      policies = data.policies || [];
      claims = data.claims || [];
      triggerEvents = data.triggerEvents || [];
      walletTransactions = data.walletTransactions || [];

      // Migrate / repair walletBalance for all workers.
      // walletBalance = (sum of paid claim payouts) + (sum of manual top-up credits) - (sum of withdrawals)
      // We recompute this correctly so it matches totalProtected for fresh users
      // and still preserves any manual top-ups that were added.
      let migrated = false;
      workers.forEach(w => {
        const paidClaims = claims.filter(c => c.workerId === w.id && c.status === 'paid');
        const totalPaid  = paidClaims.reduce((s, c) => s + (c.payoutAmount || 0), 0);

        const workerTxns = walletTransactions.filter(t => t.workerId === w.id);
        const topUps     = workerTxns
          .filter(t => t.type === 'credit' && t.method !== 'claim_payout')
          .reduce((s, t) => s + t.amount, 0);
        const withdrawn  = workerTxns
          .filter(t => t.type === 'debit' && t.method === 'upi_withdrawal')
          .reduce((s, t) => s + t.amount, 0);

        const correctBalance = Math.max(0, totalPaid + topUps - withdrawn);

        if (w.walletBalance === undefined || w.walletBalance !== correctBalance) {
          w.walletBalance = correctBalance;
          migrated = true;
        }
      });
      if (migrated) {
        console.log('🔄 Repaired walletBalance for workers from transaction history');
        save();
      }

      console.log('✅ DB Loaded from file');
      return;
    } catch (err) {
      console.error('❌ DB Load failed, re-seeding:', err.message);
    }
  }

  // SEED DATA if no file
  const pw = bcrypt.hashSync('password123', 10);
  workers = [
    {
      id: 'w1', name: 'Ravi Kumar',   phone: '9876543210', email: 'ravi@example.com',
      password: pw, platform: 'swiggy', zoneId: 'z2',
      baseHourlyEarning: 80, avgHoursPerWeek: 50, kycVerified: true,
      walletBalance: 500, // starter balance for demo
      createdAt: new Date('2024-01-15').toISOString(), role: 'worker',
    },
    {
      id: 'w2', name: 'Priya Sharma', phone: '9876543211', email: 'priya@example.com',
      password: pw, platform: 'zomato', zoneId: 'z4',
      baseHourlyEarning: 75, avgHoursPerWeek: 45, kycVerified: true,
      walletBalance: 200,
      createdAt: new Date('2024-02-10').toISOString(), role: 'worker',
    },
  ];
  admins = [
    {
      id: 'a1', name: 'Admin', email: 'admin@gigshield.in',
      password: bcrypt.hashSync('admin123', 10), role: 'admin',
    },
  ];
  console.log('🌱 DB Seeded with initial data');
  save();
}

load();

// ---------------------------------------------------------------------------
// WALLET HELPERS
// ---------------------------------------------------------------------------

const db = {
  // ref data
  zones:  ZONES,
  plans:  PLANS,
  getWorkers: () => workers,
  getPolicies: () => policies,
  getClaims: () => claims,

  getZones:  () => ZONES,
  getZone:   id => ZONES.find(z => z.id === id),
  getPlans:  () => PLANS,
  getPlan:   id => PLANS.find(p => p.id === id),

  // workers
  findWorkerById:    id    => workers.find(w => w.id === id),
  findWorkerByPhone: phone => workers.find(w => w.phone === phone),
  findWorkerByEmail: email => workers.find(w => w.email === email),
  createWorker: data => {
    const w = {
      id: uuid(), ...data, role: 'worker', kycVerified: true,
      walletBalance: 0, // new workers start with ₹0
      createdAt: new Date().toISOString(),
    };
    workers.push(w); save(); return w;
  },

  // wallet
  getWalletBalance: (workerId) => {
    const w = workers.find(w => w.id === workerId);
    return w ? (w.walletBalance || 0) : 0;
  },

  creditWallet: (workerId, amount, description, meta = {}) => {
    const w = workers.find(w => w.id === workerId);
    if (!w) return null;
    w.walletBalance = (w.walletBalance || 0) + amount;
    const tx = {
      id: uuid(),
      workerId,
      type: 'credit',
      amount,
      description,
      balanceAfter: w.walletBalance,
      createdAt: new Date().toISOString(),
      ...meta,
    };
    walletTransactions.unshift(tx);
    save();
    return tx;
  },

  debitWallet: (workerId, amount, description, meta = {}) => {
    const w = workers.find(w => w.id === workerId);
    if (!w) return null;
    if ((w.walletBalance || 0) < amount) return { error: 'Insufficient balance' };
    w.walletBalance = (w.walletBalance || 0) - amount;
    const tx = {
      id: uuid(),
      workerId,
      type: 'debit',
      amount,
      description,
      balanceAfter: w.walletBalance,
      createdAt: new Date().toISOString(),
      ...meta,
    };
    walletTransactions.unshift(tx);
    save();
    return tx;
  },

  getWalletTransactions: (workerId, limit = 50) => {
    return walletTransactions
      .filter(t => t.workerId === workerId)
      .slice(0, limit);
  },

  // admins
  findAdminByEmail: email => admins.find(a => a.email === email),

  // policies
  getPoliciesByWorker: wid => policies.filter(p => p.workerId === wid),
  getActivePolicy:     wid => policies.find(p => p.workerId === wid && p.status === 'active'),
  getPolicyById:       id  => policies.find(p => p.id === id),
  createPolicy: data => {
    const p = { id: uuid(), ...data, createdAt: new Date().toISOString() };
    policies.push(p); save(); return p;
  },
  updatePolicy: (id, updates) => {
    const i = policies.findIndex(p => p.id === id);
    if (i !== -1) {
      Object.assign(policies[i], updates);
      save();
    }
    return policies[i] || null;
  },
  cancelPolicy: (wid) => {
    const i = policies.findIndex(p => p.workerId === wid && p.status === 'active');
    if (i !== -1) {
      policies[i].status = 'cancelled';
      policies[i].endDate = new Date().toISOString();
      save();
      return true;
    }
    return false;
  },

  // claims
  getClaimsByWorker: wid => claims.filter(c => c.workerId === wid),
  getAllClaims:       ()  => claims,
  createClaim: data => {
    const c = { id: uuid(), ...data, createdAt: new Date().toISOString() };
    claims.push(c); save(); return c;
  },
  updateClaim: (id, updates) => {
    const i = claims.findIndex(c => c.id === id);
    if (i !== -1) {
      Object.assign(claims[i], updates);
      save();
    }
    return claims[i] || null;
  },

  // trigger events
  addTriggerEvent: data => {
    const e = { id: uuid(), ...data, detectedAt: new Date().toISOString() };
    triggerEvents.unshift(e);
    if (triggerEvents.length > 100) triggerEvents.pop();
    save();
    return e;
  },
  getRecentTriggers: (n = 20) => triggerEvents.slice(0, n),

  // Stochastic Alert Engine
  getZoneAlerts: (zone) => {
    if (!zone) return [];
    const now = Date.now();
    const h = new Date().getHours();
    const alerts = [];

    if (zone.riskScore > 0.7) {
      alerts.push({
        id: `w-${zone.id}-${Math.floor(now/600000)}`,
        type: 'weather',
        msg: `High volatility detected: Scattered showers likely in ${zone.name}.`,
        time: '5m ago'
      });
    }

    if ((h >= 8 && h <= 11) || (h >= 18 && h <= 21)) {
      alerts.push({
        id: `t-${zone.id}-${Math.floor(now/900000)}`,
        type: 'traffic',
        msg: `Peak hour congestion: Heavy traffic reported near ${zone.name} hubs.`,
        time: '18m ago'
      });
    } else {
      alerts.push({
        id: `t-low-${zone.id}`,
        type: 'traffic',
        msg: `Smooth transit reported in ${zone.city} central corridors.`,
        time: 'Just now'
      });
    }

    return alerts;
  },

  save,
};

module.exports = db;