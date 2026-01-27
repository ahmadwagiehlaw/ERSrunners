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
let pListUnsub = null;
let journalUnsub = null;
let detailsUnsub = null;
let currentBroker = 'thndr';

// === بيانات السوق (مع تحديث حي) ===
const marketData = {
    USD: { val: 50.80, icon: 'fa-dollar-sign', label: 'USD/EGP', change: 0, lastUpdate: null },
    ALUMINUM: { val: 2485.00, icon: 'fa-layer-group', label: 'Aluminum ($/MT)', change: 0, lastUpdate: null },
    GOLD: { val: 2735.00, icon: 'fa-ring', label: 'Gold ($/oz)', change: 0, lastUpdate: null }
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
    if (navBtn) navBtn.classList.add('active');
};

window.showModal = (html) => {
    const box = document.getElementById('modal-box');
    const overlay = document.getElementById('modal-overlay');
    box.innerHTML = html + '<button class="btn-text" onclick="window.closeModal()" style="position:absolute; top:15px; left:15px; color:#666; font-size:1.2rem"><i class="fa-solid fa-xmark"></i></button>';
    overlay.classList.remove('hidden');
};


window.closeModal = () => document.getElementById('modal-overlay').classList.add('hidden');

// === نظام Toast للإشعارات ===
window.showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${message}`;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// === نظام الأسعار الحية ===
async function fetchMarketData() {
    try {
        // محاكاة جلب الأسعار الحية (يمكن استبدالها بـ API حقيقي)
        marketData.USD.val += (Math.random() - 0.5) * 0.02;
        marketData.ALUMINUM.val += (Math.random() - 0.5) * 5;
        marketData.GOLD.val += (Math.random() - 0.5) * 2;

        Object.keys(marketData).forEach(key => {
            const prev = marketData[key].lastUpdate || marketData[key].val;
            marketData[key].change = ((marketData[key].val - prev) / prev) * 100;
            marketData[key].lastUpdate = marketData[key].val;
        });

        renderMarketGrid();
    } catch (err) {
        console.error('خطأ في تحديث الأسعار:', err);
    }
}

function renderMarketGrid() {
    const grid = document.getElementById('market-grid');
    if (!grid) return;

    grid.innerHTML = Object.entries(marketData).map(([key, data]) => {
        const changeClass = data.change > 0 ? 'positive' : data.change < 0 ? 'negative' : '';
        const changeIcon = data.change > 0 ? 'fa-arrow-up' : data.change < 0 ? 'fa-arrow-down' : 'fa-minus';

        return `
            <div class="market-item glass-card">
                <div class="market-icon"><i class="fa-solid ${data.icon}"></i></div>
                <div class="market-info">
                    <div class="market-label">${data.label}</div>
                    <div class="market-value">${data.val.toFixed(2)}</div>
                    <div class="market-change ${changeClass}">
                        <i class="fa-solid ${changeIcon}"></i> ${Math.abs(data.change).toFixed(2)}%
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // تحديث ticker bar
    const tickerBar = document.getElementById('ticker-bar');
    if (tickerBar) {
        const tickerHTML = Object.entries(marketData).map(([key, data]) => {
            const changeClass = data.change >= 0 ? 'text-green' : 'text-danger';
            const changeIcon = data.change >= 0 ? '▲' : '▼';
            return `<span>${data.label}: ${data.val.toFixed(2)} <span class="${changeClass}">${changeIcon} ${Math.abs(data.change).toFixed(2)}%</span></span>`;
        }).join(' &nbsp;•&nbsp; ');

        tickerBar.innerHTML = tickerHTML + ' &nbsp;•&nbsp; ' + tickerHTML; // تكرار للتأثير المستمر
    }
}

// === Loading Overlay ===
function showLoading() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(overlay);
    }
    overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
}


// === التهيئة ===
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('✅ تسجيل دخول ناجح:', user.email);
        window.setView('dashboard');
        loadMarketData();
        loadPortfolios(); // بدون معاملات
        loadJournalTrades('OPEN');
    } else {
        console.log('⚠️ لم يتم تسجيل الدخول');
        window.setView('auth');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-btn')?.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        try { await signInWithEmailAndPassword(auth, email, pass); }
        catch { try { await createUserWithEmailAndPassword(auth, email, pass); } catch (e) { alert(e.message); } }
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

// === بيانات السوق والمحافظ ===
async function loadMarketData() {
    console.log('🔄 بدء تحديث أسعار السوق...');

    // 1. تحديث سعر الدولار (USD/EGP) ✅
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data && data.rates && data.rates.EGP) {
            const oldVal = marketData.USD.val;
            marketData.USD.val = data.rates.EGP;
            marketData.USD.change = oldVal > 0 ? ((data.rates.EGP - oldVal) / oldVal) * 100 : 0;
            marketData.USD.lastUpdate = new Date();
            console.log('✅ USD/EGP:', data.rates.EGP);
        }
    } catch (e) {
        console.error('❌ فشل تحميل سعر الدولار:', e.message);
    }

    // 2. تحديث سعر الذهب (Gold) - استخدام CORS proxy مع Yahoo Finance
    try {
        // استخدام CORS proxy للتغلب على منع المتصفح
        const corsProxy = 'https://api.allorigins.win/raw?url=';
        const yahooUrl = encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d');
        const goldRes = await fetch(corsProxy + yahooUrl);
        const goldData = await goldRes.json();

        if (goldData && goldData.chart && goldData.chart.result && goldData.chart.result[0]) {
            const result = goldData.chart.result[0];
            const currentPrice = result.meta.regularMarketPrice || result.meta.previousClose;

            if (currentPrice) {
                const oldGold = marketData.GOLD.val;
                marketData.GOLD.val = currentPrice;
                marketData.GOLD.change = oldGold > 0 ? ((currentPrice - oldGold) / oldGold) * 100 : 0;
                marketData.GOLD.lastUpdate = new Date();
                console.log('✅ Gold Price:', currentPrice);
            }
        }
    } catch (e) {
        console.error('❌ فشل تحميل سعر الذهب:', e.message);

        // Fallback: استخدام API بديل
        try {
            const fallbackRes = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
            const fallbackData = await fallbackRes.json();

            if (fallbackData && fallbackData.items && fallbackData.items.length > 0) {
                const xauPrice = fallbackData.items[0].xauPrice;
                if (xauPrice) {
                    const pricePerOz = parseFloat(xauPrice);
                    const oldGold = marketData.GOLD.val;
                    marketData.GOLD.val = pricePerOz;
                    marketData.GOLD.change = oldGold > 0 ? ((pricePerOz - oldGold) / oldGold) * 100 : 0;
                    marketData.GOLD.lastUpdate = new Date();
                    console.log('✅ Gold Price (Fallback):', pricePerOz);
                }
            }
        } catch (fallbackError) {
            console.error('❌ فشل المصدر البديل للذهب:', fallbackError.message);
        }
    }

    // 3. تحديث سعر الألمونيوم (Aluminum) - مع CORS proxy
    try {
        const corsProxy = 'https://api.allorigins.win/raw?url=';
        const yahooUrl = encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/ALI=F?interval=1d&range=1d');
        const alRes = await fetch(corsProxy + yahooUrl);
        const alData = await alRes.json();

        if (alData && alData.chart && alData.chart.result && alData.chart.result[0]) {
            const result = alData.chart.result[0];
            const currentPrice = result.meta.regularMarketPrice || result.meta.previousPrice;

            if (currentPrice) {
                const oldAl = marketData.ALUMINUM.val;
                marketData.ALUMINUM.val = currentPrice;
                marketData.ALUMINUM.change = oldAl > 0 ? ((currentPrice - oldAl) / oldAl) * 100 : 0;
                marketData.ALUMINUM.lastUpdate = new Date();
                console.log('✅ Aluminum Price:', currentPrice);
            }
        }
    } catch (e) {
        console.error('❌ فشل تحميل سعر الألمونيوم:', e.message);
    }

    renderTicker();
    console.log('✅ تم تحديث الأسعار بنجاح!');

    // تحديث تلقائي كل 5 دقائق
    if (marketInterval) clearInterval(marketInterval);
    marketInterval = setInterval(() => loadMarketData(), 5 * 60 * 1000);
}

function renderTicker() {
    const bar = document.getElementById('ticker-bar');
    if (!bar) return;
    let html = ``;
    html += createTickerItem(marketData.USD);
    html += `<div class="sep"></div>`;
    html += createTickerItem(marketData.ALUMINUM);
    html += `<div class="sep"></div>`;
    html += createTickerItem(marketData.GOLD);
    bar.innerHTML = html;
}

function createTickerItem(item) {
    const changeClass = item.change > 0 ? 'text-green' : item.change < 0 ? 'text-danger' : '';
    const changeIcon = item.change > 0 ? 'fa-arrow-up' : item.change < 0 ? 'fa-arrow-down' : '';
    const changeDisplay = item.change !== 0 ? `<i class="fa-solid ${changeIcon}" style="font-size:0.6rem; margin-left:3px"></i>` : '';

    return `
        <div class="ticker-item">
            <div class="t-label"><i class="fa-solid ${item.icon}" style="color:var(--gold)"></i> ${item.label}</div>
            <div class="t-val ${changeClass}">${item.val.toFixed(2)} ${changeDisplay}</div>
        </div>
    `;
}

// ثابت سعر الصرف (مؤقتاً)
const USD_RATE = 50.5;

// ... (Authentication logic remains the same)

function loadPortfolios() {
    if (pListUnsub) pListUnsub();
    const q = query(collection(db, "users", auth.currentUser.uid, "portfolios"));
    const list = document.getElementById('portfolios-container');

    pListUnsub = onSnapshot(q, (snap) => {
        list.innerHTML = '';
        let totalNetWorthEGP = 0;
        let totalInvestedEGP = 0;

        let bestPerformer = null;
        let worstPerformer = null;
        let bestGain = -Infinity;
        let worstGain = Infinity;

        if (snap.empty) {
            list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-folder-plus empty-icon"></i><p>لا توجد محافظ. أنشئ محفظتك الأولى!</p></div>';
            document.getElementById('total-net-worth').textContent = window.formatMoney(0);
            return;
        }

        const gridContainer = document.createElement('div');
        gridContainer.className = 'portfolios-grid';

        snap.forEach(d => {
            const p = { id: d.id, ...d.data() };
            const currency = p.currency || 'EGP'; // Default EGP
            const isUSD = currency === 'USD';

            const value = p.currentValue || 0;
            const initial = p.initialCapital || 0;

            // تحويل للجنيه لحساب الإجمالي العام
            const valInEGP = isUSD ? value * USD_RATE : value;
            const initInEGP = isUSD ? initial * USD_RATE : initial;

            totalNetWorthEGP += valInEGP;
            totalInvestedEGP += initInEGP;

            // حساب الربح للمحفظة (بعملتها الأصلية)
            const profit = value - initial;
            const profitPercent = initial > 0 ? ((profit / initial) * 100) : 0;

            // Track Best/Worst
            if (profitPercent > bestGain) { bestGain = profitPercent; bestPerformer = p.name; }
            if (profitPercent < worstGain) { worstGain = profitPercent; worstPerformer = p.name; }

            // تحديد الرمز
            const currSymbol = isUSD ? '$' : 'EGP';
            const formattedValue = isUSD ? '$' + value.toLocaleString() : window.formatMoney(value);

            // ... (Card Creation Logic)
            const card = document.createElement('div');
            // ... (Rest is similar, just using formattedValue)
            let statusClass = 'neutral';
            if (profitPercent > 0.1) statusClass = 'winning';
            else if (profitPercent < -0.1) statusClass = 'losing';

            const profitColor = profit >= 0 ? 'text-green' : 'text-danger';
            const profitIcon = profit >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

            card.className = `portfolio-card ${statusClass}`;
            card.onclick = () => window.openPortfolio(p.id);

            // تخزين البيانات
            card.dataset.profitPercent = profitPercent;
            card.dataset.portfolioId = p.id;

            card.innerHTML = `
                <div class="pc-header">
                    <div>
                        <div class="pc-name">${p.name}</div>
                        <div class="pc-label">محفظة ${currency}</div>
                    </div>
                    <div class="pc-icon">
                        <i class="fa-solid fa-briefcase"></i>
                    </div>
                </div>
                <div class="pc-value" dir="ltr">${formattedValue}</div>
                <div class="pc-profit ${profitColor}" dir="ltr">
                    <i class="fa-solid ${profitIcon}"></i>
                    ${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(1)}%
                </div>
                <div class="performance-badge" style="display:none;"></div>
            `;
            gridContainer.appendChild(card);
        });

        list.appendChild(gridContainer);

        // إضافة Badges (نفس الكود السابق)
        if (snap.size > 1) { /* ... same badge logic ... */
            const cards = gridContainer.querySelectorAll('.portfolio-card');
            cards.forEach(card => {
                const badge = card.querySelector('.performance-badge');
                if (bestPerformer && card.querySelector('.pc-name').textContent === bestPerformer && bestGain > 0) {
                    badge.innerHTML = '<i class="fa-solid fa-trophy"></i>';
                    badge.className = 'performance-badge best';
                    badge.style.display = 'flex';
                } else if (worstPerformer && card.querySelector('.pc-name').textContent === worstPerformer && worstGain < 0) {
                    badge.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i>';
                    badge.className = 'performance-badge worst';
                    badge.style.display = 'flex';
                }
            });
        }

        // تحديث Dashboard Analytics (بالجنيه المصري)
        document.getElementById('total-net-worth').textContent = window.formatMoney(totalNetWorthEGP);
        document.getElementById('total-invested').textContent = window.formatMoney(totalInvestedEGP);
        document.getElementById('portfolios-count').textContent = snap.size;

        const totalPnl = totalNetWorthEGP - totalInvestedEGP;
        const pnlEl = document.getElementById('total-pnl');
        pnlEl.textContent = window.formatMoney(totalPnl);
        pnlEl.className = `stat-value ${totalPnl >= 0 ? 'text-green' : 'text-danger'}`;

        const totalRoi = totalInvestedEGP > 0 ? (totalPnl / totalInvestedEGP) * 100 : 0;
        const wealthChangeEl = document.getElementById('wealth-change');
        const icon = totalRoi >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        wealthChangeEl.className = `wealth-change ${totalRoi < 0 ? 'negative' : ''}`;
        wealthChangeEl.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${totalRoi >= 0 ? '+' : ''}${totalRoi.toFixed(1)}%</span>`;

        // تهيئة Lottie Animation للثروة
        const lottieWealth = document.getElementById('lottie-wealth');
        if (lottieWealth && typeof lottie !== 'undefined' && !lottieWealth.hasAttribute('data-loaded')) {
            lottie.loadAnimation({
                container: lottieWealth,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: 'https://assets10.lottiefiles.com/packages/lf20_06a6pf9i.json' // Money/Wealth animation
            });
            lottieWealth.setAttribute('data-loaded', 'true');
        }
    });
}

window.submitNewPortfolio = async () => {
    const name = document.getElementById('new-p-name').value;
    const cap = parseFloat(document.getElementById('new-p-cap').value);
    // الحصول على العملة المختارة
    const currency = document.querySelector('input[name="p-curr"]:checked').value;

    if (!name) {
        showToast('الرجاء إدخال اسم المحفظة', 'error');
        return;
    }

    showLoading();
    try {
        await addDoc(collection(db, "users", auth.currentUser.uid, "portfolios"), {
            name,
            initialCapital: cap || 0,
            currentValue: cap || 0, // القيمة الابتدائية تساوي رأس المال
            currency: currency,
            createdAt: serverTimestamp()
        });
        showToast('تم إنشاء المحفظة بنجاح', 'success');
        window.closeModal();
    } catch (e) {
        showToast('فشل إنشاء المحفظة: ' + e.message, 'error');
    } finally {
        hideLoading();
    }
};

window.openPortfolio = (pid) => {
    currentPortfolioId = pid;
    window.setView('details');
    loadPortfolioDetails(pid);
};

// متغير لتخزين الرسم البياني الحالي ومنع تداخل الرسومات
let currentChart = null;

// متغير عام لتخزين العملة الحالية للمحفظة المفتوحة
let currentPortfolioCurrency = 'EGP';

function loadPortfolioDetails(pid) {
    if (detailsUnsub) detailsUnsub();

    const pRef = doc(db, "users", auth.currentUser.uid, "portfolios", pid);

    onSnapshot(pRef, (s) => {
        if (s.exists()) {
            const data = s.data();
            currentPortfolioCurrency = data.currency || 'EGP';
            const isUSD = currentPortfolioCurrency === 'USD';
            const currSymbol = isUSD ? '$' : 'EGP';

            const currentVal = data.currentValue || 0;
            const initialCap = data.initialCapital || 0; // This is now "Net Invested Capital"

            document.getElementById('d-p-name').textContent = data.name;
            document.getElementById('d-p-currency').textContent = currSymbol;

            const displayVal = isUSD ? currentVal.toLocaleString() : window.formatMoney(currentVal).replace('EGP', '').trim();
            document.getElementById('d-p-val').textContent = displayVal;
            document.getElementById('d-p-val').dataset.initialCap = initialCap;

            // حساب الربح: القيمة الحالية - صافي رأس المال المستثمر
            const profit = currentVal - initialCap;
            const profitPercent = initialCap > 0 ? (profit / initialCap) * 100 : 0;

            const profitText = isUSD ? '$' + profit.toLocaleString() : window.formatMoney(profit);
            document.getElementById('d-p-profit').textContent = profitText;
            document.getElementById('d-p-roi').textContent = (profit >= 0 ? '+' : '') + profitPercent.toFixed(1) + '%';

            updateHeroColors(profit);
        }
    });

    // مراقبة سجل التاريخ (History Log)
    const q = query(collection(db, "users", auth.currentUser.uid, "portfolios", pid, "history"), orderBy("date", "desc"), limit(50));
    detailsUnsub = onSnapshot(q, (snap) => {
        const list = document.getElementById('history-list-body');
        const emptyState = document.getElementById('history-empty-state');
        const table = document.getElementById('valuation-history-table');

        list.innerHTML = '';

        if (snap.empty) {
            emptyState.classList.remove('hidden');
            table.classList.add('hidden');
            // If no history, maybe just one point for chart?
            renderHistoryChart([], 0);
        } else {
            emptyState.classList.add('hidden');
            table.classList.remove('hidden');

            let historyData = [];
            snap.forEach(d => {
                historyData.push({ id: d.id, ...d.data() });
            });

            // الرسم البياني (يحتاج ترتيب تصاعدي)
            const chartData = [...historyData].reverse();
            renderHistoryChart(chartData);

            historyData.forEach((h, index) => {
                const isUSD = currentPortfolioCurrency === 'USD';
                const valDisplay = isUSD ? '$' + h.value.toLocaleString() : window.formatMoney(h.value);

                let actionBadge = '<span class="badge-text">تحديث</span>';
                if (h.type === 'DEPOSIT') actionBadge = '<span class="badge-text success">إيداع</span>';
                else if (h.type === 'WITHDRAW') actionBadge = '<span class="badge-text danger">سحب</span>';

                // حساب التغير عن السجل السابق
                let changeHtml = '<span class="text-muted">--</span>';
                if (index < historyData.length - 1) {
                    const prev = historyData[index + 1].value;
                    // لو كان فيه إيداع/سحب، المفروض نخصمهم من الحسبة عشان نعرف الأداء الحقيقي؟
                    // حالياً هنعرض التغير البسيط في القيمة السوقية
                    const diff = h.value - prev;
                    const per = prev > 0 ? (diff / prev) * 100 : 0;
                    const colorClass = diff >= 0 ? 'text-green' : 'text-danger';
                    const sign = diff >= 0 ? '+' : '';
                    changeHtml = `<span class="${colorClass}" dir="ltr">${sign}${per.toFixed(2)}%</span>`;
                }

                const dateObj = h.date.toDate ? h.date.toDate() : new Date(h.date);
                const dateStr = dateObj.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' });

                list.innerHTML += `
                    <tr>
                        <td>${dateStr}</td>
                        <td style="font-weight:bold; font-family:'Inter'">${valDisplay}</td>
                        <td>${actionBadge}</td>
                        <td>${changeHtml}</td>
                    </tr>
                `;
            });
        }
    });
}

function updateHeroColors(profit) {
    const pnlIconBox = document.getElementById('pnl-icon-box');
    const roiIconBox = document.getElementById('roi-icon-box');

    if (profit >= 0) {
        if (pnlIconBox) { pnlIconBox.style.color = 'var(--success)'; pnlIconBox.style.background = 'rgba(48, 209, 88, 0.1)'; }
        if (roiIconBox) { roiIconBox.style.color = 'var(--success)'; roiIconBox.style.background = 'rgba(48, 209, 88, 0.1)'; }
        document.getElementById('d-p-profit').className = 'stat-number-small text-green';
        document.getElementById('d-p-roi').className = 'stat-number-small text-green';
    } else {
        if (pnlIconBox) { pnlIconBox.style.color = 'var(--danger)'; pnlIconBox.style.background = 'rgba(255, 69, 58, 0.1)'; }
        if (roiIconBox) { roiIconBox.style.color = 'var(--danger)'; roiIconBox.style.background = 'rgba(255, 69, 58, 0.1)'; }
        document.getElementById('d-p-profit').className = 'stat-number-small text-danger';
        document.getElementById('d-p-roi').className = 'stat-number-small text-danger';
    }
}

// فتح مودال التحديث المتقدم
window.updateCurrentBalance = () => {
    if (!currentPortfolioId) return;

    const currentValText = document.getElementById('d-p-val').textContent;
    const currentVal = parseFloat(currentValText.replace(/[^0-9.-]+/g, ""));

    document.getElementById('ub-value').value = currentVal;
    document.getElementById('ub-date').valueAsDate = new Date();

    document.getElementById('type-none').checked = true;
    window.toggleCashFlowInput();
    document.getElementById('ub-cash-amount').value = '';

    document.getElementById('update-balance-modal').showModal();
};

window.toggleCashFlowInput = () => {
    const type = document.querySelector('input[name="ub-type"]:checked').value;
    const container = document.getElementById('cash-flow-input-container');
    if (type === 'NONE') {
        container.classList.add('hidden');
    } else {
        container.classList.remove('hidden');
    }
};

window.closeModal = () => {
    document.querySelectorAll('.modal').forEach(m => m.close());
};

window.submitBalanceUpdate = async () => {
    const val = parseFloat(document.getElementById('ub-value').value);
    const dateVal = document.getElementById('ub-date').value;
    const type = document.querySelector('input[name="ub-type"]:checked').value;

    if (isNaN(val) || !dateVal) {
        showToast("البيانات غير مكتملة", "error");
        return;
    }

    let cashAmount = 0;
    if (type !== 'NONE') {
        cashAmount = parseFloat(document.getElementById('ub-cash-amount').value);
        if (isNaN(cashAmount)) {
            showToast("الرجاء إدخال المبلغ", "error");
            return;
        }
    }

    showLoading();
    try {
        const pRef = doc(db, "users", auth.currentUser.uid, "portfolios", currentPortfolioId);

        await runTransaction(db, async (txn) => {
            const pDoc = await txn.get(pRef);
            if (!pDoc.exists) throw "Portfolio not found";

            const currentData = pDoc.data();
            let newCapital = currentData.initialCapital || 0;

            // تحديث رأس المال المستثمر بناءً على حركة الأموال
            if (type === 'DEPOSIT') newCapital += cashAmount;
            if (type === 'WITHDRAW') newCapital -= cashAmount;

            // إضافة سجل للتاريخ
            const historyRef = doc(collection(pRef, "history"));
            txn.set(historyRef, {
                date: new Date(dateVal),
                value: val,
                type: type,
                cashAmount: cashAmount,
                createdAt: serverTimestamp()
            });

            // تحديث حالة المحفظة
            txn.update(pRef, {
                currentValue: val,
                initialCapital: newCapital
            });
        });

        showToast("تم تحديث السجل بنجاح", "success");
        window.closeModal();
    } catch (e) {
        console.error(e);
        showToast("حدث خطأ: " + e.message, "error");
    } finally {
        hideLoading();
    }
};

window.editPortfolioCapital = async () => {
    if (!currentPortfolioId) return;
    const valEl = document.getElementById('d-p-val');
    const initialCap = valEl.dataset.initialCap ? parseFloat(valEl.dataset.initialCap) : 0;
    const newCap = prompt("أدخل صافي رأس المال المستثمر (Initial Capital):", initialCap);
    if (newCap !== null && !isNaN(newCap) && newCap.trim() !== "") {
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid, "portfolios", currentPortfolioId), {
                initialCapital: parseFloat(newCap)
            });
            showToast("تم تحديث رأس المال بنجاح", "success");
        } catch (e) {
            showToast("فشل التحديث: " + e.message, "error");
        }
    }
};

window.updateChartFilter = (period) => {
    // الفلاتر هنا ممكن تبقى client-side filtering للـ historyData الموجودة
    // حالياً هنسبها 1W افتراضي ونرسم كل الداتا المتاحة لحد ما نطبق منطق الفلترة
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    // TODO: Implement actual filtering logic on the cached historyData
};

function renderHistoryChart(data) {
    const ctx = document.getElementById('portfolioChart').getContext('2d');
    if (currentChart) currentChart.destroy();

    // if empty
    if (!data || data.length === 0) {
        // Maybe render empty chart or placeholder
        return;
    }

    const labels = data.map(d => {
        const date = d.date.toDate ? d.date.toDate() : new Date(d.date);
        return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
    });
    const values = data.map(d => d.value);

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'قيمة المحفظة',
                data: values,
                borderColor: '#0a84ff',
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(10, 132, 255, 0.2)');
                    gradient.addColorStop(1, 'rgba(10, 132, 255, 0)');
                    return gradient;
                },
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    backgroundColor: 'rgba(28,28,30,0.9)',
                    callbacks: {
                        label: function (context) {
                            return ' ' + window.formatMoney(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#8e8e93' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { display: false }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });




    window.deleteCurrentPortfolio = async () => {
        if (confirm('حذف المحفظة؟ لا يمكن التراجع عن هذا الإجراء.')) {
            showLoading();
            try {
                await deleteDoc(doc(db, "users", auth.currentUser.uid, "portfolios", currentPortfolioId));
                showToast('تم حذف المحفظة بنجاح', 'success');
                window.setView('dashboard');
            } catch (e) {
                showToast('فشل حذف المحفظة: ' + e.message, 'error');
            } finally {
                hideLoading();
            }
        }
    };

    function renderChart(data) {
        const ctx = document.getElementById('portfolioChart')?.getContext('2d');
        if (!ctx) return;
        if (chartInstance) chartInstance.destroy();
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
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { color: '#aaa', font: { family: 'Cairo' } } } } }
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
        if (!ticker) {
            showToast('الرجاء إدخال رمز السهم', 'error');
            return;
        }

        showLoading();
        try {
            await addDoc(collection(db, "users", auth.currentUser.uid, "trades"), {
                ticker, side: document.getElementById('t-side').value,
                target1: parseFloat(document.getElementById('t-tp').value),
                stopLoss: parseFloat(document.getElementById('t-sl').value),
                status: 'OPEN', createdAt: serverTimestamp(), realizedPnL: 0, avgPrice: 0, currentQty: 0
            });
            showToast('تم إضافة الصفقة بنجاح', 'success');
            window.closeModal();
            loadJournalTrades('OPEN');
        } catch (e) {
            showToast('فشل إضافة الصفقة: ' + e.message, 'error');
        } finally {
            hideLoading();
        }
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
        <h3 style="text-align:center">${type === 'BUY' ? 'شراء' : 'بيع'}</h3>
        <input id="e-qty" type="number" placeholder="الكمية">
        <input id="e-price" type="number" placeholder="السعر">
        <button class="btn-primary" onclick="window.submitExecution('${tid}', '${type}')">تأكيد</button>
    `);
    };

    window.submitExecution = async (tid, type) => {
        const qty = parseFloat(document.getElementById('e-qty').value);
        const price = parseFloat(document.getElementById('e-price').value);
        if (!qty || !price) return;
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
        if (confirm('تأكيد الإغلاق؟')) {
            await updateDoc(doc(db, "users", auth.currentUser.uid, "trades", tid), { status: 'CLOSED' });
            window.closeModal();
        }
    };

    async function loadJournalTrades(filter) {
        const list = document.getElementById('journal-list');
        if (journalUnsub) journalUnsub();
        const q = query(collection(db, "users", auth.currentUser.uid, "trades"), orderBy("createdAt", "desc"));
        journalUnsub = onSnapshot(q, (snap) => {
            list.innerHTML = '';
            let count = 0; let totalPnl = 0;
            snap.forEach(d => {
                const t = { id: d.id, ...d.data() };
                if (t.status === 'OPEN') count++;
                totalPnl += (t.realizedPnL || 0);
                if (t.status !== filter) return;
                const isWin = (t.realizedPnL || 0) >= 0;
                if (filter === 'CLOSED') {
                    list.innerHTML += `<div class="glass-card" style="padding:15px; border-right:4px solid ${isWin ? 'var(--success)' : 'var(--danger)'}"><div style="display:flex; justify-content:space-between"><div>${t.ticker}</div><span class="${isWin ? 'text-green' : 'text-danger'}">${window.formatMoney(t.realizedPnL)}</span></div></div>`;
                } else {
                    list.innerHTML += `<div class="glass-card" style="padding:15px; border-right:4px solid var(--primary)"><div style="display:flex; justify-content:space-between"><div>${t.ticker}</div><div>${t.currentQty} سهم</div></div><button class="btn-add-stylish" style="width:100%; margin-top:10px; justify-content:center" onclick="window.tradeAction('${t.id}')">إدارة</button></div>`;
                }
            });
            document.getElementById('j-open-count').textContent = count;
            document.getElementById('j-total-pnl').textContent = window.formatMoney(totalPnl);

            // حساب R/R العام
            calculateGlobalRR(openTrades);
        });
    }

    function calculateGlobalRR(trades) {
        const validTrades = trades.filter(t => t.target1 && t.stopLoss && t.avgPrice && t.avgPrice > 0);

        const rrEl = document.getElementById('global-rr');
        if (!rrEl) return;

        if (validTrades.length === 0) {
            rrEl.textContent = '--';
            rrEl.style.color = 'var(--text-secondary)';
            return;
        }

        let totalRR = 0;
        validTrades.forEach(t => {
            const profitPer = Math.abs(((t.target1 - t.avgPrice) / t.avgPrice) * 100);
            const lossPer = Math.abs(((t.stopLoss - t.avgPrice) / t.avgPrice) * 100);
            if (lossPer > 0) {
                totalRR += profitPer / lossPer;
            }
        });

        const avgRR = totalRR / validTrades.length;
        rrEl.textContent = `1 : ${avgRR.toFixed(1)}`;
        rrEl.style.color = avgRR >= 2 ? 'var(--success)' : avgRR >= 1 ? 'var(--gold)' : 'var(--danger)';
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
    window.exportBackup = async () => {
        showLoading();
        try {
            const uid = auth.currentUser.uid;
            const portfoliosSnap = await getDocs(collection(db, "users", uid, "portfolios"));
            const tradesSnap = await getDocs(collection(db, "users", uid, "trades"));

            const backupData = {
                version: "2.0",
                exportDate: new Date().toISOString(),
                portfolios: [],
                trades: []
            };

            // جمع المحافظ والأصول
            for (const pDoc of portfoliosSnap.docs) {
                const assetsSnap = await getDocs(collection(db, "users", uid, "portfolios", pDoc.id, "assets"));
                backupData.portfolios.push({
                    id: pDoc.id,
                    data: pDoc.data(),
                    assets: assetsSnap.docs.map(a => ({ id: a.id, ...a.data() }))
                });
            }

            // جمع الصفقات
            backupData.trades = tradesSnap.docs.map(t => ({ id: t.id, ...t.data() }));

            // تحميل الملف
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `my-wealth-backup-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);

            showToast('تم تصدير النسخة الاحتياطية بنجاح', 'success');
        } catch (e) {
            showToast('فشل التصدير: ' + e.message, 'error');
        } finally {
            hideLoading();
        }
    };

    window.importBackupData = async (data) => {
        if (!confirm('هل تريد استيراد هذه النسخة؟ سيتم دمجها مع البيانات الحالية.')) return;

        showLoading();
        try {
            const uid = auth.currentUser.uid;

            // استيراد المحافظ
            for (const portfolio of data.portfolios) {
                const pRef = await addDoc(collection(db, "users", uid, "portfolios"), portfolio.data);

                // استيراد الأصول
                for (const asset of portfolio.assets) {
                    await addDoc(collection(db, "users", uid, "portfolios", pRef.id, "assets"), asset);
                }
            }

            // استيراد الصفقات
            for (const trade of data.trades) {
                await addDoc(collection(db, "users", uid, "trades"), trade);
            }


            showToast('تم استيراد النسخة الاحتياطية بنجاح', 'success');
            window.setView('dashboard');
        } catch (e) {
            showToast('فشل الاستيراد: ' + e.message, 'error');
        } finally {
            hideLoading();
        }
    };

    /* --- Journal V2 Logic --- */

    // Global variable for journal unsubscribe
    let journalUnsub = null;

    window.loadJournal = () => {
        if (journalUnsub) journalUnsub();

        const q = query(collection(db, "users", auth.currentUser.uid, "trades"), orderBy("date", "desc"), limit(50));

        journalUnsub = onSnapshot(q, (snap) => {
            let trades = [];
            snap.forEach(d => trades.push({ id: d.id, ...d.data() }));

            updateJournalStats(trades);
            renderJournalTimeline(trades);
        });
    };

    function updateJournalStats(trades) {
        if (trades.length === 0) {
            document.getElementById('j-winrate').textContent = '--%';
            document.getElementById('j-avg-rr').textContent = '--';
            document.getElementById('j-total-trades').textContent = '0';
            return;
        }

        let wins = 0;
        let totalRR = 0;
        let rrCount = 0;

        trades.forEach(t => {
            if (t.result === 'WIN') wins++;
            if (t.rr) {
                totalRR += parseFloat(t.rr);
                rrCount++;
            }
        });

        const winRate = ((wins / trades.length) * 100).toFixed(0);
        const avgRR = rrCount > 0 ? (totalRR / rrCount).toFixed(2) : '--';

        document.getElementById('j-winrate').textContent = winRate + '%';
        document.getElementById('j-avg-rr').textContent = avgRR;
        document.getElementById('j-total-trades').textContent = trades.length;
    }

    function renderJournalTimeline(trades) {
        const timeline = document.getElementById('journal-timeline');
        timeline.innerHTML = '';

        if (trades.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-book-open"></i>
                    <p>No trades yet. Start capturing your lessons!</p>
                </div>`;
            return;
        }

        trades.forEach(t => {
            const dateObj = t.date.toDate ? t.date.toDate() : new Date(t.date);
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const isWin = t.result === 'WIN';
            const resultClass = isWin ? 'win' : (t.result === 'LOSS' ? 'loss' : '');
            const pnlColor = isWin ? 'text-green' : (t.result === 'LOSS' ? 'text-danger' : '');
            const profitSign = t.profit > 0 ? '+' : '';
            const profitDisplay = t.profit ? `<span class="${pnlColor}">${profitSign}$${t.profit}</span>` : '';

            timeline.innerHTML += `
                <div class="timeline-item ${resultClass}">
                    <div class="trade-card">
                        <div class="trade-header">
                            <span class="trade-ticker">${t.ticker}</span>
                            <span class="trade-pnl">${profitDisplay}</span>
                        </div>
                        <div style="font-size:0.8rem; color:#888; margin-bottom:5px;">
                            ${t.type} • ${dateStr} • ${t.setup || 'No Setup'}
                        </div>
                        ${t.lesson ? `<div class="trade-lesson">"${t.lesson}"</div>` : ''}
                    </div>
                </div>
            `;
        });
    }

    window.showAddTradeModal = () => {
        // Dynamic Modal for Journal Entry
        const modalHtml = `
            <dialog id="journal-modal" class="modal">
                <div class="modal-content glass-card">
                    <h3>New Journal Entry</h3>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <input id="jt-ticker" placeholder="Ticker (e.g. AAPL)" style="text-transform:uppercase">
                        <select id="jt-type">
                            <option value="LONG">Long</option>
                            <option value="SHORT">Short</option>
                        </select>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                        <input id="jt-date" type="date">
                        <select id="jt-result">
                            <option value="WIN">Win</option>
                            <option value="LOSS">Loss</option>
                            <option value="BE">Break Even</option>
                        </select>
                    </div>

                    <div class="input-group" style="margin-top:10px;">
                        <input id="jt-setup" placeholder="Setup / Strategy (e.g. Breakout)">
                    </div>

                    <div class="input-group">
                        <input id="jt-rr" type="number" step="0.1" placeholder="Realized R:R (e.g. 2.5)">
                    </div>
                    
                    <div class="input-group">
                         <input id="jt-profit" type="number" placeholder="P&L Amount ($)">
                    </div>

                    <div class="input-group">
                        <textarea id="jt-lesson" rows="3" placeholder="What did you learn? (The most important part!)"></textarea>
                    </div>

                    <div class="modal-actions">
                        <button class="btn-text" onclick="document.getElementById('journal-modal').close()">Cancel</button>
                        <button class="btn-primary" onclick="window.submitJournalEntry()">Save Entry</button>
                    </div>
                </div>
            </dialog>
        `;

        // Check if exists, remove it first
        const existing = document.getElementById('journal-modal');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('journal-modal');
        document.getElementById('jt-date').valueAsDate = new Date();
        modal.showModal();
    };

    window.submitJournalEntry = async () => {
        const ticker = document.getElementById('jt-ticker').value.toUpperCase();
        const type = document.getElementById('jt-type').value;
        const date = document.getElementById('jt-date').value;
        const result = document.getElementById('jt-result').value;
        const setup = document.getElementById('jt-setup').value;
        const rr = document.getElementById('jt-rr').value;
        const profit = document.getElementById('jt-profit').value;
        const lesson = document.getElementById('jt-lesson').value;

        if (!ticker || !date) {
            showToast('Please enter at least Ticker and Date', 'error');
            return;
        }

        showLoading();
        try {
            await addDoc(collection(db, "users", auth.currentUser.uid, "trades"), {
                ticker, type,
                date: new Date(date),
                result, setup,
                rr: rr ? parseFloat(rr) : null,
                profit: profit ? parseFloat(profit) : 0,
                lesson,
                createdAt: serverTimestamp()
            });

            showToast('Journal Entry Saved!', 'success');
            document.getElementById('journal-modal').close();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        } finally {
            hideLoading();
        }
    };
