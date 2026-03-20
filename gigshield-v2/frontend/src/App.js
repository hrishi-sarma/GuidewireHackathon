import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { authAPI, policyAPI, claimsAPI, dashAPI, triggerAPI, workerAPI, walletAPI } from './utils/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Chart, ArcElement, DoughnutController, BarController, LineController, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Tooltip as ChartTooltip, Legend } from 'chart.js';
import './App.css';

Chart.register(ArcElement, DoughnutController, BarController, LineController, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, ChartTooltip, Legend);

// ─── Icons ───────────────────────────────────────────────────────────────────
function Icon({ name, size = 20 }) {
  const d = {
    shield:  <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z"/>,
    home:    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>,
    file:    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2zm0 0v6h6"/>,
    user:    <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    rupee:   <path d="M6 3h12M6 8h12M15 21L6 8h3a4 4 0 000-8"/>,
    check:   <polyline points="20 6 9 17 4 12"/>,
    x:       <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    alert:   <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    zap:     <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    logout:  <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    chart:   <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    grid:    <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></>,
    wallet:  <><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    plus:    <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    arrow:   <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    download:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    credit:  <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    send:    <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    lock:    <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
    phone:   <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {d[name]}
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt      = n  => `₹${(n || 0).toLocaleString('en-IN')}`;
const fmtDate  = d  => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
const fmtTime  = d  => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
const statusColor = s => ({ paid: '#22c55e', processing: '#3b82f6', fraud_review: '#ef4444', rejected: '#6b7280' }[s] ?? '#6b7280');
const trigIcon    = t => ({ rain: '🌧️', aqi: '😷', heat: '🌡️', curfew: '🚫', flood: '🌊' }[t] ?? '⚡');
const nav         = page => window.dispatchEvent(new CustomEvent('gs:nav', { detail: page }));

const ZONES_FB = [
  { id: 'z1', name: 'Andheri West',  city: 'Mumbai' },
  { id: 'z2', name: 'Kurla',          city: 'Mumbai' },
  { id: 'z3', name: 'Bandra',         city: 'Mumbai' },
  { id: 'z4', name: 'Powai',          city: 'Mumbai' },
  { id: 'z5', name: 'Dwarka',         city: 'Delhi'  },
  { id: 'z6', name: 'Lajpat Nagar',   city: 'Delhi'  },
  { id: 'z7', name: 'Rohini',         city: 'Delhi'  },
  { id: 'z8', name: 'Cyber City',     city: 'Gurgaon' },
  { id: 'z10', name: 'Koramangala',   city: 'Bengaluru' },
  { id: 'z14', name: 'T Nagar',       city: 'Chennai' },
  { id: 'z17', name: 'Hitech City',   city: 'Hyderabad' },
  { id: 'z20', name: 'Hinjewadi',     city: 'Pune' },
  { id: 'z23', name: 'Salt Lake',     city: 'Kolkata' },
];

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toast = null;
const toast = (msg, type = 'success') => _toast?.({ msg, type });

function Toast() {
  const [t, setT] = useState(null);
  _toast = setT;
  useEffect(() => { if (t) { const id = setTimeout(() => setT(null), 3500); return () => clearTimeout(id); } }, [t]);
  if (!t) return null;
  return (
    <div className={`toast ${t.type}`}>
      <Icon name={t.type === 'success' ? 'check' : 'alert'} size={15} />
      {t.msg}
    </div>
  );
}

const Spinner     = () => <div className="spinner-wrap"><div className="spinner" /></div>;
const SpinInline  = () => <span className="spinner-inline" />;

const getDist = (lat1, lon1, lat2, lon2) => Math.sqrt((lat1-lat2)**2 + (lon1-lon2)**2);

function findNearestZone(lat, lon, zones) {
  if (!zones?.length) return null;
  return [...zones].sort((a,b) => getDist(lat,lon,a.lat,a.lon) - getDist(lat,lon,b.lat,b.lon))[0];
}

// ─── Data Components ─────────────────────────────────────────────────────────
function WeatherRadar({ weather, zone }) {
  if (!weather) return null;
  const time = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  return (
    <div className="weather-radar">
      <div className="radar-header">
        <div className="radar-title"><Icon name="zap" size={14}/> Radar: {zone?.name || 'Local Zone'}</div>
        <div className="radar-live-indicator"><span className="pulse-dot"/> {time}</div>
      </div>
      <div className="radar-grid">
        <div className="radar-item"><div className="radar-val">{weather.temp_celsius}°C</div><div className="radar-label">Temperature</div></div>
        <div className="radar-item"><div className="radar-val">{weather.aqi}</div><div className="radar-label">AQI Index</div></div>
        <div className="radar-item"><div className="radar-val">{weather.rainfall_mm_hr}</div><div className="radar-label">Precip (mm)</div></div>
      </div>
    </div>
  );
}

function LiveAlerts({ alerts }) {
  if (!alerts?.length) return null;
  return (
    <div className="alerts-feed">
      <div className="feed-title"><Icon name="alert" size={13}/> Live Zone Alerts</div>
      {alerts.map(a => (
        <div key={a.id} className="alert-item">
          <span className={`alert-bullet ${a.type}`}/>
          <div className="alert-content"><p>{a.msg}</p><span>{a.time}</span></div>
        </div>
      ))}
    </div>
  );
}

function PriceInsight({ plan, pricing }) {
  if (!pricing) return null;
  const isAdjusted = pricing.multiplier !== 1;
  return (
    <div className="price-insight-card">
      <div className="insight-header">AI Risk Computation</div>
      <div className="insight-row"><span className="insight-key">Base Weekly Rate</span><span className="insight-val">₹{plan.baseWeeklyPremium}</span></div>
      {isAdjusted && (<>
        <div className="insight-row"><span className="insight-key">Dynamic Multiplier</span><span className="insight-val">x{pricing.multiplier}</span></div>
        <div className="insight-row"><span className="insight-key">Detected Risk Level</span><span className={`insight-val risk-${pricing.riskLabel?.toLowerCase().split(' ')[0]}`}>{pricing.riskLabel}</span></div>
      </>)}
      <div className="insight-footer">Adjusted for seasonal volatility and zone history 📉</div>
    </div>
  );
}

function SystemInfo() {
  return (
    <div className="info-section">
      <div className="info-title"><Icon name="shield" size={16}/> Why Parametric?</div>
      <div className="info-text">
        Traditional insurance takes weeks. GigShield is <strong>Parametric</strong>.
        It means we don't need you to prove your loss. If our satellite and weather APIs
        detect a disruption in your zone, we pay you <strong>automatically</strong>.
        No forms, no wait.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAYMENT GATEWAY MODAL
// ═══════════════════════════════════════════════════════════════════
function PaymentGateway({ isOpen, onClose, onSuccess, amount, purpose }) {
  const [method,    setMethod]    = useState('card');
  const [step,      setStep]      = useState('form'); // form | processing | success
  const [cardNum,   setCardNum]   = useState('');
  const [expiry,    setExpiry]    = useState('');
  const [cvv,       setCvv]       = useState('');
  const [cardName,  setCardName]  = useState('');
  const [upiId,     setUpiId]     = useState('');
  const [bank,      setBank]      = useState('sbi');
  const [error,     setError]     = useState('');

  useEffect(() => {
    if (!isOpen) { setStep('form'); setError(''); }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatCard = v => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  const formatExp  = v => {
    const d = v.replace(/\D/g,'').slice(0,4);
    return d.length > 2 ? d.slice(0,2) + '/' + d.slice(2) : d;
  };

  const validate = () => {
    if (method === 'card') {
      if (cardNum.replace(/\s/g,'').length < 16) return 'Enter a valid 16-digit card number';
      if (expiry.length < 5) return 'Enter a valid expiry (MM/YY)';
      if (cvv.length < 3) return 'Enter a valid CVV';
      if (!cardName.trim()) return 'Enter the name on card';
    }
    if (method === 'upi') {
      if (!upiId.includes('@')) return 'Enter a valid UPI ID (e.g. name@upi)';
    }
    return '';
  };

  const handlePay = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setStep('processing');
    // Simulate gateway processing
    setTimeout(() => {
      setStep('success');
      setTimeout(() => {
        onSuccess({
          method,
          cardLast4: method === 'card' ? cardNum.replace(/\s/g,'').slice(-4) : undefined,
          upiId:     method === 'upi'  ? upiId : undefined,
        });
      }, 1200);
    }, 2200);
  };

  const BANKS = [
    { id: 'sbi', name: 'State Bank of India' },
    { id: 'hdfc', name: 'HDFC Bank' },
    { id: 'icici', name: 'ICICI Bank' },
    { id: 'axis', name: 'Axis Bank' },
    { id: 'kotak', name: 'Kotak Mahindra' },
  ];

  return (
    <div className="gw-overlay" onClick={onClose}>
      <div className="gw-sheet" onClick={e => e.stopPropagation()}>

        {step === 'processing' && (
          <div className="gw-processing">
            <div className="gw-processing-ring"/>
            <div className="gw-processing-label">Processing payment…</div>
            <div className="gw-processing-sub">Connecting to secure gateway</div>
          </div>
        )}

        {step === 'success' && (
          <div className="gw-success">
            <div className="gw-success-icon"><Icon name="check" size={32}/></div>
            <div className="gw-success-title">Payment Successful!</div>
            <div className="gw-success-amt">{fmt(amount)}</div>
            <div className="gw-success-sub">{purpose}</div>
          </div>
        )}

        {step === 'form' && <>
          <div className="gw-header">
            <div className="gw-header-left">
              <div className="gw-logo"><Icon name="lock" size={14}/> Secure Pay</div>
              <div className="gw-amount">{fmt(amount)}</div>
              <div className="gw-purpose">{purpose}</div>
            </div>
            <button className="gw-close" onClick={onClose}><Icon name="x" size={18}/></button>
          </div>

          <div className="gw-methods">
            {[['card','💳 Card'],['upi','⚡ UPI'],['netbanking','🏦 Net Banking']].map(([id,label]) => (
              <button key={id} className={`gw-method-btn ${method===id?'active':''}`} onClick={() => setMethod(id)}>{label}</button>
            ))}
          </div>

          {method === 'card' && (
            <div className="gw-form">
              <div className="gw-card-preview">
                <div className="gw-card-chip"/>
                <div className="gw-card-number">{cardNum || '•••• •••• •••• ••••'}</div>
                <div className="gw-card-row">
                  <div><div className="gw-card-micro">CARD HOLDER</div><div className="gw-card-name">{cardName || 'YOUR NAME'}</div></div>
                  <div><div className="gw-card-micro">EXPIRES</div><div className="gw-card-exp">{expiry || 'MM/YY'}</div></div>
                </div>
              </div>
              <div className="gw-field"><label>Card Number</label><input placeholder="1234 5678 9012 3456" value={cardNum} onChange={e => setCardNum(formatCard(e.target.value))} maxLength={19}/></div>
              <div className="gw-field-row">
                <div className="gw-field"><label>Expiry</label><input placeholder="MM/YY" value={expiry} onChange={e => setExpiry(formatExp(e.target.value))} maxLength={5}/></div>
                <div className="gw-field"><label>CVV</label><input type="password" placeholder="•••" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g,'').slice(0,4))} maxLength={4}/></div>
              </div>
              <div className="gw-field"><label>Name on Card</label><input placeholder="Ravi Kumar" value={cardName} onChange={e => setCardName(e.target.value)}/></div>
            </div>
          )}

          {method === 'upi' && (
            <div className="gw-form">
              <div className="gw-upi-apps">
                {[['gpay','G Pay'],['phonepe','PhonePe'],['paytm','Paytm'],['bhim','BHIM']].map(([id,label]) => (
                  <button key={id} className="gw-upi-app" onClick={() => setUpiId(prev => prev || 'user@' + id)}>{label}</button>
                ))}
              </div>
              <div className="gw-upi-divider">or enter UPI ID</div>
              <div className="gw-field">
                <label>UPI ID</label>
                <input placeholder="yourname@upi" value={upiId} onChange={e => setUpiId(e.target.value)}/>
              </div>
            </div>
          )}

          {method === 'netbanking' && (
            <div className="gw-form">
              <div className="gw-bank-list">
                {BANKS.map(b => (
                  <button key={b.id} className={`gw-bank-btn ${bank===b.id?'active':''}`} onClick={() => setBank(b.id)}>{b.name}</button>
                ))}
              </div>
            </div>
          )}

          {error && <div className="gw-error"><Icon name="alert" size={13}/> {error}</div>}

          <div className="gw-footer">
            <button className="gw-pay-btn" onClick={handlePay}>
              <Icon name="lock" size={15}/> Pay {fmt(amount)} Securely
            </button>
            <div className="gw-secure-note"><Icon name="shield" size={11}/> 256-bit SSL encrypted · PCI DSS compliant</div>
          </div>
        </>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WALLET PAGE
// ═══════════════════════════════════════════════════════════════════
function Wallet() {
  const [balance,  setBalance]  = useState(0);
  const [txns,     setTxns]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState('main'); // main | add | withdraw
  const [addAmt,   setAddAmt]   = useState('');
  const [wdrAmt,   setWdrAmt]   = useState('');
  const [wdrUpi,   setWdrUpi]   = useState('');
  const [gwOpen,   setGwOpen]   = useState(false);
  const [gwConfig, setGwConfig] = useState({});
  const [wdrBusy,  setWdrBusy]  = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      const r = await walletAPI.balance();
      setBalance(r.data.balance);
      setTxns(r.data.transactions);
    } catch { if (!silent) toast('Could not load wallet', 'error'); }
    setLoading(false);
  }, []);

  // Poll every 3s so balance updates instantly when a claim payout arrives
  useEffect(() => {
    load();
    const iv = setInterval(() => load(true), 3000);
    return () => clearInterval(iv);
  }, [load]);

  const QUICK_AMOUNTS = [100, 250, 500, 1000, 2000, 5000];

  const openAddGateway = () => {
    const amt = Number(addAmt);
    if (!amt || amt < 10) { toast('Minimum ₹10 to add', 'error'); return; }
    if (amt > 50000) { toast('Maximum ₹50,000 per transaction', 'error'); return; }
    setGwConfig({ amount: amt, purpose: 'Add to GigShield Wallet' });
    setGwOpen(true);
  };

  const handleGwSuccess = async ({ method, cardLast4, upiId }) => {
    setGwOpen(false);
    try {
      const r = await walletAPI.add({ amount: Number(addAmt), method, cardLast4, upiId });
      // Update balance immediately from server response, then reload for transactions
      const newBal = r.data.balance ?? (balance + Number(addAmt));
      setBalance(newBal);
      toast(`✅ ${fmt(Number(addAmt))} added to wallet!`);
      setAddAmt('');
      setView('main');
      // Small delay so the backend has persisted before we poll again
      setTimeout(() => load(true), 300);
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to add money', 'error');
    }
  };

  const handleWithdraw = async () => {
    const amt = Number(wdrAmt);
    if (!amt || amt < 10) { toast('Minimum ₹10 to withdraw', 'error'); return; }
    if (!wdrUpi.includes('@')) { toast('Enter a valid UPI ID', 'error'); return; }
    if (amt > balance) { toast('Insufficient balance', 'error'); return; }
    setWdrBusy(true);
    try {
      const r = await walletAPI.withdraw({ amount: amt, upiId: wdrUpi });
      setBalance(r.data.balance);
      toast(`✅ ${fmt(amt)} sent to ${wdrUpi}`);
      setWdrAmt(''); setWdrUpi('');
      setView('main');
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Withdrawal failed', 'error');
    }
    setWdrBusy(false);
  };

  const txIcon = tx => {
    if (tx.type === 'credit') {
      if (tx.method === 'claim_payout') return '🛡️';
      return '⬇️';
    }
    if (tx.method === 'wallet') return '🛡️';
    return '⬆️';
  };

  const txColor = tx => tx.type === 'credit' ? '#22c55e' : '#ef4444';
  const txSign  = tx => tx.type === 'credit' ? '+' : '−';

  if (loading) return <Spinner />;

  return (
    <div className="screen">
      <PaymentGateway
        isOpen={gwOpen}
        onClose={() => setGwOpen(false)}
        onSuccess={handleGwSuccess}
        amount={gwConfig.amount}
        purpose={gwConfig.purpose}
      />

      {/* Balance Hero */}
      <div className="wallet-hero">
        <div className="wallet-hero-label">GigShield Wallet</div>
        <div className="wallet-hero-balance">{fmt(balance)}</div>
        <div className="wallet-hero-sub">Available balance</div>
        <div className="wallet-hero-actions">
          <button className="wallet-action-btn" onClick={() => setView(view === 'add' ? 'main' : 'add')}>
            <div className="wallet-action-icon"><Icon name="plus" size={18}/></div>
            <span>Add Money</span>
          </button>
          <button className="wallet-action-btn" onClick={() => setView(view === 'withdraw' ? 'main' : 'withdraw')}>
            <div className="wallet-action-icon"><Icon name="send" size={18}/></div>
            <span>Withdraw</span>
          </button>
        </div>
      </div>

      {/* Add Money Panel */}
      {view === 'add' && (
        <div className="wallet-panel">
          <div className="wallet-panel-title"><Icon name="plus" size={15}/> Add Money</div>
          <div className="wallet-quick-amounts">
            {QUICK_AMOUNTS.map(a => (
              <button key={a} className={`quick-amt-btn ${addAmt == a ? 'active' : ''}`} onClick={() => setAddAmt(String(a))}>
                ₹{a.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
          <div className="gw-field" style={{ marginBottom: 16 }}>
            <label>Or enter amount</label>
            <input
              type="number" placeholder="Enter amount"
              value={addAmt} onChange={e => setAddAmt(e.target.value)}
              min="10" max="50000"
            />
          </div>
          <button className="btn-primary" onClick={openAddGateway} disabled={!addAmt}>
            <Icon name="credit" size={15}/> Proceed to Payment
          </button>
          <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setView('main')}>Cancel</button>
        </div>
      )}

      {/* Withdraw Panel */}
      {view === 'withdraw' && (
        <div className="wallet-panel">
          <div className="wallet-panel-title"><Icon name="send" size={15}/> Withdraw to UPI</div>
          <div className="gw-field">
            <label>Amount</label>
            <input type="number" placeholder="Enter amount" value={wdrAmt} onChange={e => setWdrAmt(e.target.value)} min="10" max={balance}/>
          </div>
          <div className="gw-field">
            <label>UPI ID</label>
            <input placeholder="yourname@upi" value={wdrUpi} onChange={e => setWdrUpi(e.target.value)}/>
          </div>
          {wdrAmt && balance < Number(wdrAmt) && (
            <div className="gw-error"><Icon name="alert" size={13}/> Insufficient balance</div>
          )}
          <button className="btn-primary" onClick={handleWithdraw} disabled={wdrBusy || !wdrAmt || !wdrUpi}>
            {wdrBusy ? <SpinInline/> : <><Icon name="send" size={15}/> Withdraw {wdrAmt ? fmt(Number(wdrAmt)) : ''}</>}
          </button>
          <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setView('main')}>Cancel</button>
        </div>
      )}

      {/* Transaction History */}
      <div className="section">
        <div className="section-label">Transaction History</div>
        {txns.length === 0 ? (
          <div className="empty" style={{ paddingTop: 32 }}>
            <div className="empty-icon">💳</div>
            <div className="empty-title">No transactions yet</div>
            <div className="empty-sub">Add money to get started</div>
          </div>
        ) : (
          <div className="txn-list">
            {txns.map(tx => (
              <div key={tx.id} className="txn-row">
                <div className="txn-icon">{txIcon(tx)}</div>
                <div className="txn-info">
                  <div className="txn-desc">{tx.description}</div>
                  <div className="txn-date">{fmtDate(tx.createdAt)} · {fmtTime(tx.createdAt)}</div>
                  {tx.ref && <div className="txn-ref">{tx.ref}</div>}
                </div>
                <div className="txn-amount" style={{ color: txColor(tx) }}>
                  {txSign(tx)}{fmt(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AUTH SCREEN
// ═══════════════════════════════════════════════════════════════════
function AuthScreen({ onAdmin }) {
  const { login, register } = useAuth();
  const [tab,    setTab]    = useState('login');
  const [zones,  setZones]  = useState(ZONES_FB);
  const [busy,   setBusy]   = useState(false);
  const [form,   setForm]   = useState({ name:'', phone:'', email:'', password:'', platform:'swiggy', city:'Mumbai', zoneId:'z1', avgHoursPerWeek:45 });

  const cities = [...new Set(zones.map(z => z.city))];
  const filteredZones = zones.filter(z => z.city === form.city);

  const set = k => e => {
    const val = e.target.value;
    setForm(f => {
      const next = { ...f, [k]: val };
      if (k === 'city') {
        const firstInCity = zones.find(z => z.city === val);
        next.zoneId = firstInCity?.id || '';
      }
      return next;
    });
  };

  useEffect(() => {
    workerAPI.zones().then(r => { if (r.data.zones?.length) setZones(r.data.zones); }).catch(() => {});
  }, []);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === 'login') {
        await login(form.phone, form.password);
        toast('Welcome back! 🛡️');
      } else {
        await register(form);
        toast('Account created — your shield is active!');
      }
    } catch (err) {
      toast(err.response?.data?.error || 'Could not connect — is the backend running?', 'error');
    }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-glow" />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon"><Icon name="shield" size={26} /></div>
          <div><div className="logo-name">GigShield</div><div className="logo-tagline">Income protection for delivery partners</div></div>
        </div>
        <div className="tabs">
          <button className={`tab-btn ${tab==='login'?'active':''}`}    onClick={() => setTab('login')}>Sign in</button>
          <button className={`tab-btn ${tab==='register'?'active':''}`} onClick={() => setTab('register')}>Register</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          {tab === 'register' && <>
            <div className="field"><label>Full name</label><input placeholder="Ravi Kumar" value={form.name} onChange={set('name')} required /></div>
            <div className="field-row">
              <div className="field"><label>Platform</label><select value={form.platform} onChange={set('platform')}><option value="swiggy">Swiggy</option><option value="zomato">Zomato</option><option value="zepto">Zepto</option><option value="blinkit">Blinkit</option></select></div>
              <div className="field"><label>Weekly Hrs</label><input type="number" min="10" max="84" value={form.avgHoursPerWeek} onChange={set('avgHoursPerWeek')} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>City</label><select value={form.city} onChange={set('city')}>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="field"><label>Area</label><select value={form.zoneId} onChange={set('zoneId')}>{filteredZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
            </div>
          </>}
          <div className="field"><label>Phone number</label><input placeholder="9876543210" value={form.phone} onChange={set('phone')} required /></div>
          <div className="field"><label>Password</label><input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required /></div>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? <SpinInline /> : tab === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button className="admin-link" onClick={onAdmin}><Icon name="grid" size={13} /> Insurer dashboard →</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════════════════════════════
function Home() {
  const { user, setUser } = useAuth();
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [nearZone,  setNearZone]  = useState(null);

  const load = useCallback(async (isSilent = false) => {
    try {
      const r = await dashAPI.worker();
      setData(r.data);
      if (r.data.worker) setUser(s => ({ ...s, ...r.data.worker }));
    }
    catch { if (!isSilent) toast('Failed to load dashboard', 'error'); }
    setLoading(false);
  }, [setUser]);

  useEffect(() => {
    load();
    const iv = setInterval(() => load(true), 3000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    if (!data?.zones) return;
    const onPos = pos => {
      const nearest = findNearestZone(pos.coords.latitude, pos.coords.longitude, data.zones);
      if (nearest && nearest.id !== data.worker?.zoneId) setNearZone(nearest);
      else setNearZone(null);
    };
    const watchId = navigator.geolocation.watchPosition(onPos, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [data?.zones, data?.worker?.zoneId]);

  const switchZone = async () => {
    if (!nearZone) return;
    try {
      await workerAPI.updateProfile({ zoneId: nearZone.id });
      setNearZone(null);
      await load();
      toast(`📍 Location synced: ${nearZone.name}`);
    } catch { toast('Failed to update zone', 'error'); }
  };

  if (loading) return <Spinner />;
  if (!data)   return null;

  const { policy, stats, recentClaims, liveWeather, worker, alerts, walletBalance } = data;
  const daysLeft = policy ? Math.max(0, Math.ceil((new Date(policy.endDate) - Date.now()) / 86400000)) : 0;
  const zone = policy?.zone || worker?.zone;

  return (
    <div className="screen">
      {nearZone && (
        <div className="location-tip">
          <div className="tip-text">📍 Movement detected! You are near <strong>{nearZone.name}</strong>.<br/>Sync coverage with your current location?</div>
          <button className="tip-btn" onClick={switchZone}>Sync Now</button>
        </div>
      )}

      <WeatherRadar weather={liveWeather} zone={zone} />
      <LiveAlerts alerts={alerts} />

      {/* Hero */}
      <div className="hero">
        <div className={`hero-badge ${policy ? 'active' : 'inactive'}`}>
          {policy ? '🛡️ Protected' : '⚠️ No active policy'}
        </div>
        <div className="hero-amount">{fmt(stats.totalProtected)}</div>
        <div className="hero-label">Total income protected</div>
        {policy && (
          <div className="hero-pills">
            <span className="pill">{policy.plan?.name}</span>
            <span className="pill-dot"/>
            <span className="pill">{daysLeft}d left</span>
            <span className="pill-dot"/>
            <span className="pill">{fmt(policy.weeklyPremium)}/wk</span>
          </div>
        )}
      </div>

      {/* Wallet Balance Strip */}
      <div className="home-wallet-strip" onClick={() => nav('wallet')}>
        <div className="hws-left">
          <Icon name="wallet" size={16}/>
          <div>
            <div className="hws-label">Wallet Balance</div>
            <div className="hws-bal">{fmt(walletBalance ?? 0)}</div>
          </div>
        </div>
        <div className="hws-right">
          <span className="hws-cta">{(walletBalance ?? 0) > 0 ? 'Withdraw' : 'View'}</span>
          <Icon name="arrow" size={14}/>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color:'#3b82f6' }}><Icon name="zap" size={16}/></div>
          <div className="stat-val">{fmt(stats.weeklyProtected)}</div>
          <div className="stat-key">This week</div>
          <div className="stat-hint">{stats.protectionRate}% rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color:'#22c55e' }}><Icon name="check" size={16}/></div>
          <div className="stat-val">{stats.paidClaims}</div>
          <div className="stat-key">Paid claims</div>
          <div className="stat-hint">{stats.totalClaims} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color:'#f59e0b' }}><Icon name="rupee" size={16}/></div>
          <div className="stat-val">{fmt(stats.estimatedWeeklyEarnings)}</div>
          <div className="stat-key">Est. weekly</div>
          <div className="stat-hint">base earnings</div>
        </div>
      </div>

      {/* Recent Claims */}
      {recentClaims?.length > 0 && (
        <div className="section">
          <div className="section-label">Recent claims</div>
          {recentClaims.slice(0, 3).map(c => (
            <div key={c.id} className="mini-claim">
              <span className="mini-claim-icon">{trigIcon(c.triggerType)}</span>
              <div className="mini-claim-info">
                <div className="mini-claim-type">{c.triggerType} disruption</div>
                <div className="mini-claim-date">{fmtDate(c.triggeredAt)}</div>
              </div>
              <div className="mini-claim-right">
                <div className="mini-claim-amt">{fmt(c.payoutAmount)}</div>
                <div className="status-pill" style={{ background: statusColor(c.status)+'22', color: statusColor(c.status), fontSize: 10 }}>
                  {c.status?.replace('_',' ')}
                </div>
              </div>
            </div>
          ))}
          <button className="btn-ghost" onClick={() => nav('claims')} style={{ marginTop:10 }}>
            View all claims <Icon name="arrow" size={13}/>
          </button>
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ isOpen, onCancel, onConfirm, title, text, loading }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-icon"><Icon name="alert" size={28}/></div>
        <div className="modal-title">{title}</div>
        <div className="modal-text">{text}</div>
        <div className="modal-actions">
          <button className="btn-primary" style={{ background: '#ef4444' }} onClick={onConfirm} disabled={loading}>
            {loading ? <SpinInline /> : 'Confirm Deactivation'}
          </button>
          <button className="btn-outline" onClick={onCancel} disabled={loading}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Add Money Modal (triggered from Plans when balance is low) ───────
function InsufficientBalanceModal({ isOpen, onClose, required, balance, onAdded }) {
  const [addAmt, setAddAmt] = useState(String(Math.max(required - balance, 100)));
  const [gwOpen, setGwOpen] = useState(false);

  if (!isOpen) return null;

  const handleGwSuccess = async ({ method, cardLast4, upiId }) => {
    setGwOpen(false);
    try {
      await walletAPI.add({ amount: Number(addAmt), method, cardLast4, upiId });
      toast(`✅ ${fmt(Number(addAmt))} added to wallet!`);
      onAdded();
      onClose();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to add money', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <PaymentGateway
          isOpen={gwOpen}
          onClose={() => setGwOpen(false)}
          onSuccess={handleGwSuccess}
          amount={Number(addAmt)}
          purpose="Add to GigShield Wallet"
        />
        <div className="modal-icon" style={{ color: '#f59e0b' }}><Icon name="wallet" size={28}/></div>
        <div className="modal-title">Insufficient Balance</div>
        <div className="modal-text">
          You need <strong>{fmt(required)}</strong> to activate this plan.<br/>
          Current balance: <strong>{fmt(balance)}</strong>
        </div>
        <div className="gw-field" style={{ marginBottom: 16 }}>
          <label>Amount to add</label>
          <input type="number" value={addAmt} onChange={e => setAddAmt(e.target.value)} min={required - balance}/>
        </div>
        <div className="modal-actions">
          <button className="btn-primary" onClick={() => setGwOpen(true)} disabled={!addAmt || Number(addAmt) < 1}>
            <Icon name="plus" size={15}/> Add {addAmt ? fmt(Number(addAmt)) : 'Money'}
          </button>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan Details ─────────────────────────────────────────────────
function PlanDetails({ plan }) {
  return (
    <div className="plan-details">
      <div className="pd-title">What's covered</div>
      <div className="pd-list">
        <div className="pd-item"><Icon name="check" size={12}/> Up to {fmt(plan.maxWeeklyPayout)} weekly payout</div>
        <div className="pd-item"><Icon name="check" size={12}/> Auto-triggered — no claim forms</div>
        <div className="pd-item"><Icon name="check" size={12}/> Paid directly to your wallet</div>
        {plan.triggers.map(t => <div key={t} className="pd-item"><Icon name="check" size={12}/> {trigIcon(t)} {t} disruption covered</div>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PLANS (with wallet integration)
// ═══════════════════════════════════════════════════════════════════
function Plans() {
  const [plans,       setPlans]       = useState([]);
  const [active,      setActive]      = useState(null);
  const [buying,      setBuying]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [showInsight, setShowInsight] = useState({});
  const [expandedId,  setExpandedId]  = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling,  setCancelling]  = useState(false);
  const [walletBal,   setWalletBal]   = useState(0);
  const [insufModal,  setInsufModal]  = useState(null); // { required, balance }

  const toggleInsight = (e, id) => { e.stopPropagation(); setShowInsight(s => ({ ...s, [id]: !s[id] })); };

  const load = useCallback(async () => {
    try {
      const [p1, p2, p3] = await Promise.all([policyAPI.plans(), policyAPI.active(), walletAPI.balance()]);
      setPlans(p1.data.plans);
      setActive(p2.data.policy);
      setWalletBal(p3.data.balance || 0);
    } catch { toast('Failed to load plans', 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const buy = async (e, planId, premium) => {
    e.stopPropagation();
    // Check balance first
    if (walletBal < premium) {
      setInsufModal({ required: premium, balance: walletBal });
      return;
    }
    setBuying(planId);
    try {
      const r = await policyAPI.buy(planId);
      setActive(r.data.policy);
      setWalletBal(r.data.walletBalance ?? walletBal - premium);
      toast(`✅ ${r.data.message}`);
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 402) {
        setInsufModal({ required: errData.required, balance: errData.balance });
      } else {
        toast(errData?.error || 'Purchase failed', 'error');
      }
    }
    setBuying(null);
  };

  const deactivate = async () => {
    setCancelling(true);
    try {
      await policyAPI.cancel();
      setActive(null);
      setShowConfirm(false);
      toast('Policy deactivated successfully');
    } catch { toast('Failed to cancel policy', 'error'); }
    setCancelling(false);
  };

  if (loading) return <Spinner />;

  return (
    <div className="screen">
      <ConfirmModal
        isOpen={showConfirm} onCancel={() => setShowConfirm(false)}
        onConfirm={deactivate} loading={cancelling}
        title="Stop coverage?" text="Are you sure you want to end your parametric shield? You will no longer be covered for income disruptions in your zone."
      />
      <InsufficientBalanceModal
        isOpen={!!insufModal}
        onClose={() => setInsufModal(null)}
        required={insufModal?.required || 0}
        balance={insufModal?.balance || walletBal}
        onAdded={load}
      />

      {/* Wallet balance banner */}
      <div className="plans-wallet-bar">
        <div className="pwb-left"><Icon name="wallet" size={14}/> Wallet balance</div>
        <div className="pwb-right">
          <strong>{fmt(walletBal)}</strong>
          <button className="pwb-add" onClick={() => nav('wallet')}><Icon name="plus" size={12}/> Add</button>
        </div>
      </div>

      <SystemInfo />
      <div className="page-title" style={{ marginBottom: 4 }}>Weekly plans</div>
      <div className="page-sub" style={{ marginBottom: 24 }}>Pricing personalised to your zone and history</div>

      <div className="plans-grid">
        {plans.map(plan => {
          const isCurrent = active?.planId === plan.id;
          const price     = plan.pricing;
          const premium   = price?.dynamicWeeklyPremium || plan.baseWeeklyPremium;
          const canAfford = walletBal >= premium;
          const hasInsight = showInsight[plan.id];
          const isExpanded = expandedId === plan.id;

          return (
            <div
              key={plan.id}
              className={`plan-card ${plan.popular?'featured':''} ${isCurrent?'current':''}`}
              onClick={() => setExpandedId(isExpanded ? null : plan.id)}
            >
              {plan.popular  && <div className="plan-badge">Most popular</div>}
              {isCurrent     && <div className="plan-active-badge">✓ Active</div>}

              <div className="plan-head">
                <div>
                  <div className="plan-name">{plan.name}</div>
                  <div className="plan-coverage">Up to {fmt(plan.maxWeeklyPayout)}/week</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div className="plan-price">{fmt(premium)}</div>
                  <div className="plan-price-note">/week</div>
                </div>
              </div>

              <div className="plan-triggers">
                {plan.triggers.map(t => <span key={t} className="trigger-chip">{trigIcon(t)} {t}</span>)}
              </div>

              {isExpanded && <PlanDetails plan={plan} />}

              <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
                <button className="price-insight-toggle" onClick={(e) => toggleInsight(e, plan.id)}>
                  <Icon name="chart" size={12}/> {hasInsight ? 'Hide dynamic pricing' : 'Why this price?'}
                </button>
                {hasInsight && <PriceInsight plan={plan} pricing={price} />}

                {isCurrent ? (
                  <button className="btn-outline-danger" onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}>
                    Deselect plan / End coverage
                  </button>
                ) : (
                  <button
                    className={`btn-primary ${!canAfford ? 'btn-warn' : ''}`}
                    style={{ marginTop: 8 }}
                    disabled={buying === plan.id}
                    onClick={(e) => buy(e, plan.id, premium)}
                  >
                    {buying === plan.id ? <SpinInline /> : canAfford
                      ? 'Activate this week →'
                      : <><Icon name="wallet" size={14}/> Add {fmt(premium - walletBal)} & Activate</>
                    }
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="plan-note">
        <Icon name="shield" size={13}/>
        Parametric — payouts trigger automatically, credited to your wallet
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CLAIMS
// ═══════════════════════════════════════════════════════════════════
function Claims() {
  const [claims,    setClaims]    = useState([]);
  const [hasPolicy, setHasPolicy] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [simType,   setSimType]   = useState('rain');
  const [simming,   setSimming]   = useState(false);
  const [walletBal, setWalletBal] = useState(null);

  const load = useCallback(async () => {
    try {
      const [c, p, w] = await Promise.all([claimsAPI.my(), policyAPI.active(), walletAPI.balance()]);
      setClaims(c.data.claims || []);
      setHasPolicy(!!p.data.policy);
      setWalletBal(w.data.balance);
    } catch { /* stay empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [load]);

  const simulate = async () => {
    setSimming(true);
    try {
      await triggerAPI.simulate(simType);
      toast(`${trigIcon(simType)} ${simType} disruption triggered — refreshing in 3s…`);
      setTimeout(load, 3000);
    } catch (err) {
      toast(err.response?.data?.error || 'Simulation failed', 'error');
    }
    setSimming(false);
  };

  if (loading) return <Spinner />;

  const totalPaid = claims.filter(c => c.status === 'paid').reduce((s, c) => s + c.payoutAmount, 0);

  return (
    <div className="screen">
      <div className="page-title" style={{ marginBottom: 4 }}>My claims</div>
      <div className="page-sub" style={{ marginBottom: 16 }}>{fmt(totalPaid)} paid out · zero forms filed</div>

      {/* Wallet balance hint */}
      {walletBal !== null && (
        <div className="claims-wallet-hint">
          <Icon name="wallet" size={13}/>
          <span>Payouts are credited to your wallet · Current balance: <strong>{fmt(walletBal)}</strong></span>
        </div>
      )}

      {!hasPolicy && (
        <div className="empty">
          <div className="empty-icon">🛡️</div>
          <div className="empty-title">No active policy</div>
          <div className="empty-sub">Activate a weekly plan first. Claims are created automatically when disruptions hit your zone.</div>
          <button className="btn-primary" style={{ marginTop:20, width:'auto', padding:'12px 28px' }} onClick={() => nav('plans')}>
            View plans →
          </button>
        </div>
      )}

      {/* Simulate panel */}
      {hasPolicy && (
        <div className="sim-panel">
          <div className="sim-title"><Icon name="zap" size={13}/> Simulate Disruption</div>
          <div className="sim-row">
            <select value={simType} onChange={e => setSimType(e.target.value)} className="sim-select">
              {['rain','aqi','heat','curfew','flood'].map(t => <option key={t} value={t}>{trigIcon(t)} {t}</option>)}
            </select>
            <button className="btn-sim" onClick={simulate} disabled={simming}>
              {simming ? <SpinInline/> : 'Trigger'}
            </button>
          </div>
        </div>
      )}

      <div className="claims-grid">
        {claims.map(c => (
          <div key={c.id} className="claim-card">
            <div className="claim-card-head">
              <div className="claim-card-emoji">{trigIcon(c.triggerType)}</div>
              <div className="claim-card-info">
                <div className="claim-card-title">{c.triggerType} disruption</div>
                <div className="claim-card-date">{fmtDate(c.triggeredAt)} at {fmtTime(c.triggeredAt)}</div>
              </div>
              <div className="status-badge" style={{ background: statusColor(c.status)+'22', color: statusColor(c.status) }}>
                {c.status?.replace('_',' ')}
              </div>
            </div>
            <div className="claim-body">
              <div className="claim-row-detail"><span className="cd-label">Trigger reading</span><span className="cd-val">{c.triggerValue}</span></div>
              <div className="claim-row-detail"><span className="cd-label">Duration</span><span className="cd-val">{c.disruptionHours}h disrupted</span></div>
              <div className="claim-row-detail"><span className="cd-label">Payout</span><span className="cd-amount">{fmt(c.payoutAmount)}</span></div>
              {c.status === 'paid' && (
                <div className="claim-row-detail">
                  <span className="cd-label">Credited to</span>
                  <span className="cd-val" style={{ color:'#22c55e' }}>💳 GigShield Wallet</span>
                </div>
              )}
              {c.weatherSource && <div className="proof-tag"><Icon name="check" size={10}/> Verified via {c.weatherSource} API</div>}
              {c.upiRef && <div className="claim-row-detail"><span className="cd-label">Ref</span><span className="cd-upi">{c.upiRef}</span></div>}
              {c.fraudReason && <div className="fraud-warn"><Icon name="alert" size={13}/> {c.fraudReason}</div>}
            </div>
          </div>
        ))}
      </div>

      {claims.length > 0 && (
        <button className="btn-ghost" onClick={load} style={{ marginTop: 6, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <Icon name="refresh" size={14}/> Refresh
        </button>
      )}
    </div>
  );
}

// ─── Chart.js Canvas Wrappers ─────────────────────────────────────────────
function DoughnutChart({ data, colors, labels, centerLabel, centerSub }) {
  const ref = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; }
    const existing = Chart.getChart(ref.current);
    if (existing) existing.destroy();
    instanceRef.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }],
      },
      options: {
        cutout: '72%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed.toFixed(2)}`,
            },
            backgroundColor: '#1a1e2e',
            titleColor: '#eeeef5',
            bodyColor: '#8b8ea8',
            borderColor: 'rgba(255,255,255,0.07)',
            borderWidth: 1,
          },
        },
      },
    });
    return () => { if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; } };
  }, [JSON.stringify(data)]);

  return (
    <div className="analytics-doughnut-wrap">
      <canvas ref={ref} />
      {centerLabel && (
        <div className="analytics-doughnut-center">
          <div className="adc-val">{centerLabel}</div>
          <div className="adc-sub">{centerSub}</div>
        </div>
      )}
    </div>
  );
}

function BarChartJS({ labels, datasets, yPrefix = '' }) {
  const ref = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; }
    const existing = Chart.getChart(ref.current);
    if (existing) existing.destroy();
    instanceRef.current = new Chart(ref.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, labels: { color: '#8b8ea8', font: { size: 11 }, boxWidth: 12 } },
          tooltip: {
            backgroundColor: '#1a1e2e',
            titleColor: '#eeeef5',
            bodyColor: '#8b8ea8',
            borderColor: 'rgba(255,255,255,0.07)',
            borderWidth: 1,
            callbacks: { label: ctx => ` ${yPrefix}${ctx.parsed.y}` },
          },
        },
        scales: {
          x: { ticks: { color: '#454762', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#454762', font: { size: 11 }, callback: v => `${yPrefix}${v}` }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
    return () => { if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; } };
  }, [JSON.stringify(labels), JSON.stringify(datasets)]);

  return <div className="analytics-bar-wrap"><canvas ref={ref} /></div>;
}

function LineChartJS({ labels, datasets }) {
  const ref = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; }
    const existing = Chart.getChart(ref.current);
    if (existing) existing.destroy();
    instanceRef.current = new Chart(ref.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        tension: 0.4,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1e2e',
            titleColor: '#eeeef5',
            bodyColor: '#8b8ea8',
            borderColor: 'rgba(255,255,255,0.07)',
            borderWidth: 1,
          },
        },
        scales: {
          x: { ticks: { color: '#454762', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#454762', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
    return () => { if (instanceRef.current) { instanceRef.current.destroy(); instanceRef.current = null; } };
  }, [JSON.stringify(labels), JSON.stringify(datasets)]);

  return <div className="analytics-bar-wrap"><canvas ref={ref} /></div>;
}

// ─── Profile Analytics Section ────────────────────────────────────────────
function ProfileAnalytics({ claims, rp }) {
  const [analyticsTab, setAnalyticsTab] = useState('earnings');

  const paidClaims  = claims.filter(c => c.status === 'paid');
  const totalPayout = paidClaims.reduce((s, c) => s + c.payoutAmount, 0);
  const totalClaims = claims.length;

  // --- Earnings vs Payout (last 6 months) ---
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    return d.toLocaleString('en-IN', { month: 'short' });
  });
  const payoutByMonth = months.map((_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const m = d.getMonth(), y = d.getFullYear();
    return paidClaims
      .filter(c => { const t = new Date(c.triggeredAt); return t.getMonth() === m && t.getFullYear() === y; })
      .reduce((s, c) => s + c.payoutAmount, 0);
  });
  const baseEarning = 80 * 45 * 4;
  const earningsData = months.map(() => baseEarning);

  // --- Trigger breakdown (doughnut) ---
  const trigTypes = ['rain', 'aqi', 'heat', 'curfew', 'flood'];
  const trigColors = ['#4f7fff', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e'];
  const trigCounts = trigTypes.map(t => claims.filter(c => c.triggerType === t).length);
  const nonZeroTrig = trigTypes.map((t, i) => ({ t, color: trigColors[i], count: trigCounts[i] })).filter(x => x.count > 0);

  // --- Fraud score trend (line) ---
  const fraudData = claims.slice(-8).map((c, i) => ({ x: `C${i + 1}`, y: c.fraudScore ?? 0 }));

  // --- Payout distribution bar ---
  const payoutBuckets = ['₹0–200', '₹200–500', '₹500–1k', '₹1k+'];
  const payoutBucketCounts = [
    paidClaims.filter(c => c.payoutAmount < 200).length,
    paidClaims.filter(c => c.payoutAmount >= 200 && c.payoutAmount < 500).length,
    paidClaims.filter(c => c.payoutAmount >= 500 && c.payoutAmount < 1000).length,
    paidClaims.filter(c => c.payoutAmount >= 1000).length,
  ];

  const TABS = [
    { id: 'earnings', label: 'Earnings' },
    { id: 'triggers', label: 'Triggers' },
    { id: 'payouts',  label: 'Payouts'  },
    { id: 'risk',     label: 'Risk'     },
  ];

  return (
    <div className="analytics-section">
      <div className="analytics-header">
        <div className="analytics-title-row">
          <Icon name="chart" size={15}/> Analytics
        </div>
        <div className="analytics-summary-pills">
          <span className="a-pill"><span className="a-pill-val">{totalClaims}</span> claims</span>
          <span className="a-pill"><span className="a-pill-val">{fmt(totalPayout)}</span> earned</span>
          <span className="a-pill"><span className="a-pill-val">{paidClaims.length}</span> paid</span>
        </div>
      </div>

      <div className="analytics-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`analytics-tab-btn ${analyticsTab === t.id ? 'active' : ''}`} onClick={() => setAnalyticsTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {analyticsTab === 'earnings' && (
        <div className="analytics-card">
          <div className="analytics-card-title">Monthly Payout vs Base Earnings</div>
          <div className="analytics-card-sub">6-month view · estimated base vs protected income</div>
          <BarChartJS
            labels={months}
            yPrefix="₹"
            datasets={[
              {
                label: 'Base Earnings',
                data: earningsData,
                backgroundColor: 'rgba(79,127,255,0.15)',
                borderColor: '#4f7fff',
                borderWidth: 2,
                borderRadius: 4,
              },
              {
                label: 'Claim Payouts',
                data: payoutByMonth,
                backgroundColor: 'rgba(34,197,94,0.25)',
                borderColor: '#22c55e',
                borderWidth: 2,
                borderRadius: 4,
              },
            ]}
          />
        </div>
      )}

      {analyticsTab === 'triggers' && (
        <div className="analytics-card">
          <div className="analytics-card-title">Disruption Trigger Breakdown</div>
          <div className="analytics-card-sub">Distribution of claim types</div>
          {nonZeroTrig.length === 0 ? (
            <div className="analytics-empty">No claims yet — trigger a disruption to see analytics</div>
          ) : (
            <>
              <DoughnutChart
                data={nonZeroTrig.map(x => x.count)}
                colors={nonZeroTrig.map(x => x.color)}
                labels={nonZeroTrig.map(x => x.t)}
                centerLabel={totalClaims}
                centerSub="total"
              />
              <div className="analytics-legend">
                {nonZeroTrig.map(x => (
                  <div key={x.t} className="analytics-legend-item">
                    <span className="analytics-legend-dot" style={{ background: x.color }}/>
                    <span className="analytics-legend-label">{trigIcon(x.t)} {x.t}</span>
                    <span className="analytics-legend-val">{x.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {analyticsTab === 'payouts' && (
        <div className="analytics-card">
          <div className="analytics-card-title">Payout Distribution</div>
          <div className="analytics-card-sub">Claim payout amount buckets</div>
          <BarChartJS
            labels={payoutBuckets}
            datasets={[{
              label: 'Claims',
              data: payoutBucketCounts,
              backgroundColor: ['rgba(79,127,255,0.7)', 'rgba(139,92,246,0.7)', 'rgba(245,158,11,0.7)', 'rgba(34,197,94,0.7)'],
              borderRadius: 6,
              borderWidth: 0,
            }]}
          />
          <div className="analytics-payout-stats">
            <div className="aps-item">
              <div className="aps-val">{fmt(Math.round(totalPayout / Math.max(paidClaims.length, 1)))}</div>
              <div className="aps-lbl">Avg payout</div>
            </div>
            <div className="aps-item">
              <div className="aps-val">{fmt(Math.max(...paidClaims.map(c => c.payoutAmount), 0))}</div>
              <div className="aps-lbl">Highest payout</div>
            </div>
            <div className="aps-item">
              <div className="aps-val">{paidClaims.length > 0 ? Math.round((paidClaims.length / Math.max(totalClaims, 1)) * 100) : 0}%</div>
              <div className="aps-lbl">Success rate</div>
            </div>
          </div>
        </div>
      )}

      {analyticsTab === 'risk' && rp && (
        <div className="analytics-card">
          <div className="analytics-card-title">AI Risk Score Breakdown</div>
          <div className="analytics-card-sub">Factors influencing your premium multiplier</div>
          <BarChartJS
            labels={Object.keys(rp.breakdown || {}).map(k => k.replace(/([A-Z])/g, ' $1').trim())}
            datasets={[{
              label: 'Risk factor',
              data: Object.values(rp.breakdown || {}).map(v => parseFloat((v * 10).toFixed(2))),
              backgroundColor: Object.values(rp.breakdown || {}).map(v =>
                v > 0.2 ? 'rgba(239,68,68,0.7)' : v > 0.1 ? 'rgba(245,158,11,0.7)' : 'rgba(34,197,94,0.7)'
              ),
              borderRadius: 5,
              borderWidth: 0,
            }]}
          />
          {fraudData.length > 1 && (
            <>
              <div className="analytics-card-title" style={{ marginTop: 20 }}>Fraud Score Trend</div>
              <div className="analytics-card-sub">Across your last {fraudData.length} claims</div>
              <LineChartJS
                labels={fraudData.map(d => d.x)}
                datasets={[{
                  data: fraudData.map(d => d.y),
                  borderColor: '#4f7fff',
                  backgroundColor: 'rgba(79,127,255,0.08)',
                  fill: true,
                  pointBackgroundColor: fraudData.map(d => d.y > 65 ? '#ef4444' : '#22c55e'),
                  pointRadius: 4,
                }]}
              />
            </>
          )}
          <div className="analytics-risk-summary">
            <div className="ars-row">
              <span>Multiplier</span>
              <strong>×{rp.multiplier}</strong>
            </div>
            <div className="ars-row">
              <span>Risk label</span>
              <strong className={`risk-label risk-${rp.riskLabel?.toLowerCase().split(' ')[0]}`}>{rp.riskLabel}</strong>
            </div>
            <div className="ars-row">
              <span>Pricing source</span>
              <strong>{rp.source === 'ml_service' ? 'ML Model' : 'Local formula'}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════════
function Profile() {
  const { user, setUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [claims,  setClaims]  = useState([]);
  const [zones,   setZones]   = useState([]);
  const [updating, setUpdating] = useState(false);
  const [selCity, setSelCity] = useState(user?.zone?.city || 'Mumbai');

  const load = useCallback(async () => {
    try {
      const [r1, r2, r3] = await Promise.all([workerAPI.riskProfile(), workerAPI.zones(), claimsAPI.my()]);
      setProfile(r1.data);
      setZones(r2.data.zones);
      setClaims(r3.data.claims || []);
      if (r1.data.riskProfile?.zone?.city) setSelCity(r1.data.riskProfile.zone.city);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const cities = [...new Set(zones.map(z => z.city))];
  const filteredZones = zones.filter(z => z.city === selCity);

  const changeZone = async (e) => {
    const zoneId = e.target.value;
    setUpdating(true);
    try {
      const r = await workerAPI.updateProfile({ zoneId });
      setUser(s => ({ ...s, ...r.data.worker }));
      load();
      toast('📍 Work zone updated');
    } catch { toast('Failed to update zone', 'error'); }
    setUpdating(false);
  };

  const rp = profile?.riskProfile;

  return (
    <div className="screen">
      <div className="profile-card">
        <div className="profile-avatar">{user?.name?.[0]?.toUpperCase()}</div>
        <div className="profile-name">{user?.name}</div>
        <div className="profile-meta">{user?.platform} partner · {user?.phone}</div>
      </div>

      <div className="section">
        <div className="section-label">Settings</div>
        <div className="risk-card" style={{ marginBottom: 16 }}>
          <div className="profile-field">
            <label>Work City</label>
            <select value={selCity} onChange={(e) => setSelCity(e.target.value)}>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="profile-field" style={{ marginBottom: 0 }}>
            <label>Delivery Area</label>
            <select value={user?.zoneId} onChange={changeZone} disabled={updating}>
              {filteredZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            {updating && <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 4 }}>Updating location data...</div>}
          </div>
        </div>
      </div>

      {rp && (
        <div className="section">
          <div className="section-label">AI Risk Profile</div>
          <div className="risk-card">
            <div className="risk-zone-row">
              <div className="risk-zone-name">{rp.zone}</div>
              <div className={`risk-label risk-${rp.riskLabel?.toLowerCase().split(' ')[0]}`}>{rp.riskLabel}</div>
            </div>
            <div className="metric-grid">
              <div className="metric-box"><div className="m-val">0.82</div><div className="m-lbl">Safety score</div></div>
              <div className="metric-box"><div className="m-val">12</div><div className="m-lbl">Zone events/mo</div></div>
            </div>
            <div className="risk-rows">
              {Object.entries(rp.breakdown || {}).map(([k, v]) => (
                <div key={k} className="risk-row">
                  <div className="risk-row-label"><span>{k.replace(/([A-Z])/g,' $1').trim()}</span><span>{(v * 10).toFixed(1)}/10</span></div>
                  <div className="risk-bar-track"><div className="risk-bar-fill" style={{ width:`${Math.min(100,v*300)}%`, background: v > 0.2 ? '#ef4444' : v > 0.1 ? '#f59e0b' : '#22c55e' }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ProfileAnalytics claims={claims} rp={rp} />

      <div style={{ marginTop: 24 }}>
        <button className="btn-danger" onClick={logout}><Icon name="logout" size={16}/> Sign out</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WORKER APP SHELL
// ═══════════════════════════════════════════════════════════════════
function WorkerApp() {
  const { user } = useAuth();
  const [page, setPage] = useState('home');

  useEffect(() => {
    const h = e => setPage(e.detail);
    window.addEventListener('gs:nav', h);
    return () => window.removeEventListener('gs:nav', h);
  }, []);

  const NAV = [
    { id:'home',    label:'Home',    icon:'home'   },
    { id:'plans',   label:'Plans',   icon:'shield' },
    { id:'claims',  label:'Claims',  icon:'file'   },
    { id:'wallet',  label:'Wallet',  icon:'wallet' },
    { id:'profile', label:'Profile', icon:'user'   },
  ];

  return (
    <div className="app-shell responsive-shell">
      {/* Desktop Sidebar */}
      <div className="desktop-sidebar">
        <div className="desktop-sidebar-top">
          <div className="sidebar-brand">
            <Icon name="shield" size={24}/>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>GigShield</span>
              <span className="live-badge" style={{ marginLeft: 0, marginTop: 4 }}>LIVE</span>
            </div>
          </div>
          <nav className="desktop-nav">
            {NAV.map(n => (
              <button key={n.id} className={`desktop-nav-btn ${page===n.id?'active':''}`} onClick={() => setPage(n.id)}>
                <Icon name={n.icon} size={20}/>
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="desktop-user">
          <div className="avatar">{user?.name?.[0]}</div>
          <div className="desktop-user-info">
            <div className="desktop-user-name">{user?.name}</div>
            <div className="desktop-user-role">Partner • {user?.platform}</div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Mobile Header */}
        <div className="app-header">
          <div className="header-brand">
            <Icon name="shield" size={19}/>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>GigShield</span>
              <span className="live-badge" style={{ marginLeft: 0, marginTop: 2 }}>LIVE</span>
            </div>
          </div>
          <div className="header-right">
            <span className="header-name">{user?.name?.split(' ')[0]}</span>
            <div className="avatar">{user?.name?.[0]}</div>
          </div>
        </div>

        <div className="app-content content-scroll">
          <div className="content-inner">
            {page === 'home'    && <Home    />}
            {page === 'plans'   && <Plans   />}
            {page === 'claims'  && <Claims  />}
            {page === 'wallet'  && <Wallet  />}
            {page === 'profile' && <Profile />}
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="bottom-nav">
          {NAV.map(n => (
            <button key={n.id} className={`nav-btn ${page===n.id?'active':''}`} onClick={() => setPage(n.id)}>
              <Icon name={n.icon} size={21}/>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function AdminDash({ onLogout }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('overview');
  const [simType,  setSimType]  = useState('rain');
  const [simming,  setSimming]  = useState(false);

  const load = useCallback(async () => {
    try { const r = await dashAPI.admin(); setData(r.data); }
    catch { toast('Failed to load admin data', 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
  }, [load]);

  const simulate = async () => {
    setSimming(true);
    try { await triggerAPI.simulate(simType); toast(`⚡ ${simType} simulated`); setTimeout(load, 1500); }
    catch { toast('Simulation failed', 'error'); }
    setSimming(false);
  };

  const handleClaim = async (id, action) => {
    try {
      if (action === 'approve') await claimsAPI.approve(id);
      else                       await claimsAPI.reject(id, 'Fraud confirmed');
      toast(action === 'approve' ? '✅ Approved & credited to worker wallet' : '❌ Rejected');
      load();
    } catch { toast('Action failed', 'error'); }
  };

  if (loading) return <Spinner />;
  if (!data)   return null;

  const { summary, byTrigger, weeklyTrend, zoneStats, recentClaims, fraudQueue } = data;
  const TABS = [
    { id:'overview', label:'Overview' },
    { id:'claims',   label:'Claims'   },
    { id:'fraud',    label:`Fraud (${fraudQueue?.length||0})` },
    { id:'zones',    label:'Zones'    },
  ];

  return (
    <div className="admin-shell">
      <div className="admin-sidebar">
        <div className="admin-sidebar-brand"><Icon name="grid" size={22}/><span>Admin</span></div>
        <nav className="admin-nav">
          {TABS.map(t => <button key={t.id} className={`admin-nav-btn ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </nav>
        <div className="admin-sim-box">
          <div className="sim-title"><Icon name="zap" size={13}/> Simulate</div>
          <select value={simType} onChange={e => setSimType(e.target.value)} className="sim-select">
            {['rain','aqi','heat','curfew','flood'].map(t => <option key={t} value={t}>{trigIcon(t)} {t}</option>)}
          </select>
          <button className="btn-sim" onClick={simulate} disabled={simming} style={{ width:'100%', marginTop:8 }}>
            {simming ? <SpinInline/> : 'Run trigger'}
          </button>
        </div>
        <button className="admin-logout" onClick={onLogout}><Icon name="logout" size={14}/> Log out</button>
      </div>

      <div className="admin-main">
        {tab === 'overview' && <>
          <div className="admin-page-title">Dashboard overview</div>
          <div className="admin-kpi-grid">
            {[
              { label:'Workers',         val: summary.totalWorkers,    icon:'user'   },
              { label:'Active policies', val: summary.activePolicies,  icon:'shield' },
              { label:'Premium in',      val: fmt(summary.premiumIn),  icon:'rupee'  },
              { label:'Paid out',        val: fmt(summary.paidOut),    icon:'check'  },
              { label:'Loss ratio',      val: summary.lossRatio + '%', icon:'chart'  },
              { label:'Fraud queue',     val: summary.fraudQueueCount, icon:'alert'  },
            ].map(k => (
              <div key={k.label} className="admin-kpi">
                <div className="kpi-icon"><Icon name={k.icon} size={16}/></div>
                <div className="kpi-val">{k.val}</div>
                <div className="kpi-label">{k.label}</div>
              </div>
            ))}
          </div>
          <div className="charts-row">
            <div className="chart-card">
              <div className="chart-title">Weekly payout trend</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={weeklyTrend}>
                  <XAxis dataKey="week" tick={{ fontSize:11 }}/>
                  <YAxis tick={{ fontSize:11 }}/>
                  <Tooltip formatter={v => fmt(v)}/>
                  <Area type="monotone" dataKey="payout" stroke="#4f7fff" fill="rgba(79,127,255,.15)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <div className="chart-title">Weekly claim count</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyTrend}>
                  <XAxis dataKey="week" tick={{ fontSize:11 }}/>
                  <YAxis tick={{ fontSize:11 }}/>
                  <Tooltip/>
                  <Bar dataKey="claims" fill="#8b5cf6" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>}

        {tab === 'claims' && <>
          <div className="admin-page-title" style={{ marginBottom: 20 }}>All claims</div>
          <div className="claims-table-wrap">
            <table className="claims-table">
              <thead><tr><th>Worker</th><th>Trigger</th><th>Hours</th><th>Payout</th><th>Fraud</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {recentClaims.map(c => (
                  <tr key={c.id}>
                    <td>{c.worker?.name || '—'}</td>
                    <td>{trigIcon(c.triggerType)} {c.triggerType}</td>
                    <td>{c.disruptionHours}h</td>
                    <td>{fmt(c.payoutAmount)}</td>
                    <td>
                      <div className="fraud-bar-wrap">
                        <div className="fraud-bar-track"><div className="fraud-bar-fill" style={{ width:`${c.fraudScore}%`, background: c.fraudScore>65?'#ef4444':c.fraudScore>35?'#f59e0b':'#22c55e' }}/></div>
                        <span style={{ fontSize:11, color:'var(--text2)' }}>{c.fraudScore}</span>
                      </div>
                    </td>
                    <td><span className="status-pill" style={{ background:statusColor(c.status)+'22', color:statusColor(c.status) }}>{c.status?.replace('_',' ')}</span></td>
                    <td style={{ color:'var(--text2)', fontSize:12 }}>{fmtDate(c.triggeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {tab === 'fraud' && <>
          <div className="admin-page-title" style={{ marginBottom: 20 }}>Fraud review queue</div>
          {fraudQueue.length === 0 ? (
            <div className="empty"><div className="empty-icon">✅</div><div className="empty-title">Queue is clear</div></div>
          ) : fraudQueue.map(c => (
            <div key={c.id} className="fraud-card">
              <div className="fraud-card-head">
                <div>
                  <div className="fraud-worker">{c.worker?.name} · {c.worker?.platform}</div>
                  <div className="fraud-trigger">{trigIcon(c.triggerType)} {c.triggerType} · {c.triggerValue} · {c.disruptionHours}h</div>
                </div>
                <div className="fraud-score-big">{c.fraudScore}<span>/100</span></div>
              </div>
              {c.fraudReason && <div className="fraud-reason"><Icon name="alert" size={13}/> {c.fraudReason}</div>}
              <div className="fraud-payout">Claimed: <strong>{fmt(c.payoutAmount)}</strong></div>
              <div className="fraud-actions">
                <button className="btn-approve" onClick={() => handleClaim(c.id,'approve')}><Icon name="check" size={13}/> Approve & credit wallet</button>
                <button className="btn-reject"  onClick={() => handleClaim(c.id,'reject')} ><Icon name="x"     size={13}/> Reject</button>
              </div>
            </div>
          ))}
        </>}

        {tab === 'zones' && <>
          <div className="admin-page-title" style={{ marginBottom: 20 }}>Zone analytics</div>
          <div className="zones-grid">
            {zoneStats.map(z => (
              <div key={z.id} className="zone-card">
                <div className="zone-name">{z.name}</div>
                <div className="zone-city">{z.city}</div>
                <div className="zone-risk-track"><div className="zone-risk-fill" style={{ width:`${z.riskScore*100}%`, background: z.riskScore>.8?'#ef4444':z.riskScore>.65?'#f59e0b':'#22c55e' }}/></div>
                <div className="zone-stats">
                  <span>{z.activePolicies} active policies</span>
                  <span>{z.totalClaims} claims</span>
                  <span className={`zone-flood ${z.floodProne?'yes':'no'}`}>{z.floodProne?'flood-prone':'stable'}</span>
                </div>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN LOGIN
// ═══════════════════════════════════════════════════════════════════
function AdminLogin({ onBack, onLoggedIn }) {
  const [email, setEmail]   = useState('admin@gigshield.in');
  const [pass,  setPass]    = useState('admin123');
  const [busy,  setBusy]    = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await authAPI.adminLogin({ email, password: pass });
      localStorage.setItem('gs_token', r.data.token);
      onLoggedIn();
    } catch { toast('Invalid admin credentials', 'error'); }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-glow"/>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon admin"><Icon name="grid" size={22}/></div>
          <div><div className="logo-name">GigShield</div><div className="logo-tagline">Insurer admin portal</div></div>
        </div>
        <form onSubmit={submit} className="auth-form">
          <div className="field"><label>Email</label><input value={email} onChange={e => setEmail(e.target.value)}/></div>
          <div className="field"><label>Password</label><input type="password" value={pass} onChange={e => setPass(e.target.value)}/></div>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? <SpinInline/> : 'Access dashboard'}</button>
        </form>
        <button className="admin-link" onClick={onBack}>← Back to worker app</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════
function Root() {
  const { user, loading } = useAuth();
  const [adminMode,    setAdminMode]    = useState(false);
  const [adminAuthed,  setAdminAuthed]  = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('gs_token');
    if (!t) return;
    try {
      const p = JSON.parse(atob(t.split('.')[1]));
      if (p.role === 'admin') setAdminAuthed(true);
    } catch {}
  }, []);

  if (loading) return (
    <div className="loading-screen"><div className="spinner"/><span>Loading GigShield…</span></div>
  );

  if (adminAuthed) return (
    <AdminDash onLogout={() => { localStorage.removeItem('gs_token'); setAdminAuthed(false); setAdminMode(false); }}/>
  );

  if (adminMode) return (
    <AdminLogin onBack={() => setAdminMode(false)} onLoggedIn={() => setAdminAuthed(true)}/>
  );

  if (!user) return <AuthScreen onAdmin={() => setAdminMode(true)}/>;

  return <WorkerApp/>;
}

export default function App() {
  return (
    <AuthProvider>
      <Toast/>
      <Root/>
    </AuthProvider>
  );
}