/* ERS Runners - V3.0 (Cleaned & Pro Admin) */

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
let editingRunId = null;
let editingOldDist = 0;
let allUsersCache = [];
let deferredPrompt;
let isLiking = false; // Debounce variable

// ==================== 0. Helpers & Utilities ====================

// 1. تحريك الأرقام (Animation)
function animateValue(obj, start, end, duration) {
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = progress * (end - start) + start;
        obj.innerHTML = Number.isInteger(end) ? Math.floor(value) : value.toFixed(1);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = Number.isInteger(end) ? end : end.toFixed(1);
        }
    };
    window.requestAnimationFrame(step);
}

// 2. جلب البيانات بأمان (Caching)
async function fetchTopRunners() {
    if (allUsersCache.length > 0) return allUsersCache;
    try {
        const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(50).get();
        allUsersCache = [];
        snap.forEach(doc => {
            allUsersCache.push({ uid: doc.id, ...doc.data() }); 
        });
        return allUsersCache;
    } catch(e) {
        console.error("Network Error:", e);
        return [];
    }
}

// 3. دوال التاريخ والأرقام
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

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = type === 'error' ? '<i class="ri-error-warning-line"></i>' : '<i class="ri-checkbox-circle-line"></i>';
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.4s forwards';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ==================== 1. Authentication ====================

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
                isAdmin: false, isBanned: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await auth.signInWithEmailAndPassword(email, pass);
        }
    } catch (err) {
        if (msgEl) {
            if(err.code === 'auth/email-already-in-use') msgEl.innerText = "هذا البريد مسجل بالفعل.";
            else if(err.code === 'auth/wrong-password') msgEl.innerText = "كلمة المرور خاطئة.";
            else if(err.code === 'auth/user-not-found') msgEl.innerText = "غير مسجل.";
            else msgEl.innerText = "خطأ: " + err.message;
        }
        activeBtn.innerHTML = originalText;
        activeBtn.disabled = false;
        activeBtn.style.opacity = "1";
    }
}

function logout() {
    if(confirm("تسجيل خروج؟")) { auth.signOut(); window.location.reload(); }
}

// مراقب الدخول (تم دمج المنطق هنا وحذف التكرار)
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                userData = doc.data();
                
                // --- نظام الحظر (V3.0) ---
                if (userData.isBanned === true) {
                    auth.signOut();
                    alert("⛔ تم حظر حسابك لمخالفة القوانين.");
                    window.location.reload();
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

// ==================== 2. Initialization ====================
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
    loadChart('week'); // استخدام الشارت الجديد
    initNetworkMonitor();
    checkSharedData(); 
}

// ==================== 3. UI Updates & Profile ====================
function updateUI() {
    try {
        const headerName = document.getElementById('headerName');
        if (headerName) headerName.innerText = userData.name || "Runner";

        // Dashboard Animations (V2.0)
        const mDistEl = document.getElementById('monthDist');
        const tRunsEl = document.getElementById('totalRuns');
        if(mDistEl) animateValue(mDistEl, 0, userData.monthDist || 0, 1500);
        if(tRunsEl) animateValue(tRunsEl, 0, userData.totalRuns || 0, 1500);

        // Profile Data
        const rankData = calculateRank(userData.totalDist || 0);
        document.getElementById('profileName').innerText = userData.name;
        document.getElementById('profileRegion').innerText = userData.region;
        const nextRankNameEl = document.getElementById('nextRankName');
        // دالة بسيطة لمعرفة الاسم القادم
        const ranksList = ["مبتدئ", "هاوي", "عداء", "محترف", "أسطورة"];
        const currentIdx = ranksList.indexOf(rankData.name);
        const nextName = ranksList[currentIdx + 1] || "القمة"; 
        if(nextRankNameEl) nextRankNameEl.innerText = nextName;

        // 2. تحديث الكالوري (تقديري: المسافة * 60)
        const calEl = document.getElementById('caloriesEst');
        if(calEl) {
            const cal = (userData.monthDist || 0) * 60; // متوسط تقريبي
            // عرض الرقم بتنسيق مختصر (مثلاً 1.2k)
            calEl.innerText = cal > 999 ? (cal/1000).toFixed(1) + 'k' : cal.toFixed(0);
        }

// ... باقي الكود كما هو ...
       // ... داخل updateUI ...
        const profileAvatar = document.getElementById('profileAvatar');
        
        if (profileAvatar) {
            // التحقق: هل توجد صورة مخصصة؟
            if (userData.photoUrl) {
                profileAvatar.innerText = "";
                profileAvatar.style.backgroundImage = `url('${userData.photoUrl}')`;
                profileAvatar.style.border = "2px solid #fff";
            } else {
                // العودة للأيقونات
                profileAvatar.style.backgroundImage = "none";
                let avatarIcon = userData.avatarIcon || getUserAvatar(userData);
                // منطق الرتب الخاصة
                if(rankData.name === 'أسطورة' && !userData.avatarIcon) avatarIcon = '👑';
                profileAvatar.innerText = avatarIcon;
                profileAvatar.style.border = "2px solid var(--primary)";
            }
        }

        document.getElementById('profileTotalDist').innerText = (userData.totalDist || 0).toFixed(1);
        document.getElementById('profileTotalRuns').innerText = userData.totalRuns || 0;
        document.getElementById('profileRankText').innerText = rankData.name;
        
        // XP Bar
        document.getElementById('nextLevelDist').innerText = rankData.remaining.toFixed(1);
        document.getElementById('xpBar').style.width = `${rankData.percentage}%`;
        document.getElementById('xpBar').style.backgroundColor = `var(--rank-color)`;
        document.getElementById('xpText').innerText = `${rankData.distInLevel.toFixed(1)} / ${rankData.distRequired} كم`;
        document.getElementById('xpPerc').innerText = `${Math.floor(rankData.percentage)}%`;

        updateGoalRing();
        renderBadges();
        calculatePersonalBests(); // (V2.2)
        if(typeof updateCoachAdvice === 'function') updateCoachAdvice();

        // زر الأدمن
        const adminBtn = document.getElementById('btn-admin-entry');
        if (adminBtn) {
            adminBtn.style.display = (userData.isAdmin === true) ? 'flex' : 'none';
        }

    } catch (error) { console.error("UI Error:", error); }
}

function calculateRank(totalDist) {
    const levels = [
        { name: "مبتدئ", min: 0, class: "rank-mubtadi", next: 50 },
        { name: "هاوي", min: 50, class: "rank-hawy", next: 150 },
        { name: "عداء", min: 150, class: "rank-runner", next: 500 },
        { name: "محترف", min: 500, class: "rank-pro", next: 1000 },
        { name: "أسطورة", min: 1000, class: "rank-legend", next: 10000 }
    ];
    let currentLevel = levels[0];
    for (let i = levels.length - 1; i >= 0; i--) {
        if (totalDist >= levels[i].min) { currentLevel = levels[i]; break; }
    }
    const distRequired = currentLevel.next - currentLevel.min;
    const distInLevel = totalDist - currentLevel.min;
    let percentage = (distInLevel / distRequired) * 100;
    if (percentage > 100) percentage = 100;
    
    return { 
        name: currentLevel.name, 
        class: currentLevel.class, 
        nextTarget: currentLevel.next, 
        remaining: currentLevel.next - totalDist, 
        percentage: percentage, 
        distInLevel: distInLevel, 
        distRequired: distRequired 
    };
}

function updateGoalRing() {
    const goalRing = document.getElementById('goalRing');
    const goalText = document.getElementById('goalText');
    const goalSub = document.getElementById('goalSub');
    if(goalRing && goalText) {
        const myGoal = userData.monthlyGoal || 0;
        const currentMonthDist = userData.monthDist || 0;
        if(myGoal === 0) {
            goalText.innerText = "اضغط لتحديد هدف";
            goalSub.innerText = "تحدى نفسك هذا الشهر";
            goalRing.style.background = `conic-gradient(#374151 0deg, rgba(255,255,255,0.05) 0deg)`;
        } else {
            const perc = Math.min((currentMonthDist / myGoal) * 100, 100);
            const deg = (perc / 100) * 360;
            const remaining = Math.max(myGoal - currentMonthDist, 0).toFixed(1);
            goalText.innerText = `${currentMonthDist.toFixed(1)} / ${myGoal} كم`;
            goalSub.innerText = remaining == 0 ? "أنت أسطورة! 🎉" : `باقي ${remaining} كم`;
            goalSub.style.color = remaining == 0 ? "#10b981" : "#a78bfa";
            goalRing.style.background = `conic-gradient(#8b5cf6 ${deg}deg, rgba(255,255,255,0.1) 0deg)`;
        }
    }
}

// أرقامي القياسية (V2.2 Fix)
async function calculatePersonalBests() {
    if (!currentUser) return;
    
    // 1. أطول جرية
    db.collection('users').doc(currentUser.uid).collection('runs')
      .orderBy('dist', 'desc').limit(1).get()
      .then(snap => {
          if(!snap.empty) {
              const run = snap.docs[0].data();
              const el = document.getElementById('best-dist');
              if(el) el.innerText = run.dist.toFixed(1);
              
              const paceEl = document.getElementById('best-pace');
              if(paceEl && run.dist > 0) {
                  const pace = (run.time / run.dist).toFixed(1);
                  paceEl.innerText = pace;
              }
          }
      });

    // 2. الساعات (تجميع)
    try {
        const snap = await db.collection('users').doc(currentUser.uid).collection('runs').get();
        let totalMinutes = 0;
        snap.forEach(doc => { totalMinutes += (doc.data().time || 0); });
        const hours = Math.floor(totalMinutes / 60);
        const elHours = document.getElementById('total-time-hours');
        if(elHours) animateValue(elHours, 0, hours, 2000);
    } catch(e) {}
}

// ==================== 4. Badges & Coach ====================
const BADGES_CONFIG = [
    { id: 'first_step', name: 'الانطلاقة', icon: '🚀', desc: 'أول نشاط لك' },
    { id: 'early_bird', name: 'طائر الصباح', icon: '🌅', desc: 'نشاط بين 5-8 صباحاً' },
    { id: 'night_owl', name: 'ساهر الليل', icon: '🌙', desc: 'نشاط بعد 10 مساءً' },
    { id: 'weekend_warrior', name: 'بطل العطلة', icon: '🎉', desc: 'نشاط يوم الجمعة' },
    { id: 'half_marathon', name: 'نصف ماراثون', icon: '🔥', desc: 'جرية +20 كم' },
    { id: 'club_100', name: 'نادي المئة', icon: '💎', desc: 'إجمالي 100 كم' },
    { id: 'club_500', name: 'المحترف', icon: '👑', desc: 'إجمالي 500 كم' },
];

async function checkNewBadges(dist, time, dateObj) {
    const myBadges = userData.badges || []; 
    let newBadgesEarned = [];
    const runDate = dateObj || new Date();
    const h = runDate.getHours();
    const d = runDate.getDay(); 

    if (!myBadges.includes('first_step')) newBadgesEarned.push('first_step');
    if (!myBadges.includes('early_bird') && h >= 5 && h <= 8) newBadgesEarned.push('early_bird');
    if (!myBadges.includes('night_owl') && (h >= 22 || h <= 3)) newBadgesEarned.push('night_owl');
    if (!myBadges.includes('weekend_warrior') && d === 5) newBadgesEarned.push('weekend_warrior');
    if (!myBadges.includes('half_marathon') && dist >= 20) newBadgesEarned.push('half_marathon');
    if (!myBadges.includes('club_100') && userData.totalDist >= 100) newBadgesEarned.push('club_100');
    if (!myBadges.includes('club_500') && userData.totalDist >= 500) newBadgesEarned.push('club_500');

    if (newBadgesEarned.length > 0) {
        await db.collection('users').doc(currentUser.uid).update({ badges: firebase.firestore.FieldValue.arrayUnion(...newBadgesEarned) });
        if(!userData.badges) userData.badges = [];
        userData.badges.push(...newBadgesEarned);
        const badgeNames = newBadgesEarned.map(b => BADGES_CONFIG.find(x => x.id === b).name).join(" و ");
        alert(`🎉 إنجاز جديد: ${badgeNames}`);
    }
}

function renderBadges() {
    const grid = document.getElementById('badges-grid');
    if(!grid) return;
    const myBadges = userData.badges || [];
    let html = '';
    BADGES_CONFIG.forEach(badge => {
        const isUnlocked = myBadges.includes(badge.id);
        const stateClass = isUnlocked ? 'unlocked' : 'locked';
        const clickAction = isUnlocked ? `alert('${badge.desc}')` : `alert('🔒 ${badge.desc}')`;
        html += `<div class="badge-item ${stateClass}" onclick="${clickAction}"><span class="badge-icon">${badge.icon}</span><span class="badge-name">${badge.name}</span></div>`;
    });
    grid.innerHTML = html;
}

function updateCoachAdvice() {
    const msgEl = document.getElementById('coach-message');
    if(!msgEl) return;
    const name = (userData.name || "يا بطل").split(' ')[0];
    let msg = `أهلاً ${name}! استمر في التقدم.`;
    if (userData.totalRuns === 0) msg = `أهلاً بك يا ${name}! رحلة الألف ميل تبدأ بخطوة.`;
    msgEl.innerText = msg;
}

// ==================== 5. Activity Log Logic ====================
function openNewRun() {
    editingRunId = null;
    editingOldDist = 0;
    document.getElementById('log-dist').value = '';
    document.getElementById('log-time').value = '';
    document.getElementById('log-type').value = 'Run';
    document.getElementById('log-link').value = '';
    document.getElementById('save-run-btn').innerText = "حفظ النشاط";
    const dateInput = document.getElementById('log-date');
    if(dateInput) dateInput.value = getLocalInputDate();
    openLogModal();
    enableSmartPaste(); 
}

window.editRun = function(id, dist, time, type, link) {
    editingRunId = id;
    editingOldDist = dist;
    document.getElementById('log-dist').value = dist;
    document.getElementById('log-time').value = time;
    document.getElementById('log-type').value = type;
    document.getElementById('log-link').value = link || '';
    document.getElementById('save-run-btn').innerText = "تعديل النشاط";
    openLogModal();
}

async function submitRun() {
    if (!navigator.onLine) return alert("لا يوجد اتصال بالإنترنت ⚠️");
    
    const btn = document.getElementById('save-run-btn');
    const dist = parseFloat(document.getElementById('log-dist').value);
    const time = parseFloat(document.getElementById('log-time').value);
    const type = document.getElementById('log-type').value;
    const link = document.getElementById('log-link').value;
    const dateInput = document.getElementById('log-date').value;

    if (!dist || !time) return showToast("البيانات ناقصة!", "error");
    if (dist <= 0 || time <= 0) return showToast("الأرقام يجب أن تكون صحيحة", "error");
    if (dist > 100) return showToast("⛔ المسافة كبيرة جداً!", "error");
    
    const selectedDate = new Date(dateInput);
    if (selectedDate > new Date()) return showToast("⛔ لا يمكن تسجيل نشاط في المستقبل!", "error");

    if(btn) { btn.innerText = "جاري المعالجة..."; btn.disabled = true; }

    try {
        const uid = currentUser.uid;
        if (editingRunId) {
            const distDiff = dist - editingOldDist; 
            await db.collection('users').doc(uid).collection('runs').doc(editingRunId).update({ dist, time, type, link });
            await db.collection('users').doc(uid).set({
                totalDist: firebase.firestore.FieldValue.increment(distDiff),
                monthDist: firebase.firestore.FieldValue.increment(distDiff)
            }, { merge: true });
            showToast("تم تعديل الجرية ✅", "success");
            editingRunId = null;
        } else {
            const timestamp = firebase.firestore.Timestamp.fromDate(selectedDate);
            const currentMonthKey = selectedDate.toISOString().slice(0, 7); 
            let newMonthDist = (userData.monthDist || 0) + dist;
            if(userData.lastMonthKey !== currentMonthKey) { newMonthDist = dist; }

            const runData = { dist, time, type, link, date: selectedDate.toISOString(), timestamp };
            await db.collection('users').doc(uid).collection('runs').add(runData);
            await db.collection('activity_feed').add({
                uid: uid, userName: userData.name, userRegion: userData.region,
                ...runData, likes: []
            });
            await db.collection('users').doc(uid).set({
                totalDist: firebase.firestore.FieldValue.increment(dist),
                totalRuns: firebase.firestore.FieldValue.increment(1),
                monthDist: newMonthDist, lastMonthKey: currentMonthKey
            }, { merge: true });

            // تحديث التحديات
            const activeCh = await db.collection('challenges').where('active', '==', true).get();
            const batch = db.batch();
            activeCh.forEach(doc => {
                batch.set(doc.ref.collection('participants').doc(uid), {
                    progress: firebase.firestore.FieldValue.increment(dist),
                    lastUpdate: timestamp, name: userData.name, region: userData.region
                }, { merge: true });
            });
            await batch.commit();

            userData.totalDist += dist; userData.totalRuns += 1; userData.monthDist = newMonthDist;
            await checkNewBadges(dist, time, selectedDate);
            showToast("تم الحفظ بنجاح 🚀", "success");
        }
        
        closeModal('modal-log');
        document.getElementById('save-run-btn').innerText = "حفظ النشاط";
        allUsersCache = []; 
        updateUI(); 
        loadGlobalFeed(); 
        loadActivityLog();

    } catch (error) { showToast("خطأ: " + error.message, "error"); } 
    finally { if(btn) { btn.innerText = "حفظ النشاط"; btn.disabled = false; } }
}

function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if(!list) return;
    db.collection('users').doc(currentUser.uid).collection('runs')
      .orderBy('timestamp', 'desc').limit(30).onSnapshot(snap => {
          if(snap.empty) { list.innerHTML = '<div style="text-align:center; padding:20px; color:#6b7280;">لا توجد أنشطة</div>'; return; }
          const runs = []; 
          snap.forEach(doc => { const r = doc.data(); r.id = doc.id; runs.push(r); });
          
          let html = '';
          runs.forEach(r => {
              const dateObj = r.timestamp ? r.timestamp.toDate() : new Date();
              const dayStr = dateObj.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
              const pace = r.time > 0 ? (r.time / r.dist).toFixed(1) : '-';
              html += `
              <div class="log-row-compact">
                  <div class="log-col-main">
                      <div class="log-type-icon"><i class="${r.type === 'Walk' ? 'ri-walk-line' : 'ri-run-line'}"></i></div>
                      <div><span class="log-dist-val">${formatNumber(r.dist)}</span> <span class="log-dist-unit">كم</span></div>
                  </div>
                  <div class="log-col-meta">
                      <span class="log-date-text">${dayStr}</span>
                      <span class="log-pace-text">${r.time}د • ${pace} د/كم</span>
                  </div>
                  <div class="log-col-actions">
                      <button class="btn-mini-action btn-share" onclick="generateShareCard('${r.dist}', '${r.time}', '${dayStr}')"><i class="ri-share-forward-line"></i></button>
                      <button class="btn-mini-action btn-edit" onclick="editRun('${r.id}', ${r.dist}, ${r.time}, '${r.type}', '${r.link || ''}')"><i class="ri-pencil-line"></i></button>
                      <button class="btn-mini-action btn-del" onclick="deleteRun('${r.id}', ${r.dist})"><i class="ri-delete-bin-line"></i></button>
                  </div>
              </div>`;
          });
          list.innerHTML = html;
      });
}

async function deleteRun(id, dist) {
    dist = parseFloat(dist);
    if(!confirm("هل أنت متأكد من الحذف؟")) return;
    
    try {
        const uid = currentUser.uid;
        const runDoc = await db.collection('users').doc(uid).collection('runs').doc(id).get();
        if (!runDoc.exists) return; 
        const runData = runDoc.data();

        await db.collection('users').doc(uid).collection('runs').doc(id).delete();
        await db.collection('users').doc(uid).update({
            totalDist: firebase.firestore.FieldValue.increment(-dist),
            totalRuns: firebase.firestore.FieldValue.increment(-1),
            monthDist: firebase.firestore.FieldValue.increment(-dist)
        });

        if (runData.timestamp) {
            const feedQuery = await db.collection('activity_feed')
                .where('uid', '==', uid).where('timestamp', '==', runData.timestamp).get();
            const batch = db.batch();
            feedQuery.forEach(doc => batch.delete(doc.ref));
            await batch.commit(); 
        }

        userData.totalDist = Math.max(0, (userData.totalDist || 0) - dist);
        userData.totalRuns = Math.max(0, (userData.totalRuns || 0) - 1);
        userData.monthDist = Math.max(0, (userData.monthDist || 0) - dist);

        allUsersCache = [];
        updateUI();
        loadActivityLog(); 
        loadGlobalFeed();
        showToast("تم الحذف 🗑️", "success");
    } catch (error) { showToast("فشل الحذف", "error"); }
}

// ==================== 6. Leaderboard & Teams ====================
async function loadLeaderboard(filterType = 'all') {
    const list = document.getElementById('leaderboard-list');
    const podiumContainer = document.getElementById('podium-container');
    const teamTotalEl = document.getElementById('teamTotalDisplay');
    const teamBar = document.getElementById('teamGoalBar');

    if (!list) return;
    if (allUsersCache.length === 0) {
        list.innerHTML = getSkeletonHTML('leaderboard');
    }

    await fetchTopRunners();

    let displayUsers = allUsersCache;
    if (filterType === 'region') displayUsers = allUsersCache.filter(u => u.region === userData.region);

    let teamTotal = 0;
    displayUsers.forEach(u => teamTotal += (u.totalDist || 0));
    if(teamTotalEl) teamTotalEl.innerText = teamTotal.toFixed(0);
    if(teamBar) teamBar.style.width = `${Math.min((teamTotal / 1000) * 100, 100)}%`;

    if (podiumContainer) {
        let podiumHtml = '';
        const u1 = displayUsers[0];
        const u2 = displayUsers[1];
        const u3 = displayUsers[2];
        if(u2) podiumHtml += createPodiumItem(u2, 2);
        if(u1) podiumHtml += createPodiumItem(u1, 1);
        if(u3) podiumHtml += createPodiumItem(u3, 3);
        podiumContainer.innerHTML = podiumHtml || '<div style="color:#9ca3af; font-size:12px;">...</div>';
    }

    list.innerHTML = '';
    const restUsers = displayUsers.slice(3); 
    
    if (restUsers.length === 0 && displayUsers.length > 3) {
        list.innerHTML = '<div style="text-align:center; padding:10px;">لا يوجد المزيد</div>';
    }

    restUsers.forEach((u, index) => {
        const realRank = index + 4;
        const isMe = (u.name === userData.name) ? 'border:1px solid #10b981; background:rgba(16,185,129,0.1);' : '';
        list.innerHTML += `
            <div class="leader-row" style="${isMe}; cursor:pointer;" onclick="viewUserProfile('${u.uid}')">
                <div class="rank-col" style="font-size:14px; color:#9ca3af;">#${realRank}</div>
                <div class="avatar-col">${(u.name || "?").charAt(0)}</div>
                <div class="info-col">
                    <div class="name">${u.name} ${isMe ? '(أنت)' : ''}</div>
                    <div class="region">${u.region}</div>
                </div>
                <div class="dist-col">${(u.totalDist||0).toFixed(1)}</div>
            </div>`;
    });
}

function createPodiumItem(user, rank) {
    let crown = rank === 1 ? '<div class="crown-icon">👑</div>' : '';
    let avatarChar = (user.name || "?").charAt(0);
    return `
        <div class="podium-item rank-${rank}" onclick="viewUserProfile('${user.uid}')">
            ${crown}
            <div class="podium-avatar">${avatarChar}</div>
            <div class="podium-name">${user.name}</div>
            <div class="podium-dist">${(user.totalDist||0).toFixed(1)}</div>
        </div>`;
}

function filterLeaderboard(type) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
    loadLeaderboard(type);
}

function viewUserProfile(targetUid) {
    const user = allUsersCache.find(u => u.uid === targetUid);
    if (!user) return showToast("بيانات المستخدم غير متوفرة", "error");

    document.getElementById('view-name').innerText = user.name;
    document.getElementById('view-region').innerText = user.region;
    
    const rankData = calculateRank(user.totalDist || 0);
    document.getElementById('view-avatar').innerText = getUserAvatar(user);
    document.getElementById('view-rank').innerText = rankData.name;
    document.getElementById('view-total-dist').innerText = (user.totalDist || 0).toFixed(1);
    document.getElementById('view-total-runs').innerText = user.totalRuns || 0;

    document.getElementById('modal-view-user').style.display = 'flex';
}

const REGION_AR = { "Cairo": "القاهرة", "Giza": "الجيزة", "Alexandria": "الإسكندرية", "Mansoura": "المنصورة", "Tanta": "طنطا", "Luxor": "الأقصر", "Aswan": "أسوان", "Red Sea": "البحر الأحمر", "Sinai": "سيناء", "Sharkia": "الشرقية", "Dakahlia": "الدقهلية", "Menofia": "المنوفية", "Gharbia": "الغربية", "Beni Suef": "بني سويف" };

async function loadRegionBattle() {
    const list = document.getElementById('region-battle-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center; padding:20px; color:#9ca3af;">جاري التحليل... 📡</div>';
    
    try {
        const users = await fetchTopRunners();
        let stats = {};
        users.forEach(u => {
            if(u.region) {
                let regKey = u.region.charAt(0).toUpperCase() + u.region.slice(1).toLowerCase();
                if (!stats[regKey]) stats[regKey] = { totalDist: 0, players: 0 };
                stats[regKey].totalDist += (u.totalDist || 0);
                stats[regKey].players += 1;
            }
        });

        const sorted = Object.keys(stats)
            .map(key => ({ originalName: key, ...stats[key], avg: stats[key].totalDist / stats[key].players }))
            .sort((a, b) => b.totalDist - a.totalDist);

        if (sorted.length === 0) { list.innerHTML = '<div>لا توجد بيانات</div>'; return; }
        const maxVal = sorted[0].totalDist || 1; 
        let html = '<div class="squad-list">';
        
        sorted.forEach((r, i) => {
            const rank = i + 1;
            const percent = (r.totalDist / maxVal) * 100;
            const arabicName = REGION_AR[r.originalName] || r.originalName;
            let rankClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : ''));
            let icon = rank === 1 ? '👑' : '';

            html += `
            <div class="squad-row ${rankClass}">
                <div class="squad-bg-bar" style="width:${percent}%"></div>
                <div class="squad-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="squad-rank">${rank}</div>
                        <div class="squad-name-box"><h4>${icon} ${arabicName}</h4></div>
                    </div>
                    <div class="squad-total-badge">${r.totalDist.toFixed(0)} كم</div>
                </div>
                <div class="squad-stats-row">
                    <div class="stat-item"><i class="ri-user-3-line"></i> ${r.players} لاعب</div>
                    <div style="width:1px; height:10px; background:#4b5563;"></div>
                    <div class="stat-item"><i class="ri-speed-line"></i> القوة: ${r.avg.toFixed(1)}</div>
                </div>
            </div>`;
        });
        list.innerHTML = html + '</div>';
    } catch (e) { list.innerHTML = 'خطأ في التحميل'; }
}

// ==================== 7. Feed & Social ====================
async function toggleLike(pid, postOwnerId) {
    if(!currentUser || isLiking) return;
    const btn = event.currentTarget; 
    const icon = btn.querySelector('i');
    const countSpan = btn.querySelector('.feed-compact-count');
    const isCurrentlyLiked = icon.classList.contains('ri-heart-fill');
    
    // Optimistic UI
    if(isCurrentlyLiked) {
        icon.classList.replace('ri-heart-fill', 'ri-heart-line');
        btn.classList.remove('liked');
        let c = parseInt(countSpan.innerText || 0);
        countSpan.innerText = c > 1 ? c - 1 : '';
    } else {
        icon.classList.replace('ri-heart-line', 'ri-heart-fill');
        btn.classList.add('liked');
        let c = parseInt(countSpan.innerText || 0);
        countSpan.innerText = c + 1;
    }

    isLiking = true;
    try {
        const ref = db.collection('activity_feed').doc(pid);
        if(isCurrentlyLiked) {
            await ref.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        } else {
            await ref.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
            if(postOwnerId !== currentUser.uid) sendNotification(postOwnerId, `${userData.name} شجعك ❤️`);
        }
    } catch(e) { console.error(e); } finally { isLiking = false; }
}

function loadGlobalFeed() {
    const list = document.getElementById('global-feed-list');
    if(!list) return;
    if(!list.hasChildNodes()) list.innerHTML = getSkeletonHTML('feed');

    // تم التخفيض إلى 10 فقط لتسريع التحميل وتوفير الكوتا
    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(10).onSnapshot(snap => {
        if(snap.empty) { list.innerHTML = '<div style="text-align:center; color:#6b7280;">لا توجد أنشطة</div>'; return; }
        let html = '';
        snap.forEach(doc => {
            const p = doc.data();
            const isLiked = p.likes && p.likes.includes(currentUser.uid);
            const commentsCount = p.commentsCount || 0;
            const timeAgo = getArabicTimeAgo(p.timestamp);

            html += `
            <div class="feed-card-compact">
                <div class="feed-compact-content">
                    <div class="feed-compact-avatar">${(p.userName||"?").charAt(0)}</div>
                    <div>
                        <div class="feed-compact-text"><strong>${p.userName}</strong> <span style="opacity:0.7">(${p.userRegion})</span></div>
                        <div class="feed-compact-text" style="margin-top:2px;">
                            ${p.type === 'Run' ? 'جري' : p.type} <span style="color:#10b981; font-weight:bold;">${formatNumber(p.dist)} كم</span>
                        </div>
                    </div>
                </div>
                <div class="feed-compact-action">
                    ${p.link ? `<a href="${p.link}" target="_blank" style="text-decoration:none; color:#3b82f6; font-size:14px;"><i class="ri-link"></i></a>` : ''}
                    <button class="feed-compact-btn ${isLiked?'liked':''}" onclick="toggleLike('${doc.id}', '${p.uid}')">
                        <i class="${isLiked?'ri-heart-fill':'ri-heart-line'}"></i> <span class="feed-compact-count">${(p.likes||[]).length || ''}</span>
                    </button>
                    <button class="feed-compact-btn" onclick="openComments('${doc.id}', '${p.uid}')" style="margin-right:8px;">
                        <i class="ri-chat-3-line"></i> <span class="feed-compact-count">${commentsCount > 0 ? commentsCount : ''}</span>
                    </button>
                    <span class="feed-compact-meta" style="margin-right:5px;">${timeAgo}</span>
                </div>
            </div>`;
        });
        list.innerHTML = html;
    });
}

// ==================== 8. V3.0 Admin Dashboard (The Command Center) ====================

function openAdminAuth() {
    if (currentUser && userData && userData.isAdmin === true) {
        closeModal('modal-settings'); 
        setTimeout(() => { 
            switchView('admin'); 
            loadAdminDashboard(); 
        }, 100);
    } else { 
        showToast("⛔ هذه المنطقة محظورة", "error"); 
    }
}

function loadAdminDashboard() {
    loadAllUsersTable();
    detectSuspiciousActivity();
}

async function loadAllUsersTable() {
    const tbody = document.getElementById('users-table-body');
    const countEl = document.getElementById('total-users-count');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">جاري التحميل...</td></tr>';

    try {
        const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(100).get();
        if(countEl) countEl.innerText = snap.size;
        let html = '';
        snap.forEach(doc => {
            const u = doc.data();
            const isBanned = u.isBanned === true;
            html += `
            <tr style="${isBanned ? 'opacity:0.5; background:rgba(239,68,68,0.1);' : ''}">
                <td><div style="font-weight:bold;">${u.name}</div><div style="font-size:9px; color:#9ca3af;">${u.email||'-'}</div></td>
                <td>${u.region}</td>
                <td>
                    ${isBanned ? 
                        `<button class="action-btn" style="background:#10b981; color:#000;" onclick="toggleBan('${doc.id}', false)">فك</button>` : 
                        `<button class="action-btn btn-ban" onclick="toggleBan('${doc.id}', true)">حظر</button>`
                    }
                    <button class="action-btn" onclick="viewUserProfile('${doc.id}')">👤</button>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    } catch(e) { tbody.innerHTML = '<tr><td colspan="3" style="color:red;">خطأ</td></tr>'; }
}

async function toggleBan(uid, banStatus) {
    if(!confirm(banStatus ? "حظر العضو؟" : "فك الحظر؟")) return;
    try {
        await db.collection('users').doc(uid).update({ isBanned: banStatus });
        showToast(banStatus ? "تم الحظر 🚫" : "تم الفك ✅", "success");
        loadAllUsersTable();
    } catch(e) { showToast("خطأ", "error"); }
}

async function detectSuspiciousActivity() {
    const list = document.getElementById('suspicious-list');
    const countEl = document.getElementById('flagged-runs-count');
    if(!list) return;
    
    const snap = await db.collection('activity_feed').orderBy('timestamp', 'desc').limit(100).get();
    let suspiciousCount = 0;
    let html = '';

    snap.forEach(doc => {
        const run = doc.data();
        const dist = parseFloat(run.dist);
        const time = parseFloat(run.time);
        const pace = dist > 0 ? time / dist : 0;
        
        const isTooFast = pace < 2.5 && dist > 1; 
        const isTooFar = dist > 45; 

        if (isTooFast || isTooFar) {
            suspiciousCount++;
            const reason = isTooFast ? `🚀 سرعة (${pace.toFixed(1)} د/كم)` : `🗺️ مسافة (${dist} كم)`;
            html += `
            <div class="alert-card">
                <div class="alert-info">
                    <strong>${run.userName}</strong>
                    <span>${reason} • ${getArabicTimeAgo(run.timestamp)}</span>
                </div>
                <button class="action-btn btn-ban" onclick="adminDelete('${doc.id}', ${dist})">حذف</button>
            </div>`;
        }
    });

    if(countEl) countEl.innerText = suspiciousCount;
    list.innerHTML = html || '<div style="text-align:center; color:#10b981; font-size:11px;">الوضع آمن ✅</div>';
}

async function adminDelete(id, dist) {
    if(!confirm("حذف هذا النشاط المشبوه؟")) return;
    // استدعاء دالة الحذف العادية لكن بدون تأكيد إضافي لو أردنا، أو استخدام نفس الدالة
    // هنا سنستخدم دالة الحذف العامة
    deleteRun(id, dist || 0); 
    setTimeout(detectSuspiciousActivity, 2000); // تحديث القائمة
}

async function createAdvancedChallenge() {
    const title = document.getElementById('adv-ch-title').value;
    const target = parseFloat(document.getElementById('adv-ch-target').value);
    const days = parseInt(document.getElementById('adv-ch-days').value);
    const startDateVal = document.getElementById('adv-ch-start').value;

    if(!title || !target || !days) return showToast("البيانات ناقصة", "error");
    const startDate = startDateVal ? new Date(startDateVal).toISOString() : new Date().toISOString();

    try {
        await db.collection('challenges').add({
            title: title, target: target, durationDays: days,
            startDate: startDate, active: true, participantsCount: 0
        });
        showToast("تم إطلاق التحدي 🎯", "success");
        document.getElementById('adv-ch-title').value = '';
    } catch(e) { showToast("خطأ", "error"); }
}

// ==================== 9. Charts & Graphs (V2.0) ====================
let currentChartMode = 'week'; 

function loadChart(mode, btnElement) {
    currentChartMode = mode;
    if (btnElement) {
        document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }

    const chartDiv = document.getElementById('main-chart-area');
    if(!chartDiv) return;
    chartDiv.innerHTML = '<div style="margin:auto; font-size:11px; color:#6b7280;">جاري التحليل...</div>';
    chartDiv.classList.remove('monthly');

    const daysCount = mode === 'week' ? 7 : 30;
    const daysMap = [];
    const daysAr = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

    for(let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().slice(0, 10);
        let label = mode === 'week' ? daysAr[d.getDay()] : `${d.getDate()}/${d.getMonth()+1}`;
        daysMap.push({ label: label, dateKey: dateKey, dist: 0 });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);

    db.collection('users').doc(currentUser.uid).collection('runs')
      .where('timestamp', '>=', startDate)
      .get().then(snap => {
          snap.forEach(doc => {
              const run = doc.data();
              if(run.timestamp) {
                  const runDate = run.timestamp.toDate().toISOString().slice(0, 10);
                  const target = daysMap.find(d => d.dateKey === runDate);
                  if(target) target.dist += (run.dist || 0);
              }
          });

          if (mode === 'month') chartDiv.classList.add('monthly');
          let html = '';
          const maxDist = Math.max(...daysMap.map(d => d.dist), 5);

          daysMap.forEach(day => {
              const heightPerc = (day.dist / maxDist) * 100;
              let barClass = day.dist > 10 ? 'high' : (day.dist > 3 ? 'med' : 'low');
              if(day.dist === 0) barClass = 'low';

              html += `
                <div class="chart-column">
                    <span class="bar-tooltip">${day.dist > 0 ? day.dist.toFixed(1) : ''}</span>
                    <div class="bar-bg"><div class="bar-fill ${barClass}" style="height: ${heightPerc}%"></div></div>
                    <span class="bar-label" style="font-size:${mode==='month'?'8px':'9px'}">${day.label}</span>
                </div>`;
          });
          chartDiv.innerHTML = html;
          if(mode === 'month') {
             const wrapper = document.querySelector('.chart-scroll-wrapper');
             if(wrapper) wrapper.scrollLeft = 0; 
          }
      });
}

// ==================== 10. Utils & Listeners ====================
function openLogModal() { document.getElementById('modal-log').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function openSettingsModal() { document.getElementById('modal-settings').style.display='flex'; }
function showNotifications() { document.getElementById('modal-notifications').style.display='flex'; document.getElementById('notif-dot').classList.remove('active'); loadNotifications(); }
function openEditProfile() { document.getElementById('modal-edit-profile').style.display='flex'; }

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    const navItems = document.querySelectorAll('.nav-item');
    const map = {'home':0, 'challenges':1, 'profile':2};
    if(navItems[map[viewId]]) navItems[map[viewId]].classList.add('active');
}

function setTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
    if (tabName === 'leaderboard') loadLeaderboard('all');
    if (tabName === 'squads') loadRegionBattle();
    if (tabName === 'active-challenges') loadActiveChallenges();
}

function getSkeletonHTML(type) {
    if (type === 'leaderboard') return Array(5).fill('').map(() => `<div class="sk-leader-row"><div class="skeleton sk-circle"></div><div style="flex:1"><div class="skeleton sk-line long"></div><div class="skeleton sk-line short"></div></div></div>`).join('');
    if (type === 'feed') return Array(3).fill('').map(() => `<div class="sk-feed-card"><div class="sk-header"><div class="skeleton sk-circle"></div><div style="flex:1"><div class="skeleton sk-line long"></div></div></div><div class="skeleton sk-line"></div></div>`).join('');
    return '...';
}

function enableSmartPaste() {
    const linkInput = document.getElementById('log-link');
    const distInput = document.getElementById('log-dist');
    if(!linkInput || !distInput) return;
    linkInput.addEventListener('paste', (event) => {
        setTimeout(() => {
            const text = linkInput.value;
            const distMatch = text.match(/(\d+(\.\d+)?)\s*(km|k|كم)/i);
            if (distMatch && distMatch[1]) {
                if(confirm(`🤖 اكتشفت مسافة ${distMatch[1]} كم. كتابتها؟`)) {
                    distInput.value = parseFloat(distMatch[1]);
                    showToast("تم استخراج المسافة ⚡", "success");
                }
            }
            const urlMatch = text.match(/https?:\/\/[^\s]+/);
            if (urlMatch && urlMatch[0] !== text) linkInput.value = urlMatch[0]; 
        }, 100);
    });
}

// Notifications
function loadNotifications() {
    const list = document.getElementById('notifications-list');
    db.collection('users').doc(currentUser.uid).collection('notifications').orderBy('timestamp','desc').limit(10).get().then(snap => {
        let html = '';
        snap.forEach(d => { html += `<div class="notif-item"><div class="notif-content">${d.data().msg}</div></div>`; d.ref.update({read:true}); });
        list.innerHTML = html || '<div style="padding:20px;text-align:center;">لا جديد</div>';
    });
}
function listenForNotifications() {
    if(!currentUser) return;
    db.collection('users').doc(currentUser.uid).collection('notifications').where('read','==',false).onSnapshot(s => {
        if(!s.empty) document.getElementById('notif-dot').classList.add('active');
    });
}

// Social Comments
function openComments(postId, postOwnerId) {
    currentPostId = postId; currentPostOwner = postOwnerId;
    document.getElementById('modal-comments').style.display = 'flex';
    document.getElementById('comment-text').value = ''; 
    loadComments(postId);
}
function loadComments(postId) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '...';
    db.collection('activity_feed').doc(postId).collection('comments').orderBy('timestamp', 'asc').onSnapshot(snap => {
          let html = '';
          if(snap.empty) { list.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.7;">كن أول من يعلق!</div>'; return; }
          snap.forEach(doc => {
              const c = doc.data();
              html += `<div class="comment-item"><div class="comment-avatar">${c.userName.charAt(0)}</div><div class="comment-bubble"><span class="comment-user">${c.userName}</span><span class="comment-msg">${c.text}</span></div></div>`;
          });
          list.innerHTML = html;
          list.scrollTop = list.scrollHeight;
      });
}
async function sendComment() {
    const input = document.getElementById('comment-text');
    const text = input.value.trim();
    if(!text || !currentPostId) return;
    input.value = ''; 
    await db.collection('activity_feed').doc(currentPostId).collection('comments').add({
        text: text, userId: currentUser.uid, userName: userData.name, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('activity_feed').doc(currentPostId).update({ commentsCount: firebase.firestore.FieldValue.increment(1) });
    if(currentPostOwner !== currentUser.uid) sendNotification(currentPostOwner, `علق ${userData.name}: "${text.substring(0, 20)}..."`);
}

// Profile Editing
async function saveProfileChanges() {
    const name = document.getElementById('edit-name').value.trim();
    const region = document.getElementById('edit-region').value;
    const gender = document.getElementById('edit-gender').value;
    const birthYear = document.getElementById('edit-birthyear').value;

    if (name.length < 3) return showToast("الاسم قصير", "error");
    const btn = event.target; btn.innerText = "جاري الحفظ..."; btn.disabled = true;
    
    try {
        await db.collection('users').doc(currentUser.uid).update({ name, region, gender, birthYear });
        userData.name = name; userData.region = region; userData.gender = gender; userData.birthYear = birthYear;
        allUsersCache = []; 
        updateUI(); closeModal('modal-edit-profile'); 
        showToast("تم التحديث ✅", "success");
    } catch (e) { showToast("خطأ", "error"); } 
    finally { btn.innerText = "حفظ"; btn.disabled = false; }
}

// Force Update
async function forceUpdateApp() {
    if(!confirm("تحديث التطبيق الآن؟")) return;
    const btn = event.target.closest('button'); if(btn) btn.innerText = "جاري التحديث...";
    try {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (let reg of regs) await reg.unregister();
        }
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
    } catch(e) {}
    window.location.reload(true);
}

// Delete Account
async function deleteFullAccount() {
    if(!confirm("⚠️ حذف الحساب نهائياً؟")) return;
    const checkWord = prompt("للتأكيد اكتب (حذف):");
    if (checkWord !== "حذف") return;

    try {
        const uid = currentUser.uid;
        // حذف الجريات
        const runs = await db.collection('users').doc(uid).collection('runs').get();
        await Promise.all(runs.docs.map(d => d.ref.delete()));
        // حذف البروفايل
        await db.collection('users').doc(uid).delete();
        await currentUser.delete();
        alert("تم الحذف 👋"); window.location.reload();
    } catch (e) { alert("خطأ: " + e.message); }
}

// Fix Stats
async function fixMyStats() {
    if(!confirm("إعادة حساب العدادات؟")) return;
    const btn = document.getElementById('fix-btn'); if(btn) btn.innerText = "...";
    try {
        const uid = currentUser.uid;
        const snap = await db.collection('users').doc(uid).collection('runs').get();
        let tDist = 0, tRuns = 0;
        snap.forEach(d => { tDist += parseFloat(d.data().dist)||0; tRuns++; });
        tDist = Math.round(tDist*100)/100;
        await db.collection('users').doc(uid).update({ totalDist: tDist, totalRuns: tRuns, monthDist: tDist });
        userData.totalDist = tDist; userData.totalRuns = tRuns; userData.monthDist = tDist;
        updateUI(); alert(`تم التصحيح: ${tDist} كم`);
    } catch(e) { alert("خطأ"); } finally { if(btn) btn.innerText = "إصلاح"; }
}

// Share Logic
function generateShareCard(dist, time, dateStr) {
    document.getElementById('share-name').innerText = userData.name;
    const rank = calculateRank(userData.totalDist||0);
    document.getElementById('share-rank').innerText = rank.name;
    document.getElementById('share-dist').innerText = dist;
    document.getElementById('share-time').innerText = time + "m";
    document.getElementById('share-pace').innerText = (time/dist).toFixed(1);
    document.getElementById('modal-share').style.display = 'flex';
    document.getElementById('final-share-img').style.display = 'none'; 
    setTimeout(() => {
        html2canvas(document.getElementById('capture-area'), { backgroundColor: null, scale: 2 }).then(canvas => {
            document.getElementById('final-share-img').src = canvas.toDataURL("image/png");
            document.getElementById('final-share-img').style.display = 'block';
        });
    }, 100);
}

// Active Challenges Loader
function loadActiveChallenges() {
    const list = document.getElementById('challenges-list');
    const mini = document.getElementById('my-active-challenges'); 
    if(!list) return;
    list.innerHTML = getSkeletonHTML('challenges');

    db.collection('challenges').where('active','==',true).get().then(async snap => {
        if(snap.empty) { 
            list.innerHTML = "<div style='text-align:center; padding:20px; color:#6b7280'>لا توجد تحديات</div>"; 
            if(mini) mini.innerHTML="<div class='empty-state-mini'>لا تحديات</div>"; 
            return; 
        }
        let fullHtml = '<div class="challenges-grid">', miniHtml = '';
        for(const doc of snap.docs) {
            const ch = doc.data();
            let isJoined = false, progress = 0;
            if(currentUser) {
                const p = await doc.ref.collection('participants').doc(currentUser.uid).get();
                if(p.exists) { isJoined = true; progress = p.data().progress || 0; }
            }
            const perc = Math.min((progress/ch.target)*100, 100);
            
            fullHtml += `
            <div class="mission-card">
                <div class="mission-bg-icon"><i class="ri-trophy-line"></i></div>
                <div class="mission-header">
                    <div><h3 class="mission-title">${ch.title}</h3><div class="mission-meta"><span>${ch.durationDays} يوم</span></div></div>
                    <div class="mission-target-badge">${ch.target} كم</div>
                </div>
                ${isJoined ? `<div class="mission-progress-container"><div class="mission-progress-bar" style="width:${perc}%"></div></div><div class="mission-stats"><span>${progress.toFixed(1)}</span><span>${Math.floor(perc)}%</span></div>` : `<button class="btn-join-mission" onclick="joinChallenge('${doc.id}')">قبول التحدي</button>`}
            </div>`;

            if(isJoined && mini) miniHtml += `<div class="mini-challenge-card"><div class="mini-ch-title">${ch.title}</div><div class="mini-ch-progress"><div class="mini-ch-fill" style="width:${perc}%"></div></div></div>`;
        }
        list.innerHTML = fullHtml + '</div>';
        if(mini) mini.innerHTML = miniHtml || "<div class='empty-state-mini'>لم تنضم بعد</div>";
    });
}

async function joinChallenge(cid) {
    if(!confirm("قبول التحدي؟")) return;
    await db.collection('challenges').doc(cid).collection('participants').doc(currentUser.uid).set({
        progress: 0, joinedAt: new Date().toISOString(), name: userData.name
    });
    loadActiveChallenges();
    showToast("أنت قدها يا بطل 💪", "success");
}

function setPersonalGoal() {
    const g = prompt("هدفك الشهري (كم):", userData.monthlyGoal||0);
    if(g && g>0) {
        db.collection('users').doc(currentUser.uid).update({ monthlyGoal: parseFloat(g) });
        userData.monthlyGoal = parseFloat(g); updateUI();
    }
}

// PWA Install
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.getElementById('header-install-btn').style.display = 'flex'; });
async function installApp() {
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; document.getElementById('header-install-btn').style.display = 'none'; }
}

// ==================== V3.2 Avatar System ====================

let selectedAvatarIcon = "🏃"; // الافتراضي

function openAvatarSelector() {
    const grid = document.getElementById('avatar-grid');
    const icons = ["🏃", "🏃‍♀️", "⚡", "🔥", "🦁", "🦅", "🚀", "👑", "💀", "🤖"];
    
    let html = '';
    icons.forEach(icon => {
        html += `<div class="avatar-option" onclick="selectAvatarIcon(this, '${icon}')">${icon}</div>`;
    });
    grid.innerHTML = html;
    
    // إعادة تعيين الحقول
    document.getElementById('custom-avatar-url').value = userData.photoUrl || '';
    if(userData.photoUrl) {
        previewCustomAvatar(userData.photoUrl);
    } else {
        selectedAvatarIcon = userData.avatarIcon || "🏃";
        updatePreview(selectedAvatarIcon);
    }
    
    document.getElementById('modal-avatar').style.display = 'flex';
}

function selectAvatarIcon(el, icon) {
    // إزالة التحديد من الكل
    document.querySelectorAll('.avatar-option').forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');
    
    selectedAvatarIcon = icon;
    // مسح الرابط المخصص إذا اختار أيقونة
    document.getElementById('custom-avatar-url').value = '';
    updatePreview(icon);
}

function previewCustomAvatar(url) {
    const preview = document.getElementById('avatar-preview');
    if(url.length > 5) {
        preview.innerText = '';
        preview.style.backgroundImage = `url('${url}')`;
    } else {
        preview.style.backgroundImage = 'none';
        preview.innerText = selectedAvatarIcon;
    }
}

function updatePreview(icon) {
    const preview = document.getElementById('avatar-preview');
    preview.style.backgroundImage = 'none';
    preview.innerText = icon;
}

async function saveAvatarSelection() {
    const customUrl = document.getElementById('custom-avatar-url').value.trim();
    const btn = event.target;
    btn.innerText = "جاري الحفظ...";
    
    const updateData = {};
    
    if(customUrl) {
        updateData.photoUrl = customUrl;
        updateData.avatarIcon = null; // نلغي الأيقونة لو فيه صورة
        userData.photoUrl = customUrl;
    } else {
        updateData.avatarIcon = selectedAvatarIcon;
        updateData.photoUrl = null;
        userData.avatarIcon = selectedAvatarIcon;
    }

    try {
        await db.collection('users').doc(currentUser.uid).update(updateData);
        allUsersCache = []; // تحديث الكاش ليظهر الجديد في القوائم
        updateUI();
        closeModal('modal-avatar');
        showToast("تم تحديث الصورة الشخصية 📸", "success");
    } catch(e) {
        showToast("فشل الحفظ", "error");
    } finally {
        btn.innerText = "حفظ الصورة";
    }
}


