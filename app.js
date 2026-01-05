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
let editingOldType = 'Run';
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
    // 1) Activate correct tab button (data-tab driven)
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(t => {
        const key = t.dataset.tab || '';
        t.classList.toggle('active', key === tabName);
    });

    // 2) Show correct content section
    document.querySelectorAll('.admin-content-section').forEach(s => s.classList.remove('active'));
    const content = document.getElementById('admin-' + tabName);
    if (content) content.classList.add('active');

    // 3) Lazy-load per tab
    if (tabName === 'overview') loadAdminStats();
    if (tabName === 'inspector') loadAdminRuns();
    if (tabName === 'studio') loadAdminChallengesList();
    if (tabName === 'coach') loadCoachAdmin();
    if (tabName === 'users') loadAllUsersTable();
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
    if(confirm("تسجيل خروج؟")) {
        try{ if(typeof _resetCoachFeed === 'function') _resetCoachFeed(); }catch(e){}
        auth.signOut();
        window.location.reload();
    }
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
            renderCoachHeroStats(); 
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

        const pTotal = document.getElementById('profileTotalDist');
        if (pTotal) pTotal.innerText = (userData.totalDist || 0).toFixed(1);
        const pRuns = document.getElementById('profileTotalRuns');
        if (pRuns) pRuns.innerText = userData.totalRuns || 0;
        const pRank = document.getElementById('profileRankText');
        if (pRank) pRank.innerText = rankData.name;

        // XP Bar (Profile)
        const nextEl = document.getElementById('nextLevelDist');
        if (nextEl) nextEl.innerText = rankData.remaining.toFixed(1);
        const xpBar = document.getElementById('xpBar');
        if (xpBar) {
            xpBar.style.width = `${rankData.percentage}%`;
            xpBar.style.backgroundColor = `var(--rank-color)`;
        }

        // (Optional legacy fields – قد لا تكون موجودة في DOM)
        const xpText = document.getElementById('xpText');
        if (xpText) xpText.innerText = `${rankData.distInLevel.toFixed(1)} / ${rankData.distRequired} كم`;
        const xpPerc = document.getElementById('xpPerc');
        if (xpPerc) xpPerc.innerText = `${Math.floor(rankData.percentage)}%`;

        updateGoalRing();
        if (typeof renderPlanCard === 'function') renderPlanCard();
        renderBadges();
        calculatePersonalBests(); // (V2.2)
        if(typeof updateCoachAdvice === 'function') updateCoachAdvice();
        if(typeof setupCoachFeedOnce === 'function') setupCoachFeedOnce();

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


// ==================== V4.0 Helpers (Coach Tabs + Cross Training) ====================
const ERS_CORE_TYPES = ['Run','Walk','Race'];
const ERS_XT_TYPES = ['Bike','Cardio','Strength','Yoga'];

window.openExternal = function(url){
  try { window.open(url, '_blank', 'noopener'); } catch(e){ location.href = url; }
};

window.setCoachHomeTab = function(tab){
  const tabs = ['today','plan','community'];
  tabs.forEach(t=>{
    const pane = document.getElementById('coach-home-tab-'+t);
    if(pane) pane.classList.toggle('active', t===tab);
  });
  document.querySelectorAll('.coach-tab-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.getAttribute('data-tab')===tab);
  });
  
  
  // === [تعديل: تحميل بيانات المجتمع عند فتح التبويب] ===
  if (tab === 'today') {
      // تحميل تمرين الفريق
      renderTeamWorkout(); 
      // تحميل التحدي الأسبوعي (لأنه أصبح في تبويب يومك)
      if (typeof loadWeeklyChallenge === 'function') loadWeeklyChallenge();
  }
  

   // ==============================================

  try{ localStorage.setItem('ers_coach_home_tab', tab); }catch(e){}
};

function setupLogTypeUI(){
  const typeSel = document.getElementById('log-type');
  const distWrap = document.getElementById('log-dist')?.closest('.input-wrap');
  const distInput = document.getElementById('log-dist');
  const timeInput = document.getElementById('log-time');

  function apply(){
    const t = typeSel ? typeSel.value : 'Run';
    const isCore = _ersIsCoreType(t);

    if(distWrap){
      distWrap.style.display = isCore ? '' : 'none';
    }
    if(distInput){
      distInput.required = isCore;
      if(!isCore && !distInput.value) distInput.value = '';
    }
    if(timeInput){
      timeInput.required = true;
    }

    const modalTitle = document.querySelector('#modal-log h3');
    if(modalTitle){
      modalTitle.textContent = isCore ? 'تسجيل نشاط 🏃‍♂️' : 'تسجيل نشاط (Cross Training) 🧩';
    }
  }

  if(typeSel){
    typeSel.addEventListener('change', apply);
    apply();
  }
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

// إلغاء الخطة الحالية والبدء من جديد
async function resetActivePlan(btnElement) {
    if(!confirm("⚠️ هل أنت متأكد من حذف الخطة الحالية؟\nسيتم فقدان تقدمك في الجدول وتعود لنقطة الصفر.")) return;

    // ضمان التقاط الزر الصحيح حتى لو لم يتم تمريره (Fallout)
    const btn = btnElement || event.target.closest('button');
    const originalContent = btn.innerHTML; // حفظ المحتوى الأصلي (أيقونة + نص)
    
    btn.innerHTML = "جاري الحذف...";
    btn.style.opacity = "0.5";
    btn.disabled = true; // تعطيل الزر لمنع التكرار

    try {
        // 1. حذف حقل activePlan من قاعدة البيانات
        await db.collection('users').doc(currentUser.uid).update({
            activePlan: firebase.firestore.FieldValue.delete()
        });

        // 2. تحديث المتغير المحلي فوراً
        delete userData.activePlan;

        // 3. تحديث واجهة الكوتش ليعود الزر القديم
        updateCoachAdvice();

        showToast("تم إلغاء الخطة بنجاح 🗑️", "success");

    } catch(e) {
        console.error(e);
        showToast("حدث خطأ أثناء الحذف", "error");
        
        // استعادة الزر في حالة الخطأ
        btn.innerHTML = originalContent;
        btn.style.opacity = "1";
        btn.disabled = false;
    }
}
// ==================== V11.0 Coach & Action Plan Logic ====================

function updateCoachAdvice() {
    const msgEl = document.getElementById('coach-message');
    const labelEl = document.querySelector('.coach-label');
    if(!msgEl) return;

    const name = (userData.name || "يا بطل").split(' ')[0];
    const hasPlan = userData?.activePlan && userData.activePlan.status === 'active';

    // العنوان ثابت لتقليل اللخبطة
    if(labelEl) labelEl.innerText = "قرار اليوم";

    // ملاحظة قصيرة "تلمس" المستخدم — بدون أزرار هنا لتقليل الزحمة
    let note = '';
    try{
        if(hasPlan){
            const s = getPlanTodaySession(userData.activePlan);
            note = s?.isRunDay
                ? `يا ${name}… النهارده من خطتك. خلّيك ثابت واشتغل على الجودة بهدوء.`
                : `يا ${name}… يوم خفيف من الخطة. الاستشفاء جزء من التدريب مش راحة وخلاص.`;
        }else{
            const runs = window._ersRunsCache || [];
            const d = computeDecisionFromRuns(runs);
            note = `يا ${name}… ${d.why}`;
        }
    }catch(e){
        note = `يا ${name}… الاستمرارية هي سر النجاح.`;
    }

    msgEl.innerHTML = `<div class="coach-note">🧠 ${note}</div>`;

    // تحديث قرار اليوم (Coach V2)
    if (typeof updateCoachDecisionUI === 'function') updateCoachDecisionUI();

    // تحديث كارت الخطة/البدء (Plan Hero)
    if (typeof renderPlanHero === 'function') renderPlanHero();
}


function openBasicLibrary(){
    // المكتبة الأساسية مرجع — نفتحها في مودال واحد
    try{ openRunCatalog('all'); }catch(e){}
}

function _formatPlanTarget(target){
    if(!target) return '';
    const t = String(target).toLowerCase();
    if(t.includes('21') || t.includes('half')) return '21K';
    if(t.includes('10')) return '10K';
    if(t.includes('5')) return '5K';
    // fallback numeric
    return String(target).toUpperCase();
}

function renderPlanHero(){
    const box = document.getElementById('plan-hero');
    if(!box) return;

    const name = (userData.name || "يا بطل").split(' ')[0];
    const hasPlan = userData?.activePlan && userData.activePlan.status === 'active';

    if(!hasPlan){
        // ... (كود حالة عدم وجود خطة - يبقى كما هو) ...
        box.innerHTML = `... (نفس كود الحالة السابقة) ...`;
        // (اختصاراً للمساحة، إذا لم يكن لديك الكود السابق اخبرني لأكتبه كاملاً)
        // سأفترض أنك ستبقي الجزء الأول كما هو وتركز على جزء الـ else
        // ...
        return;
    }

    // === التعديل هنا فقط (حالة وجود خطة) ===
    const plan = userData.activePlan;
    const targetBig = _formatPlanTarget(plan.target || plan.goal || '10k');
    const startDate = new Date(plan.startDate);
    const dayNum = Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const weekNum = Math.max(1, Math.ceil(dayNum / 7));
    const dayInWeek = ((dayNum - 1) % 7) + 1;

    const s = getPlanTodaySession(plan);
    const todayTitle = s?.title || 'تمرين اليوم';
    const todayMeta = s?.sub || 'تابع الخطة لمعرفة تفاصيل التمرين.';

    box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
                <div class="plan-hero-big" style="margin-bottom:0; line-height:0.9;">${targetBig}</div>
                <div style="color:#9ca3af; font-size:11px; font-weight:bold; margin-top:4px;">
                    الأسبوع ${weekNum} • يوم ${dayInWeek}
                </div>
            </div>

            <div style="display:flex; flex-direction:column; align-items:flex-end;">
                <span class="plan-hero-chip" style="background:rgba(16,185,129,0.1); color:#10b981; padding:3px 8px; border-radius:6px; font-size:9px; margin-bottom:5px;">نشطة ✅</span>
                
                <div class="plan-top-actions">
                    <button class="link-mini" onclick="openPlanWizard()">
                        <i class="ri-edit-2-line"></i> تعديل
                    </button>
                    <button class="link-mini danger" onclick="resetActivePlan(this)">
                        <i class="ri-close-circle-line"></i> إلغاء
                    </button>
                </div>
            </div>
        </div>

        <div style="margin-top:15px;">
            <div style="background:rgba(0,0,0,0.2); border-radius:10px; padding:10px; border-right:2px solid ${s.mode === 'recovery' ? '#10b981' : 'var(--primary)'};">
                <div style="font-size:9px; color:#9ca3af;">تمرين اليوم:</div>
                <div style="font-size:14px; font-weight:bold; color:#fff;">${_escapeHtml(todayTitle)}</div>
                <div style="font-size:11px; color:#d1d5db; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${_escapeHtml(todayMeta)}</div>
            </div>

            <div class="plan-actions-grid">
                <button class="btn-glossy primary" onclick="openMyPlan()">
                    <i class="ri-map-2-line"></i> الجدول
                </button>
                <button class="btn-glossy secondary" onclick="openLogFromCoach('${String(todayTitle).replace(/'/g,"&#39;")}')">
                    <i class="ri-check-line"></i> تم التنفيذ
                </button>
            </div>
            </div>
    `;
}

// ==================== Coach V2: Decision Engine (Safe / Non-breaking) ====================
window._ersRunsCache = window._ersRunsCache || [];

// === Coach Brain v1 helpers (pace / classification / prefs) ===
const ERS_PACE_RUN_MAX = 10.5;   // min/km and faster => Run
const ERS_PACE_WALK_MIN = 10.75; // above this is usually Walk
const ERS_MIN_DIST_FOR_SPEED = 5; // km

function _ersPace(distKm, timeMin){
    const d = parseFloat(distKm||0);
    const t = parseFloat(timeMin||0);
    if(!d || !t) return null;
    return t / d; // min per km
}
function _ersFormatPace(p){
    if(p === null || p === undefined || !isFinite(p)) return '—';
    const mm = Math.floor(p);
    const ss = Math.round((p - mm)*60);
    return `${mm}:${String(ss).padStart(2,'0')} د/كم`;
}
function _ersAutoKind(selectedType, pace){
    // Race always treated as Run
    const t = String(selectedType||'').toLowerCase();
    if(t === 'race') return 'Run';
    if(pace === null || pace === undefined || !isFinite(pace)) return (t === 'walk' ? 'Walk' : 'Run');
    return (pace <= ERS_PACE_RUN_MAX ? 'Run' : 'Walk');
}
function _ersInferChallengeActivityKind(ch){
    // explicit
    const explicit = ch?.rules?.activityKind;
    if(explicit === 'Run' || explicit === 'Walk' || explicit === 'Any') return explicit;
    const title = String(ch?.title || ch?.name || '').toLowerCase();
    if(title.includes('مشي') || title.includes('walk') || title.includes('steps')) return 'Walk';
    if(ch?.type === 'speed') return 'Run';
    if(title.includes('جري') || title.includes('run') || title.includes('race') || title.includes('ماراثون') || title.includes('half')) return 'Run';
    return 'Any';
}
function _ersEligibleForChallenge(ch, effectiveKind){
    const kind = _ersInferChallengeActivityKind(ch);
    if(kind === 'Any') return true;
    return String(effectiveKind||'') === kind;
}
function _ersLoadPrefs(){
    try{
        const raw = localStorage.getItem('ers_prefs');
        return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
}
function _ersSavePrefs(prefs){
    try{ localStorage.setItem('ers_prefs', JSON.stringify(prefs||{})); }catch(e){}
}
function getUserPref(key, fallback){
    const prefs = (userData && userData.prefs) ? userData.prefs : _ersLoadPrefs();
    if(prefs && Object.prototype.hasOwnProperty.call(prefs, key)) return prefs[key];
    return fallback;
}
async function setUserPref(key, value){
    const prefs = Object.assign({}, _ersLoadPrefs(), (userData?.prefs||{}), { [key]: value });
    _ersSavePrefs(prefs);
    if(userData) userData.prefs = prefs;
    try{
        if(db && auth?.currentUser){
            await db.collection('users').doc(auth.currentUser.uid).set({ prefs }, { merge:true });
        }
    }catch(e){}
    try{ applyUserPrefsToUI(); }catch(e){}
}
function applyUserPrefsToUI(){
    const hideTeam = !!getUserPref('hideTeamWorkout', false);
    const hideWeekly = !!getUserPref('hideWeeklyChallenge', false);
    const hideLib = !!getUserPref('hideBasicLibrary', false);
    const hideSpeed = !!getUserPref('hideSpeedRadar', false);

    const teamEl = document.getElementById('team-workout-section');
    const weeklyEl = document.getElementById('weekly-challenge-section');
    const libEl = document.getElementById('basic-library-section');
    const speedBtn = document.getElementById('coach-speed-btn');

    if(teamEl) teamEl.style.display = hideTeam ? 'none' : '';
    if(weeklyEl) weeklyEl.style.display = hideWeekly ? 'none' : '';
    if(libEl) libEl.style.display = hideLib ? 'none' : '';

    if(speedBtn && hideSpeed) speedBtn.style.display = 'none';
}

function openCoachPreferences(){
    const modal = document.getElementById('modal-coach-prefs');
    if(!modal) return;

    // Fill UI from prefs
    const setChk = (id, val) => { const el=document.getElementById(id); if(el) el.checked = !!val; };
    setChk('pref-hide-team', getUserPref('hideTeamWorkout', false));
    setChk('pref-hide-weekly', getUserPref('hideWeeklyChallenge', false));
    setChk('pref-hide-lib', getUserPref('hideBasicLibrary', false));
    setChk('pref-hide-speed', getUserPref('hideSpeedRadar', false));
    setChk('pref-disable-comments', getUserPref('disableComments', false));

    const focusSel = document.getElementById('pref-goal-focus');
    if(focusSel) focusSel.value = getUserPref('goalFocus', 'general');

    modal.style.display = 'flex';
}

async function saveCoachPreferences(){
    try{
        const getChk = (id) => { const el=document.getElementById(id); return !!(el && el.checked); };

        setUserPref('hideTeamWorkout', getChk('pref-hide-team'));
        setUserPref('hideWeeklyChallenge', getChk('pref-hide-weekly'));
        setUserPref('hideBasicLibrary', getChk('pref-hide-lib'));
        setUserPref('hideSpeedRadar', getChk('pref-hide-speed'));
        setUserPref('disableComments', getChk('pref-disable-comments'));

        const focusSel = document.getElementById('pref-goal-focus');
        const focus = focusSel ? (focusSel.value || 'general') : 'general';
        setUserPref('goalFocus', focus);

        // Persist to Firestore (merge)
        if(currentUser && db){
            await db.collection('users').doc(currentUser.uid).set({
                uiPrefs: userData.uiPrefs || {}
            }, {merge:true});
        }

        applyUserPrefsToUI();
        showToast("تم حفظ تفضيلاتك ✅", "success");
        closeModal('modal-coach-prefs');
        updateUI();
    }catch(e){
        console.error(e);
        showToast("تعذر حفظ التفضيلات", "error");
    }
}



function openExternal(url){
    if(!url) return;
    try { window.open(url, '_blank', 'noopener,noreferrer'); }
    catch(e) { location.href = url; }
}

function getPlanTodaySession(plan){
    if(!plan) return null;

    const startDate = new Date(plan.startDate);
    const today = new Date();
    startDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffDays = Math.floor((today - startDate) / (1000*60*60*24));
    const dayNum = diffDays + 1;
    const dayInWeek = ((dayNum - 1) % 7) + 1; // 1..7

    const daysCount = parseInt(plan.daysPerWeek) || 3;
    let runDays = [];
    if(daysCount === 3) runDays = [1, 3, 5];
    else if(daysCount === 4) runDays = [1, 2, 4, 6];
    else if(daysCount === 5) runDays = [1, 2, 3, 5, 6];
    else runDays = [1, 2, 3, 4, 5, 6];

    const isRunDay = runDays.includes(dayInWeek);
    let title = 'راحة واستشفاء 🧘‍♂️';
    let sub = 'مشي خفيف + إطالة 8–10 دقايق.';
    let mode = 'recovery';

    if (isRunDay) {
        const targetNum = parseFloat(plan.target);
        const baseDist = (Number.isFinite(targetNum) ? (targetNum / daysCount) : 4);

        if (dayInWeek === runDays[0]) {
            title = `جري مريح (Easy)`;
            sub = `${(baseDist).toFixed(1)} كم • تنفّس مريح (RPE 3–4).`;
            mode = 'build';
        } else if (dayInWeek === runDays[runDays.length-1]) {
            title = `لونج رن (Long)`;
            sub = `${(baseDist * 1.2).toFixed(1)} كم • ثابت وبهدوء + جرعة ماء.`;
            mode = 'push';
        } else {
            title = `تمرين جودة (Speed/Tempo)`;
            sub = `${(baseDist * 0.8).toFixed(1)} كم • ركّز على الإيقاع بدون تهور.`;
            mode = 'push';
        }
    }

    return { title, sub, mode, isRunDay };
}

function computeDecisionFromRuns(runs){
    const now = new Date();
    const msDay = 24*3600*1000;

    const sorted = (runs||[]).slice().sort((a,b)=>{
        const ta = (a.timestamp ? a.timestamp.toDate() : new Date(a.date||0)).getTime();
        const tb = (b.timestamp ? b.timestamp.toDate() : new Date(b.date||0)).getTime();
        return tb-ta;
    });

    const last = sorted[0] || null;
    const lastDate = last ? (last.timestamp ? last.timestamp.toDate() : new Date(last.date||now)) : null;
    const daysSince = lastDate ? Math.floor((now - lastDate)/msDay) : 999;

    const lastDist = last ? (parseFloat(last.dist)||0) : 0;
    const lastTime = last ? (parseFloat(last.time)||0) : 0;
    const lastPace = last ? (last.pace || _ersPace(lastDist, lastTime) || 0) : 0;
    const lastKind = last ? (last.autoKind || _ersAutoKind(last.type||'Run', lastPace)) : 'Run';

    // آخر 7 أيام
    const since7 = new Date(now.getTime()-7*msDay);
    const weekRuns = sorted.filter(r=>{
        const d = r.timestamp ? r.timestamp.toDate() : new Date(r.date||0);
        return d >= since7;
    });

    const weekDist = weekRuns.reduce((s,r)=>s+(parseFloat(r.dist)||0),0);
    // V4 Hero quick stats
    try{
      const wEl = document.getElementById('hero-week-dist');
      if(wEl) wEl.textContent = (weekDist||0).toFixed(1);
      const mEl = document.getElementById('hero-month-dist');
      if(mEl) mEl.textContent = (userData?.monthDist || 0).toFixed(1);
      const sEl = document.getElementById('hero-streak');
      if(sEl) sEl.textContent = String(userData?.currentStreak || 0);
      const gEl = document.getElementById('coach-greeting');
      if(gEl){
        const h = (new Date()).getHours();
        const name = (userData?.name || 'يا كابتن').split(' ')[0];
        const greet = (h < 12) ? 'صباح الخير' : (h < 17 ? 'مساء الخير' : 'مساء النور');
        gEl.textContent = `${greet} يا ${name} 👋`;
      }
    }catch(e){}

    const weekHard = weekRuns.filter(r=>{
        const d = parseFloat(r.dist)||0;
        const t = parseFloat(r.time)||0;
        const p = r.pace || _ersPace(d,t) || 0;
        return (d >= 10) || (p>0 && p <= 5.3);
    }).length;

    // قرار اليوم (Coach Brain v1)
    let title = "قرار الكوتش اليوم 🧠";
    let summary = "";
    let tone = "neutral";
    let actionKey = "easy"; // for UI hints

    if (!last) {
        title = "نبدأ صح 👟";
        summary = "مفيش نشاط مسجل لسه… النهارده نعمل 20–30 دقيقة جري/مشي خفيف + 5 دقايق إطالة. أهم حاجة نفتح الباب.";
        tone = "good";
        actionKey = "start";
    } else if (daysSince >= 4) {
        title = "رجعنا للمسار 💚";
        summary = `آخر نشاط من ${daysSince} أيام… هنرجّع الإيقاع بهدوء: 25–35 دقيقة سهل (RPE 2–3) + مشي دقيقتين في النص لو احتجت.`;
        tone = "warn";
        actionKey = "return";
    } else if (lastKind === 'Run' && (lastDist >= 10 || (lastPace>0 && lastPace<=5.3))) {
        title = "استشفاء ذكي 🫶";
        summary = "أمس/آخر مرة كان فيها شغل تقيل… النهارده جسمك محتاج يوم سهل: 20–40 دقيقة Recovery أو راحة نشطة + Mobility.";
        tone = "good";
        actionKey = "recovery";
    } else if (weekHard >= 2) {
        title = "توازن الأسبوع ⚖️";
        summary = "الأسبوع فيه مجهود عالي كفاية… خلينا النهارده سهل عشان نطلع أقوى في الجلسة الجاية.";
        tone = "neutral";
        actionKey = "easy";
    } else if (weekDist < 8) {
        title = "نزوّد الاستمرارية 🔥";
        summary = "إجمالي الأسبوع قليل… النهارده 30–45 دقيقة سهل + 4×20 ثانية سترایدز خفيفة (اختياري).";
        tone = "good";
        actionKey = "build";
    } else {
        title = "يوم شغل مُتحكَّم فيه 💪";
        summary = "لو حاسس نفسك كويس: 10 دقايق إحماء → 6×(1 دقيقة أسرع + 1 دقيقة سهل) → تهدئة. لو مش جاهز… خليه Easy.";
        tone = "neutral";
        actionKey = "quality";
    }

    return { title, summary, tone, actionKey, weekDist: weekDist.toFixed(1), weekHard };
}

function updateCoachDecisionUI(runsOverride){
    const pill = document.getElementById('coach-mode-pill');
    const tEl = document.getElementById('coach-command-title');
    const sEl = document.getElementById('coach-command-sub');
    if(!pill || !tEl || !sEl) return;

    // 1) لو فيه خطة نشطة: القرار يطلع منها
    const hasPlan = userData?.activePlan && userData.activePlan.status === 'active';
    if (hasPlan) {
        const s = getPlanTodaySession(userData.activePlan);
        if (s) {
            pill.className = `coach-mode-pill ${s.mode}`;
            pill.textContent = s.mode === 'recovery' ? 'Recovery' : (s.mode === 'push' ? 'Push' : 'Build');
            tEl.textContent = s.title;
            sEl.textContent = s.sub;
            return;
        }
    }

    // 2) من واقع آخر النشاطات
    const runs = runsOverride || window._ersRunsCache || [];
    const d = computeDecisionFromRuns(runs);
    const tone = d.tone || 'neutral';
    pill.className = `coach-mode-pill ${tone}`;
    pill.textContent = (tone==='good') ? 'Stable' : (tone==='warn' ? 'Reset' : 'Focus');
    tEl.textContent = d.title;
    const w = (d.weekDist != null) ? ` • أسبوعك: ${d.weekDist} كم` : '';
    sEl.textContent = `${d.summary}${w}`;
}
//========================================================
// دوال مساعدة للعرض
// ==================== Coach Center: Daily Workout + Weekly Challenge (V3.5) ====================

let _coachFeedReady = false;
let _coachDailyWorkout = null;
let _coachWeeklyChallenge = null;
let _coachUnsubs = { override:null, schedule:null, workout:null, challenge:null, myChallenge:null };

function _ersDateKey(d=new Date()){
    const z = new Date(d);
    const y = z.getFullYear();
    const m = String(z.getMonth()+1).padStart(2,'0');
    const day = String(z.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
}
function _ersDayKey(d=new Date()){
    const map = ['sun','mon','tue','wed','thu','fri','sat'];
    return map[d.getDay()];
}

function setupCoachFeedOnce(){
    if(_coachFeedReady) return;
    if(!db || !currentUser) return;
    _coachFeedReady = true;
    setupCoachFeed();
}

function setupCoachFeed(){
    try{
        const dateKey = _ersDateKey(new Date());

        // override for "today" (coach can publish a special workout)
        if(_coachUnsubs.override) _coachUnsubs.override();
        _coachUnsubs.override = db.collection('coachOverrides').doc(dateKey)
            .onSnapshot(() => loadCoachDailyWorkout());

        // weekly schedule (fallback if no override)
        if(!_coachUnsubs.schedule){
            _coachUnsubs.schedule = db.collection('coachConfig').doc('weeklySchedule')
                .onSnapshot(() => loadCoachDailyWorkout());
        }

        // weekly challenge (global)
        if(!_coachUnsubs.challenge){
            _coachUnsubs.challenge = db.collection('coachConfig').doc('weeklyChallenge')
                .onSnapshot(() => loadCoachWeeklyChallenge());
        }

        // my completion status (per user)
        if(!_coachUnsubs.myChallenge){
            _coachUnsubs.myChallenge = db.collection('users').doc(currentUser.uid)
                .collection('coachWeekly').doc('current')
                .onSnapshot(() => loadCoachWeeklyChallenge());
        }

        loadCoachDailyWorkout();
        loadCoachWeeklyChallenge();
    }catch(e){
        console.error(e);
    }
}

function _resetCoachFeed(){
    _coachFeedReady = false;
    Object.keys(_coachUnsubs).forEach(k=>{
        if(typeof _coachUnsubs[k] === 'function') _coachUnsubs[k]();
        _coachUnsubs[k] = null;
    });
    _coachDailyWorkout = null;
    _coachWeeklyChallenge = null;
}

/* -------------------- Daily Workout -------------------- */

async function loadCoachDailyWorkout(){
    const card = document.getElementById('coach-daily-card');
    if(!card) return;
    if(!db) return;

    const dateKey = _ersDateKey(new Date());
    const dayKey = _ersDayKey(new Date());

    let workoutId = null;
    let source = 'weekly';

    try{
        const ov = await db.collection('coachOverrides').doc(dateKey).get();
        if(ov.exists && ov.data()?.workoutId){
            workoutId = ov.data().workoutId;
            source = 'override';
        }else{
            const sched = await db.collection('coachConfig').doc('weeklySchedule').get();
            if(sched.exists){
                workoutId = sched.data()?.[dayKey] || null;
                source = 'weekly';
            }
        }

        if(workoutId){
            // subscribe to workout live updates (edit from admin)
            if(_coachUnsubs.workout) _coachUnsubs.workout();
            _coachUnsubs.workout = db.collection('coachWorkouts').doc(workoutId)
                .onSnapshot(snap=>{
                    if(!snap.exists) return;
                    _coachDailyWorkout = { id:snap.id, ...snap.data(), _source: source };
                    renderCoachDailyCard();
                });
        }else{
            _coachDailyWorkout = _getFallbackWorkout(dayKey);
            _coachDailyWorkout._source = 'fallback';
            renderCoachDailyCard();
        }

        const pill = document.getElementById('coach-daily-pill');
        if(pill){
            pill.style.display = 'inline-flex';
            pill.innerText = (source === 'override') ? 'مُحدث اليوم ✨' : 'من جدول الأسبوع ♻️';
        }
    }catch(e){
        console.error(e);
        card.innerHTML = `<div style="text-align:center; color:#ef4444;">تعذر تحميل جرية اليوم.</div>`;
    }
}

function _getFallbackWorkout(dayKey){
    const defaults = {
        sat: { emoji:'🫁', title:'استشفائي أو راحة', type:'recovery', load:'20–35 دقيقة', rpe:'2–3', structure:'Warmup: 5 دقائق مشي/جري خفيف\nMain: جري سهل جدًا\nCooldown: إطالة 8 دقائق', notes:'خفّفها… الهدف إنك تقوم تاني بكرة.' },
        sun: { emoji:'🏔️', title:'تمرين هيلز', type:'hills', load:'30–45 دقيقة', rpe:'6–7', structure:'Warmup: 10 دقائق\nMain: 6×(40ث صعود + 70ث نزول)\nCooldown: 8 دقائق', notes:'الصعود قوي بس قصير… والنزول مرن.' },
        mon: { emoji:'🧘‍♂️', title:'موبيلتي / يوجا', type:'mobility', load:'20–30 دقيقة', rpe:'1–2', structure:'Mobility: كاحل + فخذ + حوض\nYoga: تنفّس + إطالات', notes:'ده مش رفاهية… ده صيانة.' },
        tue: { emoji:'⚡', title:'انترفال', type:'intervals', load:'35–55 دقيقة', rpe:'7–8', structure:'Warmup: 10 دقائق\nMain: 8×(1د سريع + 1د سهل)\nCooldown: 8 دقائق', notes:'سرعاتك "متحكم فيها" مش سباق.' },
        wed: { emoji:'🎲', title:'فارتلك أو استشفائي', type:'fartlek', load:'25–45 دقيقة', rpe:'4–6', structure:'Warmup: 10 دقائق\nMain: 10×(1د أسرع + 1د سهل)\nCooldown: 6 دقائق', notes:'إلعبها… وانهى وأنت قادر تزود.' },
        thu: { emoji:'🏋️', title:'كروس تريننج', type:'strength', load:'25–40 دقيقة', rpe:'4–6', structure:'Strength: سكوات خفيف + كور\nأو: عجلة/سباحة/إليبتكال', notes:'قوة = حماية للركبة + سرعة أسرع.' },
        fri: { emoji:'🐢', title:'لونج رن', type:'long', load:'60–90 دقيقة', rpe:'3–5', structure:'Warmup: 8 دقائق\nMain: جري ثابت\nCooldown: 6 دقائق + سوائل', notes:'خليها "مريحة"… اللونج يبنيك.' }
    };
    return defaults[dayKey] || defaults.sun;
}

function renderCoachDailyCard(){
    const card = document.getElementById('coach-daily-card');
    if(!card) return;

    const w = _coachDailyWorkout;
    if(!w){
        card.innerHTML = `<div class="loader-placeholder">جاري تجهيز جرية اليوم…</div>`;
        return;
    }

    const emoji = w.emoji || '🔥';
    const title = w.title || w.name || 'جرية اليوم';
    const load = w.load || w.distance || '';
    const rpe = w.rpe ? `RPE ${w.rpe}` : '';
    const hasYT = !!_toYouTubeEmbed(w.youtubeUrl || w.youtube);

    card.innerHTML = `
        <div class="dw-head">
            <div class="dw-badge">
                <div class="dw-emoji">${emoji}</div>
                <div>
                    <div class="dw-title">${title}</div>
                    <div class="dw-meta">${load}${(load && rpe) ? ' • ' : ''}${rpe}${hasYT ? ' • 🎥 فيديو' : ''}</div>
                </div>
            </div>
            <div class="chip" style="opacity:0.9;" onclick="openDailyWorkoutModal(); event.stopPropagation();"><i class="ri-information-line"></i> التفاصيل</div>
        </div>
        <p class="dw-notes">${(w.notes || 'جاهز؟ نفّذها وارجع قولّي!').replace(/\n/g,'<br>')}</p>
        <div class="dw-actions">
            <button class="btn btn-primary" onclick="openLogFromCoach('${title.replace(/'/g,"&#39;")}'); event.stopPropagation();"><i class="ri-run-line"></i> سجل بعد ما تخلص</button>
            <button class="btn btn-ghost" onclick="openDailyWorkoutModal(); event.stopPropagation();"><i class="ri-map-2-line"></i> خطة التمرين</button>
        </div>
    `;
}

function openDailyWorkoutModal(){
    const w = _coachDailyWorkout;
    if(!w) return;

    const titleEl = document.getElementById('daily-modal-title');
    const bodyEl = document.getElementById('daily-modal-body');
    if(titleEl) titleEl.innerText = `${w.emoji || '🔥'} ${w.title || w.name || 'جرية اليوم'}`;

    const embed = _toYouTubeEmbed(w.youtubeUrl || w.youtube);
    const structure = (w.structure || '').trim();
    const notes = (w.notes || '').trim();
    const load = w.load || '';
    const rpe = w.rpe ? `RPE ${w.rpe}` : '';

    let html = '';
    html += `<div style="margin-bottom:10px; color:#9ca3af; font-size:12px;">${load}${(load && rpe) ? ' • ' : ''}${rpe}</div>`;

    if(structure){
        html += `<div style="background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:12px; white-space:pre-wrap; line-height:1.7; color:#e5e7eb; font-size:12px;">${_escapeHtml(structure)}</div>`;
    }else{
        html += `<div style="background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:12px; color:#e5e7eb; font-size:12px;">ابدأ بإحماء 8–10 دقائق… ثم نفّذ الجزء الرئيسي… وأنهِ بتهدئة وإطالة.</div>`;
    }

    if(notes){
        html += `<div style="margin-top:10px; font-size:12px; color:#dbeafe; line-height:1.7;"><b>كلمة الكوتش:</b> ${_escapeHtml(notes)}</div>`;
    }

    if(embed){
        html += `<div style="margin-top:12px; border-radius:14px; overflow:hidden; border:1px solid rgba(255,255,255,0.10);">
                    <iframe src="${embed}" style="width:100%; aspect-ratio:16/9; border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                 </div>`;
        html += `<div style="margin-top:6px; font-size:11px; color:#9ca3af;">لو الفيديو مفيد… احفظه وكرره. ✅</div>`;
    }

    if(bodyEl) bodyEl.innerHTML = html;
    document.getElementById('modal-daily-workout').style.display = 'flex';
}

function _escapeHtml(str){
    return (str||'')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}

function _toYouTubeEmbed(url){
    if(!url) return null;
    try{
        const u = new URL(url);
        let id = '';
        if(u.hostname.includes('youtu.be')){
            id = u.pathname.replace('/','').trim();
        }else if(u.hostname.includes('youtube.com')){
            if(u.pathname.startsWith('/watch')) id = u.searchParams.get('v') || '';
            if(u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] || '';
            if(u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2] || '';
        }
        if(!id) return null;
        return `https://www.youtube-nocookie.com/embed/${id}`;
    }catch(e){
        return null;
    }
}

function openLogFromCoach(suggestedType){
    // يفتح Modal تسجيل نشاط (بدون لمس الداتا القديمة)
    try{
        openNewRun(); // <--- تم التعديل من openLog() إلى openNewRun()
        const t = document.getElementById('log-type');
        if(t && suggestedType){
            // هنا يمكن إضافة منطق لاحقاً لتحديد النوع تلقائياً
        }
    }catch(e){
        console.error(e);
    }
}
/* -------------------- Weekly Challenge -------------------- */

async function loadCoachWeeklyChallenge(){
    const card = document.getElementById('coach-weekly-card');
    if(!card || !db || !currentUser) return;

    try{
        const snap = await db.collection('coachConfig').doc('weeklyChallenge').get();
        if(!snap.exists){
            _coachWeeklyChallenge = null;
            card.innerHTML = `<div style="text-align:center; color:#9ca3af;">لا يوجد تحدي أسبوعي منشور حالياً.</div>`;
            return;
        }
        _coachWeeklyChallenge = { id:snap.id, ...snap.data() };

        const mine = await db.collection('users').doc(currentUser.uid).collection('coachWeekly').doc('current').get();
        const completed = mine.exists && !!mine.data()?.completed;
        renderCoachWeeklyCard(completed, mine.exists ? mine.data() : null);
    }catch(e){
        console.error(e);
        card.innerHTML = `<div style="text-align:center; color:#ef4444;">تعذر تحميل تحدي الأسبوع.</div>`;
    }
}

function renderCoachWeeklyCard(completed, mineData){
    const card = document.getElementById('coach-weekly-card');
    if(!card) return;

    const ch = _coachWeeklyChallenge;
    if(!ch){
        card.innerHTML = `<div style="text-align:center; color:#9ca3af;">لا يوجد تحدي أسبوعي منشور حالياً.</div>`;
        return;
    }

    const emoji = ch.emoji || '🏁';
    const title = ch.title || 'تحدي الأسبوع';
    const desc = (ch.desc || ch.description || '').trim() || 'ابدأ… وخد صورة إثبات.';
    const requireImg = (ch.requireImage !== false);
    const status = completed ? 'مكتمل ✅' : (requireImg ? 'محتاج إثبات 📸' : 'جاهز للتنفيذ 🚀');

    const meta = document.getElementById('coach-weekly-meta');
    if(meta){
        meta.style.display = 'inline';
        meta.innerText = status;
    }

    card.innerHTML = `
        <div class="wc-head">
            <div class="wc-badge">
                <div class="wc-emoji">${emoji}</div>
                <div>
                    <div class="wc-title">${title}</div>
                    <div class="wc-meta">${status}</div>
                </div>
            </div>
            <div class="chip" onclick="openWeeklyChallengeModal(); event.stopPropagation();"><i class="ri-eye-line"></i> عرض</div>
        </div>
        <p class="wc-notes">${_escapeHtml(desc).replace(/\n/g,'<br>')}</p>
        <div class="wc-actions">
            <button class="btn btn-primary" onclick="openWeeklyChallengeModal(); event.stopPropagation();" ${completed ? 'disabled style="opacity:.6;"' : ''}>
                ${completed ? 'تم ✅' : 'تفاصيل التحدي'}
            </button>
            <button class="btn btn-ghost" onclick="shareWeeklyText(); event.stopPropagation();"><i class="ri-share-line"></i> مشاركة</button>
        </div>
    `;
}

function openWeeklyChallengeModal(){
    const ch = _coachWeeklyChallenge;
    if(!ch) return;

    const titleEl = document.getElementById('weekly-modal-title');
    const bodyEl = document.getElementById('weekly-modal-body');
    if(titleEl) titleEl.innerText = `${ch.emoji || '🏁'} ${ch.title || 'تحدي الأسبوع'}`;

    const requireImg = (ch.requireImage !== false);
    const desc = (ch.desc || ch.description || '').trim();

    let html = '';
    html += `<div style="color:#9ca3af; font-size:12px; margin-bottom:10px;">${requireImg ? '📸 يتطلب صورة إثبات' : '✅ بدون صورة إثبات'}</div>`;
    html += `<div style="background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:12px; white-space:pre-wrap; line-height:1.7; color:#e5e7eb; font-size:12px;">${_escapeHtml(desc || 'اكتب تفاصيل التحدي من لوحة الكوتش.')}</div>`;

    bodyEl.innerHTML = html;

    // update button availability
    db.collection('users').doc(currentUser.uid).collection('coachWeekly').doc('current').get().then(mine=>{
        const completed = mine.exists && !!mine.data()?.completed;
        const btn = document.getElementById('weekly-complete-btn');
        if(btn){
            btn.disabled = completed;
            btn.style.opacity = completed ? 0.6 : 1;
            btn.innerText = completed ? 'مكتمل ✅' : 'أكملت التحدي ✅';
        }
    });

    document.getElementById('modal-weekly-challenge').style.display = 'flex';
}

function openWeeklyProof(){
    const ch = _coachWeeklyChallenge;
    if(!ch) return;

    // reset proof UI
    const status = document.getElementById('weekly-upload-status');
    const prev = document.getElementById('weekly-img-preview');
    const hid = document.getElementById('weekly-uploaded-img-url');
    const note = document.getElementById('weekly-proof-note');
    if(status) status.innerText = '';
    if(prev){ prev.style.display = 'none'; prev.src = ''; }
    if(hid) hid.value = '';
    if(note) note.value = '';

    document.getElementById('modal-weekly-proof').style.display = 'flex';
}

async function saveWeeklyProof(){
    const ch = _coachWeeklyChallenge;
    if(!ch || !db || !currentUser) return;

    const requireImg = (ch.requireImage !== false);
    const imgUrl = document.getElementById('weekly-uploaded-img-url')?.value || '';
    const note = document.getElementById('weekly-proof-note')?.value || '';

    if(requireImg && !imgUrl){
        showToast('لازم ترفع صورة إثبات 📸');
        return;
    }

    try{
        await db.collection('users').doc(currentUser.uid).collection('coachWeekly').doc('current').set({
            completed: true,
            photoUrl: imgUrl || null,
            note: note || null,
            challengeTitle: ch.title || null,
            challengeEmoji: ch.emoji || null,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        closeModal('modal-weekly-proof');
        showToast('مبروك! التحدي اتسجل ✅');
        loadCoachWeeklyChallenge();
    }catch(e){
        console.error(e);
        showToast('حصل خطأ… حاول تاني');
    }
}

function shareWeeklyText(){
    const ch = _coachWeeklyChallenge;
    if(!ch) return;

    const title = ch.title || 'تحدي الأسبوع';
    const desc = (ch.desc || ch.description || '').trim();
    const msg = `🏁 ${title}\n\n${desc}\n\n#ERS #EgyRunnerSquad`;

    if(navigator.share){
        navigator.share({ title: title, text: msg }).catch(()=>{});
    }else{
        try{
            navigator.clipboard.writeText(msg);
            showToast('تم نسخ نص التحدي ✅');
        }catch(e){
            alert(msg);
        }
    }
}

/* Weekly proof upload (ImgBB) */
async function uploadWeeklyProofToImgBB(){
    const fileInput = document.getElementById('weekly-img-file');
    const status = document.getElementById('weekly-upload-status');
    const preview = document.getElementById('weekly-img-preview');
    const hidden = document.getElementById('weekly-uploaded-img-url');
    const saveBtn = document.getElementById('weekly-save-proof-btn');

    if(!fileInput || !fileInput.files || !fileInput.files[0]) return;

    const file = fileInput.files[0];
    if(saveBtn) saveBtn.disabled = true;
    if(status) status.innerText = 'جاري رفع الصورة...';

    try{
        const apiKey = IMG_BB_KEY;
        if(!apiKey) throw new Error('IMG_BB_KEY missing');

        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, { method:'POST', body: formData });
        const json = await res.json();
        if(!json || !json.success) throw new Error('upload failed');

        const url = json.data.url;
        if(hidden) hidden.value = url;

        if(preview){
            preview.src = url;
            preview.style.display = 'block';
        }
        if(status) status.innerText = 'تم رفع الصورة ✅';
    }catch(e){
        console.error(e);
        if(status) status.innerText = 'فشل رفع الصورة ❌';
    }finally{
        if(saveBtn) saveBtn.disabled = false;
    }
}

/* -------------------- Admin Coach Panel -------------------- */

async function loadCoachAdmin(){
    if(!(userData && userData.isAdmin===true) || !db) return;

    // set default date to today
    const dateEl = document.getElementById('coach-ov-date');
    if(dateEl && !dateEl.value) dateEl.value = _ersDateKey(new Date());

    await adminEnsureCoachSeed();
    await adminLoadCoachWorkoutsIntoSelects();
    await adminLoadScheduleAndChallenge();
    await adminRenderWorkoutsList();
}

async function adminEnsureCoachSeed(){
    try{
        const snap = await db.collection('coachWorkouts').limit(1).get();
        if(!snap.empty) return; // already has workouts

        const hint = document.getElementById('coach-week-hint');
        if(hint) hint.innerText = 'جاري إنشاء مكتبة افتراضية أول مرة…';

        const presets = [
            { emoji:'🫁', title:'Recovery Run', type:'recovery', load:'20–35 دقيقة', rpe:'2–3', structure:'Warmup: 5 دقائق\nMain: جري سهل جدًا\nCooldown: إطالة 8 دقائق', notes:'استشفاء… عايزك تخلص وأنت مبسوط.' },
            { emoji:'🏔️', title:'Hills Session', type:'hills', load:'30–45 دقيقة', rpe:'6–7', structure:'Warmup: 10 دقائق\nMain: 6×(40ث صعود + 70ث نزول)\nCooldown: 8 دقائق', notes:'الصعود قوي قصير… والنزول مرن.' },
            { emoji:'🧘‍♂️', title:'Mobility / Yoga', type:'mobility', load:'20–30 دقيقة', rpe:'1–2', structure:'Mobility: كاحل + حوض + فخذ\nYoga: 10 دقائق تنفّس + إطالات', notes:'ده يوم الصيانة.' },
            { emoji:'⚡', title:'Intervals 1:1', type:'intervals', load:'35–55 دقيقة', rpe:'7–8', structure:'Warmup: 10 دقائق\nMain: 8×(1د سريع + 1د سهل)\nCooldown: 8 دقائق', notes:'سرعاتك متحكم فيها.' },
            { emoji:'🎲', title:'Fartlek Play', type:'fartlek', load:'25–45 دقيقة', rpe:'4–6', structure:'Warmup: 10 دقائق\nMain: 10×(1د أسرع + 1د سهل)\nCooldown: 6 دقائق', notes:'إلعبها… وانهى وأنت قادر تزود.' },
            { emoji:'🏋️', title:'Cross / Strength', type:'strength', load:'25–40 دقيقة', rpe:'4–6', structure:'Strength: سكوات خفيف + كور\nأو: عجلة/سباحة', notes:'قوة = حماية للركبة.' },
            { emoji:'🐢', title:'Long Run', type:'long', load:'60–90 دقيقة', rpe:'3–5', structure:'Warmup: 8 دقائق\nMain: جري ثابت\nCooldown: 6 دقائق + سوائل', notes:'اللونج يبنيك… بهدوء.' },
        ];

        const ids = {};
        for(const p of presets){
            const docRef = await db.collection('coachWorkouts').add({
                ...p,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // map by type for schedule
            if(!ids[p.type]) ids[p.type] = docRef.id;
            // special for recovery etc
            if(p.title === 'Long Run') ids.long = docRef.id;
        }

        // default weekly schedule: sat recovery, sun hills, mon mobility, tue intervals, wed fartlek, thu strength, fri long
        await db.collection('coachConfig').doc('weeklySchedule').set({
            sat: ids.recovery || null,
            sun: ids.hills || null,
            mon: ids.mobility || null,
            tue: ids.intervals || null,
            wed: ids.fartlek || null,
            thu: ids.strength || null,
            fri: ids.long || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        await db.collection('coachConfig').doc('weeklyChallenge').set({
            emoji:'🏁',
            title:'تحدي الأسبوع: 3 أيام متتالية',
            desc:'سجّل 3 أنشطة (جري/مشي) خلال 3 أيام متتالية… وخد صورة إثبات في اليوم الأخير 💪',
            requireImage:true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        if(hint) hint.innerText = 'تم إنشاء مكتبة افتراضية ✅ (تقدر تعدّلها أو تضيف براحتك).';
    }catch(e){
        console.error(e);
    }
}

async function adminLoadCoachWorkoutsIntoSelects(){
    const selects = [
        document.getElementById('coach-ov-workout'),
        document.getElementById('wk-sat'), document.getElementById('wk-sun'), document.getElementById('wk-mon'),
        document.getElementById('wk-tue'), document.getElementById('wk-wed'), document.getElementById('wk-thu'),
        document.getElementById('wk-fri')
    ].filter(Boolean);

    if(!selects.length) return;

    const snap = await db.collection('coachWorkouts').orderBy('updatedAt','desc').get();
    const opts = [];
    snap.forEach(d=>{
        const data = d.data() || {};
        const label = `${data.emoji || '🔥'} ${data.title || data.name || 'Workout'} • ${data.type || ''}`;
        opts.push({ id:d.id, label });
    });

    const html = ['<option value="">— اختر —</option>']
        .concat(opts.map(o=>`<option value="${o.id}">${o.label}</option>`))
        .join('');

    selects.forEach(s=>{
        const val = s.value;
        s.innerHTML = html;
        if(val) s.value = val;
    });

    window._coachWorkoutsAdmin = opts;
}

async function adminLoadScheduleAndChallenge(){
    // schedule
    const sched = await db.collection('coachConfig').doc('weeklySchedule').get();
    if(sched.exists){
        const d = sched.data() || {};
        const map = { sat:'wk-sat', sun:'wk-sun', mon:'wk-mon', tue:'wk-tue', wed:'wk-wed', thu:'wk-thu', fri:'wk-fri' };
        Object.entries(map).forEach(([k,id])=>{
            const el = document.getElementById(id);
            if(el && d[k]) el.value = d[k];
        });
    }

    // weekly challenge
    const ch = await db.collection('coachConfig').doc('weeklyChallenge').get();
    if(ch.exists){
        const d = ch.data() || {};
        const e = document.getElementById('coach-ch-emoji');
        const t = document.getElementById('coach-ch-title');
        const ds = document.getElementById('coach-ch-desc');
        const r = document.getElementById('coach-ch-require-img');
        if(e) e.value = d.emoji || '🏁';
        if(t) t.value = d.title || '';
        if(ds) ds.value = d.desc || d.description || '';
        if(r) r.checked = (d.requireImage !== false);
    }

    // override hint
    const dateEl = document.getElementById('coach-ov-date');
    const hint = document.getElementById('coach-ov-hint');
    if(dateEl && hint){
        const dateKey = dateEl.value || _ersDateKey(new Date());
        const ov = await db.collection('coachOverrides').doc(dateKey).get();
        if(ov.exists){
            hint.innerText = `يوجد تعيين خاص لهذا اليوم ✅`;
        }else{
            hint.innerText = `لا يوجد تعيين خاص… سيستخدم جدول الأسبوع ♻️`;
        }
    }
}

async function adminRenderWorkoutsList(){
    const box = document.getElementById('coach-workouts-list');
    if(!box || !db) return;

    const snap = await db.collection('coachWorkouts').orderBy('updatedAt','desc').limit(50).get();
    if(snap.empty){
        box.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:16px;">لا توجد تمرينات بعد.</div>`;
        return;
    }

    let html = '';
    snap.forEach(doc=>{
        const w = doc.data() || {};
        const title = (w.title || w.name || 'Workout');
        const sub = `${w.type || ''}${w.load ? ' • ' + w.load : ''}${w.rpe ? ' • RPE ' + w.rpe : ''}${(w.youtubeUrl||w.youtube)?' • 🎥':''}`;
        html += `
            <div class="workout-row">
                <div class="wr-left">
                    <div class="wr-title">${_escapeHtml((w.emoji||'🔥') + ' ' + title)}</div>
                    <div class="wr-sub">${_escapeHtml(sub)}</div>
                </div>
                <div class="wr-actions">
                    <button class="btn btn-ghost" onclick="adminEditWorkout('${doc.id}')"><i class="ri-edit-line"></i></button>
                    <button class="btn btn-ghost" onclick="adminDeleteWorkout('${doc.id}')"><i class="ri-delete-bin-6-line"></i></button>
                </div>
            </div>
        `;
    });

    box.innerHTML = html;
}

async function adminCreateWorkout(){
    try{
        const title = document.getElementById('cw-title')?.value?.trim();
        const type = document.getElementById('cw-type')?.value?.trim() || 'recovery';
        const load = document.getElementById('cw-load')?.value?.trim() || '';
        const rpe = document.getElementById('cw-rpe')?.value?.trim() || '';
        const structure = document.getElementById('cw-structure')?.value?.trim() || '';
        const notes = document.getElementById('cw-notes')?.value?.trim() || '';
        const youtubeUrl = document.getElementById('cw-youtube')?.value?.trim() || '';

        if(!title){
            showToast('اكتب اسم التمرين');
            return;
        }

        await db.collection('coachWorkouts').add({
            emoji: _guessEmoji(type),
            title, type, load, rpe, structure, notes,
            youtubeUrl: youtubeUrl || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // reset a few fields
        document.getElementById('cw-title').value = '';
        document.getElementById('cw-load').value = '';
        document.getElementById('cw-rpe').value = '';
        document.getElementById('cw-structure').value = '';
        document.getElementById('cw-notes').value = '';
        document.getElementById('cw-youtube').value = '';

        showToast('تم إضافة التمرين ✅');
        await adminLoadCoachWorkoutsIntoSelects();
        await adminRenderWorkoutsList();
    }catch(e){
        console.error(e);
        showToast('حصل خطأ…');
    }
}

function _guessEmoji(type){
    const map = { recovery:'🫁', hills:'🏔️', intervals:'⚡', fartlek:'🎲', tempo:'🔥', long:'🐢', strength:'🏋️', mobility:'🧘‍♂️' };
    return map[type] || '🔥';
}

async function adminDeleteWorkout(id){
    if(!id) return;
    if(!confirm('حذف التمرين؟')) return;
    try{
        await db.collection('coachWorkouts').doc(id).delete();
        showToast('اتحذف ✅');
        await adminLoadCoachWorkoutsIntoSelects();
        await adminRenderWorkoutsList();
    }catch(e){
        console.error(e);
        showToast('تعذر الحذف');
    }
}

async function adminEditWorkout(id){
    if(!id) return;
    try{
        const snap = await db.collection('coachWorkouts').doc(id).get();
        if(!snap.exists) return;
        const w = snap.data() || {};

        const newTitle = prompt('اسم التمرين:', w.title || '');
        if(newTitle === null) return;

        const newLoad = prompt('المدة/المسافة (نص):', w.load || '');
        if(newLoad === null) return;

        const newRpe = prompt('RPE:', w.rpe || '');
        if(newRpe === null) return;

        const newNotes = prompt('تعليمات الكوتش (مختصر):', w.notes || '');
        if(newNotes === null) return;

        const newYT = prompt('رابط يوتيوب (اختياري):', w.youtubeUrl || '');
        if(newYT === null) return;

        await db.collection('coachWorkouts').doc(id).set({
            title: (newTitle||'').trim(),
            load: (newLoad||'').trim(),
            rpe: (newRpe||'').trim(),
            notes: (newNotes||'').trim(),
            youtubeUrl: (newYT||'').trim() || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        showToast('تم التحديث ✅');
        await adminLoadCoachWorkoutsIntoSelects();
        await adminRenderWorkoutsList();
    }catch(e){
        console.error(e);
        showToast('تعذر التعديل');
    }
}

async function adminPublishDailyOverride(){
    if(!(userData && userData.isAdmin===true) || !db) return;
    const dateKey = document.getElementById('coach-ov-date')?.value || _ersDateKey(new Date());
    const workoutId = document.getElementById('coach-ov-workout')?.value || '';
    const hint = document.getElementById('coach-ov-hint');

    if(!workoutId){
        showToast('اختر تمرين');
        return;
    }

    try{
        await db.collection('coachOverrides').doc(dateKey).set({
            workoutId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        if(hint) hint.innerText = 'تم النشر ✅ (الناس هتشوفه فوراً)';
        showToast('نشرنا تمرين اليوم ✅');
    }catch(e){
        console.error(e);
        showToast('تعذر النشر');
    }
}

async function adminClearDailyOverride(){
    if(!(userData && userData.isAdmin===true) || !db) return;
    const dateKey = document.getElementById('coach-ov-date')?.value || _ersDateKey(new Date());
    const hint = document.getElementById('coach-ov-hint');

    try{
        await db.collection('coachOverrides').doc(dateKey).delete();
        if(hint) hint.innerText = 'تم المسح ✅ سيستخدم جدول الأسبوع ♻️';
        showToast('تم مسح التعيين');
    }catch(e){
        console.error(e);
        showToast('تعذر المسح');
    }
}

async function adminSaveWeeklySchedule(){
    if(!(userData && userData.isAdmin===true) || !db) return;

    const get = (id)=> document.getElementById(id)?.value || '';
    const data = {
        sat: get('wk-sat'),
        sun: get('wk-sun'),
        mon: get('wk-mon'),
        tue: get('wk-tue'),
        wed: get('wk-wed'),
        thu: get('wk-thu'),
        fri: get('wk-fri'),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try{
        await db.collection('coachConfig').doc('weeklySchedule').set(data, { merge:true });
        const hint = document.getElementById('coach-week-hint');
        if(hint) hint.innerText = 'تم حفظ جدول الأسبوع ✅';
        showToast('اتحفظ ✅');
    }catch(e){
        console.error(e);
        showToast('تعذر الحفظ');
    }
}

async function adminPublishWeeklyChallenge(){
    if(!(userData && userData.isAdmin===true) || !db) return;

    const emoji = document.getElementById('coach-ch-emoji')?.value?.trim() || '🏁';
    const title = document.getElementById('coach-ch-title')?.value?.trim() || '';
    const desc = document.getElementById('coach-ch-desc')?.value?.trim() || '';
    const requireImage = document.getElementById('coach-ch-require-img')?.checked ?? true;

    if(!title || !desc){
        showToast('اكتب العنوان والوصف');
        return;
    }

    try{
        await db.collection('coachConfig').doc('weeklyChallenge').set({
            emoji, title, desc, requireImage,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        const hint = document.getElementById('coach-ch-hint');
        if(hint) hint.innerText = 'تم نشر تحدي الأسبوع ✅';
        showToast('نشرنا التحدي 🚀');
    }catch(e){
        console.error(e);
        showToast('تعذر النشر');
    }
}



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
window.editRun = function(id, dist, time, type, link, img, xtDist) {
    // 1. وضع بيانات التعديل
    editingRunId = id;
    editingOldDist = dist;
    editingOldType = type || 'Run';

    // 2. تعبئة الحقول
    document.getElementById('log-dist').value = _ersIsCoreType(type) ? dist : (xtDist || '');
    document.getElementById('log-time').value = time;
    document.getElementById('log-type').value = type;
    try{ document.getElementById('log-type').dispatchEvent(new Event('change')); }catch(e){}
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

          // Cache for Coach V2 decision engine
          window._ersRunsCache = runs;
          if (typeof updateCoachDecisionUI === 'function') updateCoachDecisionUI(runs);

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
                  if (_ersIsCoreType(r.type) && r.dist === maxDist && maxDist > 5) {
                      iconClass = 'ri-trophy-fill';
                      typeClass = 'record-gold';
                      recordLabel = '<span style="font-size:9px; color:#f59e0b; margin-right:5px;">(الأطول)</span>';
                  } 
                  // ب) هل هي الأسرع؟ (الأحمر) - بشرط تكون جري وليست مشي
                  else if (_ersIsCoreType(r.type) && currentPace === bestPace && r.dist >= 1 && r.type === 'Run') {
                      iconClass = 'ri-flashlight-fill'; 
                      typeClass = 'record-fire';
                      recordLabel = '<span style="font-size:9px; color:#ef4444; margin-right:5px;">(الأسرع)</span>';
                  }
                  // ج) هل هي الأطول زمناً؟ (البنفسجي)
                  else if (_ersIsCoreType(r.type) && r.time === maxTime && maxTime > 30) {
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
                              ${(_ersIsCoreType(r.type) ? `${formatNumber(r.dist)} <span class="log-unit">كم</span> ${recordLabel}` : `<span class="xt-badge">XT</span> <span class="log-unit">${r.type || 'Cross'}</span>`)}
                          </div>
                          <div class="log-sub-stat">
                              <span><i class="ri-calendar-line"></i> ${dayNum} ${dayName}</span>
                              ${(_ersIsCoreType(r.type) ? `<span><i class="ri-timer-flash-line"></i> ${paceDisplay} د/كم</span>` : `<span><i class="ri-time-line"></i> ${r.time || 0} دقيقة</span>`)}
                          </div>
                      </div>

                      <div class="log-actions">
                          <button class="btn-icon-action share" onclick="generateShareCard('${r.dist}', '${r.time}', '${dayNum} ${month}')">
                              <i class="ri-share-forward-line"></i>
                          </button>
                          
                          <button class="btn-icon-action" onclick="editRun('${r.id}', ${r.dist}, ${r.time}, '${r.type}', '${r.link || ''}', '${r.img || ''}', ${r.xtDist || 0})">
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
            totalRuns: firebase.firestore.FieldValue.increment(-(_ersIsCoreType(runData.type) ? 1 : 0)),
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

// ==================== دوري المحافظات (نظام القوة النسبية V5.0) ====================
// ==================== دوري المحافظات (Game Mode V6.0) ====================
async function loadRegionBattle() {
    const list = document.getElementById('region-battle-list');
    if (!list) return;
    
    // عرض اللودر
    list.innerHTML = getSkeletonHTML('squads');
    
    try {
        if (allUsersCache.length === 0) await fetchTopRunners();

        let govStats = {};
        
        // 1. الحسابات (القوة = المسافة ÷ العدد)
        allUsersCache.forEach(user => {
            const monthRun = (user.monthRunDist != null ? user.monthRunDist : (user.monthDist || 0));
            if(user.region && monthRun > 0) { // استبعاد الخاملين
                let gov = user.region;
                if (!govStats[gov]) govStats[gov] = { name: gov, dist: 0, players: 0 };
                govStats[gov].dist += monthRun;
                govStats[gov].players += 1;
            }
        });

        let leagueData = Object.values(govStats)
            .map(g => {
                g.power = g.players > 0 ? (g.dist / g.players) : 0;
                return g;
            })
            .sort((a, b) => b.power - a.power);

        if (leagueData.length === 0) { 
            list.innerHTML = '<div style="text-align:center; padding:30px; opacity:0.5;">😴 الساحة هادئة.. ابدأ الجري لإشعال المنافسة!</div>'; 
            return; 
        }

        const maxPower = leagueData[0].power || 1;
        const REGION_AR = { "Cairo": "القاهرة", "Giza": "الجيزة", "Alexandria": "الإسكندرية", "Mansoura": "المنصورة", "Tanta": "طنطا", "Luxor": "الأقصر", "Aswan": "أسوان", "Red Sea": "البحر الأحمر", "Sinai": "سيناء", "Sharkia": "الشرقية", "Dakahlia": "الدقهلية", "Menofia": "المنوفية", "Gharbia": "الغربية", "Beni Suef": "بني سويف", "Fayoum": "الفيوم", "Minya": "المنيا", "Assiut": "أسيوط", "Sohag": "سوهاج", "Qena": "قنا", "Matrouh": "مطروح", "Port Said": "بورسعيد", "Damietta": "دمياط", "Suez": "السويس", "Ismailia": "الإسماعيلية" };

        // 2. بناء الواجهة (مقدمة اللعبة + الكروت)
        let html = `
        <div class="battle-tutorial">
            <i class="ri-flashlight-fill" style="color:#f59e0b"></i>
            <div>قوة المحافظة = <span>إجمالي المسافة</span> ÷ <span>عدد المحاربين</span></div>
        </div>
        <div class="squad-list">`;

        leagueData.forEach((gov, index) => {
            const rank = index + 1;
            const percent = Math.min((gov.power / maxPower) * 100, 100);
            const arabicName = REGION_AR[gov.name] || gov.name;
            
            // ألوان الرتب
            let color = 'var(--primary)'; // أخضر للباقي
            let rankBadge = `<span style="font-size:12px; color:#6b7280">#${rank}</span>`;
            
            if (rank === 1) { color = '#f59e0b'; rankBadge = '👑'; } // ذهبي
            else if (rank === 2) { color = '#9ca3af'; rankBadge = '🥈'; } // فضي
            else if (rank === 3) { color = '#cd7f32'; rankBadge = '🥉'; } // برونزي

            // تأخير الأنيميشن لكل كارت (Stagger Effect)
            const animDelay = index * 0.1; 

            html += `
            <div class="gov-game-card" style="animation-delay:${animDelay}s; border-right: 4px solid ${color};">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="font-size:22px; width:30px; text-align:center;">${rankBadge}</div>
                        <div>
                            <div style="font-size:15px; font-weight:bold; color:#fff;">${arabicName}</div>
                            <div style="display:flex; gap:5px; margin-top:4px;">
                                <div class="stat-pill"><i class="ri-user-3-line"></i> ${gov.players}</div>
                                <div class="stat-pill"><i class="ri-route-line"></i> ${gov.dist.toFixed(0)}</div>
                            </div>
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:18px; font-weight:900; color:${color}; text-shadow:0 0 10px rgba(0,0,0,0.5);">${gov.power.toFixed(1)}</div>
                        <div style="font-size:9px; color:#9ca3af; text-transform:uppercase;">Power</div>
                    </div>
                </div>

                <div class="power-track">
                    <div class="power-fill" id="bar-${index}" style="background:${color}; width:0%"></div>
                </div>
            </div>`;
        });

        html += '</div>';
        list.innerHTML = html;

        // 3. تفعيل أنيميشن امتلاء الأشرطة (بعد رسم الكروت)
        setTimeout(() => {
            leagueData.forEach((gov, index) => {
                const bar = document.getElementById(`bar-${index}`);
                if (bar) {
                    const percent = Math.min((gov.power / maxPower) * 100, 100);
                    bar.style.width = `${percent}%`;
                }
            });
        }, 100); // تأخير بسيط جداً ليسمح للمتصفح برسم العنصر أولاً

    } catch (e) { 
        console.error(e);
    }
}
// ==================== عرض المنشورات (محدث لزر الصورة) ====================
function loadGlobalFeed() {
    const list = document.getElementById('global-feed-list');
    if(!list) return;

    // عرض الهيكل العظمي عند التحميل لأول مرة
    if(!list.hasChildNodes() || list.innerHTML.includes('جاري التحميل')) {
        list.innerHTML = getSkeletonHTML('feed');
    }

    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(10).onSnapshot(snap => {
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

                    ${p.commentsDisabled ? `<span class="feed-compact-meta" style="margin-right:8px; color:#9ca3af;"><i class="ri-lock-line"></i> التعليقات مغلقة</span>` : `<button class="feed-compact-btn" onclick="openComments('${doc.id}', '${p.uid}')" style="margin-right:8px;"><i class="ri-chat-3-line"></i><span class="feed-compact-count">${commentsCount > 0 ? commentsCount : ''}</span></button>`}

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
        const kind = run.autoKind || _ersAutoKind(run.type || run.activityType || 'Run', pace);
        const isTooFast = pace < 2.5 && dist > 1;
        const isTooFar = dist > 45;
        const isWalkLikeRun = ((run.type === 'Run' || run.type === 'Race') && kind === 'Walk' && dist >= 2);

        if (isTooFast || isTooFar || isWalkLikeRun) {
            suspiciousCount++;
            const reason = isTooFast ? `🚀 سرعة (${pace.toFixed(1)} د/كم)` : (isTooFar ? `🗺️ مسافة (${dist} كم)` : `🚶‍♂️ مشي متسجل كجري (${pace.toFixed(1)} د/كم)`);
          
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
                totalRuns: firebase.firestore.FieldValue.increment(-(_ersIsCoreType(runData.type) ? 1 : 0)),
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


// ==================== Coach Brain v1: Speed Radar ====================
function _ersGetRecentRunsForSpeed(){
  const runs = (window._ersRunsCache || []).slice().filter(r=>{
    const kind = r.autoKind || _ersAutoKind(r.type, _ersPace(r.dist, r.time));
    return kind === 'Run' && (parseFloat(r.dist)||0) > 0 && (parseFloat(r.time)||0) > 0;
  });
  return runs;
}
function _ersComputeSpeedStats(runs){
  const now = new Date();
  const msDay = 1000*60*60*24;
  const inDays = (r,days)=>{
    const d = r.timestamp ? (r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp)) : null;
    return d && (now - d) <= days*msDay;
  };
  const agg = (arr)=>{
    let dist=0, time=0, count=0, bestPace=null;
    arr.forEach(r=>{
      const d=parseFloat(r.dist)||0, t=parseFloat(r.time)||0;
      const p=_ersPace(d,t);
      if(d>0 && t>0 && p){
        dist+=d; time+=t; count++;
        if(bestPace===null || p<bestPace) bestPace=p;
      }
    });
    const avgPace = dist>0 ? (time/dist) : null;
    return {dist,time,count,avgPace,bestPace};
  };
  return {
    last7: agg(runs.filter(r=>inDays(r,7))),
    last14: agg(runs.filter(r=>inDays(r,14)))
  };
}
function _ersSpeedWorkoutSuggestion(stats){
  const focus = String(getUserPref('focusGoal','fitness')).toLowerCase();
  const note = (focus==='weightloss' || focus==='fitness')
    ? 'تنويه: لو هدفك لياقة/خسارة وزن… السرعة مش أولوية. الأهم الاستمرارية والمسافة.'
    : 'هدفك أداء/سرعة… هنشتغل بذكاء بدون ضغط مبالغ فيه.';
  const basePace = stats?.last14?.avgPace || stats?.last7?.avgPace;
  const p = (basePace && isFinite(basePace)) ? basePace : null;

  let suggestion = {title:'⚡ تمرين سرعة خفيف', details:'إحماء 10د + 6×(1د سريع / 1د سهل) + تهدئة 8د.', tip:'السريع "قابل للتحكم"… مش سباق.', safety:'لو في ألم/إرهاق عالي: حوله لجري سهل 20–30د.'};
  if(p && p < 6.5){
    suggestion = {title:'⚡ Speed Builder', details:'إحماء 12د + 8×(400م سريع / 200م سهل) + تهدئة 10د.', tip:'ركز على تكنيك وخفة…', safety:'يوم استشفاء بعدها.'};
  }else if(p && p < 8.5){
    suggestion = {title:'⚡ Intervals ذكية', details:'إحماء 10د + 5×(2د سريع / 2د سهل) + تهدئة 8د.', tip:'السريع حوالي 15–25ث أسرع من بيسك السهل.', safety:'لو بعد لونج رن… خليه فارتلك خفيف.'};
  }
  return {note, suggestion};
}
function openSpeedRadar(){
  const body=document.getElementById('speed-radar-body');
  if(!body) return;
  const runs=_ersGetRecentRunsForSpeed();
  const btn=document.getElementById('coach-speed-btn');
  if(btn) btn.style.display = (!getUserPref('hideSpeedRadar', false) && runs.length>=2) ? 'flex' : 'none';
  const stats=_ersComputeSpeedStats(runs);
  const last7=stats.last7, last14=stats.last14;
  const pack=_ersSpeedWorkoutSuggestion(stats);
  body.innerHTML = `
    <div class="speed-stat"><b>متوسط بيس 7 أيام</b><span>${_ersFormatPace(last7.avgPace)} • ${last7.dist.toFixed(1)} كم • ${last7.count} نشاط</span></div>
    <div class="speed-stat"><b>أفضل بيس (14 يوم)</b><span>${_ersFormatPace(last14.bestPace)} • ${last14.dist.toFixed(1)} كم</span></div>
    <div class="speed-card">
      <h4>${pack.suggestion.title}</h4>
      <p><b>الخطة:</b> ${pack.suggestion.details}</p>
      <p style="margin-top:8px;"><b>Tip:</b> ${pack.suggestion.tip}</p>
      <p style="margin-top:8px; color:#9ca3af;">${pack.note}</p>
      <p style="margin-top:8px; color:#9ca3af;">${pack.suggestion.safety}</p>
    </div>
  `;
  openModal('modal-speed-radar');
}

// ==================== Weekly Awards (Top 3) ====================
function _ersWeekRangeSat(d=new Date()){
  const z=new Date(d); z.setHours(0,0,0,0);
  const day=z.getDay(); // 0 Sun..6 Sat
  const offset=(day+1)%7;
  const start=new Date(z); start.setDate(z.getDate()-offset);
  const end=new Date(start); end.setDate(start.getDate()+7);
  return {start,end};
}
function _ersFormatDateShort(d){ return `${d.getDate()}/${d.getMonth()+1}`; }
async function _ersFetchFeedSince(dateObj, limit=1500){
  if(!db) return [];
  const items=[];
  const snap=await db.collection('activity_feed').where('timestamp','>=',dateObj).orderBy('timestamp','desc').limit(limit).get();
  snap.forEach(doc=>items.push(Object.assign({id:doc.id}, doc.data()||{})));
  return items;
}
async function openWeeklyAwards(category){
  const titleEl=document.getElementById('weekly-awards-title');
  const rangeEl=document.getElementById('weekly-awards-range');
  const bodyEl=document.getElementById('weekly-awards-body');
  if(!titleEl||!rangeEl||!bodyEl) return;
  const mapTitle={distance:'تكريم: الأطول نفسًا 🫁', speed:'تكريم: الأسرع عدوًا ⚡', consistency:'تكريم: الأكثر تحمّلًا 🛡️'};
  titleEl.textContent = mapTitle[category] || 'لوحة تكريم الأسبوع';
  const {start,end}=_ersWeekRangeSat(new Date());
  rangeEl.textContent = `الأسبوع: ${_ersFormatDateShort(start)} → ${_ersFormatDateShort(new Date(end-1))}`;
  bodyEl.innerHTML='<div style="text-align:center; padding:10px; color:#9ca3af;">جاري التحميل…</div>';
  openModal('modal-weekly-awards');
  try{
    const feed=await _ersFetchFeedSince(start, 1500);
    const week=feed.filter(it=>{
      const d=it.timestamp?it.timestamp.toDate():null;
      return d && d>=start && d<end;
    });
    const per={};
    week.forEach(it=>{
      const uid=it.uid||it.userId;
      if(!uid) return;
      const dist=parseFloat(it.dist)||0, time=parseFloat(it.time)||0;
      const pace=it.pace || _ersPace(dist,time);
      const autoKind=it.autoKind || _ersAutoKind(it.type, pace);
      if(autoKind!=='Run') return;
      if(!per[uid]) per[uid]={uid,name:it.userName||'عضو',dist:0,time:0,count:0,days:{}};
      per[uid].dist+=dist; per[uid].time+=time; per[uid].count+=1;
      try{ const dd = it.timestamp?it.timestamp.toDate():null; if(dd){ const k=_ersDateKey(dd); per[uid].days[k]=true; } }catch(e){}
    });
    let arr=Object.values(per);
    if(category==='distance'){ arr.sort((a,b)=>b.dist-a.dist); arr=arr.slice(0,3); }
    else if(category==='speed'){
      arr=arr.filter(u=>u.dist>=ERS_MIN_DIST_FOR_SPEED);
      arr.forEach(u=>u.avgPace = u.dist>0 ? (u.time/u.dist) : null);
      arr.sort((a,b)=>(a.avgPace||999)-(b.avgPace||999));
      arr=arr.slice(0,3);
    }else if(category==='consistency'){
      arr.forEach(u=>u.daysActive = u.days ? Object.keys(u.days).length : 0);
      const eligible = arr.filter(u=>u.daysActive>=5);
      const pool = eligible.length ? eligible : arr;
      pool.sort((a,b)=> (b.daysActive||0) - (a.daysActive||0));
      arr = pool.slice(0,3);
    }
    else { arr.sort((a,b)=>b.dist-a.dist); arr=arr.slice(0,3); }
    if(!arr.length){ bodyEl.innerHTML='<div style="text-align:center; padding:10px; color:#9ca3af;">لا توجد بيانات كافية هذا الأسبوع</div>'; return; }
    bodyEl.innerHTML = `<div class="hof-list">${arr.map((u,idx)=>{ const metric = category==='speed'?_ersFormatPace(u.avgPace):(category==='consistency'?`${(u.daysActive??(u.days?Object.keys(u.days).length:0))} أيام`:`${u.dist.toFixed(1)} كم`); return `
      <div class="hof-row" onclick="viewUserProfile('${u.uid}')">
        <div class="hof-rank">#${idx+1}</div>
        <div class="hof-main"><div class="hof-name">${u.name}</div><div class="hof-meta">${metric}</div></div>
        <div class="hof-action"><i class="ri-arrow-left-s-line"></i></div>
      </div>`; }).join('')}</div>`;
  }catch(e){
    bodyEl.innerHTML='<div style="text-align:center; padding:10px; color:#ef4444;">حدث خطأ في التحميل</div>';
  }
}

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
    // ترتيب التبويبات الجديد: الكوتش / بياناتي / النادي / الأرينا
    const map = {'home':0, 'profile':1, 'club':2, 'challenges':3};
    if(navItems[map[viewId]]) navItems[map[viewId]].classList.add('active');

    // Hooks بسيطة للصفحات الجديدة
    if (viewId === 'home') {
        if (typeof renderPlanCard === 'function') renderPlanCard();
        if (typeof updateCoachDecisionUI === 'function') updateCoachDecisionUI();
    }
// if (viewId === 'club' && typeof loadHallOfFame === 'function') loadHallOfFame(); // تم النقل لصفحة الكوتش
}

// Keyboard shortcut for header name (accessibility)
try {
    const _hn = document.getElementById('headerName');
    if (_hn) {
        _hn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                switchView('profile');
            }
        });
    }
} catch(e) {}

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
        if(typeof setupCoachFeedOnce === 'function') setupCoachFeedOnce();

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
async function loadActiveChallenges() {
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

    // 2. الحالة الفارغة
    if (displayList.length === 0) {
        let funIcon = "👻";
        let funTitle = "المكان مهجور يا كابتن!";
        let funDesc = "مفيش تحديات هنا حالياً.. ارجع بعدين";

        if (currentChallengeFilter === 'joined') {
            funIcon = "🐢"; funTitle = "إيه الكسل ده؟"; funDesc = "أنت مش مشترك في أي تحدي لسه!<br>روح على <b>'جديدة'</b> واشترك يا بطل.";
        } else if (currentChallengeFilter === 'new') {
            funIcon = "✅"; funTitle = "خلصت كل حاجة!"; funDesc = "يا جامد! مفيش تحديات جديدة قدامك.";
        } else if (currentChallengeFilter === 'completed') {
            funIcon = "🏆"; funTitle = "لسه بدري ع الكؤوس"; funDesc = "شد حيلك شوية يا وحش عايزين نشوف ميداليات!";
        }

        list.innerHTML = `
            <div class="empty-state-fun">
                <span class="fun-icon">${funIcon}</span>
                <div class="fun-title">${funTitle}</div>
                <div class="fun-desc">${funDesc}</div>
            </div>`;
        return;
    }

    // 3. عرض الكروت (القابلة للضغط بالكامل)
    let fullHtml = '';
    displayList.forEach(ch => {
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
        }

        // إعداد الفوتر
        let timeIcon = isUrgent ? "ri-fire-fill" : "ri-hourglass-2-fill";
        let timeClass = isUrgent ? "time urgent" : (daysLeftText === "انتهى" ? "time done" : "time");
        if(daysLeftText === "انتهى") timeIcon = "ri-checkbox-circle-fill";

        const metaFooter = `
            <div class="ch-meta-footer">
                <div class="meta-pill social" title="عدد الأبطال">
                    <i class="ri-group-fill"></i> <span>${ch.participantsCount || 0} مشارك</span>
                </div>
                <div class="meta-pill ${timeClass}">
                    <span>${daysLeftText}</span> <i class="${timeIcon}"></i>
                </div>
            </div>
        `;

        // أزرار الأدمن (مع stopPropagation لمنع فتح المودال عند الحذف)
        let adminControls = '';
        if (userData.isAdmin) {
            adminControls = `
            <div style="position:absolute; top:15px; left:15px; display:flex; gap:8px; z-index:50;">
                <div class="admin-del-btn" onclick="event.stopPropagation(); editChallenge('${ch.id}')" title="تعديل" style="position:static; background:rgba(245, 158, 11, 0.15); color:#f59e0b; border-color:rgba(245, 158, 11, 0.3); width:32px; height:32px;"><i class="ri-pencil-line"></i></div>
                <div class="admin-del-btn" onclick="event.stopPropagation(); deleteChallenge('${ch.id}')" title="حذف" style="position:static; width:32px; height:32px;"><i class="ri-delete-bin-line"></i></div>
            </div>`;
        }

        // زر الترتيب (لم يعد له داعي كبير لأن الكارت كله يفتح، لكن سنبقيه كعنصر جمالي أو نحذفه، سأبقيه كأيقونة فقط)
        const rankBadge = `
            <div class="ch-leaderboard-btn" style="pointer-events:none;">
                <i class="ri-trophy-fill"></i> الترتيب
            </div>
        `;

        // زر الحالة أو الانضمام
        let actionBtn = '';
        if (!ch.isJoined) {
            // انتبه: stopPropagation هنا ضروري لكي يعمل زر الانضمام دون فتح التفاصيل فوراً (اختياري)
            // لكن الأفضل أن يفتح التفاصيل ومن هناك ينضم، ولكن سأترك الزر يعمل مباشرة
            actionBtn = `<button class="ch-join-btn" onclick="event.stopPropagation(); joinChallenge('${ch.id}')" style="position:relative; z-index:20;">قبول التحدي</button>`;
        } else if (ch.completed) {
            actionBtn = `<div style="margin-top:15px; text-align:center; color:#10b981; font-weight:bold; font-size:12px; background:rgba(16,185,129,0.1); padding:8px; border-radius:8px;">🎉 التحدي مكتمل</div>`;
        }

        // السمة المشتركة للكارت (onclick يفتح التفاصيل)
        const cardAttribs = `onclick="openChallengeDetails('${ch.id}')" style="cursor:pointer;"`;

        // بناء الكارت حسب النوع
        if (ch.type === 'speed') {
            const isDone = ch.completed;
            fullHtml += `
            <div class="ch-card speed-mode ${isDone?'done':''}" ${cardAttribs}>
                ${adminControls} ${rankBadge}
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
            <div class="ch-card habit-mode" ${cardAttribs}>
                ${adminControls} ${rankBadge}
                <div class="ch-header-centered" style="margin-top:40px;">
                    <h3 style="margin:0; font-size:16px; color:#fff;">${ch.title}</h3>
                    <span style="font-size:10px; color:#c4b5fd; margin-top:5px;">هدف: ${ch.target} جرية</span>
                </div>
                ${ch.isJoined ? `<div class="habit-grid">${dotsHtml}</div><span class="habit-counter">${Math.floor(ch.progress)} / ${ch.target}</span>` : actionBtn}
                ${metaFooter}
            </div>`;
        }
        else {
            const perc = Math.min((ch.progress / ch.target) * 100, 100);
            fullHtml += `
            <div class="ch-card dist-mode" ${cardAttribs}>
                ${adminControls} ${rankBadge}
                <div class="ch-header-centered" style="margin-top:40px;">
                    <h3 style="margin:0; font-size:16px; color:#fff;">${ch.title}</h3>
                    <div style="display:flex; gap:10px; align-items:center; margin-top:5px; justify-content:center;">
                        <span style="font-size:14px; font-weight:bold; color:#fff;">${Math.floor(ch.progress)} <span style="font-size:10px; opacity:0.6">/ ${ch.target} كم</span></span>
                    </div>
                </div>
                ${ch.isJoined ? `<div class="road-track"><div class="road-fill" style="width:${perc}%"></div></div>` : actionBtn}
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


async function submitRun() {
    
    if (!navigator.onLine) return showToast("لا يوجد اتصال بالإنترنت ⚠️", "error");

    const btn = document.getElementById('save-run-btn');
    const distInputRaw = parseFloat(document.getElementById('log-dist').value);
    const time = parseFloat(document.getElementById('log-time').value);
    const type = document.getElementById('log-type').value;
    const link = document.getElementById('log-link').value;
    const dateInput = document.getElementById('log-date').value;
    const imgUrlInput = document.getElementById('uploaded-img-url');

    const isCore = _ersIsCoreType(type);
    const xtDist = (!isCore && distInputRaw && distInputRaw > 0) ? distInputRaw : 0;
    const dist = isCore ? (distInputRaw || 0) : 0; // ✅ XT لا يؤثر على التحديات/الإحصائيات

    if (!time) return showToast("البيانات ناقصة!", "error");
    if (time <= 0) return showToast("الأرقام يجب أن تكون صحيحة", "error");

    if (isCore) {
      if (!dist) return showToast("البيانات ناقصة!", "error");
      if (dist <= 0) return showToast("الأرقام يجب أن تكون صحيحة", "error");
    }
// تعطيل الزر لمنع التكرار
    if(btn) { 
        btn.innerText = "جاري الحفظ..."; 
        btn.disabled = true; 
        btn.style.opacity = "0.7";
    }

    try {
        const uid = currentUser.uid;
        const selectedDate = new Date(dateInput);
        
        // 1. منطق التعديل (Edit Mode)
        if (editingRunId) {
            const oldIsCore = _ersIsCoreType(editingOldType);
            const oldDistForStats = oldIsCore ? (editingOldDist || 0) : 0;
            const newDistForStats = isCore ? dist : 0;
            const distDiff = newDistForStats - oldDistForStats;
            const runDiff = (isCore ? 1 : 0) - (oldIsCore ? 1 : 0); 
            
            await db.collection('users').doc(uid).collection('runs').doc(editingRunId).update({ 
                dist: (isCore ? dist : 0), time, type, link, xtDist: (isCore ? 0 : xtDist),
                img: imgUrlInput.value 
            }); 

            await db.collection('users').doc(uid).set({
                totalDist: firebase.firestore.FieldValue.increment(distDiff),
                totalRuns: firebase.firestore.FieldValue.increment(runDiff),
                monthDist: firebase.firestore.FieldValue.increment(distDiff)
            }, { merge: true });

            // إعادة فحص التحديات بأثر رجعي عند إضافة صورة
            if (imgUrlInput.value) { 
                 const activeCh = await db.collection('challenges').where('active', '==', true).get();
                 const batch = db.batch();
                 let updatedCount = 0;

                 activeCh.forEach(doc => {
                    const ch = doc.data();
                    const rules = ch.rules || {};
                    if (rules.requireImg && dist >= (rules.minDistPerRun || 0)) {
                        const participantRef = doc.ref.collection('participants').doc(uid);
                        batch.set(participantRef, {
                            photoUrl: userData.photoUrl || null,
                            lastUpdate: firebase.firestore.Timestamp.now(),
                            progress: firebase.firestore.FieldValue.increment(dist) 
                        }, { merge: true });
                        updatedCount++;
                    }
                 });
                 if(updatedCount > 0) await batch.commit();
            }
            showToast("تم التعديل بنجاح ✅", "success");
            editingRunId = null;

        } else {
            // 2. منطق الإضافة الجديدة (New Run)
            const timestamp = firebase.firestore.Timestamp.fromDate(selectedDate);
            const streakInfo = isCore ? updateStreakLogic(selectedDate) : { streak: (userData.currentStreak || 0), lastDate: (userData.lastRunDate || null) };
            const currentMonthKey = selectedDate.toISOString().slice(0, 7); 
            let newMonthDist = (userData.monthDist || 0) + dist;
            
            // تصفير الشهر إذا دخلنا شهر جديد
            if(userData.lastMonthKey !== currentMonthKey) { newMonthDist = dist; }

            const pace = _ersPace(dist, time) || 0;
            const autoKind = _ersAutoKind(type, pace);
            const slowAsWalk = (autoKind === 'Walk' && (type === 'Run' || type === 'Race'));
            // Run/Walk split for fairness (doesn't break old data)
            let newMonthRunDist = (userData.monthRunDist || 0) + (autoKind==='Run' ? dist : 0);
            let newMonthWalkDist = (userData.monthWalkDist || 0) + (autoKind==='Walk' ? dist : 0);
            if(userData.lastMonthKey !== currentMonthKey) {
                newMonthRunDist = (autoKind==='Run' ? dist : 0);
                newMonthWalkDist = (autoKind==='Walk' ? dist : 0);
            }
            const commentsDisabled = !!getUserPref('disableComments', false);

            const runData = { dist: (isCore ? dist : 0), xtDist: (isCore ? 0 : xtDist), time, type, pace, autoKind, slowAsWalk, timestamp, img: imgUrlInput.value, commentsDisabled };
            
            // الحفظ في المجموعات
            await db.collection('users').doc(uid).collection('runs').add(runData);
            await db.collection('activity_feed').add({
                uid: uid, userName: userData.name, userRegion: userData.region, ...runData, likes: []
            });

            // تحديث إجماليات المستخدم
            await db.collection('users').doc(uid).set({
                totalDist: firebase.firestore.FieldValue.increment(dist),
                totalRuns: firebase.firestore.FieldValue.increment(isCore ? 1 : 0),
                totalRunDist: firebase.firestore.FieldValue.increment(autoKind==='Run' ? dist : 0),
                totalWalkDist: firebase.firestore.FieldValue.increment(autoKind==='Walk' ? dist : 0),
                monthDist: newMonthDist,
                monthRunDist: newMonthRunDist,
                monthWalkDist: newMonthWalkDist,
                lastMonthKey: currentMonthKey,
                currentStreak: streakInfo.streak,
                lastRunDate: streakInfo.lastDate
            }, { merge: true });

            // تحديث التحديات
            const activeCh = await db.collection('challenges').where('active', '==', true).get();
            const batch = db.batch();
            const currentPace = pace; 

            activeCh.forEach(doc => {
                const ch = doc.data();
                const rules = ch.rules || {};
                // Run/Walk fairness gate
                if(!_ersEligibleForChallenge(ch, autoKind)) return;

                // شروط الرفض
                if (rules.requireImg && !imgUrlInput.value) return; 
                if (rules.minDistPerRun && dist < rules.minDistPerRun) return;

                const participantRef = doc.ref.collection('participants').doc(uid);
                let incrementValue = (ch.type === 'frequency') ? 1 : dist;
                let isSpeedSuccess = (ch.type === 'speed' && autoKind==='Run' && currentPace <= ch.target && dist >= 1);

                if (ch.type === 'speed') {
                    if (isSpeedSuccess) {
                        batch.set(participantRef, { progress: ch.target, lastUpdate: timestamp, name: userData.name, completed: true, photoUrl: userData.photoUrl||null }, { merge: true });
                    }
                } else {
                    batch.set(participantRef, { progress: firebase.firestore.FieldValue.increment(incrementValue), lastUpdate: timestamp, name: userData.name, photoUrl: userData.photoUrl||null }, { merge: true });
                }
            });
            await batch.commit();

            // تحديث البيانات المحلية
            userData.totalDist = (userData.totalDist||0) + dist;
            userData.totalRuns = (userData.totalRuns||0) + 1;
            userData.totalRunDist = (userData.totalRunDist||0) + (autoKind==='Run' ? dist : 0);
            userData.totalWalkDist = (userData.totalWalkDist||0) + (autoKind==='Walk' ? dist : 0);
            userData.monthDist = newMonthDist;
            userData.monthRunDist = newMonthRunDist;
            userData.monthWalkDist = newMonthWalkDist;
            
            checkNewBadges(dist, time, selectedDate);
            setTimeout(() => { showRunAnalysis(dist, time, autoKind, pace); }, 300);
        }     

        // إغلاق وتنظيف
        closeModal('modal-log');
        allUsersCache = []; 
        updateUI(); 
        loadActivityLog();
        loadGlobalFeed();
        loadActiveChallenges(); 

    } catch (error) { 
        console.error(error);
        showToast("خطأ: " + error.message, "error"); 
    } 
    finally { 
        if(btn) { 
            btn.innerText = "حفظ النشاط"; 
            btn.disabled = false; 
            btn.style.opacity = "1";
        } 
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
    status.style.color = "#f59e0b"; 
    saveBtn.disabled = true; // تعطيل الزر مؤقتاً
    saveBtn.innerText = "جاري الرفع...";
    saveBtn.style.opacity = "0.5";

    // 3. تجهيز البيانات
    const formData = new FormData();
    formData.append("image", file);
    const API_KEY = "0d0b1fefa53eb2fc054b27c6395af35c"; 

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            // نجح الرفع
            const imageUrl = data.data.url;
            hiddenInput.value = imageUrl; 
            
            preview.src = imageUrl;
            preview.style.display = 'block';
            
            status.innerText = "تم إرفاق الصورة بنجاح ✅";
            status.style.color = "#10b981"; 
        } else {
            throw new Error("فشل من المصدر");
        }

    } catch (error) {
        console.error("Upload Error:", error);
        status.innerText = "فشل الرفع! حاول مرة أخرى ❌";
        status.style.color = "#ef4444";
        // تنظيف الحقل المخفي في حالة الفشل
        hiddenInput.value = ""; 
    } finally {
        // 🔥 أهم خطوة: إعادة تفعيل الزر في كل الأحوال (نجح أو فشل)
        saveBtn.disabled = false;
        saveBtn.innerText = "حفظ النشاط";
        saveBtn.style.opacity = "1";
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
// اعتماد الخطة (الحفظ في الداتابيز + تحديث فوري)
// اعتماد الخطة (الحفظ في الداتابيز + تحديث فوري)
async function confirmPlan() {
    const days = document.getElementById('plan-days').value;
    const target = document.getElementById('plan-target').value;
    const level = document.getElementById('plan-level').value;
    
    const btn = event.target;
    btn.innerText = "جاري إنشاء الجدول...";
    
    // 🔥 التعديل هنا: تحديد تاريخ البدء ليكون بداية اليوم الحالي
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // تصفير الوقت ليحسب أي جرية تمت اليوم

    // تجهيز كائن الخطة
    const newPlanData = {
        target: target,
        daysPerWeek: days,
        level: level,
        startDate: startDate.toISOString(), // استخدام التاريخ المصحح
        status: 'active'
    };

    try {
        // 1. الحفظ في السيرفر
        await db.collection('users').doc(currentUser.uid).update({
            activePlan: newPlanData
        });
        
        // 2. تحديث البيانات المحلية فوراً
        userData.activePlan = newPlanData;

        // 3. تحديث واجهة الكوتش
        updateCoachAdvice();

        showToast("تم تفعيل الخطة بنجاح! 🚀", "success");
        closeModal('modal-plan-wizard');
        
        setTimeout(() => openMyPlan(), 500); 

    } catch(e) {
        console.error(e);
        showToast("خطأ في الحفظ", "error");
    } finally {
        btn.innerText = "اعتماد الخطة والبدء 🚀";
    }
}
// ==================== V12.0 Run Analysis Engine (Coach Feedback) ====================

function showRunAnalysis(dist, time, kind = 'Run', paceOverride = null) {
    const pace = paceOverride ?? (dist > 0 ? (time / dist) : 0);
    const firstName = ((userData && userData.name) ? userData.name : "يا بطل").split(' ')[0];

    const goalFocus = getUserPref('goalFocus', 'general'); // speed | endurance | weight | general

    let title = "تم يا بطل ✅";
    let msg = "";
    let score = "جيد";

    const paceTxt = pace > 0 ? _ersFormatPace(pace) : "-";

    // تصنيف سريع
    const walkLike = (kind === 'Run' && pace >= ERS_PACE_WALK_MIN); // جري بسرعة مشي تقريباً

    if (kind === 'Walk') {
        title = "نشاط محسوب 🚶";
        msg = `عاش يا ${firstName}… المشي ده مفيد للوزن وللاستشفاء.`;
        score = "Steady";
    } else if (dist >= 12) {
        title = "وحش المسافات 🦁";
        msg = `الله عليك يا ${firstName}! ${dist.toFixed(1)} كم… نفس طويل محترم.`;
        score = "Legend";
    } else if (pace > 0 && pace <= 5.0 && dist >= 3) {
        title = "سرعة عالية 🚀";
        msg = `بيس ${paceTxt} ممتاز… بس ركّز إن السرعة تكون "متحكم فيها" مش تهور.`;
        score = "Speedster";
    } else if (dist < 3) {
        title = "خطوة ممتازة 🌱";
        msg = `حتى المسافات القصيرة بتفرق… المهم الاستمرارية.`;
        score = "Active";
    } else {
        title = "تمرين نظيف 💪";
        msg = `شغل محترم يا ${firstName}.`;
        score = "Strong";
    }

    // ملاحظة مهمة لو "جري" لكن بيسه بيس مشي
    if (walkLike) {
        msg += `<br><br><span style="color:#f59e0b; font-size:12px;">تنبيه لطيف: التمرين اتسجل "جري" لكن بيسه قريب من المشي (${paceTxt}). لو كان مشي فعلاً… سجّله Walk عشان العدالة في التحديات. ✅</span>`;
    }

    // توجيه حسب هدف المستخدم
    if (goalFocus === 'speed') {
        msg += `<br><br><span style="color:var(--primary); font-size:12px;">🎯 هدفك: تحسين السرعة — شوف "رادار السرعات" من زر ⚡ عشان نديك توصية دقيقة.</span>`;
    } else if (goalFocus === 'weight' || goalFocus === 'general') {
        msg += `<br><br><span style="color:#9ca3af; font-size:12px;">ملاحظة: لو هدفك وزن/لياقة… المسافة والاستمرارية أهم من السرعة.</span>`;
    }

    // مقارنة بالخطة الشخصية (إن وجدت)
    if (userData && userData.activePlan && userData.activePlan.status === 'active') {
        msg += `<br><br><span style="color:var(--primary); font-size:12px;">✅ اتسجل ضمن خطة الـ ${userData.activePlan.target}.</span>`;
    }

    document.getElementById('feedback-title').innerText = title;
    document.getElementById('feedback-msg').innerHTML = msg;

    document.getElementById('fb-pace').innerText = pace > 0 ? paceTxt : '-';
    document.getElementById('fb-score').innerText = score;

    // تقدير مبسط للسعرات
    document.getElementById('fb-cal').innerText = (dist * 60).toFixed(0);

    document.getElementById('modal-run-feedback').style.display = 'flex';
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
            version: 'V3.3'
        });
        showToast("وصلنا، شكراً لك! 🫡", "success");
        closeModal('modal-bug-report');
    } catch(e) {
        showToast("فشل الإرسال", "error");
    } finally {
        btn.innerText = "إرسال";
    }
}

// فتح مودال تفاصيل الخطة وعرض الجدول
function openMyPlan() {
    const modal = document.getElementById('modal-my-plan');
    if (!userData.activePlan) return showToast("لا توجد خطة نشطة!", "error");
    
    // إظهار المودال
    if(modal) modal.style.display = 'flex';
    
    renderWeeklySchedule();
}

// توليد الجدول الأسبوعي ديناميكياً
// توليد الجدول الأسبوعي ديناميكياً (نسخة ذكية تتصل بالسجل)
async function renderWeeklySchedule() {
    const container = document.getElementById('plan-schedule-list');
    const plan = userData.activePlan;
    
    // عرض رسالة تحميل مؤقتة
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#6b7280;">جاري مراجعة التمارين... ⏳</div>';

    // 1. حساب تواريخ الأسبوع الحالي
    const planStartDate = new Date(plan.startDate);
    const now = new Date();
    
    // تصحيح التوقيت لضمان دقة الأيام
    planStartDate.setHours(0,0,0,0);
    now.setHours(0,0,0,0);

    const diffTime = now - planStartDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    
    // تحديد رقم الأسبوع الحالي
    const currentWeek = Math.floor(diffDays / 7) + 1;
    
    // تحديد تاريخ بداية هذا الأسبوع (يوم 1 في الأسبوع الحالي)
    const startOfCurrentWeek = new Date(planStartDate);
    startOfCurrentWeek.setDate(planStartDate.getDate() + ((currentWeek - 1) * 7));

    // 2. جلب جريات المستخدم التي تمت في هذا الأسبوع فقط
    const endOfCurrentWeek = new Date(startOfCurrentWeek);
    endOfCurrentWeek.setDate(endOfCurrentWeek.getDate() + 8); // +8 لضمان شمول آخر يوم

    let weeklyRuns = [];
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('runs')
            .where('timestamp', '>=', startOfCurrentWeek)
            .where('timestamp', '<', endOfCurrentWeek)
            .get();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // نحول التاريخ لنص بسيط للمقارنة (YYYY-MM-DD)
            const dateKey = data.timestamp.toDate().toISOString().split('T')[0];
            weeklyRuns.push({ date: dateKey, dist: data.dist });
        });
    } catch(e) {
        console.error("Error fetching weekly runs", e);
    }

    // تحديث العناوين
    document.getElementById('plan-modal-title').innerText = `خطة الـ ${plan.target} 🎯`;
    document.getElementById('plan-modal-week').innerText = `الأسبوع ${currentWeek}`;

    // 3. بناء الجدول
    let html = '';
    const daysCount = parseInt(plan.daysPerWeek) || 3;
    
    // نمط توزيع أيام الراحة
    let runDays = [];
    if(daysCount === 3) runDays = [1, 3, 5]; 
    else if(daysCount === 4) runDays = [1, 2, 4, 6];
    else if(daysCount === 5) runDays = [1, 2, 3, 5, 6];
    else runDays = [1, 2, 3, 4, 5, 6]; 

    for (let i = 1; i <= 7; i++) {
        // حساب تاريخ هذا اليوم (i)
        const thisDayDate = new Date(startOfCurrentWeek);
        thisDayDate.setDate(thisDayDate.getDate() + (i - 1));
        const thisDayDateStr = thisDayDate.toISOString().split('T')[0];
        const isToday = (thisDayDateStr === now.toISOString().split('T')[0]);

        const isRunDay = runDays.includes(i);
        
        // فحص هل تم إنجاز التمرين؟
        // نبحث هل يوجد جرية في هذا التاريخ ومسافتها أكبر من 1 كم (لتجنب الجريات الخاطئة)
        const isCompleted = weeklyRuns.some(r => r.date === thisDayDateStr && r.dist >= 1);

        // تحديد المحتوى
        let title = "راحة واستشفاء 🧘‍♂️";
        let desc = "رحرح جسمك النهاردة.";
        let icon = "ri-cup-line";
        let statusClass = "rest";
        
        if (isRunDay) {
            let baseDist = parseInt(plan.target) / daysCount; 
            if (i === runDays[0]) { 
                title = `جري مسافة ${baseDist.toFixed(1)} كم`;
                desc = "جري مريح لبناء الأساس الهوائي.";
                icon = "ri-run-line";
                statusClass = "run";
            } else if (i === runDays[runDays.length-1]) { 
                title = `جري طويل ${(baseDist * 1.2).toFixed(1)} كم`;
                desc = "تحدي نهاية الأسبوع.";
                icon = "ri-speed-line";
                statusClass = "long-run";
            } else { 
                title = `جري سرعات ${(baseDist * 0.8).toFixed(1)} كم`;
                desc = "جري سريع لرفع كفاءة القلب.";
                icon = "ri-flashlight-fill";
                statusClass = "interval";
            }
        }

// ... داخل Loop الأيام في دالة renderWeeklySchedule ...

        // إضافة كلاس الإنجاز وتغيير المحتوى ليكون احتفالياً
        if (isCompleted && isRunDay) {
            statusClass += " done"; 
            
            // تغيير الأيقونة لعلامة صح مزدوجة أو كأس
            icon = "ri-checkbox-circle-fill"; 
            
            // نصوص تشجيعية متنوعة
            const praiseMessages = [
                "عاش يا وحش! 💪",
                "أداء عالمي 🚀",
                "استمرارية رائعة 🔥",
                "تمت المهمة بنجاح ✅"
            ];
            // اختيار رسالة عشوائية (اختياري) أو ثابتة
            title = praiseMessages[Math.floor(Math.random() * praiseMessages.length)];
            
            desc = `سجلت تمرين اليوم بنجاح. ارتاح واستعد للي جاي!`;
        }

        // تصميم الكارت (كما هو)
        
        html += `
        <div class="plan-day-card ${isToday ? 'today' : ''} ${statusClass}">
            <div class="day-indicator">
                <span class="d-name">يوم ${i} (${thisDayDate.toLocaleDateString('ar-EG', {weekday:'long'})})</span>
                ${isToday ? '<span class="today-badge">اليوم</span>' : ''}
            </div>
            <div class="day-content">
                <div class="d-icon"><i class="${icon}"></i></div>
                <div class="d-info">
                    <h4>${title}</h4>
                    <p>${desc}</p>
                </div>
            </div>
        </div>
        `;
    }

    container.innerHTML = html;
}


async function loadGovernorateLeague() {
    const container = document.getElementById('admin-content-area'); // أو المكان المخصص للدوري
    
    // 1. تجميع البيانات
    let govStats = {};
    
    // نستخدم الكاش الموجود لتسريع العملية
    if (allUsersCache.length === 0) {
        const snap = await db.collection('users').get();
        snap.forEach(d => allUsersCache.push(d.data()));
    }

    allUsersCache.forEach(user => {
        let gov = user.region || "غير محدد";
        if (!govStats[gov]) govStats[gov] = { name: gov, dist: 0, players: 0 };
        
        govStats[gov].dist += (user.monthDist || 0); // ننافس على مسافة الشهر
        govStats[gov].players += 1;
    });

    // 2. تحويلها لمصفوفة وترتيبها
    let leagueData = Object.values(govStats).sort((a, b) => b.dist - a.dist);
    
    // حساب "المتوسط" لإنصاف المحافظات الصغيرة (اختياري)
    // leagueData.sort((a, b) => (b.dist/b.players) - (a.dist/a.players));

    // 3. بناء الواجهة (التصميم الجديد)
    let html = `
    <div style="padding: 20px;">
        <div class="section-header">
            <h3>🏆 دوري المحافظات</h3>
            <p style="font-size:12px; color:#9ca3af;">المنافسة مشتعلة! شد حيلك وارفع علم محافظتك.</p>
        </div>
        <div class="gov-league-list">
    `;

    // الحصول على أعلى رقم (للمقياس)
    const maxDist = leagueData.length > 0 ? leagueData[0].dist : 1;

    leagueData.forEach((gov, index) => {
        if (gov.dist === 0) return; // إخفاء المحافظات الصفرية

        const rank = index + 1;
        const percent = Math.min((gov.dist / maxDist) * 100, 100);
        
        // ألوان المراكز الأولى
        let color = 'var(--primary)';
        let badge = `<span class="gov-rank">#${rank}</span>`;
        let glow = '';

        if (rank === 1) { 
            color = '#f59e0b'; // ذهبي
            badge = '👑'; 
            glow = 'box-shadow: 0 0 15px rgba(245, 158, 11, 0.2); border:1px solid rgba(245, 158, 11, 0.5);';
        } else if (rank === 2) {
            color = '#9ca3af'; // فضي
            badge = '🥈';
        } else if (rank === 3) {
            color = '#cd7f32'; // برونزي
            badge = '🥉';
        }

        html += `
        <div class="gov-card" style="margin-bottom: 12px; background:var(--bg-card); padding:15px; border-radius:12px; position:relative; overflow:hidden; ${glow}">
            
            <div style="position:absolute; top:0; left:0; height:100%; width:${percent}%; background:${color}; opacity:0.1; z-index:0;"></div>
            
            <div style="position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="font-size:20px; font-weight:bold; width:30px; text-align:center;">${badge}</div>
                    <div>
                        <div style="font-size:16px; font-weight:bold; color:#fff;">${gov.name}</div>
                        <div style="font-size:11px; color:#9ca3af;">${gov.players} لاعب نشط</div>
                    </div>
                </div>
                
                <div style="text-align:left;">
                    <div style="font-size:18px; font-weight:900; color:${color};">${gov.dist.toFixed(1)}</div>
                    <div style="font-size:10px; color:#9ca3af;">كم هذا الشهر</div>
                </div>
            </div>
        </div>`;
    });

    html += `</div></div>`;
    
    // إذا كنت تعرض هذا في صفحة الأدمن أو صفحة مخصصة
    container.innerHTML = html;
}


// ==================== Coach Zone UI Helpers (V3.3) ====================


function renderPlanCard(){
    // Backward-compat: old home card removed in v3.6
    if(typeof renderPlanHero === 'function') renderPlanHero();
}



// ==================== Run Catalog (V3.3) ====================


function openRunCatalog(type) {
    const titleEl = document.getElementById('catalog-title');
    const bodyEl = document.getElementById('catalog-body');
    const modal = document.getElementById('modal-catalog');
    if (!titleEl || !bodyEl || !modal) return;

    const items = {
        recovery: {
            title: 'الجري الاستشفائي (Recovery) 🫶',
            body: `هدفه: تنشيط الدم بدون إجهاد.

شكل التمرين: 20–40 دقيقة جري خفيف جدًا (RPE 2–3) + 5 دقايق إطالة.

متى؟ بعد يوم سرعات/لونج رن أو بعد ضغط شغل.`
        },
        hills: {
            title: 'الهيلز (Hills) ⛰️',
            body: `هدفه: قوة + اقتصاد في الجري.

مثال (كوبري/تريدميل): 10 دقايق إحماء → 8×(30–45 ثانية صعود قوي + نزول هادي) → 8 دقايق تهدئة.

مهم: حافظ على شكل الجسم، وماتكسرش نزول بعنف.`
        },
        intervals: {
            title: 'الإنترفال/السرعات (Intervals) ⚡',
            body: `هدفه: سرعة و VO2max.

مثال: 12 دقيقة إحماء → 6×(400م سريع + 200م سهل) أو 5×(2 دقيقة سريع + 2 دقيقة سهل) → تهدئة.

متى؟ يوم واحد/أسبوع كبداية.`
        },
        longrun: {
            title: 'اللونج رن (Long Run) 🦁',
            body: `هدفه: أساس التحمل + التحضير للسباقات.

مثال: 60–120 دقيقة جري سهل (RPE 3–4).

مفتاحه: "سهل وبس"… السرعة هنا مش الهدف.`
        },
        easy: {
            title: 'الجري السهل (Easy) 🌿',
            body: `هدفه: بناء حجم أسبوعي بدون إرهاق.

مثال: 30–50 دقيقة على نفس مريح (تقدر تتكلم).

ممتاز كتمرين بين الشغل التقيل.`
        },
        fartlek: {
            title: 'الفارتلك (Fartlek) 🎲',
            body: `هدفه: لعب سرعات بدون ضغط حسابات.

مثال: 10 دقايق إحماء → 10×(1 دقيقة أسرع + 1 دقيقة سهل) أو "سرّع بين أعمدة النور" → 8 دقايق تهدئة.

ممتاز للأيام اللي مش عايز فيها انترفال رسمي.`
        },
        tempo: {
            title: 'التمبو (Tempo) 🔥',
            body: `هدفه: رفع العتبة اللاهوائية.

مثال: 10 دقائق إحماء → 15–25 دقيقة تمبو → 8 دقائق تهدئة.

إحساسه: "مجهود ثابت" تقدر تتكلم كلمات قصيرة.`
        },
        strides: {
            title: 'السترایدز (Strides) 🧠',
            body: `هدفه: تنشيط السرعة مع إجهاد قليل.

مثال: بعد جري سهل → 6–10×(20 ثانية أسرع + 60 ثانية سهل).

ممتاز قبل السباق أو لتحسين الشكل.`
        },
        mobility: {
            title: 'موبيلتي/يوجا (Mobility) 🧘',
            body: `هدفه: مرونة + وقاية من الإصابات.

مثال: 10–20 دقيقة (Hip / Ankle / Hamstrings) + تنفّس.

مناسب لأيام الراحة أو بعد اللونج.`
        },
        crosstrain: {
            title: 'كروس تريننج (Cross-Training) 🚴',
            body: `هدفه: لياقة بدون ضغط على الركبة.

خيارات: عجلة / سباحة / إليبتيكال 25–45 دقيقة.

لو بتتعافى من إصابة… ده ذهب.`
        }
    };

    const keys = Object.keys(items);

    // وضع المكتبة كاملة (Cards)
    if (type === 'all' || !items[type]) {
        titleEl.innerText = 'مكتبة التمارين الأساسية 📚';
        bodyEl.innerHTML = `
            <div class="catalog-grid">
                ${keys.map(k=>`
                    <button class="catalog-card" onclick="openRunCatalog('${k}')">
                        <div class="catalog-card-title">${items[k].title}</div>
                        <div class="catalog-card-sub">افتح التفاصيل 👈</div>
                    </button>
                `).join('')}
            </div>
            <div class="mini-note" style="margin-top:10px;">دي مكتبة مرجعية… تمرين الفريق اليوم بيظهر فوق كـ (جرية اليوم).</div>
        `;
        modal.style.display = 'flex';
        return;
    }

    // وضع تمرين واحد بتفاصيله
    const item = items[type];
    titleEl.innerText = item.title;
    bodyEl.innerHTML = `
        <div class="catalog-body-text">${(item.body||'').replace(/\n/g,'<br>')}</div>
        <div style="margin-top:14px; display:flex; gap:10px;">
            <button class="btn-secondary" onclick="openRunCatalog('all')">⬅️ رجوع للمكتبة</button>
            <button class="btn-primary" onclick="closeModal('modal-catalog')">تم</button>
        </div>
    `;
    modal.style.display = 'flex';
}


// ==================== Hall of Fame (V3.3) ====================

async function loadHallOfFame() {
    const listEl = document.getElementById('hall-of-fame-list');
    if (!listEl) return;

    listEl.innerHTML = '<div style="text-align:center; padding:10px; color:#6b7280;">جاري التحميل...</div>';

    try {
        const runners = await fetchTopRunners();
        const top5 = (runners || []).slice(0, 5);
        if (!top5.length) {
            listEl.innerHTML = '<div style="text-align:center; padding:10px; color:#6b7280;">لا توجد بيانات كافية</div>';
            return;
        }

        const rows = top5.map((u, idx) => {
            const rank = idx + 1;
            const avatar = (u.avatarIcon || getUserAvatar(u) || '🏃');
            const name = u.name || 'عضو';
            const region = u.region || '';
            const dist = (u.totalDist || 0).toFixed(1);
            return `
                <div class="hof-row" onclick="viewUserProfile('${u.uid || ''}')">
                    <div class="hof-rank">${rank}</div>
                    <div class="hof-avatar">${avatar}</div>
                    <div class="hof-main">
                        <div class="hof-name">${name}</div>
                        <div class="hof-meta">${region}</div>
                    </div>
                    <div class="hof-dist">${dist} كم</div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = rows;
    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<div style="text-align:center; padding:10px; color:#6b7280;">تعذر تحميل لوحة الشرف</div>';
    }
}

document.addEventListener('DOMContentLoaded', ()=>{ setupCoachHomeTabs(); setupLogTypeUI(); });


// === دالة تحديث بيانات الكوتش (الهيرو) ===
function renderCoachHeroStats() {
    // 1. التأكد من وجود العناصر
    const weekEl = document.getElementById('hero-week-dist');
    const monthEl = document.getElementById('hero-month-dist');
    const streakEl = document.getElementById('hero-streak');
    const greetEl = document.getElementById('coach-greeting');
    
    if (!weekEl || !currentUser) return;

    // 2. حساب مسافة آخر 7 أيام
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);
    
    // استخدام الكاش الموجود للجريات
    const runs = window._ersRunsCache || [];
    const weekDist = runs
        .filter(r => {
            const d = r.timestamp ? r.timestamp.toDate() : new Date(r.date);
            return d >= oneWeekAgo;
        })
        .reduce((sum, r) => sum + (parseFloat(r.dist) || 0), 0);

    // 3. تحديث الأرقام في الشاشة
    weekEl.innerText = weekDist.toFixed(1);
    monthEl.innerText = (userData.monthDist || 0).toFixed(1);
    streakEl.innerText = userData.currentStreak || 0;

    // 4. تحديث التحية
    if (greetEl) {
        const h = new Date().getHours();
        const name = (userData.name || "يا كابتن").split(' ')[0];
        let timeGreet = "صباح الخير";
        if (h >= 12 && h < 17) timeGreet = "مساء الخير";
        if (h >= 17) timeGreet = "مساء النور";
        
        greetEl.innerText = `${timeGreet} يا ${name} 👋`;
    }
}

