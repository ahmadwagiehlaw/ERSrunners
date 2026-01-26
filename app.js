import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, serverTimestamp, query, orderBy, runTransaction, getDocs, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === المتغيرات ===
let currentPortfolioId = null;
let chartInstance = null;
let marketInterval = null;
let journalUnsub = null;
let detailsUnsub = null;
let currentBroker = 'thndr';

// === بيانات السوق (بدون محاكاة) ===
const marketData = {
    USD: { val: 50.80, icon: 'fa-dollar-sign', label: 'USD/EGP' },
    ALUMINUM: { val: 3175.00, icon: 'fa-layer-group', label: 'Aluminum' },
    GOLD: { val: 2035.00, icon: 'fa-ring', label: 'Gold' }
};

// === دوال مساعدة ===
window.formatMoney = (amount, currency = 'EGP') => {
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', currency: currency === 'GOLD' ? 'USD' : currency, 
        minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(amount);
};

window.setView = (viewName) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${viewName}-section`)?.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const navMap = { 
        'dashboard': 'home', 
        'details': 'home', 
        'journal': 'journal', 
        'calculator': 'calculator',
        'settings': 'settings' 
    };
    const navBtn = document.getElementById(`nav-${navMap[viewName] || 'home'}`);
    if(navBtn) navBtn.classList.add('active');
};

window.showModal = (html) => {
    const box = document.getElementById('modal-box');
    const overlay = document.getElementById('modal-overlay');
    box.innerHTML = html + '<button class="btn-text" onclick="window.closeModal()" style="position:absolute; top:15px; left:15px; color:#666; font-size:1.2rem"><i class="fa-solid fa-xmark"></i></button>';
    overlay.classList.remove('hidden');
};

window.closeModal = () => document.getElementById('modal-overlay').classList.add('hidden');

// === التهيئة ===
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.setView('dashboard');
        loadMarketData();
        loadPortfolios(user.uid);
    } else {
        window.setView('auth');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-btn')?.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        try { await signInWithEmailAndPassword(auth, email, pass); } 
        catch { try { await createUserWithEmailAndPassword(auth, email, pass); } catch(e){ alert(e.message); } }
    });

    document.getElementById('nav-home')?.addEventListener('click', () => window.setView('dashboard'));
    document.getElementById('nav-journal')?.addEventListener('click', () => { window.setView('journal'); loadJournalTrades('OPEN'); });
    document.getElementById('nav-calculator')?.addEventListener('click', () => window.setView('calculator'));
    document.getElementById('nav-settings')?.addEventListener('click', () => window.setView('settings'));
    document.getElementById('logout-btn-settings')?.addEventListener('click', () => signOut(auth));

    document.getElementById('create-portfolio-btn')?.addEventListener('click', () => {
        window.showModal(`
            <h3 style="text-align:center">محفظة جديدة</h3>
            <input id="new-p-name" placeholder="اسم المحفظة">
            <input id="new-p-cap" type="number" placeholder="رأس المال المبدئي">
            <button class="btn-primary" onclick="window.submitNewPortfolio()">إنشاء</button>
        `);
    });

    document.querySelectorAll('.f-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.f-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            loadJournalTrades(e.target.getAttribute('data-j-filter'));
        });
    });
    document.getElementById('add-trade-btn')?.addEventListener('click', window.showAddTradeModal);
    setupBackupListeners();
});

// === منطق الحاسبة الجديد (Tabs Logic) ===
window.switchCalcTab = (tabName, btn) => {
    // تحديث الأزرار
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // تحديث المحتوى
    document.querySelectorAll('.calc-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`calc-${tabName}`).classList.add('active');
};

// 1. العمولات
window.selectBroker = (broker, el) => {
    currentBroker = broker;
    document.querySelectorAll('.radio-label').forEach(r => r.classList.remove('selected'));
    el.classList.add('selected');
    window.calcCommission();
};

window.calcCommission = () => {
    const buyPrice = parseFloat(document.getElementById('c-buy').value) || 0;
    const sellPrice = parseFloat(document.getElementById('c-sell').value) || 0;
    const qty = parseFloat(document.getElementById('c-qty').value) || 0;

    if (buyPrice === 0 || qty === 0) return;

    const buyVal = buyPrice * qty;
    const sellVal = sellPrice * qty;

    let buyFee = 0, sellFee = 0;
    if (currentBroker === 'thndr') {
        buyFee = 2 + (buyVal * 0.0006); 
        sellFee = sellPrice > 0 ? (2 + (sellVal * 0.0006)) : 0;
    } else {
        buyFee = buyVal * 0.003;
        sellFee = sellVal * 0.003;
    }

    const totalFees = buyFee + sellFee;
    let netProfit = 0;
    if (sellPrice > 0) netProfit = sellVal - buyVal - totalFees;

    const resEl = document.getElementById('c-result');
    resEl.textContent = window.formatMoney(netProfit);
    resEl.className = netProfit >= 0 ? 'text-green' : 'text-danger';
    document.getElementById('c-fees').textContent = window.formatMoney(totalFees);
};

// 2. المتوسطات
window.calcAverage = () => {
    const q1 = parseFloat(document.getElementById('avg-curr-qty').value) || 0;
    const p1 = parseFloat(document.getElementById('avg-curr-price').value) || 0;
    const q2 = parseFloat(document.getElementById('avg-new-qty').value) || 0;
    const p2 = parseFloat(document.getElementById('avg-new-price').value) || 0;
    if ((q1 + q2) === 0) return;
    const totalCost = (q1 * p1) + (q2 * p2);
    const newAvg = totalCost / (q1 + q2);
    document.getElementById('avg-result').textContent = newAvg.toFixed(2);
};

// 3. المخاطرة
window.calcRR = () => {
    const entry = parseFloat(document.getElementById('rr-entry').value) || 0;
    const target = parseFloat(document.getElementById('rr-target').value) || 0;
    const stop = parseFloat(document.getElementById('rr-stop').value) || 0;
    if (entry === 0) return;

    let profitPer = 0, lossPer = 0;
    if (target > 0) profitPer = ((target - entry) / entry) * 100;
    if (stop > 0) lossPer = ((stop - entry) / entry) * 100;

    document.getElementById('rr-profit').textContent = profitPer > 0 ? `+${profitPer.toFixed(2)}%` : '0%';
    document.getElementById('rr-loss').textContent = lossPer < 0 ? `${lossPer.toFixed(2)}%` : '0%';

    if (profitPer > 0 && lossPer < 0) {
        const ratio = Math.abs(profitPer / lossPer).toFixed(1);
        document.getElementById('rr-ratio').textContent = `1 : ${ratio}`;
        document.getElementById('rr-ratio').style.color = ratio >= 2 ? 'var(--success)' : 'white';
    } else {
        document.getElementById('rr-ratio').textContent = "0 : 0";
    }
};

// === بيانات السوق والمحافظ (الكود السابق) ===
async function loadMarketData() {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if(data && data.rates && data.rates.EGP) marketData.USD.val = data.rates.EGP;
    } catch(e) {}
    renderTicker();
}

function renderTicker() {
    const bar = document.getElementById('ticker-bar');
    if(!bar) return;
    let html = ``;
    html += createTickerItem(marketData.USD);
    html += `<div class="sep"></div>`;
    html += createTickerItem(marketData.ALUMINUM);
    html += `<div class="sep"></div>`;
    html += createTickerItem(marketData.GOLD);
    bar.innerHTML = html;
}

function createTickerItem(item) {
    return `
        <div class="ticker-item">
            <div class="t-label"><i class="fa-solid ${item.icon}" style="color:var(--gold)"></i> ${item.label}</div>
            <div class="t-val">${item.val.toFixed(2)}</div>
        </div>
    `;
}

function loadPortfolios(uid) {
    const container = document.getElementById('portfolios-container');
    const q = query(collection(db, "users", uid, "portfolios"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        container.innerHTML = '';
        let totalNetWorth = 0; let totalInvested = 0;
        if(snap.empty) {
            container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-plus empty-icon"></i><p>ابدأ الآن</p></div>`;
        }
        snap.forEach(doc => {
            const d = doc.data();
            totalNetWorth += (d.currentValue || 0);
            totalInvested += (d.initialCapital || 0);
            const pnl = (d.currentValue || 0) - (d.initialCapital || 0);
            const pnlPercent = d.initialCapital > 0 ? (pnl / d.initialCapital) * 100 : 0;
            const isPos = pnl >= 0;
            container.innerHTML += `
                <div class="portfolio-card" onclick="window.openPortfolio('${doc.id}')">
                    <div class="pc-info-right">
                        <div class="pc-icon"><i class="fa-solid fa-briefcase"></i></div>
                        <div class="pc-info-left"><div class="p-name">${d.name}</div><div class="p-sub">نشطة</div></div>
                    </div>
                    <div style="text-align:left">
                        <div class="p-val">${window.formatMoney(d.currentValue)}</div>
                        <div style="font-size:0.8rem; color:${isPos?'var(--success)':'var(--danger)'}" dir="ltr">${isPos?'+':''}${pnlPercent.toFixed(1)}%</div>
                    </div>
                </div>`;
        });
        document.getElementById('total-net-worth').textContent = window.formatMoney(totalNetWorth);
        const totalPnl = totalNetWorth - totalInvested;
        const totalRoi = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
        document.getElementById('total-roi').innerHTML = `<span class="${totalRoi>=0?'text-green':'text-danger'}" dir="ltr">${totalRoi>=0?'+':''}${totalRoi.toFixed(1)}%</span>`;
    });
}

window.submitNewPortfolio = async () => {
    const name = document.getElementById('new-p-name').value;
    const cap = parseFloat(document.getElementById('new-p-cap').value);
    if(!name) return;
    await addDoc(collection(db, "users", auth.currentUser.uid, "portfolios"), {
        name, initialCapital: cap || 0, currentValue: cap || 0, createdAt: serverTimestamp()
    });
    window.closeModal();
};

window.openPortfolio = (pid) => {
    currentPortfolioId = pid;
    window.setView('details');
    loadPortfolioDetails(pid);
};

function loadPortfolioDetails(pid) {
    if(detailsUnsub) detailsUnsub();
    onSnapshot(doc(db, "users", auth.currentUser.uid, "portfolios", pid), (s) => {
        if(s.exists()) {
            document.getElementById('d-p-name').textContent = s.data().name;
            document.getElementById('d-p-val').textContent = window.formatMoney(s.data().currentValue);
        }
    });
    const q = query(collection(db, "users", auth.currentUser.uid, "portfolios", pid, "assets"));
    detailsUnsub = onSnapshot(q, (snap) => {
        const list = document.getElementById('assets-list');
        list.innerHTML = '';
        let assetsData = [];
        snap.forEach(d => {
            const a = {id: d.id, ...d.data()};
            const currentVal = (a.qty * a.avgPrice); 
            assetsData.push({ label: a.symbol, value: currentVal });
            list.innerHTML += `
                <div class="portfolio-card" style="cursor:default">
                    <div class="pc-info-right"><div><div class="p-name">${a.symbol}</div><div class="p-sub">${a.category}</div></div></div>
                    <div style="text-align:left"><div class="p-val">${window.formatMoney(currentVal)}</div><div style="font-size:0.75rem; color:#aaa">${a.qty} x ${a.avgPrice}</div></div>
                    <button onclick="window.deleteAsset('${d.id}')" class="btn-text" style="color:var(--danger); margin-right:10px"><i class="fa-solid fa-trash"></i></button>
                </div>`;
        });
        renderChart(assetsData);
    });
}

window.showAddAssetModal = () => {
    window.showModal(`
        <h3 style="text-align:center">إضافة أصل</h3>
        <input id="a-symbol" placeholder="الرمز">
        <select id="a-cat"><option value="Stocks">أسهم</option><option value="Gold">ذهب</option><option value="Cash">كاش</option></select>
        <input id="a-qty" type="number" placeholder="الكمية">
        <input id="a-price" type="number" placeholder="السعر">
        <button class="btn-primary" onclick="window.submitAsset()">حفظ</button>
    `);
};

window.submitAsset = async () => {
    const symbol = document.getElementById('a-symbol').value;
    const qty = parseFloat(document.getElementById('a-qty').value);
    const price = parseFloat(document.getElementById('a-price').value);
    if(!symbol || !qty) return;
    await addDoc(collection(db, "users", auth.currentUser.uid, "portfolios", currentPortfolioId, "assets"), {
        symbol, qty, avgPrice: price, category: document.getElementById('a-cat').value, date: serverTimestamp()
    });
    await runTransaction(db, async (txn) => {
        const ref = doc(db, "users", auth.currentUser.uid, "portfolios", currentPortfolioId);
        const pDoc = await txn.get(ref);
        const newVal = (pDoc.data().currentValue || 0) + (qty * price);
        txn.update(ref, { currentValue: newVal });
    });
    window.closeModal();
};

window.deleteAsset = async (aid) => {
    if(confirm('حذف الأصل؟')) await deleteDoc(doc(db, "users", auth.currentUser.uid, "portfolios", currentPortfolioId, "assets", aid));
};

window.deleteCurrentPortfolio = async () => {
    if(confirm('حذف المحفظة؟')) {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "portfolios", currentPortfolioId));
        window.setView('dashboard');
    }
};

function renderChart(data) {
    const ctx = document.getElementById('portfolioChart')?.getContext('2d');
    if(!ctx) return;
    if(chartInstance) chartInstance.destroy();
    const values = data.map(d => d.value);
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                data: values.length ? values : [1],
                backgroundColor: values.length ? ['#0a84ff', '#32d74b', '#ffd60a', '#ff453a'] : ['#333'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { color: '#aaa', font: {family:'Cairo'} } } } }
    });
}

// Journal
window.showAddTradeModal = () => {
    window.showModal(`
        <h3 style="text-align:center">صفقة جديدة</h3>
        <input id="t-ticker" placeholder="الرمز" style="text-transform:uppercase">
        <select id="t-side"><option value="LONG">شراء</option><option value="SHORT">بيع</option></select>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
            <input id="t-tp" type="number" placeholder="TP">
            <input id="t-sl" type="number" placeholder="SL">
        </div>
        <button class="btn-primary" onclick="window.submitTrade()">حفظ</button>
    `);
};

window.submitTrade = async () => {
    const ticker = document.getElementById('t-ticker').value.toUpperCase();
    if(!ticker) return;
    await addDoc(collection(db, "users", auth.currentUser.uid, "trades"), {
        ticker, side: document.getElementById('t-side').value,
        target1: parseFloat(document.getElementById('t-tp').value),
        stopLoss: parseFloat(document.getElementById('t-sl').value),
        status: 'OPEN', createdAt: serverTimestamp(), realizedPnL: 0, avgPrice: 0, currentQty: 0
    });
    window.closeModal();
    loadJournalTrades('OPEN');
};

window.tradeAction = (tid) => {
    window.showModal(`
        <h3 style="text-align:center">إدارة المركز</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px">
            <button class="btn-add-stylish" style="justify-content:center; background:rgba(50, 215, 75, 0.1); color:var(--success)" onclick="window.showExecutionForm('${tid}', 'BUY')">شراء</button>
            <button class="btn-add-stylish" style="justify-content:center; background:rgba(255, 69, 58, 0.1); color:var(--danger)" onclick="window.showExecutionForm('${tid}', 'SELL')">بيع</button>
        </div>
        <button class="btn-primary" style="background:transparent; border:1px solid var(--danger); color:var(--danger)" onclick="window.closeTradeFull('${tid}')">إغلاق المركز</button>
    `);
};

window.showExecutionForm = (tid, type) => {
    window.showModal(`
        <h3 style="text-align:center">${type==='BUY'?'شراء':'بيع'}</h3>
        <input id="e-qty" type="number" placeholder="الكمية">
        <input id="e-price" type="number" placeholder="السعر">
        <button class="btn-primary" onclick="window.submitExecution('${tid}', '${type}')">تأكيد</button>
    `);
};

window.submitExecution = async (tid, type) => {
    const qty = parseFloat(document.getElementById('e-qty').value);
    const price = parseFloat(document.getElementById('e-price').value);
    if(!qty || !price) return;
    await runTransaction(db, async (txn) => {
        const tRef = doc(db, "users", auth.currentUser.uid, "trades", tid);
        const tDoc = await txn.get(tRef);
        const t = tDoc.data();
        let newQty = t.currentQty || 0, newAvg = t.avgPrice || 0, realized = t.realizedPnL || 0;
        if (type === 'BUY') {
            const totalCost = (newQty * newAvg) + (qty * price);
            newQty += qty; newAvg = totalCost / newQty;
        } else {
            realized += (price - newAvg) * qty;
            newQty -= qty;
        }
        txn.set(doc(collection(tRef, "executions")), { type, qty, price, date: serverTimestamp() });
        txn.update(tRef, { currentQty: newQty, avgPrice: newAvg, realizedPnL: realized, status: newQty <= 0 ? 'CLOSED' : 'OPEN' });
    });
    window.closeModal();
    loadJournalTrades('OPEN');
};

window.closeTradeFull = async (tid) => {
    if(confirm('تأكيد الإغلاق؟')) {
        await updateDoc(doc(db, "users", auth.currentUser.uid, "trades", tid), { status: 'CLOSED' });
        window.closeModal();
    }
};

async function loadJournalTrades(filter) {
    const list = document.getElementById('journal-list');
    if(journalUnsub) journalUnsub();
    const q = query(collection(db, "users", auth.currentUser.uid, "trades"), orderBy("createdAt", "desc"));
    journalUnsub = onSnapshot(q, (snap) => {
        list.innerHTML = '';
        let count = 0; let totalPnl = 0;
        snap.forEach(d => {
            const t = {id: d.id, ...d.data()};
            if(t.status === 'OPEN') count++;
            totalPnl += (t.realizedPnL || 0);
            if(t.status !== filter) return;
            const isWin = (t.realizedPnL || 0) >= 0;
            if(filter === 'CLOSED') {
                list.innerHTML += `<div class="glass-card" style="padding:15px; border-right:4px solid ${isWin?'var(--success)':'var(--danger)'}"><div style="display:flex; justify-content:space-between"><div>${t.ticker}</div><span class="${isWin?'text-green':'text-danger'}">${window.formatMoney(t.realizedPnL)}</span></div></div>`;
            } else {
                list.innerHTML += `<div class="glass-card" style="padding:15px; border-right:4px solid var(--primary)"><div style="display:flex; justify-content:space-between"><div>${t.ticker}</div><div>${t.currentQty} سهم</div></div><button class="btn-add-stylish" style="width:100%; margin-top:10px; justify-content:center" onclick="window.tradeAction('${t.id}')">إدارة</button></div>`;
            }
        });
        document.getElementById('j-open-count').textContent = count;
        document.getElementById('j-total-pnl').textContent = window.formatMoney(totalPnl);
    });
}

function setupBackupListeners() {
    document.getElementById('backup-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => window.importBackupData(JSON.parse(ev.target.result));
        reader.readAsText(file);
    });
}
window.exportBackup = async () => alert("قريباً");
window.importBackupData = async () => alert("قريباً");