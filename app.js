/* ERS Runners - V1.18 (Golden Edition - Full Fix) */

const firebaseConfig = {
  apiKey: "AIzaSyCHod8qSDNzKDKxRHj1yQlWgNAPXFNdAyg",
  authDomain: "ers-runners-app.firebaseapp.com",
  projectId: "ers-runners-app",
  storageBucket: "ers-runners-app.firebasestorage.app",
  messagingSenderId: "493110452684",
  appId: "1:493110452684:web:db892ab6e6c88b3e6dbd69"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userData = {};
let isSignupMode = false;
let allUsersCache = []; 
let deferredPrompt; 

// --- Core Data Fetch ---
async function fetchTopRunners() {
    if (allUsersCache.length > 0) return allUsersCache;
    const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(50).get();
    allUsersCache = [];
    snap.forEach(doc => allUsersCache.push({id: doc.id, ...doc.data()}));
    return allUsersCache;
}

// --- Helpers ---
function getLocalInputDate() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0,16);
}

function getArabicTimeAgo(timestamp) {
    if (!timestamp) return "الآن";
    const diff = (new Date() - timestamp.toDate()) / 60000;
    if (diff < 1) return "الآن";
    if (diff < 60) return `${Math.floor(diff)} د`;
    if (diff < 1440) return `${Math.floor(diff/60)} س`;
    return `${Math.floor(diff/1440)} يوم`;
}

function formatNumber(num) {
    const n = parseFloat(num) || 0;
    return n.toFixed(1);
}

function getUserAvatar(user) {
    const isNew = (user.totalDist || 0) < 50;
    if (user.gender === 'female') return isNew ? '🐣' : '🏃‍♀️';
    return isNew ? '🐣' : '🏃';
}

// ==================== Auth ====================
function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    const fields = document.getElementById('signup-fields');
    const btn = document.getElementById('toggleAuthBtn');
    const mainBtn = document.querySelector('.auth-box .btn-primary');
    
    if (fields) fields.style.display = isSignupMode ? 'block' : 'none';
    if (btn) btn.innerText = isSignupMode ? "لديك حساب بالفعل؟ تسجيل الدخول" : "ليس لديك حساب؟ سجل الآن";
    if (mainBtn) mainBtn.innerText = isSignupMode ? "إنشاء حساب جديد" : "دخول";
}

async function handleAuth() {
    const emailEl = document.getElementById('email');
    const passEl = document.getElementById('password');
    const msgEl = document.getElementById('auth-msg');
    const activeBtn = document.querySelector('.auth-box .btn-primary');
    
    if (!emailEl || !passEl) return;
    const email = emailEl.value;
    const pass = passEl.value;
    if (msgEl) msgEl.innerText = "";

    const originalText = activeBtn.innerText;
    activeBtn.innerHTML = 'جاري الاتصال <span class="loader-btn"></span>';
    activeBtn.disabled = true;
    activeBtn.style.opacity = "0.7";

    try {
        if (!email || !pass) throw new Error("يرجى ملء البيانات");

        if (isSignupMode) {
            const name = document.getElementById('username').value;
            const region = document.getElementById('region').value;
            if (!name || !region) throw new Error("البيانات ناقصة");

            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await db.collection('users').doc(cred.user.uid).set({
                name: name, region: region, email: email,
                totalDist: 0, totalRuns: 0, badges: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await auth.signInWithEmailAndPassword(email, pass);
        }
    } catch (err) {
        if (msgEl) {
            if(err.code === 'auth/email-already-in-use') msgEl.innerText = "البريد مسجل مسبقاً";
            else if(err.code === 'auth/wrong-password') msgEl.innerText = "كلمة المرور خاطئة";
            else if(err.code === 'auth/user-not-found') msgEl.innerText = "مستخدم غير موجود";
            else if(err.code === 'auth/network-request-failed') msgEl.innerText = "مشكلة في الإنترنت ⚠️";
            else msgEl.innerText = "خطأ: " + err.message;
        }
        console.error(err);
        activeBtn.innerHTML = originalText;
        activeBtn.disabled = false;
        activeBtn.style.opacity = "1";
    }
}

function logout() {
    if(confirm("تسجيل خروج؟")) { auth.signOut(); window.location.reload(); }
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                userData = doc.data();
                // --- Ban Check ---
                if (userData.isBanned) {
                    alert(`⛔ تم حظر حسابك.\nالسبب: ${userData.banReason || "مخالفة الشروط"}`);
                    auth.signOut();
                    return;
                }
                if (!userData.badges) userData.badges = [];
                initApp();
            } else {
                userData = { name: "Runner", region: "Cairo", totalDist: 0, totalRuns: 0, badges: [] };
                initApp();
            }
        } catch (e) { console.error(e); }
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
});

// ==================== Init ====================
function initApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    
    const dateInput = document.getElementById('log-date');
    if(dateInput) dateInput.value = getLocalInputDate();

    updateUI();
    loadActivityLog();
    loadActiveChallenges(); 
    loadGlobalFeed();
    listenForNotifications();
    loadWeeklyChart();
    
    initNetworkMonitor();
    checkSharedData(); 
}

// ==================== UI Updates & Hero Card ====================
function updateUI() {
    try {
        const headerName = document.getElementById('headerName');
        if (headerName) headerName.innerText = userData.name || "Runner";

        const total = userData.totalDist || 0;
        const rankData = calculateRank(total);
        
        const statsCard = document.getElementById('user-stats-card');
        if (statsCard) {
            const nextMilestone = (Math.floor(total / 100) + 1) * 100;
            const progressToNext = total % 100;
            const calories = Math.floor(total * 60);

            let avatarIcon = '🏃';
            if (typeof getUserAvatar === 'function') avatarIcon = getUserAvatar(userData);
            if(rankData.name === 'أسطورة') avatarIcon = '👑';
            else if(rankData.name === 'محترف') avatarIcon = '🦅';

            statsCard.innerHTML = `
                <div style="padding: 20px; position:relative; z-index:2;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="bib-avatar" style="width:45px; height:45px; font-size:22px; background:rgba(255,255,255,0.1); border-radius:50%; display:flex; align-items:center; justify-content:center;">${avatarIcon}</div>
                            <div>
                                <div style="font-size:16px; font-weight:bold; color:#fff;">${userData.name || 'مستخدم'}</div>
                                <div style="font-size:11px; color:var(--primary);">${rankData.name}</div>
                            </div>
                        </div>
                        <div class="rank-badge" style="font-size:24px;">${rankData.icon}</div>
                    </div>
                    <div style="text-align:center; margin: 20px 0;">
                        <div style="font-size:36px; font-weight:900; line-height:1; color:#fff;">
                            ${formatNumber(total)} <span style="font-size:14px; color:#9ca3af; font-weight:normal;">كم</span>
                        </div>
                        <div style="font-size:11px; color:#6b7280; margin-top:5px;">إجمالي المسافة المقطوعة</div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:#9ca3af; margin-bottom:5px;">
                        <span>مستواك الحالي</span><span>هدف ${nextMilestone} كم</span>
                    </div>
                    <div class="progress-track" style="background:rgba(255,255,255,0.05); height:8px; border-radius:10px; overflow:hidden;">
                        <div class="progress-fill" style="width: ${progressToNext}%; background: linear-gradient(90deg, var(--primary) 0%, #34d399 100%); height:100%; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);"></div>
                    </div>
                    <div class="stats-footer-row" style="display:flex; justify-content:space-between; margin-top:20px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
                        <div class="mini-stat" style="text-align:center; flex:1;">
                            <span style="display:block; font-size:10px; color:#9ca3af;">هذا الشهر 📅</span><strong style="display:block; font-size:14px; color:var(--primary); margin-top:3px;">${formatNumber(userData.monthDist || 0)}</strong>
                        </div>
                        <div class="mini-stat" style="text-align:center; flex:1; border-right:1px solid rgba(255,255,255,0.1); border-left:1px solid rgba(255,255,255,0.1);">
                            <span style="display:block; font-size:10px; color:#9ca3af;">أنشطة 🏃</span><strong style="display:block; font-size:14px; color:#fff; margin-top:3px;">${userData.totalRuns || 0}</strong>
                        </div>
                        <div class="mini-stat" style="text-align:center; flex:1;">
                            <span style="display:block; font-size:10px; color:#9ca3af;">حرق 🔥</span><strong style="display:block; font-size:14px; color:#fff; margin-top:3px;">${calories > 1000 ? (calories/1000).toFixed(1) + 'k' : calories}</strong>
                        </div>
                    </div>
                </div>
            `;
        }

        renderBadges();
        if(typeof updateCoachAdvice === 'function') updateCoachAdvice();

        const adminBtn = document.getElementById('btn-admin-entry');
        if (adminBtn) adminBtn.style.display = (userData.isAdmin === true) ? 'flex' : 'none';

    } catch (error) { console.error("UI Error:", error); }
}

function calculateRank(totalDist) {
    const levels = [
        { name: "مبتدئ", min: 0, next: 50, avatar: "🥚" },
        { name: "هاوي", min: 50, next: 150, avatar: "🐣" },
        { name: "عداء", min: 150, next: 500, avatar: "🏃" },
        { name: "محترف", min: 500, next: 1000, avatar: "🦅" },
        { name: "أسطورة", min: 1000, next: 10000, avatar: "👑" }
    ];
    let currentLevel = levels[0];
    for (let i = levels.length - 1; i >= 0; i--) {
        if (totalDist >= levels[i].min) { currentLevel = levels[i]; break; }
    }
    return { name: currentLevel.name, icon: currentLevel.avatar };
}

// ==================== Weekly Chart (Fixed) ====================
function loadWeeklyChart() {
    const chartDiv = document.getElementById('weekly-chart');
    if(!chartDiv) return;
    const daysAr = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    let last7Days = [];
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const localKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        last7Days.push({ dayName: daysAr[d.getDay()], dateKey: localKey, dist: 0 });
    }
    const startDate = new Date(); startDate.setDate(startDate.getDate() - 7); startDate.setHours(0, 0, 0, 0);
    db.collection('users').doc(currentUser.uid).collection('runs').where('timestamp', '>=', startDate).get().then(snap => {
          snap.forEach(doc => {
              const run = doc.data();
              if(run.timestamp) {
                  const rDate = run.timestamp.toDate();
                  const rKey = rDate.getFullYear() + '-' + String(rDate.getMonth() + 1).padStart(2, '0') + '-' + String(rDate.getDate()).padStart(2, '0');
                  const targetDay = last7Days.find(d => d.dateKey === rKey);
                  if(targetDay) targetDay.dist += (parseFloat(run.dist) || 0);
              }
          });
          let html = '';
          const maxDist = Math.max(...last7Days.map(d => d.dist), 5);
          last7Days.forEach(day => {
              const heightPerc = (day.dist / maxDist) * 100;
              let barClass = day.dist > 10 ? 'high' : (day.dist > 5 ? 'med' : 'low');
              const visualHeight = day.dist === 0 ? 5 : Math.max(heightPerc, 10);
              const opacity = day.dist === 0 ? '0.2' : '1';
              html += `<div class="chart-column"><span class="bar-tooltip" style="opacity:${day.dist>0?1:0}">${day.dist.toFixed(1)}</span><div class="bar-bg"><div class="bar-fill ${barClass}" style="height: ${visualHeight}%; opacity: ${opacity}"></div></div><span class="bar-label">${day.dayName}</span></div>`;
          });
          chartDiv.innerHTML = html;
      });
}

// ==================== Admin Dashboard V2.0 Logic ====================
function openAdminAuth() {
    if (currentUser && userData && userData.isAdmin === true) {
        closeModal('modal-settings'); switchView('admin'); loadAdminOverview();
    } else { alert("⛔ عذراً، هذه المنطقة مخصصة للمشرفين فقط."); }
}

function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'none');
    document.getElementById('admin-tab-' + tabId).style.display = 'block';
    document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    if(tabId === 'anticheat') loadAntiCheatRadar();
    if(tabId === 'users') loadUserManager();
}

async function loadAdminOverview() {
    const grid = document.getElementById('admin-stats-grid');
    const regionChart = document.getElementById('admin-regions-chart');
    let users = allUsersCache;
    if(users.length === 0) users = await fetchTopRunners();
    
    const totalUsers = users.length;
    const totalDist = users.reduce((acc, u) => acc + (u.totalDist || 0), 0);
    const activeThisMonth = users.filter(u => (u.monthDist || 0) > 0).length;
    
    const regions = {};
    users.forEach(u => { const r = u.region || 'غير محدد'; regions[r] = (regions[r] || 0) + 1; });

    grid.innerHTML = `
        <div class="admin-stat-card"><span class="admin-stat-num">${totalUsers}</span><span class="admin-stat-label">عضو مسجل</span></div>
        <div class="admin-stat-card"><span class="admin-stat-num">${formatNumber(totalDist)}</span><span class="admin-stat-label">كم إجمالي</span></div>
        <div class="admin-stat-card"><span class="admin-stat-num">${activeThisMonth}</span><span class="admin-stat-label">نشط هذا الشهر</span></div>
    `;

    let regionHtml = '';
    Object.entries(regions).sort((a,b) => b[1] - a[1]).slice(0, 5).forEach(([reg, count]) => {
            const perc = (count / totalUsers) * 100;
            regionHtml += `<div style="margin-bottom:8px;"><div style="display:flex; justify-content:space-between; font-size:12px;"><span>${reg}</span><span>${count}</span></div><div style="background:rgba(255,255,255,0.1); height:6px; border-radius:3px;"><div style="background:var(--accent); width:${perc}%; height:100%; border-radius:3px;"></div></div></div>`;
        });
    regionChart.innerHTML = regionHtml;
}

function loadAntiCheatRadar() {
    const list = document.getElementById('anticheat-list');
    list.innerHTML = '<div style="text-align:center; padding:20px;">جاري الفحص... 📡</div>';
    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(50).get().then(snap => {
        let suspiciousHtml = ''; let count = 0;
        snap.forEach(doc => {
            const run = doc.data();
            const dist = parseFloat(run.dist); const time = parseFloat(run.time);
            const pace = time / dist;
            let flags = [];
            if (dist > 0 && pace < 2.5) flags.push(`سرعة خيالية (${pace.toFixed(1)} د/كم)`);
            if (dist > 40) flags.push(`مسافة ضخمة (${dist} كم)`);
            if (flags.length > 0) {
                count++;
                suspiciousHtml += `<div class="suspicious-row"><div><div style="font-weight:bold; color:#fff;">${run.userName}</div><div style="font-size:11px; color:#ef4444;">${flags.join(' + ')}</div></div><div><button class="btn-ban" onclick="adminDeleteActivity('${doc.id}', '${run.uid}', ${run.dist})">حذف 🗑️</button></div></div>`;
            }
        });
        list.innerHTML = count > 0 ? suspiciousHtml : '<div style="text-align:center; padding:20px; color:#10b981;">✅ السجل نظيف!</div>';
    });
}

async function adminDeleteActivity(feedId, uid, dist) {
    if(!confirm("حذف هذا النشاط؟")) return;
    await db.collection('activity_feed').doc(feedId).delete();
    alert("تم الحذف"); loadAntiCheatRadar();
}

let adminUsersCache = [];
async function loadUserManager() {
    const list = document.getElementById('admin-users-list');
    list.innerHTML = 'جاري التحميل...';
    if(adminUsersCache.length === 0) {
        const snap = await db.collection('users').limit(100).get();
        snap.forEach(doc => adminUsersCache.push({id: doc.id, ...doc.data()}));
    }
    renderUserTable(adminUsersCache);
}

function renderUserTable(users) {
    const list = document.getElementById('admin-users-list');
    let html = '';
    users.forEach(u => {
        html += `<div class="admin-user-row"><div class="admin-user-info"><h4>${u.name} ${u.isAdmin?'⭐':''}</h4><span>${u.region} • ${formatNumber(u.totalDist)} كم</span></div><div class="admin-actions"><button class="btn-ban" onclick="adminBanUser('${u.id}', '${u.name}')">حظر</button></div></div>`;
    });
    list.innerHTML = html;
}

function adminSearchUser(query) {
    const lowerQ = query.toLowerCase();
    const filtered = adminUsersCache.filter(u => (u.name && u.name.toLowerCase().includes(lowerQ)) || (u.region && u.region.toLowerCase().includes(lowerQ)));
    renderUserTable(filtered);
}

async function adminBanUser(uid, name) {
    const reason = prompt(`حظر ${name}؟ اكتب السبب:`);
    if(reason) {
        await db.collection('users').doc(uid).update({ isBanned: true, banReason: reason });
        alert(`تم حظر ${name}`);
    }
}

async function sendGlobalNotification() {
    const msg = document.getElementById('global-msg').value;
    if(!msg) return alert("اكتب رسالة");
    if(!confirm("إرسال للجميع؟")) return;
    const btn = event.target; btn.innerText = "جاري الإرسال...";
    try {
        const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(20).get();
        const batch = db.batch();
        snap.forEach(doc => {
            const ref = db.collection('users').doc(doc.id).collection('notifications').doc();
            batch.set(ref, { msg: `📢 إداري: ${msg}`, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        });
        await batch.commit(); alert("تم الإرسال ✅"); document.getElementById('global-msg').value = '';
    } catch(e) { console.error(e); }
    btn.innerText = "إرسال 🚀";
}

async function createChallengeUI() {
    const t = prompt("عنوان التحدي:"); const target = prompt("الهدف (كم):");
    if(t && target) {
        await db.collection('challenges').add({ title: t, target: parseFloat(target), active: true, startDate: new Date().toISOString() });
        alert("تم إنشاء التحدي ✅");
    }
}

// ==================== Runs & Actions ====================
function openNewRun() {
    const btn = document.getElementById('save-run-btn');
    if(btn) { btn.innerText = "حفظ النشاط"; btn.disabled = false; }
    const dateInput = document.getElementById('log-date');
    if(dateInput) dateInput.value = getLocalInputDate();
    const imgInput = document.getElementById('uploaded-img-url');
    const preview = document.getElementById('img-preview');
    const status = document.getElementById('upload-status');
    const fileInput = document.getElementById('log-img-file');
    if(imgInput) imgInput.value = '';
    if(preview) { preview.src = ''; preview.style.display = 'none'; }
    if(status) status.innerText = '';
    if(fileInput) fileInput.value = '';
    openLogModal();
    if(typeof enableSmartPaste === 'function') enableSmartPaste(); 
}

async function submitRun() {
    if (!navigator.onLine) return alert("لا يوجد إنترنت");
    const btn = document.getElementById('save-run-btn');
    const dist = parseFloat(document.getElementById('log-dist').value);
    const time = parseFloat(document.getElementById('log-time').value);
    const type = document.getElementById('log-type').value;
    const link = document.getElementById('log-link').value;
    const dateInput = document.getElementById('log-date');
    const img = document.getElementById('uploaded-img-url').value; 

    if (!dist || !time) return alert("البيانات ناقصة");
    if(btn) { btn.innerText = "جاري الحفظ..."; btn.disabled = true; }

    try {
        const uid = currentUser.uid;
        const runData = { dist, time, type, link: link || '', img: img || '', timestamp: firebase.firestore.FieldValue.serverTimestamp() };
        if(dateInput && dateInput.value) {
            runData.date = dateInput.value;
            runData.timestamp = firebase.firestore.Timestamp.fromDate(new Date(dateInput.value));
        }
        await db.collection('users').doc(uid).collection('runs').add(runData);
        await db.collection('activity_feed').add({ uid: uid, userName: userData.name, userRegion: userData.region, userGender: userData.gender||'male', ...runData, likes: [], commentsCount: 0 });
        
        const currentMonthKey = new Date().toISOString().slice(0, 7);
        let newMonthDist = (userData.monthDist || 0) + dist;
        if(userData.lastMonthKey !== currentMonthKey) newMonthDist = dist;
        await db.collection('users').doc(uid).set({ totalDist: firebase.firestore.FieldValue.increment(dist), totalRuns: firebase.firestore.FieldValue.increment(1), monthDist: newMonthDist, lastMonthKey: currentMonthKey }, { merge: true });
        
        userData.totalDist += dist; userData.totalRuns += 1; userData.monthDist = newMonthDist;
        checkNewBadges(dist, time, runData.timestamp ? runData.timestamp.toDate() : new Date());
        
        document.getElementById('log-dist').value = ''; document.getElementById('log-time').value = ''; document.getElementById('log-link').value = '';
        closeModal('modal-log'); allUsersCache = []; updateUI(); loadGlobalFeed(); loadActivityLog(); showToast("تم الحفظ 🔥", "success");
    } catch (error) { console.error(error); alert("خطأ: " + error.message); } 
    finally { if(btn) { btn.innerText = "حفظ النشاط"; btn.disabled = false; } }
}

function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if(!list) return;
    db.collection('users').doc(currentUser.uid).collection('runs').orderBy('timestamp', 'desc').limit(50).onSnapshot(snap => {
          if(snap.empty) { list.innerHTML = '<div style="text-align:center; padding:20px;">ابدأ الجري!</div>'; return; }
          let html = '';
          snap.forEach(doc => {
              const r = doc.data(); const dateObj = r.timestamp ? r.timestamp.toDate() : new Date();
              const dayStr = dateObj.toLocaleDateString('ar-EG', { day: 'numeric', weekday: 'short' });
              const pace = r.time > 0 ? (r.time / r.dist).toFixed(1) : '-';
              html += `<div class="log-row-compact"><div class="log-col-main"><div><span class="log-dist-val">${formatNumber(r.dist)}</span> كم</div></div><div class="log-col-meta"><span>${dayStr}</span><span>${r.time}د • ${pace} د/كم</span></div><div class="log-col-actions"><button class="btn-mini-action btn-del" onclick="deleteRun('${doc.id}', ${r.dist})"><i class="ri-delete-bin-line"></i></button></div></div>`;
          });
          list.innerHTML = html;
      });
}

async function deleteRun(id, dist) {
    if(!confirm("حذف؟")) return;
    try {
        const uid = currentUser.uid;
        const runDoc = await db.collection('users').doc(uid).collection('runs').doc(id).get();
        if(runDoc.exists) {
            const runData = runDoc.data();
            await db.collection('users').doc(uid).collection('runs').doc(id).delete();
            await db.collection('users').doc(uid).update({ totalDist: firebase.firestore.FieldValue.increment(-dist), totalRuns: firebase.firestore.FieldValue.increment(-1), monthDist: firebase.firestore.FieldValue.increment(-dist) });
            if (runData.timestamp) {
                const q = await db.collection('activity_feed').where('uid', '==', uid).where('timestamp', '==', runData.timestamp).get();
                const b = db.batch(); q.forEach(d => b.delete(d.ref)); await b.commit();
            }
            userData.totalDist -= dist; userData.totalRuns -= 1; userData.monthDist -= dist;
            allUsersCache = []; updateUI(); loadGlobalFeed(); alert("تم الحذف");
        }
    } catch(e) { console.error(e); }
}

// ==================== Leaderboard & Feed & Features ====================
async function loadLeaderboard(type='all') {
    const list = document.getElementById('leaderboard-list');
    const podium = document.getElementById('podium-container');
    if (!list) return;
    if (allUsersCache.length === 0) list.innerHTML = getSkeletonHTML('leaderboard');
    await fetchTopRunners();
    let users = allUsersCache;
    if (type === 'region') users = allUsersCache.filter(u => u.region === userData.region);
    
    // Podium
    if (podium && users.length >= 3) {
        const u1=users[0], u2=users[1], u3=users[2];
        podium.innerHTML = createPodiumItem(u2,2) + createPodiumItem(u1,1) + createPodiumItem(u3,3);
    } else if(podium) podium.innerHTML = '';

    list.innerHTML = '';
    users.slice(3).forEach((u, i) => {
        const isMe = (u.name === userData.name) ? 'border:1px solid #10b981;' : '';
        list.innerHTML += `<div class="leader-row" style="${isMe}"><div class="rank-col">#${i+4}</div><div class="avatar-col">${(u.name||"?").charAt(0)}</div><div class="info-col"><div class="name">${u.name}</div><div class="region">${u.region}</div></div><div class="dist-col">${formatNumber(u.totalDist)}</div></div>`;
    });
}

function createPodiumItem(u, r) {
    return `<div class="podium-item rank-${r}">${r===1?'👑':''} <div class="podium-avatar">${(u.name||"?").charAt(0)}</div><div class="podium-name">${u.name}</div><div class="podium-dist">${formatNumber(u.totalDist)}</div></div>`;
}

function filterLeaderboard(t) { loadLeaderboard(t); document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active')); event.target.classList.add('active'); }

async function loadRegionBattle() {
    const list = document.getElementById('region-battle-list');
    if(!list) return; list.innerHTML = 'جاري التحميل...';
    try {
        const users = await fetchTopRunners();
        let stats = {};
        users.forEach(u => { if(u.region){ const r=u.region; if(!stats[r]) stats[r]={d:0,p:0}; stats[r].d+=u.totalDist||0; stats[r].p++; }});
        const sorted = Object.keys(stats).map(k=>({n:k, ...stats[k], avg:stats[k].d/stats[k].p})).sort((a,b)=>b.d-a.d);
        const max = sorted[0]?.d || 1;
        let html = '<div class="squad-list">';
        sorted.forEach((r,i) => {
            html += `<div class="squad-row rank-${i<3?i+1:'other'}"><div class="squad-bg-bar" style="width:${(r.d/max)*100}%"></div><div class="squad-header"><div style="display:flex;gap:10px;"><div class="squad-rank">${i+1}</div><h4>${r.n}</h4></div><div class="squad-total-badge">${r.d.toFixed(0)}</div></div><div class="squad-stats-row"><div>${r.p} لاعب</div><div>القوة: ${r.avg.toFixed(1)}</div></div></div>`;
        });
        list.innerHTML = html+'</div>';
    } catch(e){ list.innerHTML='فشل'; }
}

function loadGlobalFeed() {
    const list = document.getElementById('global-feed-list');
    if(!list) return;
    if(!list.hasChildNodes()) list.innerHTML = getSkeletonHTML('feed');
    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
        let html = '';
        snap.forEach(doc => {
            const p = doc.data(); const isLiked = p.likes && p.likes.includes(currentUser.uid);
            html += `<div class="feed-card-compact"><div class="feed-compact-content"><div class="feed-compact-avatar">${(p.userName||"?").charAt(0)}</div><div><div class="feed-compact-text"><strong>${p.userName}</strong></div><div class="feed-compact-text">${p.type} <span style="color:#10b981;">${formatNumber(p.dist)} كم</span></div></div></div><div class="feed-compact-action">${p.img?`<button onclick="window.open('${p.img}')">📷 إثبات</button>`:''} <button class="${isLiked?'liked':''}" onclick="toggleLike('${doc.id}','${p.uid}')">❤️ ${(p.likes||[]).length||''}</button> <button onclick="openComments('${doc.id}','${p.uid}')">💬 ${(p.commentsCount||0)}</button> <span class="feed-compact-meta">${getArabicTimeAgo(p.timestamp)}</span></div></div>`;
        });
        list.innerHTML = html;
    });
}

// Challenges
function loadActiveChallenges() {
    const list = document.getElementById('challenges-list'); if(!list) return;
    db.collection('challenges').where('active','==',true).get().then(async snap => {
        if(snap.empty) return list.innerHTML = "<div style='text-align:center;padding:20px'>لا تحديات</div>";
        let html = '<div class="challenges-grid">';
        for(const doc of snap.docs) {
            const ch = doc.data(); let joined = false; let prog = 0;
            if(currentUser) { const p = await doc.ref.collection('participants').doc(currentUser.uid).get(); if(p.exists) { joined=true; prog=p.data().progress||0; } }
            const perc = Math.min((prog/ch.target)*100, 100);
            html += `<div class="mission-card"><div class="mission-header"><h3>${ch.title}</h3><div class="mission-target-badge">${ch.target} كم</div></div>${joined?`<div class="mission-progress-container"><div class="mission-progress-bar" style="width:${perc}%"></div></div><div class="mission-stats"><span>${prog.toFixed(1)}</span><span>${Math.floor(perc)}%</span></div>`:`<button class="btn-join-mission" onclick="joinChallenge('${doc.id}')">قبول</button>`}</div>`;
        }
        list.innerHTML = html + '</div>';
    });
}
async function joinChallenge(cid) { if(confirm("قبول التحدي؟")) { await db.collection('challenges').doc(cid).collection('participants').doc(currentUser.uid).set({progress:0, joinedAt: new Date()}); updateUI(); loadActiveChallenges(); } }

// Shared Helpers
function getSkeletonHTML(t) { return '<div style="padding:20px;text-align:center;">جاري التحميل...</div>'; }
function showToast(m,t='success') { const c=document.getElementById('toast-container'); const d=document.createElement('div'); d.className=`toast ${t}`; d.innerHTML=m; c.appendChild(d); setTimeout(()=>{d.remove()},3000); }
function updateCoachAdvice() { document.getElementById('coach-message').innerText = `أهلاً ${userData.name.split(' ')[0]}! استمر في التقدم.`; }
function renderBadges() { const g=document.getElementById('badges-grid'); if(g) { const b=userData.badges||[]; g.innerHTML = b.length>0 ? b.map(x=>`<div class="badge-item unlocked">🏆</div>`).join('') : '<small>لا أوسمة</small>'; } }
async function checkNewBadges(d,t,dt) { /* Simplified Badge Logic */ }
function openLogModal() { document.getElementById('modal-log').style.display='flex'; }
function closeModal(id) { document.getElementById(id).style.display='none'; }
function openSettingsModal() { document.getElementById('modal-settings').style.display='flex'; }
function showNotifications() { document.getElementById('modal-notifications').style.display='flex'; document.getElementById('notif-dot').classList.remove('active'); loadNotifications(); }
function openEditProfile() { document.getElementById('modal-edit-profile').style.display='flex'; }
function switchView(id) { document.querySelectorAll('.view').forEach(e=>e.classList.remove('active')); document.getElementById('view-'+id).classList.add('active'); }
function setTab(t) { document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active')); document.getElementById('tab-'+t).classList.add('active'); if(t==='leaderboard') loadLeaderboard(); if(t==='squads') loadRegionBattle(); }
function listenForNotifications() { db.collection('users').doc(currentUser.uid).collection('notifications').where('read','==',false).onSnapshot(s=>{ if(!s.empty) document.getElementById('notif-dot').classList.add('active'); }); }
function loadNotifications() { const l=document.getElementById('notifications-list'); db.collection('users').doc(currentUser.uid).collection('notifications').orderBy('timestamp','desc').limit(10).get().then(s=>{ let h=''; s.forEach(d=>{ h+=`<div class="notif-item">${d.data().msg}</div>`; d.ref.update({read:true}); }); l.innerHTML=h||'لا يوجد'; }); }
function initNetworkMonitor() { window.addEventListener('offline', ()=>document.getElementById('offline-banner').classList.add('active')); window.addEventListener('online', ()=>document.getElementById('offline-banner').classList.remove('active')); }
function checkSharedData() { /* Shared Logic */ }
function enableSmartPaste() { /* Paste Logic */ }
async function fixMyStats() {
    if(!confirm("إصلاح العدادات؟")) return;
    const snap = await db.collection('users').doc(currentUser.uid).collection('runs').get();
    let d=0, c=0; snap.forEach(doc=>{ d+=parseFloat(doc.data().dist)||0; c++; });
    await db.collection('users').doc(currentUser.uid).update({totalDist:d, totalRuns:c, monthDist:d});
    userData.totalDist=d; userData.totalRuns=c; userData.monthDist=d; updateUI(); alert("تم الإصلاح");
}
async function saveProfileChanges() {
    const n=document.getElementById('edit-name').value; const r=document.getElementById('edit-region').value;
    if(n) { await db.collection('users').doc(currentUser.uid).update({name:n, region:r}); userData.name=n; userData.region=r; updateUI(); closeModal('modal-edit-profile'); alert("تم"); }
}
async function deleteFullAccount() { if(confirm("حذف نهائي؟") && prompt("اكتب (حذف)")==="حذف") { await currentUser.delete(); window.location.reload(); } }
async function uploadImageToImgBB() {
    const f=document.getElementById('log-img-file').files[0]; if(!f) return;
    const btn=document.getElementById('save-run-btn'); btn.innerText="جاري الرفع...";
    const fd=new FormData(); fd.append("image",f);
    try { const r=await fetch(`https://api.imgbb.com/1/upload?key=0d0b1fefa53eb2fc054b27c6395af35c`,{method:"POST",body:fd}); const d=await r.json();
    if(d.success) { document.getElementById('uploaded-img-url').value=d.data.url; document.getElementById('img-preview').src=d.data.url; document.getElementById('img-preview').style.display='block'; showToast("تم الرفع"); }
    } catch(e){alert("فشل الرفع");} btn.innerText="حفظ النشاط"; btn.disabled=false;
}
