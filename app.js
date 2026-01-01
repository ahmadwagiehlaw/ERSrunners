/* ERS Runners - V3.1 (Cleaned & Pro Admin) */

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
let currentChallengeFilter = 'all'; // 🔥 هذا السطر مهم جداً ليعرف التطبيق البداية

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

 
// ==================== V1.4 Admin Logic ====================

function switchAdminTab(tabName) {
    // 1. تحديث أزرار التبويب (إزالة التنشيط من الكل)
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(t => t.classList.remove('active'));

    // 2. تنشيط الزر الصحيح يدوياً بناءً على الاسم
    // (الترتيب: 0:overview, 1:inspector, 2:studio, 3:users)
    if (tabName === 'overview' && tabs[0]) tabs[0].classList.add('active');
    if (tabName === 'inspector' && tabs[1]) tabs[1].classList.add('active');
    if (tabName === 'studio' && tabs[2]) tabs[2].classList.add('active');
    if (tabName === 'users' && tabs[3]) tabs[3].classList.add('active');

    // 3. تحديث المحتوى
    document.querySelectorAll('.admin-content-section').forEach(s => s.classList.remove('active'));
    const content = document.getElementById('admin-' + tabName);
    if(content) content.classList.add('active');

    // 4. تحميل البيانات حسب التبويب
    if(tabName === 'overview') loadAdminStats();
    if(tabName === 'inspector') loadAdminRuns();
    if(tabName === 'studio') loadAdminChallengesList();
    if(tabName === 'users') loadAllUsersTable();
}
async function loadAdminStats() {
    // 1. حساب التواريخ
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60000); // 15 دقيقة للوراء

    // 2. المتواجدون الآن (Last Seen > 15 mins ago)
    // ملاحظة: تتطلب فهرس مركب في فايربيس، سنستخدم التصفية اليدوية مؤقتاً للأداء في القوائم الصغيرة
    const snapLive = await db.collection('users')
        .where('lastSeen', '>=', firebase.firestore.Timestamp.fromDate(fifteenMinsAgo))
        .orderBy('lastSeen', 'desc')
        .limit(20)
        .get();

    // 3. زوار اليوم
    const snapVisitors = await db.collection('users')
        .where('lastLoginDate', '==', todayStr).get();

    // 4. جريات اليوم
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const snapRuns = await db.collection('activity_feed')
        .where('timestamp', '>=', todayStart)
        .orderBy('timestamp', 'desc')
        .get();

    // 5. إجمالي الأعضاء (تقديري أو دقيق)
    // للجلب السريع، يفضل تخزين الرقم في وثيقة منفصلة، لكن هنا سنستخدم الحجم
    const snapTotal = await db.collection('users').get(); 

    // === تحديث العدادات ===
    if(document.getElementById('adm-live-now')) {
        document.getElementById('adm-live-now').innerText = snapLive.size;
        document.getElementById('adm-visitors-today').innerText = snapVisitors.size;
        document.getElementById('adm-runs-today').innerText = snapRuns.size;
        document.getElementById('adm-total-users').innerText = snapTotal.size;
    }

    // === ملء قائمة المتواجدين ===
    const liveList = document.getElementById('live-users-list');
    if(liveList) {
        let liveHtml = '';
        snapLive.forEach(doc => {
            const u = doc.data();
            liveHtml += `
            <div class="mini-user-row">
                <div class="mini-avatar">${(u.name||'?').charAt(0)}</div>
                <div class="mini-info">
                    <span class="mini-name">${u.name}</span>
                    <span class="mini-sub">${u.region || 'غير محدد'}</span>
                </div>
                <span class="status-pill">نشط الآن</span>
            </div>`;
        });
        liveList.innerHTML = liveHtml || '<div class="loader-placeholder">لا يوجد أعضاء أونلاين حالياً</div>';
    }

    // === ملء قائمة أحدث الأنشطة ===
    const runsList = document.getElementById('recent-runs-list');
    if(runsList) {
        let runsHtml = '';
        // نأخذ أول 10 فقط من النتائج
        const recentRuns = snapRuns.docs.slice(0, 10);
        recentRuns.forEach(doc => {
            const r = doc.data();
            const timeStr = r.timestamp ? r.timestamp.toDate().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '';
            runsHtml += `
            <div class="mini-user-row">
                <div class="mini-avatar" style="background:var(--bg-card); color:var(--primary);">${r.type === 'Run' ? '🏃' : '🚶'}</div>
                <div class="mini-info">
                    <span class="mini-name">${r.userName}</span>
                    <span class="mini-sub">${r.dist} كم • ${timeStr}</span>
                </div>
                <button onclick="viewUserProfile('${r.uid}')" style="background:none; border:none; color:#9ca3af; cursor:pointer;">👁️</button>
            </div>`;
        });
        runsList.innerHTML = runsHtml || '<div class="loader-placeholder">لا توجد جريات اليوم</div>';
    }

    // تحديث الرادار
    detectSuspiciousActivity();
}
function loadAdminRuns() {
    const list = document.getElementById('admin-runs-feed');
    if(!list) return;
    list.innerHTML = '<div style="text-align:center; padding:20px;"><span class="loader-btn"></span></div>';

    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(20).get().then(snap => {
        let html = '';
        snap.forEach(doc => {
            const run = doc.data();
            const timeAgo = getArabicTimeAgo(run.timestamp);
            const pace = (run.dist > 0) ? (run.time / run.dist).toFixed(1) : '-';
            
            // روابط الصور والإثباتات
            let evidence = '';
            if(run.img) evidence += `<a href="${run.img}" target="_blank" style="color:#8b5cf6;">[صورة]</a> `;
            if(run.link) evidence += `<a href="${run.link}" target="_blank" style="color:#3b82f6;">[رابط]</a>`;
            if(!evidence) evidence = '<span style="color:#6b7280;">بلا إثبات</span>';

            html += `
            <div class="inspector-card">
                <div class="inspector-header">
                    <div class="inspector-user">
                        <div style="width:20px; height:20px; background:#374151; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px;">${run.userName.charAt(0)}</div>
                        <span>${run.userName}</span>
                    </div>
                    <span class="inspector-meta">${timeAgo}</span>
                </div>
                
                <div class="inspector-data">
                    <div>
                        <span class="insp-val">${run.dist}</span> <span style="font-size:10px;">كم</span>
                    </div>
                    <div style="width:1px; height:20px; background:rgba(255,255,255,0.1);"></div>
                    <div>
                        <span class="insp-val" style="color:#fff;">${pace}</span> <span style="font-size:10px;">د/كم</span>
                    </div>
                    <div style="flex:1; text-align:left; font-size:11px;">
                        ${evidence}
                    </div>
                </div>

                <div class="insp-actions">
                    <button class="btn-insp btn-reject" onclick="adminForceDelete('${doc.id}', '${run.uid}', ${run.dist})">حذف 🗑️</button>
                    </div>
            </div>`;
        });
        list.innerHTML = html || '<div style="text-align:center; padding:20px;">لا توجد أنشطة</div>';
    });
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

    // 🔥 تحديث حالة التواجد (V1.5 Presence System)
    if (currentUser) {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // 2024-01-01
        
        db.collection('users').doc(currentUser.uid).update({
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(), // لتحديد المتواجدين الآن
            lastLoginDate: todayStr // لتحديد زوار اليوم
        }).catch(err => console.log("Presence Error", err));
    }

}

// ==================== 3. UI Updates & Profile ====================
function updateUI() {
    try {
        // --- تعديل الاسم (الأول + الثاني) ---
        const fullName = userData.name || "Runner";
        const nameParts = fullName.split(' '); // تقسيم الاسم لمصفوفة كلمات
        let displayName = nameParts[0]; // الاسم الأول
        
        // لو فيه اسم تاني، نضيفه
        if (nameParts.length > 1) {
            displayName += " " + nameParts[1];
        }
        
        const headerName = document.getElementById('headerName');
        if (headerName) headerName.innerText = displayName;
        // ------------------------------------

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

        // تحديث الشعلة 🔥
        const streakEl = document.getElementById('streak-badge');
        const streakCount = document.getElementById('streak-count');
        const myStreak = userData.currentStreak || 0;

        if (streakEl && streakCount) {
            if (myStreak > 0) {
                streakEl.style.display = 'flex';
                streakCount.innerText = myStreak + " يوم";
            } else {
                streakEl.style.display = 'none';
            }
        }
// ... باقي الكود كما هو ...
       // ... داخل updateUI ...
      const profileAvatar = document.getElementById('userMainAvatar'); // التصحيح
        
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

// ==================== V8.0 Pro Coach Engine (Training Planner) 🧠 ====================
// ==================== V9.0 Mastermind Coach Engine 🧠 ====================

const COACH_DB = {
    // 1. جداول التدريب (مخصصة حسب الهدف)
    workouts: {
        weight_loss: {
            long: "🏃‍♂️ مشي سريع أو هرولة 45 دقيقة (Zone 2) لحرق الدهون.",
            intervals: "🔥 تمرين حرق: دقيقة جري سريع / دقيقتين مشي (كرر 8 مرات).",
            tempo: "⏱️ 20 دقيقة هرولة متواصلة بدون توقف (ارفع النبض).",
            rest: "🍏 اليوم راحة. ركز على أكلك، المطبخ أهم من الجري لخسارة الوزن!"
        },
        speed: {
            long: "🐢 8 كم جري سهل جداً (Recovery Run) لتجهيز الرجل للسرعة.",
            intervals: "⚡ تراك: 400م في 90 ثانية / راحة دقيقة (كرر 10 مرات).",
            tempo: "🚀 30 دقيقة (Threshold Pace) - رتم سباق الـ 10 كم.",
            rest: "🛌 راحة تامة. عضلات السرعة تحتاج استشفاء كامل."
        },
        endurance: {
            long: "🛣️ Long Run: الموعد المقدس! 15-20 كم برتم محادثة.",
            intervals: "⛰️ فارتليك (Fartlek): دقيقتين سريع / دقيقتين بطيء لمدة ساعة.",
            tempo: "⏱️ 10 كم (Marathon Pace). عود جسمك على رتم السباق.",
            rest: "🧘 إطالات (Stretching) أو يوجا خفيفة."
        },
        general: { // الافتراضي
            long: "👟 جرية طويلة ممتعة (5-8 كم) في مكان جديد.",
            intervals: "💨 5 سرعات (Sprints) لمدة 30 ثانية في نهاية الجرية.",
            tempo: "⏱️ 3 كم رتم متوسط + 2 كم رتم سريع.",
            rest: "🚶 مشي خفيف أو يوم راحة."
        }
    },

    // 2. النصائح الفنية (مخصصة حسب الهدف)
    tips: {
        form: [
            "⚠️ ظهرك مفرود! الجري بظهر محني بيقفل الرئة ويقلل الأكسجين.",
            "🦶 انزل على وسط رجلك مش الكعب، ده بيقلل الصدمات على الركبة.",
            "👀 عينك لقدام 10 متر، متبصش تحت رجلك عشان تفتح صدرك.",
            "🛑 كتافك مشدودة؟ نزلهم وارخِ ايدك، الشد في الكتف بيضيع طاقة."
        ],
        weight_loss: [
            "💧 اشرب مية قبل الجري بـ 10 دقايق، ده بيزود الحرق 30%.",
            "🥗 الأكل بعد التمرين أهم من قبله. بروتين وسلطة عشان العضل يبني.",
            "🏃‍♂️ الجري الصبح ع الريق بيحرق من مخزون الدهون المباشر."
        ],
        speed: [
            "🚀 حرك دراعك أسرع، رجلك هتتحرك أسرع أوتوماتيك!",
            "💡 زود الـ Cadence (عدد الخطوات). خطوات قصيرة وسريعة أفضل من خطوات واسعة."
        ]
    }
};

// ==================== V11.0 Coach & Action Plan Logic ====================

function updateCoachAdvice() {
    const msgEl = document.getElementById('coach-message');
    const labelEl = document.querySelector('.coach-label');
    const iconEl = document.querySelector('.coach-icon'); // تحديد العنصر للصورة
    
    if(!msgEl) return;

    // 1. البيانات الأساسية
    const name = (userData.name || "يا بطل").split(' ')[0];
    const hasPlan = userData.activePlan && userData.activePlan.status === 'active';
    
    // إعداد النص الافتراضي
    let title = "نصيحة الكوتش";
    let message = `يا ${name}، الاستمرارية هي سر النجاح. لا تتوقف!`;

    // 2. إذا كان هناك خطة نشطة، الكوتش يتابعها
    if (hasPlan) {
        const plan = userData.activePlan;
        const startDate = new Date(plan.startDate);
        const dayNum = Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const weekNum = Math.ceil(dayNum / 7);
        
        title = `الأسبوع ${weekNum} - اليوم ${dayNum % 7 || 7}`;
        message = `أهلاً كابتن ${name}! إحنا ماشيين على خطة الـ <b>${plan.target}</b>. <br>ركز في تمرين النهاردة ومستني أشوف العلامة الخضراء! ✅`;
    }

    // 3. تجهيز الزر (إما إنشاء أو عرض)
    let actionBtn = '';
    
    if (hasPlan) {
        // زر عرض الخطة
        actionBtn = `
        <button onclick="openMyPlan()" class="btn-plan-action">
            <i class="ri-map-2-line"></i> عرض جدولي ومتابعة التنفيذ
        </button>`;
    } else {
        // زر إنشاء الخطة
        actionBtn = `
        <button onclick="openPlanWizard()" class="btn-plan-action">
            <i class="ri-magic-line"></i> صمم لي خطة تدريب
        </button>`;
    }

    // 4. العرض
    labelEl.innerText = title;
    msgEl.innerHTML = message + actionBtn;
    
    // (اختياري) يمكنك وضع كود هنا لتغيير صورة الكوتش لو أردت تغييرها برمجياً
    // iconEl.style.backgroundImage = "url('path/to/your/image.jpg')";
}

// --- دوال عرض الخطة (Action Plan) ---

function openMyPlan() {
    if (!userData.activePlan) return showToast("لا توجد خطة نشطة", "error");
    
    const container = document.getElementById('plan-timeline-container');
    const metaInfo = document.getElementById('plan-meta-info');
    const plan = userData.activePlan;
    
    // تحديث العنوان
    metaInfo.innerText = `هدف: ${plan.target} • أيام: ${plan.daysPerWeek}/أسبوع • مستوى: ${plan.level}`;
    
    // توليد الجدول (Simulated Logic based on Inputs)
    let html = '<div class="plan-timeline">';
    const totalWeeks = plan.target === '5k' ? 8 : (plan.target === '10k' ? 12 : 16);
    const startDate = new Date(plan.startDate);
    const today = new Date();
    
    // سنقوم بتوليد 4 أسابيع فقط للعرض (أو الكل حسب الرغبة)
    for (let w = 1; w <= totalWeeks; w++) {
        html += `<div style="color:var(--primary); font-weight:bold; margin:15px 0 10px 0;">الأسبوع ${w}</div>`;
        
        for (let d = 1; d <= plan.daysPerWeek; d++) {
            // حساب تاريخ هذا اليوم
            const dayOffset = ((w - 1) * 7) + ((d - 1) * 2); // نضرب في 2 لتوزيع الأيام (مجرد محاكاة)
            const taskDate = new Date(startDate);
            taskDate.setDate(startDate.getDate() + dayOffset);
            
            const isToday = taskDate.toDateString() === today.toDateString();
            const isPast = taskDate < today;
            // التحقق من قاعدة البيانات هل تم إنجاز هذا اليوم أم لا (سنفترض التخزين لاحقاً)
            // حالياً سنعتمد على التاريخ
            
            let statusClass = '';
            if (isToday) statusClass = 'today';
            else if (isPast) statusClass = 'done'; // نفترض أن الماضي تم إنجازه للمحاكاة

            // نوع التمرين (محاكاة ذكية)
            let workoutTitle = "جري مريح (Easy Run)";
            let workoutDesc = "3 كم برتم هادئ جداً.";
            
            if (d === parseInt(plan.daysPerWeek)) { // آخر يوم في الأسبوع
                workoutTitle = "جري طويل (Long Run)";
                workoutDesc = `${5 + w} كم برتم المحادثة.`;
            } else if (w % 2 === 0 && d === 1) {
                workoutTitle = "سرعة (Intervals)";
                workoutDesc = "400م سريع / 200م مشي (x6)";
            }

            html += `
            <div class="plan-day-card ${statusClass}">
                <div class="plan-day-header">
                    <span>اليوم ${d}</span>
                    <span>${taskDate.toLocaleDateString('ar-EG', {month:'short', day:'numeric'})}</span>
                </div>
                <div class="plan-day-title">${workoutTitle}</div>
                <div class="plan-day-desc">${workoutDesc}</div>
            </div>`;
        }
    }
    html += '</div>';
    
    container.innerHTML = html;
    document.getElementById('modal-view-plan').style.display = 'flex';
}


//========================================================
// دوال مساعدة للعرض
function getDayName(d) {
    const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    return days[d];
}
function getGoalName(g) {
    const names = { weight_loss: "حرق دهون", speed: "سرعة", endurance: "تحمل", general: "لياقة" };
    return names[g] || "عام";
}
// ==================== 5. Activity Log Logic ====================
// ==================== 1. فتح نافذة نشاط جديد (تنظيف كامل) ====================
function openNewRun() {
    // 1. تصفير متغيرات التعديل
    editingRunId = null;
    editingOldDist = 0;

    // 2. تنظيف الحقول النصية
    document.getElementById('log-dist').value = '';
    document.getElementById('log-time').value = '';
    document.getElementById('log-type').value = 'Run';
    document.getElementById('log-link').value = '';
    document.getElementById('save-run-btn').innerText = "حفظ النشاط";
    
    // 3. ضبط التاريخ
    const dateInput = document.getElementById('log-date');
    if(dateInput && typeof getLocalInputDate === 'function') dateInput.value = getLocalInputDate();

    // 4. (مهم) تنظيف حقول الصورة لضمان عدم وجود بقايا
    const imgInput = document.getElementById('uploaded-img-url');
    const preview = document.getElementById('img-preview');
    const status = document.getElementById('upload-status');
    const fileInput = document.getElementById('log-img-file');
    
    if(imgInput) imgInput.value = '';
    if(preview) { preview.src = ''; preview.style.display = 'none'; }
    if(status) status.innerText = '';
    if(fileInput) fileInput.value = '';

    // 5. فتح النافذة وتفعيل اللصق
    openLogModal();
    if(typeof enableSmartPaste === 'function') enableSmartPaste(); 
}

// ==================== 2. تعديل نشاط موجود (إظهار البيانات) ====================
// لاحظ: قمت بإضافة (img) في الأقواس لاستلام الصورة
window.editRun = function(id, dist, time, type, link, img) {
    // 1. وضع بيانات التعديل
    editingRunId = id;
    editingOldDist = dist;

    // 2. تعبئة الحقول
    document.getElementById('log-dist').value = dist;
    document.getElementById('log-time').value = time;
    document.getElementById('log-type').value = type;
    document.getElementById('log-link').value = link || '';
    document.getElementById('save-run-btn').innerText = "تعديل النشاط";

    // 3. معالجة الصورة في التعديل
    const imgInput = document.getElementById('uploaded-img-url');
    const preview = document.getElementById('img-preview');
    const status = document.getElementById('upload-status');
    const fileInput = document.getElementById('log-img-file');

    // تنظيف رسائل الحالة والملف القديم
    if(status) status.innerText = '';
    if(fileInput) fileInput.value = '';

    // لو الجرية فيها صورة، نعرضها ونحط الرابط في الحقل المخفي
    if (img && img !== 'undefined' && img !== 'null') {
        if(imgInput) imgInput.value = img;
        if(preview) { 
            preview.src = img; 
            preview.style.display = 'block'; 
        }
    } else {
        // لو مفيش صورة، ننظف الحقول
        if(imgInput) imgInput.value = '';
        if(preview) { preview.src = ''; preview.style.display = 'none'; }
    }

    // 4. فتح النافذة (مرة واحدة فقط)
    openLogModal();
}


// ================================================================= 

async function openChallengeDetails(chId) {
    const modal = document.getElementById('modal-challenge-details');
    const header = document.getElementById('ch-modal-header');
    const list = document.getElementById('ch-leaderboard-list');
    
    if(!modal) return;

    modal.style.display = 'flex';
    // تصفير المحتوى القديم وإظهار اللودر
    header.innerHTML = '<div style="padding:20px; text-align:center; color:#9ca3af;">جاري تحميل التفاصيل...</div>';
    list.innerHTML = '<div class="loader-placeholder">جاري سحب الأبطال...</div>';
    document.getElementById('ch-modal-title').innerText = "التفاصيل";

    try {
        // 1. جلب بيانات التحدي
        const chDoc = await db.collection('challenges').doc(chId).get();
        if (!chDoc.exists) {
            header.innerHTML = "التحدي غير موجود";
            return;
        } 
        const ch = chDoc.data();
        
        document.getElementById('ch-modal-title').innerText = ch.title;
        
        // تجهيز نصوص القواعد
        let rulesText = [];
        if(ch.rules?.requireImg) rulesText.push("📸 صورة مطلوبة");
        if(ch.rules?.minDistPerRun) rulesText.push(`📏 أقل مسافة ${ch.rules.minDistPerRun} كم`);
        if(rulesText.length === 0) rulesText.push("لا توجد شروط خاصة");
        
        // عرض الهيدر (الكارت العلوي)
        header.innerHTML = `
            <div style="font-size:14px; color:#fff; font-weight:bold;">
                ${ch.type === 'speed' ? '⚡ تحدي سرعة' : (ch.type === 'frequency' ? '🗓️ تحدي التزام' : '🛣️ سباق مسافات')}
            </div>
            <div style="font-size:11px; color:#9ca3af; margin-top:5px;">${rulesText.join(" • ")}</div>
            <div style="margin-top:10px; font-size:24px; font-weight:900; color:var(--primary);">
                ${ch.target} <span style="font-size:12px;">${ch.type==='frequency'?'مرة':'كم'}</span>
            </div>
        `;

        // 2. جلب المتصدرين
        const snap = await db.collection('challenges').doc(chId).collection('participants')
            .orderBy('progress', 'desc').limit(50).get();

        let html = '';
        if(snap.empty) { 
            list.innerHTML = '<div style="text-align:center; padding:20px; color:#6b7280;">كن أول المنضمين!</div>'; 
            return; 
        }
        
        snap.forEach((doc, index) => {
            const p = doc.data();
            const rank = index + 1;
            const isMe = (currentUser && doc.id === currentUser.uid);
            
            // تصحيح الأرقام لمنع خطأ NaN
            let safeProgress = Number(p.progress) || 0;
            
            // حساب نسبة التقدم
            let perc = 0;
            if(ch.target > 0) perc = Math.min((safeProgress / ch.target) * 100, 100);
            if(ch.type === 'speed' && p.completed) perc = 100;

            html += `
            <div class="leader-row" style="${isMe ? 'border:1px solid var(--primary); background:rgba(16,185,129,0.05);' : ''}">
                <div class="rank-col" style="color:#fff; font-weight:bold;">#${rank}</div>
                <div class="avatar-col" style="background-image:url('${p.photoUrl||''}'); background-size:cover;">
                    ${p.photoUrl ? '' : (p.name ? p.name[0] : '?')}
                </div>
                <div class="info-col">
                    <div class="name">${p.name} ${isMe?'(أنت)':''} ${p.completed?'✅':''}</div>
                    <div class="mini-xp-track" style="margin-top:5px; height:4px; background:rgba(255,255,255,0.1);">
                        <div class="mini-xp-fill" style="width:${perc}%; background:var(--accent);"></div>
                    </div>
                </div>
                <div class="dist-col" style="font-size:12px;">
                    ${safeProgress.toFixed(1)} <span style="font-size:9px; color:#6b7280;">${ch.type==='frequency'?'مرة':'كم'}</span>
                </div>
            </div>`;
        });
        
        list.innerHTML = html;

    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="text-align:center; color:#ef4444;">حدث خطأ في تحميل البيانات</div>';
    }
}
// ==================== 6. سجل الأنشطة (تصميم كروت احترافي V3.0) ====================
// ==================== 6. سجل الأنشطة (New Badge Logic) ====================
function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if(!list) return;

    // جلب البيانات
    db.collection('users').doc(currentUser.uid).collection('runs')
      .orderBy('timestamp', 'desc').limit(50).onSnapshot(snap => {
          
          if(snap.empty) { 
              list.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:#6b7280;">
                    <i class="ri-run-line" style="font-size:40px; margin-bottom:10px; display:block; opacity:0.5;"></i>
                    لا توجد أنشطة مسجلة بعد.<br>ابدأ أول جرية لك الآن!
                </div>`; 
              return; 
          }

          const runs = []; 
          
          // 1. استخراج البيانات وحساب الأرقام القياسية
          let maxDist = 0;
          let maxTime = 0;
          let bestPace = 999; // رقم كبير مبدئياً

          snap.forEach(doc => {
              const r = doc.data(); 
              r.id = doc.id;
              runs.push(r); // إضافة الجرية للمصفوفة

              // حساب الأرقام القياسية
              if (r.dist > maxDist) maxDist = r.dist;
              if (r.time > maxTime) maxTime = r.time;
              
              // حساب أفضل بيس (بشرط المسافة > 1 كم لتجنب أخطاء الـ GPS)
              if (r.dist >= 1 && r.time > 0) {
                  const p = r.time / r.dist;
                  if (p < bestPace) bestPace = p;
              }
          });

          // 2. تجميع حسب الشهر
          const groups = {};
          runs.forEach(r => {
              const date = r.timestamp ? r.timestamp.toDate() : new Date();
              const monthKey = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
              if(!groups[monthKey]) groups[monthKey] = [];
              groups[monthKey].push(r);
          });

          let html = '';

          // 3. عرض البيانات (لوب الشهور)
          for (const [month, monthRuns] of Object.entries(groups)) {
              const monthTotal = monthRuns.reduce((acc, curr) => acc + (parseFloat(curr.dist)||0), 0).toFixed(1);

              html += `
              <div class="log-group">
                  <div class="log-month-header">
                      <span>${month}</span>
                      <span style="font-size:10px; opacity:0.8;">إجمالي: ${monthTotal} كم</span>
                  </div>
              `;

              // 4. عرض الجريات داخل الشهر
              monthRuns.forEach(r => {
                  const dateObj = r.timestamp ? r.timestamp.toDate() : new Date();
                  const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
                  const dayNum = dateObj.getDate();
                  
                  // حساب البيس الحالي
                  let currentPace = 0;
                  if(r.dist > 0 && r.time > 0) currentPace = r.time / r.dist;
                  const paceDisplay = currentPace > 0 ? currentPace.toFixed(1) : '-';

                  // 🔥 تحديد نوع الإنجاز والألوان
                  let iconClass = r.type !== 'Walk' ? 'ri-run-line' : 'ri-walk-line';
                  let typeClass = r.type !== 'Walk' ? 'run' : 'walk';
                  let recordLabel = ''; 

                  // أ) هل هي الأطول مسافة؟ (الذهبي)
                  if (r.dist === maxDist && maxDist > 5) {
                      iconClass = 'ri-trophy-fill';
                      typeClass = 'record-gold';
                      recordLabel = '<span style="font-size:9px; color:#f59e0b; margin-right:5px;">(الأطول)</span>';
                  } 
                  // ب) هل هي الأسرع؟ (الأحمر) - بشرط تكون جري وليست مشي
                  else if (currentPace === bestPace && r.dist >= 1 && r.type === 'Run') {
                      iconClass = 'ri-flashlight-fill'; 
                      typeClass = 'record-fire';
                      recordLabel = '<span style="font-size:9px; color:#ef4444; margin-right:5px;">(الأسرع)</span>';
                  }
                  // ج) هل هي الأطول زمناً؟ (البنفسجي)
                  else if (r.time === maxTime && maxTime > 30) {
                      iconClass = 'ri-hourglass-fill';
                      typeClass = 'record-time';
                      recordLabel = '<span style="font-size:9px; color:#a78bfa; margin-right:5px;">(تحمل)</span>';
                  }

                  html += `
                  <div class="log-row-compact">
                      <div class="log-icon-wrapper ${typeClass}">
                          <i class="${iconClass}"></i>
                      </div>

                      <div class="log-details">
                          <div class="log-main-stat">
                              ${formatNumber(r.dist)} <span class="log-unit">كم</span>
                              ${recordLabel}
                          </div>
                          <div class="log-sub-stat">
                              <span><i class="ri-calendar-line"></i> ${dayNum} ${dayName}</span>
                              <span><i class="ri-timer-flash-line"></i> ${paceDisplay} د/كم</span>
                          </div>
                      </div>

                      <div class="log-actions">
                          <button class="btn-icon-action share" onclick="generateShareCard('${r.dist}', '${r.time}', '${dayNum} ${month}')">
                              <i class="ri-share-forward-line"></i>
                          </button>
                          
                          <button class="btn-icon-action" onclick="editRun('${r.id}', ${r.dist}, ${r.time}, '${r.type}', '${r.link || ''}', '${r.img || ''}')">
                              <i class="ri-pencil-line"></i>
                          </button>
                          
                          <button class="btn-icon-action delete" onclick="deleteRun('${r.id}', ${r.dist})">
                              <i class="ri-delete-bin-line"></i>
                          </button>
                      </div>
                  </div>`;
              });

              html += `</div>`; // إغلاق ديف الشهر
          }

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
    // ... (داخل viewUserProfile) ...

    // 🔥 عرض البادجات في بروفايل العضو (ميزة جديدة)
    const badgesContainer = document.createElement('div');
    badgesContainer.style.cssText = "margin-top:15px; display:flex; gap:5px; justify-content:center; flex-wrap:wrap;";
    
    if (user.badges && user.badges.length > 0) {
        user.badges.forEach(bId => {
            const badgeConfig = BADGES_CONFIG.find(x => x.id === bId);
            if(badgeConfig) {
                // لو أنا أدمن، أضيف زر الحذف عند الضغط
                const action = userData.isAdmin ? `onclick="adminRevokeBadge('${user.uid}', '${bId}')"` : '';
                const cursor = userData.isAdmin ? 'cursor:pointer; border:1px dashed #ef4444;' : '';
                
                badgesContainer.innerHTML += `
                    <div title="${userData.isAdmin ? 'اضغط للحذف' : badgeConfig.name}" ${action} 
                         style="background:rgba(255,255,255,0.1); padding:5px; border-radius:8px; font-size:16px; ${cursor}">
                        ${badgeConfig.icon}
                    </div>
                `;
            }
        });
    } else {
        badgesContainer.innerHTML = '<span style="font-size:10px; color:#6b7280;">لا توجد إنجازات</span>';
    }

    // تنظيف أي حاوية بادجات قديمة وإضافة الجديدة
    const existingBadges = document.getElementById('view-user-badges');
    if(existingBadges) existingBadges.remove();
    
    badgesContainer.id = 'view-user-badges';
    // إضافة البادجات بعد الـ stats-grid
    document.querySelector('#modal-view-user .stats-grid').after(badgesContainer);

    // ... (باقي الكود)
}

const REGION_AR = { "Cairo": "القاهرة", "Giza": "الجيزة", "Alexandria": "الإسكندرية", "Mansoura": "المنصورة", "Tanta": "طنطا", "Luxor": "الأقصر", "Aswan": "أسوان", "Red Sea": "البحر الأحمر", "Sinai": "سيناء", "Sharkia": "الشرقية", "Dakahlia": "الدقهلية", "Menofia": "المنوفية", "Gharbia": "الغربية", "Beni Suef": "بني سويف" };

async function loadRegionBattle() {
    const list = document.getElementById('region-battle-list');
    if (!list) return;
    
    // ✅ استخدام الهيكل العظمي الجديد بدلاً من النص
    list.innerHTML = getSkeletonHTML('squads');
    
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

        if (sorted.length === 0) { list.innerHTML = '<div style="text-align:center; padding:20px; color:#6b7280">لا توجد بيانات</div>'; return; }
        
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
    } catch (e) { 
        console.error(e);
        list.innerHTML = '<div style="text-align:center; color:red">خطأ في التحميل</div>'; 
    }
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

// ==================== عرض المنشورات (محدث لزر الصورة) ====================
function loadGlobalFeed() {
    const list = document.getElementById('global-feed-list');
    if(!list) return;

    // عرض الهيكل العظمي عند التحميل لأول مرة
    if(!list.hasChildNodes() || list.innerHTML.includes('جاري التحميل')) {
        list.innerHTML = getSkeletonHTML('feed');
    }

    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
        let html = '';
        if(snap.empty) { 
            list.innerHTML = '<div style="text-align:center; font-size:12px; color:#6b7280;">لا توجد أنشطة مسجلة بعد<br>كن أول من يسجل!</div>'; 
            return; 
        }
        
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
                        <div class="feed-compact-text">
                            <strong>${p.userName}</strong> <span style="opacity:0.7">(${p.userRegion})</span>
                        </div>
                        <div class="feed-compact-text" style="margin-top:2px;">
                            ${p.type === 'Run' ? 'جري' : p.type} <span style="color:#10b981; font-weight:bold;">${formatNumber(p.dist)} كم</span>
                        </div>
                    </div>
                </div>
                
                <div class="feed-compact-action">
                    ${p.link ? `<a href="${p.link}" target="_blank" style="text-decoration:none; color:#3b82f6; font-size:14px;"><i class="ri-link"></i></a>` : ''}
                    
                    ${p.img ? `
                        <button onclick="window.open('${p.img}', '_blank')" style="background:none; border:none; cursor:pointer; color:#8b5cf6; font-size:14px; display:flex; align-items:center; gap:3px;">
                            <i class="ri-image-2-fill"></i> <span style="font-size:10px;">إثبات</span>
                        </button>
                    ` : ''}

                    <button class="feed-compact-btn" onclick="openReportModal('${doc.id}')" style="margin-right:auto; color:#ef4444;">
                        <i class="ri-flag-line"></i>
                    </button>

                    <button class="feed-compact-btn ${isLiked?'liked':''}" onclick="toggleLike('${doc.id}', '${p.uid}')">
                        <i class="${isLiked?'ri-heart-fill':'ri-heart-line'}"></i>
                        <span class="feed-compact-count">${(p.likes||[]).length || ''}</span>
                    </button>

                    <button class="feed-compact-btn" onclick="openComments('${doc.id}', '${p.uid}')" style="margin-right:8px;">
                        <i class="ri-chat-3-line"></i>
                        <span class="feed-compact-count">${commentsCount > 0 ? commentsCount : ''}</span>
                    </button>

                    <span class="feed-compact-meta" style="margin-right:5px;">${timeAgo}</span>
                </div>
            </div>`;
        });
        list.innerHTML = html;
    }, (error) => {
        console.error("Feed Error:", error);
        // في حالة الخطأ لا نفعل شيئاً أو نعرض رسالة بسيطة
    });
}
// ==================== 8. V3.0 Admin Dashboard (The Command Center) ====================

function openAdminAuth() {
    if (currentUser && userData && userData.isAdmin === true) {
        closeModal('modal-settings'); 
        setTimeout(() => { 
            switchView('admin'); 
            switchAdminTab('overview'); // تشغيل التبويب الافتراضي
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
                <button class="action-btn btn-ban" onclick="adminForceDelete('${doc.id}', '${run.uid}', ${dist})">حذف</button>
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


// دالة الحذف القسري للمشرفين (V3.1 Admin Fix)
async function adminForceDelete(feedId, userId, runDist) {
    if(!confirm("هل أنت متأكد من حذف هذا النشاط للمستخدم؟")) return;
    
    // تغيير نص الزر ليعرف الأدمن أن العملية جارية
    const btn = event.target;
    btn.innerText = "...";

    try {
        // 1. جلب بيانات المنشور من الـ Feed لمعرفة توقيته
        const feedDoc = await db.collection('activity_feed').doc(feedId).get();
        if (!feedDoc.exists) {
            // ربما حذفت بالفعل، نحذفها من الشاشة فقط
            btn.closest('.alert-card').remove();
            return;
        }
        const feedData = feedDoc.data();

        // 2. حذف الجرية من سجل المستخدم الأصلي (إذا وجدنا الرابط)
        // ملاحظة: الـ feed لا يحتوي دائماً على runId المربوط، لكننا سنحاول البحث بالتوقيت
        const runsQuery = await db.collection('users').doc(userId).collection('runs')
            .where('timestamp', '==', feedData.timestamp).get();
            
        if (!runsQuery.empty) {
            // وجدنا الجرية الأصلية عند المستخدم! نحذفها ونخصم المسافة
            runsQuery.forEach(async (doc) => {
                await doc.ref.delete();
            });
            
            // خصم المسافة من إجمالي المستخدم
            await db.collection('users').doc(userId).update({
                totalDist: firebase.firestore.FieldValue.increment(-runDist),
                totalRuns: firebase.firestore.FieldValue.increment(-1),
                monthDist: firebase.firestore.FieldValue.increment(-runDist)
            });
        }

        // 3. حذف المنشور من الـ Feed
        await db.collection('activity_feed').doc(feedId).delete();

        // 4. تحديث الرادار فوراً
        btn.closest('.alert-card').remove();
        showToast("تم تنظيف السجل بنجاح 🧹", "success");
        
        // تحديث العداد
        const countEl = document.getElementById('flagged-runs-count');
        if(countEl) countEl.innerText = Math.max(0, parseInt(countEl.innerText) - 1);

    } catch (e) {
        console.error(e);
        showToast("خطأ في الحذف: " + e.message, "error");
        btn.innerText = "حذف";
    }
}


    // تغيير نصوص الواجهة حسب النوع
function updateChallengeUI() {
    const type = document.getElementById('adv-ch-type').value;
    const lbl = document.getElementById('lbl-target');
    const input = document.getElementById('adv-ch-target');
    
    if(type === 'distance') {
        lbl.innerText = "المسافة الإجمالية (كم)";
        input.placeholder = "100";
    } else if (type === 'frequency') {
        lbl.innerText = "عدد الجريات المطلوبة";
        input.placeholder = "15";
    } else if (type === 'speed') {
        lbl.innerText = "أقصى بيس (دقيقة/كم)";
        input.placeholder = "4.5"; 
    }
}

// إظهار/إخفاء القواعد المتقدمة
// إصلاح زر الشروط الخاصة
function toggleRules() {
    const content = document.getElementById('rules-content');
    const currentStyle = window.getComputedStyle(content).display;
    
    if (currentStyle === 'none') {
        content.style.display = 'block';
        // تمرير لأسفل لرؤية الشروط
        content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        content.style.display = 'none';
    }
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

// فتح نافذة التعديل مع ملء البيانات الحالية (V9.0)
function openEditProfile() {
    // 1. ملء البيانات الأساسية
    document.getElementById('edit-name').value = userData.name || "";
    document.getElementById('edit-region').value = userData.region || "Cairo";
    document.getElementById('edit-gender').value = userData.gender || "male";
    document.getElementById('edit-birthyear').value = userData.birthYear || "";

    // 2. 🔥 ملء بيانات الكوتش (الجديدة)
    // إذا لم يكن المستخدم قد اختار سابقاً، نضع القيم الافتراضية
    document.getElementById('edit-goal').value = userData.trainingGoal || "general";
    document.getElementById('edit-level').value = userData.manualLevel || "beginner";

    // 3. عرض النافذة
    document.getElementById('modal-edit-profile').style.display = 'flex';
}
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
    
    // 🔥 أضف هذا السطر: إعادة رسم التحديات عند فتح التبويب
    if (tabName === 'active-challenges') {
        renderChallenges(); 
    }
}

function getSkeletonHTML(type) {
    // 1. المتصدرين
    if (type === 'leaderboard') {
        return Array(5).fill('').map(() => `
            <div class="sk-leader-row">
                <div class="skeleton sk-circle"></div>
                <div style="flex:1">
                    <div class="skeleton sk-line long"></div>
                    <div class="skeleton sk-line short"></div>
                </div>
            </div>`).join('');
    }
    
    // 2. المنشورات (Feed)
    if (type === 'feed') {
        return Array(3).fill('').map(() => `
            <div class="feed-card-compact" style="pointer-events:none;">
                <div class="feed-compact-content">
                    <div class="skeleton sk-circle" style="width:30px; height:30px;"></div>
                    <div style="flex:1">
                        <div class="skeleton sk-line" style="width:60%; height:10px; margin-bottom:5px;"></div>
                        <div class="skeleton sk-line" style="width:40%; height:8px;"></div>
                    </div>
                </div>
            </div>`).join('');
    }

    // 3. التحديات
    if (type === 'challenges') {
        return Array(3).fill('').map(() => `
            <div class="ch-card" style="border-color: rgba(255,255,255,0.05); pointer-events: none;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div class="skeleton sk-line" style="width:40%; height:20px;"></div>
                    <div class="skeleton sk-line" style="width:20%; height:15px;"></div>
                </div>
                <div class="skeleton" style="width:100%; height:60px; border-radius:10px; margin-bottom:15px; opacity:0.5;"></div>
                <div class="skeleton" style="width:100%; height:45px; border-radius:12px;"></div>
            </div>
        `).join('');
    }

    // 4. (الجديد 🔥) المناطق (Squads)
    if (type === 'squads') {
        return Array(5).fill('').map(() => `
            <div class="squad-row" style="pointer-events: none; border-color: rgba(255,255,255,0.05);">
                <div class="squad-header" style="margin-bottom:15px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="skeleton" style="width:28px; height:28px; border-radius:6px;"></div> <div class="skeleton" style="width:100px; height:15px;"></div> </div>
                    <div class="skeleton" style="width:60px; height:20px; border-radius:6px;"></div> </div>
                <div class="squad-stats-row" style="border:none; padding-top:0;">
                    <div class="skeleton" style="width:100%; height:8px; opacity:0.3;"></div>
                </div>
            </div>
        `).join('');
    }
    
    return '...';
}
// Notifications
function loadNotifications() {
    const list = document.getElementById('notifications-list');
    db.collection('users').doc(currentUser.uid).collection('notifications')
      .orderBy('timestamp','desc').limit(10).get().then(snap => {
        let html = '';
        snap.forEach(d => { 
            const msg = d.data().msg;
            // التحقق هل الإشعار إداري؟
            const isAdmin = msg.includes("إداري") || msg.includes("Admin") || msg.includes("تنبيه");
            const specialClass = isAdmin ? 'admin-alert' : '';
            const icon = isAdmin ? '📢' : (msg.includes('❤️') ? '❤️' : '🔔');

            html += `
            <div class="notif-item ${specialClass}">
                <div class="notif-icon" style="${isAdmin ? 'background:rgba(239,68,68,0.2); color:#ef4444;' : ''}">${icon}</div>
                <div class="notif-content">${msg}</div>
            </div>`; 
            
            if(!d.data().read) d.ref.update({read:true}); 
        });
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


// فتح مودال الهدف
function setPersonalGoal() {
    const currentGoal = userData.monthlyGoal || 0;
    document.getElementById('input-monthly-goal').value = currentGoal > 0 ? currentGoal : '';
    document.getElementById('modal-set-goal').style.display = 'flex';
}

// حفظ الهدف في قاعدة البيانات
async function savePersonalGoal() {
    const val = parseFloat(document.getElementById('input-monthly-goal').value);
    if (!val || val <= 0) return showToast("أدخل رقماً صحيحاً", "error");

    const btn = event.target;
    btn.innerText = "...";
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            monthlyGoal: val
        });
        
        userData.monthlyGoal = val;
        updateUI(); // لتحديث الدائرة فوراً
        updateGoalRing(); // تحديث الدائرة تحديداً
        
        closeModal('modal-set-goal');
        showToast("تم تحديد الهدف! بالتوفيق 🔥", "success");
    } catch(e) {
        console.error(e);
        showToast("حدث خطأ", "error");
    } finally {
        btn.innerText = "حفظ الهدف 🎯";
    }
}
// Profile Editing
// حفظ بيانات البروفايل والكوتش (V9.0)
async function saveProfileChanges() {
    const name = document.getElementById('edit-name').value.trim();
    const region = document.getElementById('edit-region').value;
    const gender = document.getElementById('edit-gender').value;
    const birthYear = document.getElementById('edit-birthyear').value;
    
    // 🔥 قراءة البيانات الجديدة للكوتش من القوائم
    const goal = document.getElementById('edit-goal').value;
    const level = document.getElementById('edit-level').value;

    if (name.length < 3) return showToast("الاسم قصير", "error");
    
    const btn = event.target; 
    btn.innerText = "جاري الحفظ..."; 
    btn.disabled = true;
    
    try {
        // إرسال التحديث لفايربيس
        await db.collection('users').doc(currentUser.uid).update({ 
            name: name,
            region: region,
            gender: gender,
            birthYear: birthYear,
            trainingGoal: goal, // حفظ الهدف
            manualLevel: level  // حفظ المستوى المختار يدوياً
        });
        
        // تحديث المتغيرات المحلية فوراً (عشان التغيير يظهر بدون ريفريش)
        userData.name = name; 
        userData.region = region; 
        userData.gender = gender; 
        userData.birthYear = birthYear;
        userData.trainingGoal = goal;
        userData.manualLevel = level;

        allUsersCache = []; // تصفير الكاش لتحديث القوائم والترتيب
        
        updateUI(); // تحديث الواجهة
        closeModal('modal-edit-profile'); 
        showToast("تم تحديث البروفايل والخطة ✅", "success");
        
        // 🔥 تحديث رسالة الكوتش فوراً بناءً على الاختيار الجديد
        if(typeof updateCoachAdvice === 'function') updateCoachAdvice();

    } catch (e) { 
        console.error(e);
        showToast("حدث خطأ أثناء الحفظ", "error"); 
    } 
    finally { 
        btn.innerText = "حفظ التغييرات"; 
        btn.disabled = false; 
    }
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


// عرض التحديات بذكاء (V4.1 Smart Display)
// ==================== V5.0 Challenge Engine & Admin Tools ====================

let allChallengesCache = [];


// تحميل وعرض التحديات (Fixed V6.2)
function loadActiveChallenges() {
    const list = document.getElementById('challenges-list');
    const mini = document.getElementById('my-active-challenges'); 
    
    if(!list) return;
    
    // عرض الهيكل العظمي فقط إذا كانت القائمة فارغة تماماً
    if(allChallengesCache.length === 0) {
        list.innerHTML = getSkeletonHTML('challenges');
    }

    db.collection('challenges')
      .where('active', '==', true)
      .get()
      .then(async snap => {
        if(snap.empty) { 
            list.innerHTML = "<div class='empty-state-fun'><span class='fun-icon'>👻</span><div class='fun-title'>مفيش تحديات</div></div>"; 
            if(mini) mini.innerHTML="<div class='empty-state-mini'>لا تحديات</div>"; 
            return; 
        }

        allChallengesCache = []; // تصفير الكاش
        let miniHtml = '';

        for(const doc of snap.docs) {
            const ch = doc.data();
            let isJoined = false, progress = 0, completed = false;
            
            if(currentUser) {
                const p = await doc.ref.collection('participants').doc(currentUser.uid).get();
                if(p.exists) { 
                    const pData = p.data();
                    isJoined = true; 
                    progress = pData.progress || 0; 
                    completed = pData.completed === true;
                }
            }
            
            allChallengesCache.push({ id: doc.id, ...ch, isJoined, progress, completed });

            // تجميع المصغرات للصفحة الرئيسية
            if (isJoined && mini) {
                let perc = 0;
                // حماية من القسمة على صفر
                const safeTarget = ch.target > 0 ? ch.target : 1; 
                
                if (ch.type === 'speed') perc = completed ? 100 : 0;
                else perc = Math.min((progress / safeTarget) * 100, 100);

                // 🔥 التعديل هنا: عند الضغط، نذهب لصفحة التحديات ونفتح تبويب التحديات النشطة
                miniHtml += `
                <div class="mini-challenge-card" onclick="switchView('challenges'); setTab('active-challenges');" style="cursor:pointer; border-left: 3px solid ${completed?'#10b981':'var(--accent)'}">
                    <div class="mini-ch-title">${ch.title}</div>
                    <div class="mini-ch-progress">
                        <div class="mini-ch-fill" style="width:${perc}%; background:${completed?'#10b981':'var(--primary)'}"></div>
                    </div>
                    <div style="font-size:9px; color:#9ca3af; display:flex; justify-content:space-between; margin-top:4px;">
                        <span>${ch.type === 'speed' ? (completed?'نجحت!':'حاول') : Math.floor(progress)}</span>
                        <span>${ch.target}</span>
                    </div>
                </div>`;
            }
        }

        // 🔥 الإصلاح هنا: إعادة تعيين الفلتر وتحديث العرض فوراً
        currentChallengeFilter = 'all'; 
        
        // تنشيط زر "الكل" بصرياً
        document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        const allBtn = document.querySelector('.filter-pill:first-child'); 
        if(allBtn) allBtn.classList.add('active');

        renderChallenges(); // رسم القائمة فوراً

        if (mini) {
            mini.innerHTML = miniHtml || "<div class='empty-state-mini'>لم تنضم لتحديات بعد</div>";
        }
    });
}

let currentReportFeedId = null;

// فتح نافذة تفاصيل التحدي
// ==================== V5.4 Challenge Details (Rank Fixed) ====================

async function openChallengeDetails(chId) {
    const modal = document.getElementById('modal-challenge-details');
    const header = document.getElementById('ch-modal-header');
    const list = document.getElementById('ch-leaderboard-list');
    
    if(!modal) return;

    // 1. فتح المودال وعرض لودر
    modal.style.display = 'flex';
    list.innerHTML = '<div class="loader-placeholder">جاري سحب الأبطال...</div>';
    header.innerHTML = ''; // تنظيف الهيدر مؤقتاً

    try {
        // 2. جلب بيانات التحدي الأساسية
        const chDoc = await db.collection('challenges').doc(chId).get();
        if (!chDoc.exists) return showToast("التحدي غير موجود", "error");
        
        const ch = chDoc.data();
        const target = parseFloat(ch.target) || 1; // لتجنب القسمة على صفر
        document.getElementById('ch-modal-title').innerText = ch.title;

        // 3. رسم كارت الهيدر الفخم (نفس الستايل الذهبي)
        let typeIcon = ch.type === 'speed' ? '⚡' : '🛣️';
        let typeText = ch.type === 'speed' ? 'تحدي سرعة' : 'سباق مسافات';
        
        header.innerHTML = `
            <div style="text-align:center; width:100%;">
                <div style="font-size:14px; color:#fff; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:5px;">
                    <span>${typeIcon}</span> ${typeText}
                </div>
                
                <div style="font-size:11px; color:#9ca3af; margin-top:5px; display:flex; gap:10px; justify-content:center;">
                    <span><i class="ri-flag-line"></i> هدف: ${ch.target} ${ch.type==='frequency'?'مرة':'كم'}</span>
                    <span><i class="ri-time-line"></i> المدة: ${ch.durationDays || 30} يوم</span>
                </div>

                <div style="margin-top:15px; font-size:32px; font-weight:900; color:var(--primary); text-shadow:0 0 20px rgba(16,185,129,0.3);">
                    ${ch.target} <span style="font-size:14px; font-weight:normal;">كم</span>
                </div>
            </div>
        `;

        // 4. جلب وترتيب المشاركين (إصلاح الـ NaN)
        const snap = await db.collection('challenges').doc(chId).collection('participants')
            .orderBy('progress', 'desc').limit(50).get();

        if (snap.empty) {
            list.innerHTML = '<div style="text-align:center; padding:30px; color:#6b7280;">لا يوجد مشاركين بعد.<br>كن أنت الأول! 🚀</div>';
            return;
        }

        let html = '';
        snap.docs.forEach((doc, index) => {
            const p = doc.data();
            const rank = index + 1;
            const isMe = (currentUser && doc.id === currentUser.uid);
            
            // 🔥🔥🔥 الإصلاح الجذري للـ NaN 🔥🔥🔥
            // نحاول تحويل القيمة لرقم، ولو فشل نستخدم صفر
            let safeProgress = parseFloat(p.progress);
            if (isNaN(safeProgress)) safeProgress = 0;

            // حساب النسبة المئوية
            let percent = Math.min((safeProgress / target) * 100, 100);
            if (ch.type === 'speed' && p.completed) percent = 100;

            // تحديد شكل الأفاتار
            let avatarHtml = '';
            if (p.photoUrl) {
                avatarHtml = `<div class="avatar-col" style="background-image:url('${p.photoUrl}'); background-size:cover; border:1px solid #444;"></div>`;
            } else {
                let initial = p.name ? p.name.charAt(0).toUpperCase() : '?';
                avatarHtml = `<div class="avatar-col" style="background:#374151; display:flex; align-items:center; justify-content:center; color:#fff;">${initial}</div>`;
            }

            // ستايل الصف (تمييز نفسي)
            let rowStyle = isMe 
                ? 'border:1px solid var(--primary); background:rgba(16,185,129,0.05);' 
                : 'border-bottom:1px solid rgba(255,255,255,0.05);';

            // تلوين المراكز الأولى
            let rankBadge = `<span style="font-weight:bold; color:#9ca3af;">#${rank}</span>`;
            if (rank === 1) rankBadge = '🥇';
            if (rank === 2) rankBadge = '🥈';
            if (rank === 3) rankBadge = '🥉';

            html += `
            <div class="leader-row" style="${rowStyle} padding:12px; border-radius:12px; margin-bottom:8px;">
                <div class="rank-col" style="font-size:16px;">${rankBadge}</div>
                ${avatarHtml}
                
                <div class="info-col">
                    <div class="name" style="color:#fff; font-size:13px;">
                        ${p.name || 'مستخدم'} ${isMe ? '<span style="color:var(--primary); font-size:10px;">(أنت)</span>' : ''}
                    </div>
                    
                    <div style="width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:5px; overflow:hidden;">
                        <div style="width:${percent}%; height:100%; background:${p.completed ? '#10b981' : 'var(--accent)'};"></div>
                    </div>
                </div>

                <div class="dist-col" style="text-align:left;">
                    <span style="display:block; font-size:14px; font-weight:bold; color:#fff;">${safeProgress.toFixed(1)}</span>
                    <span style="font-size:10px; color:#9ca3af;">${ch.type==='frequency'?'مرة':'كم'}</span>
                </div>
            </div>`;
        });

        list.innerHTML = html;

    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="text-align:center; color:#ef4444; padding:20px;">حدث خطأ في تحميل البيانات</div>';
    }
}

// ==================== Community Reporting System (V5.0) ====================

function openReportModal(feedId) {
    currentReportFeedId = feedId;
    document.getElementById('modal-report').style.display = 'flex';
}

async function submitReport() {
    const reason = document.getElementById('report-reason').value;
    if(!currentReportFeedId) return;
    
    const btn = event.target;
    btn.innerText = "جاري الإرسال...";
    
    try {
        // إضافة البلاغ في كولكشن منفصل
        await db.collection('reports').add({
            feedId: currentReportFeedId,
            reporterId: currentUser.uid,
            reporterName: userData.name,
            reason: reason,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending' // pending, resolved
        });
        
        // يمكننا أيضاً إضافة علامة على البوست نفسه
        /* await db.collection('activity_feed').doc(currentReportFeedId).update({
            flags: firebase.firestore.FieldValue.increment(1)
        }); */

        showToast("تم استلام البلاغ، شكراً لحرصك 👮‍♂️", "success");
        closeModal('modal-report');
    } catch(e) {
        showToast("حدث خطأ", "error");
    } finally {
        btn.innerText = "إرسال البلاغ";
    }
}



//==========================================
function setChallengeFilter(filter, btn) {
    currentChallengeFilter = filter;
    
    // تحديث شكل الأزرار
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // إعادة الرسم
    renderChallenges(currentChartMode); // تمرير أي قيمة، الفلترة ستتم بالداخل
}

//==========================================
function renderChallenges(dummy) {
    const list = document.getElementById('challenges-list');
    
    // 1. تطبيق الفلترة
    let displayList = allChallengesCache;

    if (currentChallengeFilter === 'joined') {
        displayList = displayList.filter(ch => ch.isJoined && !ch.completed);
    } else if (currentChallengeFilter === 'new') {
        displayList = displayList.filter(ch => !ch.isJoined);
    } else if (currentChallengeFilter === 'completed') {
        displayList = displayList.filter(ch => ch.completed);
    }

    // 2. الحالة الفارغة (مع رسائل مضحكة حسب الفلتر)
    if (displayList.length === 0) {
        let funIcon = "👻";
        let funTitle = "المكان مهجور يا كابتن!";
        let funDesc = "مفيش تحديات هنا حالياً.. ارجع بعدين";

        // تخصيص الرسالة حسب الفلتر
        if (currentChallengeFilter === 'joined') {
            funIcon = "🐢";
            funTitle = "إيه الكسل ده؟";
            funDesc = "أنت مش مشترك في أي تحدي لسه!<br>روح على <b>'جديدة'</b> واشترك يا بطل وبطل فرجة 😂";
        } else if (currentChallengeFilter === 'new') {
            funIcon = "✅";
            funTitle = "خلصت كل حاجة!";
            funDesc = "يا جامد! مفيش تحديات جديدة قدامك.<br>أنت ختمت اللعبة ولا إيه؟";
        } else if (currentChallengeFilter === 'completed') {
            funIcon = "🏆";
            funTitle = "لسه بدري ع الكؤوس";
            funDesc = "لسه مخلصتش ولا تحدي؟<br>شد حيلك شوية يا وحش عايزين نشوف ميداليات!";
        }

        list.innerHTML = `
            <div class="empty-state-fun">
                <span class="fun-icon">${funIcon}</span>
                <div class="fun-title">${funTitle}</div>
                <div class="fun-desc">${funDesc}</div>
            </div>`;
        return;
    }

    // 3. عرض الكروت (نفس الكود السابق)
    let fullHtml = '';
    displayList.forEach(ch => {
        // ... (نفس منطق حساب الوقت والأزرار السابق) ...
        
        let daysLeftText = "مستمر";
        let isUrgent = false;
        if (ch.startDate) {
            const start = new Date(ch.startDate);
            const end = new Date(start);
            end.setDate(end.getDate() + (ch.durationDays || 30));
            const diffTime = end - new Date();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) daysLeftText = "انتهى";
            else if (diffDays <= 3) { daysLeftText = `🔥 باقي ${diffDays} يوم`; isUrgent = true; }
            else daysLeftText = `⏳ باقي ${diffDays} يوم`;

            // 🔥 الفوتر الجديد (V6.5 Animated & Compact)
        
        // تحديد أيقونة وكلاس الوقت
        let timeIcon = "ri-hourglass-2-fill";
        let timeClass = "time";
        
        if (isUrgent) {
            timeIcon = "ri-fire-fill"; // شعلة لو الوقت قليل
            timeClass = "time urgent";
        } else if (diffDays < 0) {
            timeIcon = "ri-checkbox-circle-fill";
            timeClass = "time done";
        }

        const metaFooter = `
            <div class="ch-meta-footer">
                <div class="meta-pill social" title="عدد الأبطال المشاركين">
                    <i class="ri-group-fill"></i> 
                    <span>${ch.participantsCount || 0}</span>
                </div>

                <div class="meta-pill ${timeClass}">
                    <span>${daysLeftText}</span>
                    <i class="${timeIcon}"></i>
                </div>
            </div>
        `;
        }

        // أزرار الأدمن
        let adminControls = '';
        if (userData.isAdmin) {
            adminControls = `
            <div style="position:absolute; top:15px; left:15px; display:flex; gap:8px; z-index:50;">
                <div class="admin-del-btn" onclick="editChallenge('${ch.id}')" title="تعديل" style="position:static; background:rgba(245, 158, 11, 0.15); color:#f59e0b; border-color:rgba(245, 158, 11, 0.3); width:32px; height:32px;"><i class="ri-pencil-line"></i></div>
                <div class="admin-del-btn" onclick="deleteChallenge('${ch.id}')" title="حذف" style="position:static; width:32px; height:32px;"><i class="ri-delete-bin-line"></i></div>
            </div>`;
        }

        const infoBtn = `
            <button onclick="openChallengeDetails('${ch.id}')" class="ch-leaderboard-btn" style="right:50%; transform:translateX(50%); top:15px; left:auto; z-index:40;">
                <i class="ri-trophy-fill"></i> الترتيب
            </button>
        `;

        let actionBtn = '';
        if (!ch.isJoined) {
            actionBtn = `<button class="ch-join-btn" onclick="joinChallenge('${ch.id}')" style="position:relative; z-index:100; cursor:pointer; margin-top:15px;">قبول التحدي</button>`;
        } else if (ch.completed) {
            actionBtn = `<div style="margin-top:15px; text-align:center; color:#10b981; font-weight:bold; font-size:12px; background:rgba(16,185,129,0.1); padding:8px; border-radius:8px;">🎉 التحدي مكتمل</div>`;
        }

        const metaFooter = `
            <div class="ch-meta-footer">
                <div class="ch-meta-item">
                    <i class="ri-group-line"></i> <span>${ch.participantsCount || 0} مشارك</span>
                </div>
                <div class="ch-meta-item ${isUrgent ? 'urgent' : ''}">
                    ${daysLeftText}
                </div>
            </div>
        `;

        // دمج التصميمات
        if (ch.type === 'speed') {
            const isDone = ch.completed;
            fullHtml += `
            <div class="ch-card speed-mode ${isDone?'done':''}">
                ${adminControls} ${infoBtn}
                <div style="margin-top: 45px;">
                    <h3 style="margin:0; font-size:16px; color:#fff;">${ch.title}</h3>
                    <div class="speed-gauge" style="margin-top:10px;">${ch.target} <span style="font-size:12px">د/كم</span></div>
                </div>
                ${ch.isJoined ? (isDone ? `<span class="speed-status" style="background:rgba(16,185,129,0.2); color:#10b981">🚀 حطمت الرقم!</span>` : `<span class="speed-status">أسرع بيس لك: --</span>`) : actionBtn}
                ${metaFooter}
            </div>`;
        }
        else if (ch.type === 'frequency') {
            let dotsHtml = '';
            const maxDots = Math.min(ch.target, 14); 
            for(let i=0; i<maxDots; i++) {
                const filled = i < ch.progress ? 'filled' : '';
                dotsHtml += `<div class="habit-dot ${filled}"></div>`;
            }
            if(ch.target > 14) dotsHtml += `<span style="font-size:10px; color:#fff; align-self:center;">+${ch.target-14}</span>`;

            fullHtml += `
            <div class="ch-card habit-mode">
                ${adminControls} ${infoBtn}
                <div class="ch-header-centered" style="margin-top:40px;">
                    <h3 style="margin:0; font-size:16px; color:#fff;">${ch.title}</h3>
                    <span style="font-size:10px; color:#c4b5fd; margin-top:5px;">هدف: ${ch.target} جرية</span>
                </div>
                ${ch.isJoined ? `<div class="habit-grid">${dotsHtml}</div><span class="habit-counter">${Math.floor(ch.progress)} / ${ch.target}</span>${actionBtn}` : actionBtn}
                ${metaFooter}
            </div>`;
        }
        else {
            const perc = Math.min((ch.progress / ch.target) * 100, 100);
            fullHtml += `
            <div class="ch-card dist-mode">
                ${adminControls} ${infoBtn}
                <div class="ch-header-centered" style="margin-top:40px;">
                    <h3 style="margin:0; font-size:16px; color:#fff;">${ch.title}</h3>
                    <div style="display:flex; gap:10px; align-items:center; margin-top:5px; justify-content:center;">
                        <span style="font-size:14px; font-weight:bold; color:#fff;">${Math.floor(ch.progress)} <span style="font-size:10px; opacity:0.6">/ ${ch.target} كم</span></span>
                    </div>
                </div>
                ${ch.isJoined ? `<div class="road-track"><div class="road-fill" style="width:${perc}%"></div></div>${actionBtn}` : actionBtn}
                ${metaFooter}
            </div>`;
        }
    });
    list.innerHTML = fullHtml;
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



function toggleChallengeInputs() {
    const type = document.getElementById('adv-ch-type').value;
    const lbl = document.getElementById('lbl-target');
    const input = document.getElementById('adv-ch-target');
    
    if(type === 'distance') {
        lbl.innerText = "المسافة المطلوبة (كم)";
        input.placeholder = "100";
    } else if (type === 'frequency') {
        lbl.innerText = "عدد الجريات المطلوبة";
        input.placeholder = "15";
    } else if (type === 'speed') {
        lbl.innerText = "السرعة المطلوبة (دقيقة/كم)";
        input.placeholder = "4.5"; // يعني 4 دقائق و30 ثانية
    }
}

// ==================== 13. ImgBB Upload Logic (V1.6) ====================
async function uploadImageToImgBB() {
    const fileInput = document.getElementById('log-img-file');
    const status = document.getElementById('upload-status');
    const preview = document.getElementById('img-preview');
    const hiddenInput = document.getElementById('uploaded-img-url');
    const saveBtn = document.getElementById('save-run-btn');

    // 1. التأكد من وجود ملف
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];

    // 2. تحديث الواجهة (جاري الرفع)
    status.innerText = "جاري رفع الصورة... ⏳";
    status.style.color = "#f59e0b"; // برتقالي
    saveBtn.disabled = true; // نمنع الحفظ لحد ما الرفع يخلص
    saveBtn.innerText = "انتظر...";

    // 3. تجهيز البيانات (بالمفتاح بتاعك)
    const formData = new FormData();
    formData.append("image", file);
    const API_KEY = "0d0b1fefa53eb2fc054b27c6395af35c"; // 🔑 مفتاحك

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            // 4. نجح الرفع!
            const imageUrl = data.data.url;
            hiddenInput.value = imageUrl; // نخزن الرابط في الحقل المخفي
            
            // نعرض الصورة
            preview.src = imageUrl;
            preview.style.display = 'block';
            
            status.innerText = "تم إرفاق الصورة بنجاح ✅";
            status.style.color = "#10b981"; // أخضر
            
            // نرجع زر الحفظ
            saveBtn.disabled = false;
            saveBtn.innerText = "حفظ النشاط";
            
            if(typeof showToast === 'function') showToast("تم رفع الصورة 📸", "success");
        } else {
            throw new Error(data.error ? data.error.message : "فشل غير معروف");
        }

    } catch (error) {
        console.error("ImgBB Error:", error);
        status.innerText = "فشل الرفع! تأكد من النت ❌";
        status.style.color = "#ef4444";
        saveBtn.disabled = false;
        saveBtn.innerText = "حفظ النشاط";
        alert("لم نتمكن من رفع الصورة، حاول مرة أخرى.");
    }
}

// ==================== V6.0 Streak Logic ====================

function updateStreakLogic(newRunDate) {
    const lastRunStr = userData.lastRunDate || "";
    const todayStr = newRunDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    let currentStreak = userData.currentStreak || 0;

    // 1. إذا كان أول مرة يجري
    if (!lastRunStr) {
        return { streak: 1, lastDate: todayStr };
    }

    // 2. إذا كان جرى اليوم بالفعل (لا نزيد العداد)
    if (lastRunStr === todayStr) {
        return { streak: currentStreak, lastDate: todayStr };
    }

    // 3. حساب الفرق بالأيام
    const lastDate = new Date(lastRunStr);
    const newDate = new Date(todayStr);
    const diffTime = Math.abs(newDate - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        // جرى بالأمس -> سلسلة متصلة 🔥
        return { streak: currentStreak + 1, lastDate: todayStr };
    } else {
        // فاته يوم أو أكثر -> ابدأ من جديد 😢
        return { streak: 1, lastDate: todayStr };
    }
}

// ==================== V5.0 Challenge Details & Reporting ====================

// 1. دالة فتح تفاصيل التحدي (ليدربورد)
// ==================== V5.3 Challenge Details (NaN Fix Final) ====================

async function openChallengeDetails(chId) {
    const modal = document.getElementById('modal-challenge-details');
    const header = document.getElementById('ch-modal-header');
    const list = document.getElementById('ch-leaderboard-list');
    
    if(!modal) return;

    modal.style.display = 'flex';
    list.innerHTML = '<div class="loader-placeholder">جاري بناء المنصة...</div>';
    header.innerHTML = ''; 
    header.style.padding = '0'; // إزالة الحواف للتصميم الجديد
    header.style.background = 'none';
    header.style.border = 'none';

    try {
        // 1. جلب بيانات التحدي
        const chDoc = await db.collection('challenges').doc(chId).get();
        if (!chDoc.exists) return showToast("التحدي غير موجود", "error");
        
        const ch = chDoc.data();
        const target = parseFloat(ch.target) || 1; 
        document.getElementById('ch-modal-title').innerText = ch.title;

        // 2. جلب بياناتي أنا في هذا التحدي (للعرض في الهيدر)
        let myProgress = 0;
        let amIJoined = false;
        if(currentUser) {
            const myEntry = await db.collection('challenges').doc(chId).collection('participants').doc(currentUser.uid).get();
            if(myEntry.exists) {
                amIJoined = true;
                // 🔥 الفلتر القوي لعلاج NaN
                let raw = myEntry.data().progress;
                myProgress = (typeof raw === 'number' && !isNaN(raw)) ? raw : 0;
            }
        }

        // حساب النسبة للدائرة
        let myPerc = Math.min((myProgress / target) * 100, 100);
        const deg = (myPerc / 100) * 360;

        // 3. رسم الهيدر الثوري (الدائرة الكبيرة)
        let headerHtml = `
            <div class="rev-modal-header">
                <div class="rev-progress-circle" style="--prog:${deg}deg; --primary:${ch.type==='speed'?'#ef4444':'#10b981'}">
                    <div class="rev-progress-content">
                        <span class="rev-val">${amIJoined ? myProgress.toFixed(1) : '0'}</span>
                        <span class="rev-unit">${ch.type === 'frequency' ? 'مرات' : 'كم'}</span>
                    </div>
                </div>
                <div style="color:#fff; font-weight:bold; font-size:14px;">
                    ${amIJoined ? (myPerc >= 100 ? '🎉 التحدي مكتمل!' : '🔥 متكسلش يا بطل!') : 'انضم الآن للتحدي'}
                </div>
                <div style="font-size:11px; color:#9ca3af; margin-top:5px;">
                    الهدف النهائي: ${ch.target} ${ch.type==='frequency'?'مرة':'كم'}
                </div>
        `;
        
        // إضافة زر الانضمام داخل الهيدر لو لم يكن مشتركاً
        if(!amIJoined) {
            headerHtml += `<button onclick="joinChallenge('${chId}')" class="btn btn-primary" style="margin-top:15px; padding:10px; font-size:12px;">قبول التحدي 🚀</button>`;
        }
        
        headerHtml += `</div>`; // إغلاق الهيدر
        header.innerHTML = headerHtml;


        // 4. جلب وترتيب المشاركين (معالجة NaN لكل القائمة)
        const snap = await db.collection('challenges').doc(chId).collection('participants')
            .orderBy('progress', 'desc').limit(50).get();

        if (snap.empty) {
            list.innerHTML = '<div style="text-align:center; padding:30px; color:#6b7280;">كن أول بطل ينضم هنا! 🏆</div>';
            return;
        }

        let listHtml = '<div class="rev-list">';
        
        snap.docs.forEach((doc, index) => {
            const p = doc.data();
            const rank = index + 1;
            const isMe = (currentUser && doc.id === currentUser.uid);
            
            // 🔥 الفلتر القوي لعلاج NaN في القائمة
            let safeProg = (typeof p.progress === 'number' && !isNaN(p.progress)) ? p.progress : 0;
            
            // تحديد الميدالية
            let medal = `<span style="font-size:12px; font-weight:bold; color:#6b7280;">#${rank}</span>`;
            let rankClass = '';
            if(rank === 1) { medal = '🥇'; rankClass = 'rank-1'; }
            if(rank === 2) { medal = '🥈'; rankClass = 'rank-2'; }
            if(rank === 3) { medal = '🥉'; rankClass = 'rank-3'; }

            // لون البار حسب الترتيب
            let barColor = rank === 1 ? '#f59e0b' : (rank === 2 ? '#9ca3af' : (rank === 3 ? '#cd7f32' : 'var(--primary)'));
            if(ch.type === 'speed') barColor = '#ef4444';

            // نسبة البار
            let barPerc = Math.min((safeProg / target) * 100, 100);

            // الصورة
            let avatarStyle = p.photoUrl ? `background-image:url('${p.photoUrl}')` : '';
            let avatarContent = p.photoUrl ? '' : (p.name ? p.name[0] : '?');

            listHtml += `
            <div class="rev-item ${rankClass}" style="${isMe ? 'border-color:var(--primary);' : ''}">
                <div class="rev-medal">${medal}</div>
                
                <div class="rev-avatar" style="${avatarStyle}">${avatarContent}</div>
                
                <div class="rev-info">
                    <span class="rev-name">${p.name} ${isMe ? '(أنت)' : ''}</span>
                    <div class="rev-bar-bg">
                        <div class="rev-bar-fill" style="width:${barPerc}%; background:${barColor};"></div>
                    </div>
                </div>
                
                <div class="rev-stat">
                    <span class="rev-stat-val">${safeProg.toFixed(1)}</span>
                    <span class="rev-stat-lbl">${ch.type==='frequency'?'مرة':'كم'}</span>
                </div>
            </div>`;
        });

        listHtml += '</div>';
        list.innerHTML = listHtml;

    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="text-align:center; color:#ef4444; padding:20px;">حدث خطأ في تحميل البيانات</div>';
    }
}
// ==================== V5.5 Missing Logic Functions (The Fix) ====================

// 1. دالة الانضمام للتحدي (لزر قبول التحدي)
async function joinChallenge(chId) {
    if(!currentUser) return showToast("يجب تسجيل الدخول", "error");
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "...";
    btn.disabled = true;

    try {
        // إضافة المستخدم لقائمة المشاركين
        await db.collection('challenges').doc(chId).collection('participants').doc(currentUser.uid).set({
            name: userData.name,
            photoUrl: userData.photoUrl || null,
            progress: 0,
            completed: false,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // زيادة عداد المشاركين
        await db.collection('challenges').doc(chId).update({
            participantsCount: firebase.firestore.FieldValue.increment(1)
        });

        // تحديث الكاش المحلي فوراً (لأداء أسرع)
        const chIndex = allChallengesCache.findIndex(c => c.id === chId);
        if(chIndex > -1) {
            allChallengesCache[chIndex].isJoined = true;
        }

        showToast("تم الانضمام للتحدي! 🚀", "success");
        
        // إعادة رسم التحديات لتحديث حالة الزر
        renderChallenges('all'); 
        
        // تحديث القوائم الأخرى
        loadActiveChallenges(); 

    } catch(e) {
        console.error(e);
        showToast("حدث خطأ في الانضمام", "error");
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 2. دالة حذف التحدي (لزر الحذف في الأدمن وفي الكروت)
async function deleteChallenge(id) {
    if(!confirm("هل أنت متأكد من حذف هذا التحدي نهائياً؟")) return;
    
    try {
        await db.collection('challenges').doc(id).delete();
        showToast("تم حذف التحدي 🗑️", "success");
        
        // تحديث الكاش والواجهة
        allChallengesCache = allChallengesCache.filter(c => c.id !== id);
        
        // تحديث المكانين (صفحة المنافسة وصفحة الأدمن)
        renderChallenges('all');
        if(document.getElementById('admin-active-challenges-list')) {
            loadAdminChallengesList();
        }
    } catch(e) {
        console.error(e);
        showToast("فشل الحذف", "error");
    }
}


// ==================== ENGINE: Challenge Studio V8.0 (Final) ====================

// 1. تعريف المتغير العام (Global)
var editingChallengeId = null; 

// 2. دالة تهيئة التعديل (عند الضغط على القلم)
async function editChallenge(id) {
    if (!userData.isAdmin) return;

    // تغيير نص الزر ليعرف المستخدم أن هناك عملية تحميل
    const allEditBtns = document.querySelectorAll('.ri-pencil-line');
    allEditBtns.forEach(icon => icon.parentElement.style.opacity = '0.5');

    try {
        // جلب البيانات
        const doc = await db.collection('challenges').doc(id).get();
        
        // إعادة الشفافية للأزرار
        allEditBtns.forEach(icon => icon.parentElement.style.opacity = '1');

        if (!doc.exists) return showToast("التحدي غير موجود", "error");
        const ch = doc.data();

        // 1. الانتقال للواجهة أولاً
        switchView('admin');
        
        // 2. تفعيل تبويب الستوديو (سيقوم الكود الجديد بالتعامل معه دون أخطاء)
        switchAdminTab('studio');

        // 3. ملء البيانات في النموذج
        document.getElementById('adv-ch-title').value = ch.title || '';
        document.getElementById('adv-ch-type').value = ch.type || 'distance';
        document.getElementById('adv-ch-target').value = ch.target || '';
        document.getElementById('adv-ch-days').value = ch.durationDays || '';
        
        // معالجة التاريخ
        if(ch.startDate) {
            let dateVal = ch.startDate;
            // لو التاريخ مخزن بصيغة ISO نأخذ الجزء الأول فقط
            if(dateVal.includes('T')) dateVal = dateVal.split('T')[0];
            document.getElementById('adv-ch-start').value = dateVal;
        }

        // معالجة القواعد المتقدمة
        if (ch.rules) {
            document.getElementById('rule-min-dist').value = ch.rules.minDistPerRun || '';
            document.getElementById('rule-time-start').value = (ch.rules.validHourStart !== undefined) ? ch.rules.validHourStart : '';
            document.getElementById('rule-time-end').value = (ch.rules.validHourEnd !== undefined) ? ch.rules.validHourEnd : '';
            document.getElementById('rule-require-img').checked = ch.rules.requireImg || false;
            
            // فتح قائمة القواعد إذا كان هناك بيانات
            const rulesContent = document.getElementById('rules-content');
            rulesContent.style.display = 'block';
        }

        // تحديث واجهة الإدخال حسب النوع
        updateChallengeUI();

        // 4. تفعيل وضع التعديل (تغيير أزرار الحفظ)
        editingChallengeId = id; // تخزين الآيدي في المتغير العام
        
        const submitBtn = document.getElementById('btn-create-challenge');
        const cancelBtn = document.getElementById('btn-cancel-edit');
        
        if(submitBtn) {
            submitBtn.innerHTML = `حفظ التغييرات 💾`;
            submitBtn.style.background = "#f59e0b"; // لون برتقالي للتعديل
            submitBtn.style.color = "#000";
        }
        
        if(cancelBtn) {
            cancelBtn.style.display = 'flex'; // إظهار زر الإلغاء
        }

        // التمرير لأعلى النموذج
        document.getElementById('admin-studio').scrollIntoView({ behavior: 'smooth' });
        showToast(`جاري تعديل: ${ch.title}`, "success");

    } catch (e) {
        console.error(e);
        showToast("حدث خطأ أثناء تحميل التحدي", "error");
    }
}


// 4. دالة الحفظ الذكية (تميز بين الإنشاء والتعديل)
async function createGeniusChallenge() {
    const title = document.getElementById('adv-ch-title').value;
    const type = document.getElementById('adv-ch-type').value;
    const target = parseFloat(document.getElementById('adv-ch-target').value);
    const days = parseInt(document.getElementById('adv-ch-days').value);
    const startDateVal = document.getElementById('adv-ch-start').value;

    if(!title || !target || !days) return showToast("البيانات ناقصة", "error");

    const startDate = startDateVal ? new Date(startDateVal).toISOString() : new Date().toISOString();

    let rules = {
        minDistPerRun: parseFloat(document.getElementById('rule-min-dist').value) || 0,
        requireImg: document.getElementById('rule-require-img').checked
    };
    
    const startHour = document.getElementById('rule-time-start').value;
    const endHour = document.getElementById('rule-time-end').value;
    if (startHour !== "" && endHour !== "") {
        rules.validHourStart = parseInt(startHour);
        rules.validHourEnd = parseInt(endHour);
    }

    const btn = document.getElementById('btn-create-challenge');
    btn.innerText = "جاري المعالجة...";
    btn.disabled = true;

    try {
        const challengeData = {
            title, type, target, durationDays: days, startDate, rules
        };

        if (editingChallengeId) {
            // 🔥 مسار التعديل
            await db.collection('challenges').doc(editingChallengeId).update(challengeData);
            showToast("تم حفظ التعديلات ✅", "success");
            cancelEditMode(); 
        } else {
            // 🔥 مسار الإنشاء الجديد
            challengeData.active = true;
            challengeData.participantsCount = 0;
            challengeData.createdStr = new Date().toLocaleDateString('ar-EG');
            await db.collection('challenges').add(challengeData);
            showToast("تم إطلاق التحدي 🚀", "success");
            cancelEditMode(); 
        }
        
        loadAdminChallengesList(); 
        if(typeof renderChallenges === 'function') renderChallenges('all');
        
    } catch(e) {
        console.error(e);
        showToast("حدث خطأ", "error");
    } finally {
        btn.disabled = false;
        if (editingChallengeId) btn.innerHTML = "حفظ التغييرات 💾";
        else btn.innerHTML = "إطلاق التحدي 🚀";
    }
}

// 5. دالة عرض القائمة (لضمان وجود زر التعديل)
function loadAdminChallengesList() {
    const list = document.getElementById('admin-active-challenges-list');
    if(!list) return;

    db.collection('challenges').where('active', '==', true).get().then(snap => {
        let html = '';
        snap.forEach(doc => {
            const ch = doc.data();
            html += `
            <div class="active-ch-row" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="display:block; font-size:13px; color:#fff;">${ch.title}</strong>
                    <span style="font-size:10px; color:#9ca3af;">${ch.type === 'speed' ? '⚡ سرعة' : '🛣️ مسافة'} • ${ch.target}</span>
                </div>
                <div style="display:flex; gap:8px;">
                    <button onclick="editChallenge('${doc.id}')" style="background:rgba(245, 158, 11, 0.15); color:#f59e0b; border:1px solid rgba(245, 158, 11, 0.3); padding:6px; border-radius:6px; cursor:pointer;">
                        <i class="ri-pencil-line"></i>
                    </button>
                    <button onclick="deleteChallenge('${doc.id}')" style="background:rgba(239, 68, 68, 0.15); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3); padding:6px; border-radius:6px; cursor:pointer;">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            </div>`;
        });
        list.innerHTML = html || '<div style="text-align:center; font-size:11px; color:#6b7280; padding:10px;">لا توجد تحديات نشطة</div>';
    });
}


// ==================== V10.0 AI Plan Generator Logic COACH ====================


// فتح مودال الخطة
function openPlanWizard() {
    // تصفير الواجهة
    document.getElementById('wizard-step-input').style.display = 'block';
    document.getElementById('wizard-step-thinking').style.display = 'none';
    document.getElementById('wizard-step-result').style.display = 'none';
    
    // تصفير الاختيارات
    document.querySelectorAll('.sel-option').forEach(el => el.classList.remove('selected'));
    document.getElementById('plan-days').value = '';
    document.getElementById('plan-target').value = '';
    
    document.getElementById('modal-plan-wizard').style.display = 'flex';
}

// التعامل مع الاختيارات (Visual Selection)
function selectPlanOption(el, type, value) {
    // إزالة التحديد من أخواتها
    el.parentElement.querySelectorAll('.sel-option').forEach(opt => opt.classList.remove('selected'));
    // تحديد العنصر
    el.classList.add('selected');
    // حفظ القيمة
    document.getElementById(`plan-${type}`).value = value;
}

// بدء عملية "التفكير" الوهمية
function startPlanGeneration() {
    const days = document.getElementById('plan-days').value;
    const target = document.getElementById('plan-target').value;
    
    if(!days || !target) return showToast("يرجى اختيار الأيام والهدف", "error");

    // 1. الانتقال لشاشة التفكير
    document.getElementById('wizard-step-input').style.display = 'none';
    document.getElementById('wizard-step-thinking').style.display = 'block';

    const thinkingTexts = [
        "جاري تحليل مستوى لياقتك...",
        "حساب أحمال التدريب الأسبوعية...",
        "توزيع أيام الراحة والاستشفاء...",
        "تصميم جدول الجريات الطويلة...",
        "ضبط اللمسات الأخيرة..."
    ];
    
    const textEl = document.getElementById('thinking-text');
    const barEl = document.getElementById('thinking-bar');
    let step = 0;

    // 2. تشغيل الأنيميشن (محاكاة الذكاء الاصطناعي)
    const interval = setInterval(() => {
        if(step >= thinkingTexts.length) {
            clearInterval(interval);
            showPlanResult(days, target); // إظهار النتيجة
        } else {
            textEl.innerText = thinkingTexts[step];
            barEl.style.width = `${((step + 1) / thinkingTexts.length) * 100}%`;
            step++;
        }
    }, 800); // كل خطوة تأخذ 0.8 ثانية
}

// إظهار النتيجة النهائية
function showPlanResult(days, target) {
    document.getElementById('wizard-step-thinking').style.display = 'none';
    document.getElementById('wizard-step-result').style.display = 'block';
    
    // تحديث النصوص في النتيجة
    document.getElementById('res-target').innerText = target === '21k' ? 'نصف ماراثون' : target;
    
    // هنا يمكننا مستقبلاً حفظ الخطة الحقيقية في المتغيرات
    // let planDuration = target === '5k' ? 8 : 12; // أسابيع
    // document.getElementById('res-weeks').innerText = planDuration + " أسابيع";
}

// اعتماد الخطة (الحفظ في الداتابيز)
async function confirmPlan() {
    const days = document.getElementById('plan-days').value;
    const target = document.getElementById('plan-target').value;
    const level = document.getElementById('plan-level').value;
    
    const btn = event.target;
    btn.innerText = "جاري إنشاء الجدول...";
    
    try {
        // حفظ تفضيلات الخطة في بروفايل المستخدم
        await db.collection('users').doc(currentUser.uid).update({
            activePlan: {
                target: target,
                daysPerWeek: days,
                level: level,
                startDate: new Date().toISOString(),
                status: 'active'
            }
        });
        
        showToast("تم تفعيل الخطة بنجاح! 🚀", "success");
        closeModal('modal-plan-wizard');
        
        // هنا يمكننا توجيه المستخدم لصفحة "خطتي" الجديدة مستقبلاً
        // switchView('plan'); 

    } catch(e) {
        showToast("خطأ في الحفظ", "error");
    }
}




// ==================== V12.0 Run Analysis Engine (Coach Feedback) ====================

function showRunAnalysis(dist, time, type) {
    const pace = dist > 0 ? (time / dist) : 0;
    const name = (userData.name || "يا بطل").split(' ')[0];
    
    let title = "تم يا بطل! ✅";
    let msg = "";
    let score = "جيد";
    
    // 1. تحليل الأداء (Logic)
    
    // حالة 1: جرية طويلة (Long Run)
    if (dist >= 10) {
        title = "وحش المسافات 🦁";
        msg = `الله عليك يا ${name}! ${dist} كم مسافة محترمة جداً. النفس الطويل ده هو اللي بيبني أبطال المارثون.`;
        score = "Legend";
    } 
    // حالة 2: سرعة عالية (Fast Pace - أقل من 5 دقايق للكيلو)
    else if (pace > 0 && pace < 5.0 && type === 'Run') {
        title = "صاروخ أرض جو 🚀";
        msg = `إيه السرعة دي! بيس ${pace.toFixed(1)} ده مستوى عالي. حافظ على السرعة دي، أنت في الطريق للقمة.`;
        score = "Speedster";
    }
    // حالة 3: جرية خفيفة/قصيرة
    else if (dist < 3) {
        title = "بداية موفقة 🌱";
        msg = `عاش الاستمرارية. حتى المسافات القصيرة بتفرق في اللياقة. المهم إنك نزلت ومكسلتش!`;
        score = "Active";
    }
    // حالة 4: مشي
    else if (type === 'Walk') {
        title = "نشاط وحيوية 🚶";
        msg = `المشي رياضة ممتازة لحرق الدهون وتصفية الذهن. استمر يا كوتش!`;
        score = "Steady";
    }
    // حالة افتراضية
    else {
        title = "تمرين ممتاز 💪";
        msg = `مجهود رائع يا ${name}. كل خطوة بتقربك من هدفك. ريح جسمك كويس واشرب مية كتير.`;
        score = "Strong";
    }

    // 2. مقارنة بالخطة (إذا وجدت)
    if (userData.activePlan && userData.activePlan.status === 'active') {
        msg += `<br><br><span style="color:var(--primary); font-size:12px;">✅ تم تسجيل هذا التمرين ضمن خطة الـ ${userData.activePlan.target}.</span>`;
    }

    // 3. عرض البيانات في المودال
    document.getElementById('feedback-title').innerText = title;
    document.getElementById('feedback-msg').innerHTML = msg;
    
    document.getElementById('fb-pace').innerText = pace > 0 ? pace.toFixed(1) : '-';
    document.getElementById('fb-score').innerText = score;
    
    // حساب تقريبي للكالوري (الوزن المتوسط 70 * المسافة)
    document.getElementById('fb-cal').innerText = (dist * 60).toFixed(0);

    // إظهار المودال
    document.getElementById('modal-run-feedback').style.display = 'flex';
    
    // تشغيل صوت تشجيعي (اختياري)
    // playSuccessSound(); 
}



// دالة للأدمن فقط: سحب إنجاز
async function adminRevokeBadge(targetUid, badgeId) {
    if(!userData.isAdmin) return;
    if(!confirm(`هل أنت متأكد من سحب إنجاز (${badgeId}) من هذا العضو؟`)) return;

    try {
        await db.collection('users').doc(targetUid).update({
            badges: firebase.firestore.FieldValue.arrayRemove(badgeId)
        });
        showToast("تم سحب الإنجاز 🚫", "success");
        // تحديث الواجهة فوراً
        closeModal('modal-view-user');
    } catch(e) {
        showToast("خطأ في العملية", "error");
    }
}



// ============== زر عائم الإبلاغ عن المشاكل
function openBugReport() {
    document.getElementById('bug-text').value = '';
    document.getElementById('modal-bug-report').style.display = 'flex';
}

async function submitBug() {
    const txt = document.getElementById('bug-text').value;
    if(!txt.trim()) return showToast("اكتب شيئاً أولاً", "error");
    
    const btn = event.target;
    btn.innerText = "جاري الإرسال...";
    
    try {
        await db.collection('app_feedback').add({
            uid: currentUser.uid,
            name: userData.name,
            msg: txt,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            version: 'V3.2'
        });
        showToast("وصلنا، شكراً لك! 🫡", "success");
        closeModal('modal-bug-report');
    } catch(e) {
        showToast("فشل الإرسال", "error");
    } finally {
        btn.innerText = "إرسال";
    }
}