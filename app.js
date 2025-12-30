/* ERS Runners - V1.9 (Podium & Auth Fixed) */

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
let allUsersCache = []; // كاش للمستخدمين لتقليل التحميل
let deferredPrompt; // (V1.4) لتخزين حدث التثبيت
// --- دالة مركزية لجلب البيانات بأمان (V1.3) -----------------------------
async function fetchTopRunners() {
    // إذا كانت البيانات موجودة في الكاش، لا نحملها مرة أخرى
    if (allUsersCache.length > 0) return allUsersCache;
    
    // جلب أعلى 50 عداء فقط لتوفير القراءات
    const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(50).get();
    allUsersCache = [];
    snap.forEach(doc => allUsersCache.push(doc.data()));
    return allUsersCache;
}

// --- دوال مساعدة للتواريخ (V1.3) ---

// 1. تجهيز التاريخ الحالي لحقل الإدخال (Local ISO Format)
function getLocalInputDate() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0,16);
}

// 2. حساب الزمن المنقضي (منذ كذا...)
function getArabicTimeAgo(timestamp) {
    if (!timestamp) return "الآن";
    const diff = (new Date() - timestamp.toDate()) / 60000; // الفرق بالدقائق
    if (diff < 1) return "الآن";
    if (diff < 60) return `${Math.floor(diff)} د`;
    if (diff < 1440) return `${Math.floor(diff/60)} س`;
    return `${Math.floor(diff/1440)} يوم`;
}
// 3. تنسيق الأرقام (رقم عشري واحد فقط) - (V1.3)
function formatNumber(num) {
    // تحويل النص لرقم، وفي حالة الخطأ نعتبره صفر
    const n = parseFloat(num) || 0;
    // إرجاع رقم عشري واحد ثابت
    return n.toFixed(1);
}

// 4. تحديد الأفاتار بناء على النوع والمستوى (V1.5)
function getUserAvatar(user) {
    // لو المستخدم لسه جديد (مبتدئ)
    const isNew = (user.totalDist || 0) < 50;
    
    if (user.gender === 'female') {
        return isNew ? '🐣' : '🏃‍♀️'; // بنت
    } else {
        return isNew ? '🐣' : '🏃'; // ولد (الافتراضي)
    }
}
// ==================== 1. Authentication (Global Functions) ====================
// هذه الدوال يجب أن تكون ظاهرة لـ HTML مباشرة

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
    // الزرين المحتملين (الدخول أو التسجيل)
    const activeBtn = document.querySelector('.auth-box .btn-primary');
    
    if (!emailEl || !passEl) return;
    const email = emailEl.value;
    const pass = passEl.value;
    if (msgEl) msgEl.innerText = "";

    // 1. تفعيل وضع التحميل
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
            // ... (باقي كود الحفظ كما هو) ...
            await db.collection('users').doc(cred.user.uid).set({
                name: name, region: region, email: email,
                totalDist: 0, totalRuns: 0, badges: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await auth.signInWithEmailAndPassword(email, pass);
        }
        // لا نحتاج لإعادة الزر هنا لأن الصفحة ستتغير أو يتم عمل Reload
    } catch (err) {
        if (msgEl) {
            // ترجمة بعض أخطاء فايربيس الشائعة
            if(err.code === 'auth/email-already-in-use') msgEl.innerText = "هذا البريد مسجل بالفعل، حاول الدخول.";
            else if(err.code === 'auth/wrong-password') msgEl.innerText = "كلمة المرور خاطئة.";
            else if(err.code === 'auth/user-not-found') msgEl.innerText = "مستخدم غير موجود، سجل حساب جديد.";
            else if(err.code === 'auth/network-request-failed') msgEl.innerText = "فشل الاتصال بالإنترنت ⚠️";
            else msgEl.innerText = "خطأ: " + err.message;
        }
        console.error(err);
        
        // إعادة الزر لحالته الطبيعية عند الخطأ
        activeBtn.innerHTML = originalText;
        activeBtn.disabled = false;
        activeBtn.style.opacity = "1";
    }
}

function logout() {
    if(confirm("تسجيل خروج؟")) { auth.signOut(); window.location.reload(); }
}

// مراقب الدخول
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                userData = doc.data();
                if (!userData.badges) userData.badges = [];
                initApp();
            } else {
                // حالة نادرة: إنشاء داتا افتراضية
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

// ==================== 2. App Initialization ====================
function initApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    
    
    // تعيين التاريخ الافتراضي (V1.3 Updated)
    const dateInput = document.getElementById('log-date');
    if(dateInput) dateInput.value = getLocalInputDate();

    updateUI();
    loadActivityLog();
    loadActiveChallenges(); 
    loadGlobalFeed();
  
listenForNotifications();
    if(typeof loadWeeklyChart === 'function') loadWeeklyChart();
    
    // تشغيل مراقب الشبكة
    initNetworkMonitor();
}
// ==================== 3. Leaderboard 2.0 (The Podium Logic) 🏆 ====================
async function loadLeaderboard(filterType = 'all') {
    const list = document.getElementById('leaderboard-list');
    // ... (باقي تعريف المتغيرات podiumContainer إلخ كما هي) ...
    const podiumContainer = document.getElementById('podium-container');
    const teamTotalEl = document.getElementById('teamTotalDisplay');
    const teamBar = document.getElementById('teamGoalBar');

    if (!list) return;

    // V1.5: عرض الهيكل العظمي إذا لم يكن هناك كاش
    if (allUsersCache.length === 0) {
        list.innerHTML = getSkeletonHTML('leaderboard');
        if(podiumContainer) podiumContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#6b7280; font-size:12px;">جاري تجهيز المنصة... 🏆</div>';
    }

    // استخدام الدالة المركزية الآمنة
    await fetchTopRunners();

    // ... (باقي الكود كما هو تماماً من عند let displayUsers...)

    // الفلترة
    let displayUsers = allUsersCache;
    if (filterType === 'region') {
        displayUsers = allUsersCache.filter(u => u.region === userData.region);
    }

    // 1. حساب إجمالي الفريق
    let teamTotal = 0;
    displayUsers.forEach(u => teamTotal += (u.totalDist || 0));
    if(teamTotalEl) teamTotalEl.innerText = teamTotal.toFixed(0);
    if(teamBar) {
        // لنفترض الهدف 1000 كم
        let perc = Math.min((teamTotal / 1000) * 100, 100);
        teamBar.style.width = `${perc}%`;
    }

    // 2. رسم المنصة (أول 3)
    if (podiumContainer) {
        let podiumHtml = '';
        // نحتاج ترتيب معين: الثاني (يسار) - الأول (وسط) - الثالث (يمين)
        // المصفوفة مرتبة: [0]=الأول, [1]=الثاني, [2]=الثالث
        
        // المتسابق الأول
        const u1 = displayUsers[0];
        // المتسابق الثاني
        const u2 = displayUsers[1];
        // المتسابق الثالث
        const u3 = displayUsers[2];

        // بناء HTML للمنصة (الترتيب في الـ HTML مهم للـ CSS Flexbox order)
        
        // المركز الثاني
        if(u2) {
            podiumHtml += createPodiumItem(u2, 2);
        }
        // المركز الأول (يجب أن يكون في المنتصف، سنتحكم بالـ Order في CSS)
        if(u1) {
            podiumHtml += createPodiumItem(u1, 1);
        }
        // المركز الثالث
        if(u3) {
            podiumHtml += createPodiumItem(u3, 3);
        }

        podiumContainer.innerHTML = podiumHtml || '<div style="color:#9ca3af; font-size:12px;">لا يوجد أبطال بعد</div>';
    }

    // 3. رسم باقي القائمة (من الرابع للنهاية)
    list.innerHTML = '';
    const restUsers = displayUsers.slice(3); // تخطي أول 3
    
    if (restUsers.length === 0 && displayUsers.length > 3) {
        list.innerHTML = '<div style="text-align:center; padding:10px;">لا يوجد المزيد</div>';
    }

    restUsers.forEach((u, index) => {
        // index هنا يبدأ من 0، لكن الرتبة الحقيقية هي index + 4
        const realRank = index + 4;
        const isMe = (u.name === userData.name) ? 'border:1px solid #10b981; background:rgba(16,185,129,0.1);' : '';

        list.innerHTML += `
            <div class="leader-row" style="${isMe}">
                <div class="rank-col" style="font-size:14px; color:#9ca3af;">#${realRank}</div>
                <div class="avatar-col">${(u.name || "?").charAt(0)}</div>
                <div class="info-col">
                    <div class="name">${u.name}</div>
                    <div class="region">${u.region}</div>
                </div>
                <div class="dist-col">${(u.totalDist||0).toFixed(1)}</div>
            </div>
        `;
    });
}

function createPodiumItem(user, rank) {
    let crown = rank === 1 ? '<div class="crown-icon">👑</div>' : '';
    let avatarChar = (user.name || "?").charAt(0);
    return `
        <div class="podium-item rank-${rank}">
            ${crown}
            <div class="podium-avatar">${avatarChar}</div>
            <div class="podium-name">${user.name}</div>
            <div class="podium-dist">${(user.totalDist||0).toFixed(1)}</div>
        </div>
    `;
}

function filterLeaderboard(type) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
    loadLeaderboard(type);
}

// ==================== 4. UI Updates ====================
function updateUI() {
    try {
        const headerName = document.getElementById('headerName');
        if (headerName) headerName.innerText = userData.name || "Runner";

        // Dashboard Stats
        document.getElementById('monthDist').innerText = (userData.monthDist || 0).toFixed(1);
        document.getElementById('totalRuns').innerText = userData.totalRuns || 0;

        // Profile
        const rankData = calculateRank(userData.totalDist || 0);
        document.getElementById('profileName').innerText = userData.name;
        document.getElementById('profileRegion').innerText = userData.region;
        
        // الأفاتار
        // الأفاتار
        const profileAvatar = document.querySelector('.bib-avatar') || document.getElementById('profileAvatar');
        if (profileAvatar) {
            // (V1.5) استخدام الدالة الذكية
            // بدلاً من rankData.avatar سنستخدم دالتنا الجديدة
            // لكن لو وصل لمرحلة "أسطورة" أو "محترف" نخليه مميز
            let avatarIcon = getUserAvatar(userData);
            if(rankData.name === 'أسطورة') avatarIcon = '👑';
            else if(rankData.name === 'محترف') avatarIcon = '🦅';

            profileAvatar.innerText = avatarIcon; 
            
            if(profileAvatar.classList.contains('bib-avatar')) {
                profileAvatar.style.background = "#111827"; 
                profileAvatar.style.color = "#fff";
                profileAvatar.style.border = "2px solid var(--primary)";
                profileAvatar.style.fontSize = "28px";
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
        if(typeof updateCoachAdvice === 'function') updateCoachAdvice();

        // --- إضافة جديدة: إظهار زر المشرفين للأدمن فقط ---
        const adminBtn = document.getElementById('btn-admin-entry');
        if (adminBtn) {
            // إذا كان المستخدم أدمن، اجعل الزر يظهر (flex)، وإلا اتركه مخفياً
            adminBtn.style.display = (userData.isAdmin === true) ? 'flex' : 'none';
        }

    } catch (error) { console.error("UI Error:", error); }
}
// دالة مساعدة لحساب الرتبة
function calculateRank(totalDist) {
    const levels = [
        { name: "مبتدئ", min: 0, class: "rank-mubtadi", next: 50, avatar: "🥚" },
        { name: "هاوي", min: 50, class: "rank-hawy", next: 150, avatar: "🐣" },
        { name: "عداء", min: 150, class: "rank-runner", next: 500, avatar: "🏃" },
        { name: "محترف", min: 500, class: "rank-pro", next: 1000, avatar: "🦅" },
        { name: "أسطورة", min: 1000, class: "rank-legend", next: 10000, avatar: "👑" }
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
        avatar: currentLevel.avatar, 
        nextTarget: currentLevel.next, 
        remaining: currentLevel.next - totalDist, 
        percentage: percentage, 
        distInLevel: distInLevel, 
        distRequired: distRequired 
    };
}

function getNextRankName(current) {
    if(current === "مبتدئ") return "هاوي"; if(current === "هاوي") return "عداء";
    if(current === "عداء") return "محترف"; if(current === "محترف") return "أسطورة"; return "";
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

// ==================== 5. Smart Coach & Badges ====================
function updateCoachAdvice() {
    const msgEl = document.getElementById('coach-message');
    if(!msgEl) return;
    const totalDist = userData.totalDist || 0;
    const userName = (userData.name || "يا بطل").split(' ')[0];
    const timeNow = new Date().getHours();
    let msg = "";
    if (userData.totalRuns === 0) msg = `أهلاً بك يا ${userName}! رحلة الألف ميل تبدأ بخطوة.`;
    else if (totalDist < 10) msg = `بداية ممتازة! حاول الوصول لأول 10 كم هذا الأسبوع.`;
    else if (timeNow >= 5 && timeNow <= 9) msg = `صباح النشاط يا ${userName}! ☀️ الجو مثالي الآن.`;
    else if (timeNow >= 20) msg = `يوم طويل؟ 🌙 جرية خفيفة الآن ستساعدك على النوم.`;
    else {
        const tips = ["شرب الماء مهم! 💧", "حافظ على وتيرتك.", "لا تنسَ الإحماء."];
        msg = tips[Math.floor(Math.random() * tips.length)];
    }
    msgEl.innerText = msg;
}

const BADGES_CONFIG = [
    { id: 'first_step', name: 'الانطلاقة', icon: '🚀', desc: 'أول نشاط لك في التطبيق' },
    { id: 'early_bird', name: 'طائر الصباح', icon: '🌅', desc: 'نشاط بين 5 و 8 صباحاً' },
    { id: 'night_owl', name: 'ساهر الليل', icon: '🌙', desc: 'نشاط بعد 10 مساءً' },
    { id: 'weekend_warrior', name: 'بطل العطلة', icon: '🎉', desc: 'نشاط يوم الجمعة' },
    { id: 'half_marathon', name: 'نصف ماراثون', icon: '🔥', desc: 'جرية واحدة +20 كم' },
    { id: 'club_100', name: 'نادي المئة', icon: '💎', desc: 'إجمالي مسافة 100 كم' },
    { id: 'club_500', name: 'المحترف', icon: '👑', desc: 'إجمالي مسافة 500 كم' },
];

async function checkNewBadges(currentRunDist, currentRunTime, runDateObj) {
    const myBadges = userData.badges || []; 
    let newBadgesEarned = [];
    const runDate = runDateObj || new Date();
    const currentHour = runDate.getHours();
    const currentDay = runDate.getDay(); 

    if (!myBadges.includes('first_step')) newBadgesEarned.push('first_step');
    if (!myBadges.includes('early_bird') && currentHour >= 5 && currentHour <= 8) newBadgesEarned.push('early_bird');
    if (!myBadges.includes('night_owl') && (currentHour >= 22 || currentHour <= 3)) newBadgesEarned.push('night_owl');
    if (!myBadges.includes('weekend_warrior') && currentDay === 5) newBadgesEarned.push('weekend_warrior');
    if (!myBadges.includes('half_marathon') && currentRunDist >= 20) newBadgesEarned.push('half_marathon');
    if (!myBadges.includes('club_100') && userData.totalDist >= 100) newBadgesEarned.push('club_100');
    if (!myBadges.includes('club_500') && userData.totalDist >= 500) newBadgesEarned.push('club_500');

    if (newBadgesEarned.length > 0) {
        await db.collection('users').doc(currentUser.uid).update({ badges: firebase.firestore.FieldValue.arrayUnion(...newBadgesEarned) });
        if(!userData.badges) userData.badges = [];
        userData.badges.push(...newBadgesEarned);
        const badgeNames = newBadgesEarned.map(b => BADGES_CONFIG.find(x => x.id === b).name).join(" و ");
        alert(`🎉 مبروووك! إنجاز جديد:\n\n✨ ${badgeNames} ✨`);
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
        const clickAction = isUnlocked ? `alert('${badge.desc}')` : `alert('🔒 لفتح هذا الوسام: ${badge.desc}')`;
        html += `<div class="badge-item ${stateClass}" onclick="${clickAction}"><span class="badge-icon">${badge.icon}</span><span class="badge-name">${badge.name}</span></div>`;
    });
    grid.innerHTML = html;
}

// ==================== 6. Activity Log & Submission ====================
function openNewRun() {
    editingRunId = null;
    editingOldDist = 0;
    document.getElementById('log-dist').value = '';
    document.getElementById('log-time').value = '';
    document.getElementById('log-type').value = 'Run';
    document.getElementById('log-link').value = '';
    document.getElementById('save-run-btn').innerText = "حفظ النشاط";
    // (V1.3 Updated)
    const dateInput = document.getElementById('log-date');
    if(dateInput) dateInput.value = getLocalInputDate();
    openLogModal();
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
    // V1.3: منع الإرسال إذا لم يوجد إنترنت
    if (!navigator.onLine) {
        alert("⚠️ لا يوجد اتصال بالإنترنت!\nيرجى التحقق من الشبكة ثم المحاولة.");
        return;
    }
    const btn = document.getElementById('save-run-btn');
    const dist = parseFloat(document.getElementById('log-dist').value);
    const time = parseFloat(document.getElementById('log-time').value);
    const type = document.getElementById('log-type').value;
    const link = document.getElementById('log-link').value;
    const dateInput = document.getElementById('log-date').value;

    if (!dist || !time) return alert("البيانات ناقصة");
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
            alert("تم تعديل الجرية بنجاح ✅");
            editingRunId = null;
        } else {
            const selectedDate = new Date(dateInput);
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
            alert("تم الحفظ!");
        }
        
        closeModal('modal-log');
        document.getElementById('save-run-btn').innerText = "حفظ النشاط";
        
        // 🔥 مسح الكاش لتظهر نتيجتك الجديدة في المتصدرين فوراً
        allUsersCache = []; 

        updateUI(); 
        loadGlobalFeed(); 
        loadActivityLog();

    } catch (error) { alert("خطأ: " + error.message); } 
    finally { if(btn) { btn.innerText = "حفظ النشاط"; btn.disabled = false; } }
}

function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if(!list) return;
    db.collection('users').doc(currentUser.uid).collection('runs')
      .orderBy('timestamp', 'desc').limit(50).onSnapshot(snap => {
          if(snap.empty) { list.innerHTML = '<div style="text-align:center; padding:20px; color:#6b7280;">ابدأ الجري وسجل تاريخك!</div>'; return; }
          const runs = []; let maxDist = 0;
          snap.forEach(doc => {
              const r = doc.data(); r.id = doc.id;
              if(r.dist > maxDist) maxDist = r.dist;
              runs.push(r);
          });
          const groups = {};
          runs.forEach(r => {
              const date = r.timestamp ? r.timestamp.toDate() : new Date();
              const monthKey = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
              if(!groups[monthKey]) groups[monthKey] = [];
              groups[monthKey].push(r);
          });
          let html = '';
          for (const [month, monthRuns] of Object.entries(groups)) {
              html += `<div class="log-group"><div class="log-month-header">${month}</div>`;
              monthRuns.forEach(r => {
                  const dateObj = r.timestamp ? r.timestamp.toDate() : new Date();
                  const dayStr = dateObj.toLocaleDateString('ar-EG', { day: 'numeric', weekday: 'short' });
                  const badge = (r.dist === maxDist && maxDist > 5) ? `<span class="badge-record">🏆 الأطول</span>` : '';
                  const pace = r.time > 0 ? (r.time / r.dist).toFixed(1) : '-';
                  html += `
                  <div class="log-row-compact">
                      ${badge}
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
              html += `</div>`;
          }
          list.innerHTML = html;
      });
}

async function deleteRun(id, dist) {
    if(!confirm("هل أنت متأكد من حذف هذا النشاط؟\nسيتم خصم المسافة من رصيدك.")) return;
    
    try {
        const uid = currentUser.uid;
        
        // 1. جلب بيانات الجرية قبل الحذف لنعرف توقيتها (مهم عشان نلاقي البوست في الـ Feed)
        const runDoc = await db.collection('users').doc(uid).collection('runs').doc(id).get();
        if (!runDoc.exists) return; // لو الجرية مش موجودة أصلاً نخرج
        const runData = runDoc.data();

        // 2. حذف الجرية نفسها
        await db.collection('users').doc(uid).collection('runs').doc(id).delete();
        
        // 3. تحديث العدادات (خصم المسافة)
        await db.collection('users').doc(uid).update({
            totalDist: firebase.firestore.FieldValue.increment(-dist),
            totalRuns: firebase.firestore.FieldValue.increment(-1),
            monthDist: firebase.firestore.FieldValue.increment(-dist)
        });

        // 4. (جديد V1.3) حذف المنشور من الـ Feed
        // بنبحث عن المنشور اللي يملكه المستخدم وله نفس تاريخ الجرية بالضبط
        if (runData.timestamp) {
            const feedQuery = await db.collection('activity_feed')
                .where('uid', '==', uid)
                .where('timestamp', '==', runData.timestamp)
                .get();
                
            const batch = db.batch();
            feedQuery.forEach(doc => {
                batch.delete(doc.ref); 
            });
            await batch.commit(); 
        }

        // 5. تحديث الواجهة فوراً (مسح محلي)
        userData.totalDist = Math.max(0, (userData.totalDist || 0) - dist);
        userData.totalRuns = Math.max(0, (userData.totalRuns || 0) - 1);
        userData.monthDist = Math.max(0, (userData.monthDist || 0) - dist);

        allUsersCache = []; // تدمير الكاش عشان الترتيب يتظبط
        updateUI();
        loadActivityLog(); 
        loadGlobalFeed(); // إعادة تحميل الـ Feed عشان البوست يختفي
        
        alert("تم حذف النشاط وتحديث السجلات.");

    } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء الحذف: " + error.message);
    }
}

// ==================== 7. Admin, Share & Helpers ====================
function openAdminAuth() {
    // التحقق الآمن: هل المستخدم مسجل ولديه صلاحية isAdmin؟
    if (currentUser && userData && userData.isAdmin === true) {
        closeModal('modal-settings'); 
        setTimeout(() => { 
            switchView('admin'); 
            loadAdminStats(); 
            loadAdminFeed(); 
        }, 100);
    } else { 
        // رسالة رفض لطيفة بدون طلب كود
        alert("⛔ عذراً، هذه المنطقة مخصصة للمشرفين فقط."); 
    }
}


// ==================== 8- زر التحديث الاجباري Force update ====================
async function forceUpdateApp() {
    if(!confirm("سيتم تحديث التطبيق الآن لجلب آخر التحسينات.\nهل أنت جاهز؟")) return;
    
    // تغيير نص الزر ليعرف المستخدم أن شيئاً يحدث
    const btn = event.target.closest('button');
    if(btn) btn.innerText = "جاري التحديث...";

    try {
        // 1. إلغاء تسجيل الـ Service Worker (فصل التطبيق عن الكاش القديم)
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        }

        // 2. مسح كاش التخزين تماماً
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
    } catch(e) { console.log(e); }

    // 3. إعادة تحميل قوية من السيرفر
    window.location.reload(true);
}
// ==================== 7. زر حذف الحساب بالكامل delete account =========

async function deleteFullAccount() {
    // 1. التأكيد الصارم (Double Confirmation)
    if(!confirm("⚠️ تحذير نهائي!\nسيتم حذف حسابك، وسجلك الرياضي، وجميع بياناتك بلا رجعة.\n\nهل أنت متأكد تماماً؟")) return;
    
    // التحقق بالنص العربي لزيادة الأمان
    const checkWord = prompt("للتأكيد النهائي، اكتب كلمة (حذف) أدناه:");
    if (checkWord !== "حذف") return alert("تم إلغاء العملية. لم يتم حذف أي شيء.");

    const btn = document.querySelector('.delete-danger'); // زر الحذف الأحمر
    if(btn) { btn.innerText = "جاري الحذف..."; btn.disabled = true; }

    try {
        const uid = currentUser.uid;

        // 2. حذف البيانات من Firestore (على مراحل لتجنب الأخطاء)
        
        // أ) حذف الجريات (Runs)
        const runsSnapshot = await db.collection('users').doc(uid).collection('runs').get();
        // الحذف باستخدام Promise.all لتخطي عقبة الـ 500 مستند (أكثر أماناً من الـ Batch في حالتنا البسيطة)
        const deleteRunsPromises = runsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deleteRunsPromises);

        // ب) حذف المنشورات (Activity Feed)
        const feedSnapshot = await db.collection('activity_feed').where('uid', '==', uid).get();
        const deleteFeedPromises = feedSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deleteFeedPromises);

        // ج) حذف الإشعارات (Notifications) - (جديد V1.3)
        const notifSnapshot = await db.collection('users').doc(uid).collection('notifications').get();
        const deleteNotifPromises = notifSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deleteNotifPromises);

        // د) حذف وثيقة المستخدم الرئيسية (User Profile)
        await db.collection('users').doc(uid).delete();

        // 3. حذف الحساب من المصادقة (Authentication)
        await currentUser.delete();

        alert("تم حذف الحساب بنجاح. سنفتقدك! 👋");
        window.location.reload();

    } catch (error) {
        console.error("Delete Error:", error);
        
        // معالجة خطأ "يتطلب إعادة تسجيل الدخول"
        if (error.code === 'auth/requires-recent-login') {
            alert("⚠️ لأمانك: مر وقت طويل منذ آخر تسجيل دخول.\nيرجى تسجيل الخروج ثم الدخول مرة أخرى لمحاولة حذف الحساب.");
        } else {
            alert("حدث خطأ أثناء الحذف: " + error.message);
        }
        
        // إعادة الزر لحالته
        if(btn) { 
            btn.innerHTML = '<div class="setting-icon" style="color:#ef4444;"><i class="ri-delete-bin-7-line"></i></div><div class="setting-text" style="color:#ef4444;"><span>حذف الحساب والبيانات</span><small>لا يمكن التراجع</small></div>';
            btn.disabled = false; 
        }
    }
}
async function createChallengeUI() {
    const t = document.getElementById('admin-ch-title').value;
    const target = document.getElementById('admin-ch-target').value;
    await db.collection('challenges').add({title:t, target:parseFloat(target), active:true, startDate: new Date().toISOString()});
    alert("تم");
}
function loadAdminFeed() {
    const list = document.getElementById('admin-feed-list');
    db.collection('activity_feed').orderBy('timestamp','desc').limit(10).get().then(s => {
        let h = ''; s.forEach(d => h += `<div>${d.data().userName} <button onclick="adminDelete('${d.id}')">حذف</button></div>`);
        list.innerHTML = h;
    });
}
async function adminDelete(id) { await db.collection('activity_feed').doc(id).delete(); alert("حذف"); loadAdminFeed(); loadGlobalFeed(); }
function loadAdminStats() {
    const statsDiv = document.getElementById('admin-stats');
    if(!statsDiv) return;
    db.collection('users').get().then(snap => { statsDiv.innerHTML = `عدد الأعضاء: <strong style="color:#fff">${snap.size}</strong>`; });
}
async function saveProfileChanges() {
    const name = document.getElementById('edit-name').value;
    const region = document.getElementById('edit-region').value;
    const gender = document.getElementById('edit-gender').value;
    const birthYear = document.getElementById('edit-birthyear').value;

    if(name) {
        // تغيير نص الزر ليعرف المستخدم أن الحفظ جاري
        const btn = event.target;
        btn.innerText = "جاري الحفظ...";
        
        await db.collection('users').doc(currentUser.uid).update({ 
            name, 
            region,
            gender: gender || 'male', 
            birthYear: birthYear || ''
        });
        
        // تحديث البيانات محلياً
        userData.name = name; 
        userData.region = region;
        userData.gender = gender;
        userData.birthYear = birthYear;
        
        allUsersCache = []; // تدمير الكاش
        updateUI(); 
        closeModal('modal-edit-profile'); 
        alert("تم تحديث ملفك الشخصي بنجاح ✅");
        
        // إعادة الزر لطبيعته
        btn.innerText = "حفظ التغييرات";
    }
}
}


  
function openLogModal() { document.getElementById('modal-log').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showAuthScreen() { document.getElementById('auth-screen').style.display = 'flex'; document.getElementById('app-content').style.display='none';}
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
async function toggleLike(pid, uid) {
    if(!currentUser) return;
    const ref = db.collection('activity_feed').doc(pid);
    const doc = await ref.get();
    if(doc.exists) {
        const likes = doc.data().likes || [];
        if(likes.includes(currentUser.uid)) {
            await ref.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        } else {
            await ref.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
            if(uid !== currentUser.uid) sendNotification(uid, `${userData.name} شجعك ❤️`);
        }
    }
}
async function sendNotification(receiverId, message) {
    try {
        await db.collection('users').doc(receiverId).collection('notifications').add({
            msg: message, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) {}
}
let currentPostId = null; let currentPostOwner = null;
function openComments(postId, postOwnerId) {
    currentPostId = postId; currentPostOwner = postOwnerId;
    document.getElementById('modal-comments').style.display = 'flex';
    document.getElementById('comment-text').value = ''; 
    loadComments(postId);
}
function loadComments(postId) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '<div style="text-align:center; color:#6b7280; font-size:12px; margin-top:20px;">جاري تحميل المحادثة...</div>';
    db.collection('activity_feed').doc(postId).collection('comments').orderBy('timestamp', 'asc').onSnapshot(snap => {
          let html = '';
          if(snap.empty) { list.innerHTML = '<div style="text-align:center; color:#6b7280; font-size:12px; margin-top:50px; opacity:0.7;"><i class="ri-chat-1-line" style="font-size:30px;"></i><br>كن أول من يشجع الكابتن!</div>'; return; }
          snap.forEach(doc => {
              const c = doc.data();
              const time = c.timestamp ? new Date(c.timestamp.toDate()).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '';
              html += `<div class="comment-item"><div class="comment-avatar">${c.userName.charAt(0)}</div><div class="comment-bubble"><span class="comment-user">${c.userName}</span><span class="comment-msg">${c.text}</span><span class="comment-time">${time}</span></div></div>`;
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
    try {
        await db.collection('activity_feed').doc(currentPostId).collection('comments').add({
            text: text, userId: currentUser.uid, userName: userData.name, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('activity_feed').doc(currentPostId).update({ commentsCount: firebase.firestore.FieldValue.increment(1) });
        if(currentPostOwner !== currentUser.uid) { sendNotification(currentPostOwner, `علق ${userData.name} على نشاطك: "${text.substring(0, 20)}..."`); }
    } catch(e) { console.error("Comment Error:", e); }
}
function loadNotifications() {
    const list = document.getElementById('notifications-list');
    db.collection('users').doc(currentUser.uid).collection('notifications').orderBy('timestamp','desc').limit(10).get().then(snap => {
        let html = '';
        snap.forEach(d => { html += `<div class="notif-item"><div class="notif-content">${d.data().msg}</div></div>`; d.ref.update({read:true}); });
        list.innerHTML = html || 'لا يوجد إشعارات';
    });
}
function listenForNotifications() {
    if(!currentUser) return;
    db.collection('users').doc(currentUser.uid).collection('notifications').where('read','==',false).onSnapshot(s => {
        if(!s.empty) document.getElementById('notif-dot').classList.add('active');
    });
}
function generateShareCard(dist, time, dateStr) {
    document.getElementById('share-name').innerText = userData.name || "Champion";
    const rankData = calculateRank(userData.totalDist || 0);
    document.getElementById('share-rank').innerText = rankData.name;
    document.getElementById('share-avatar').innerText = rankData.avatar;
    document.getElementById('share-dist').innerText = dist;
    document.getElementById('share-time').innerText = time + "m";
    const pace = (time / dist).toFixed(1);
    document.getElementById('share-pace').innerText = pace + "/km";
    const modal = document.getElementById('modal-share');
    modal.style.display = 'flex';
    document.getElementById('final-share-img').style.display = 'none'; 
    const element = document.getElementById('capture-area');
    setTimeout(() => {
        html2canvas(element, { backgroundColor: null, scale: 2, useCORS: true }).then(canvas => {
            const imgData = canvas.toDataURL("image/png");
            const imgTag = document.getElementById('final-share-img');
            imgTag.src = imgData;
            imgTag.style.display = 'block';
        }).catch(err => { console.error(err); alert("حدث خطأ"); });
    }, 100);
}
function loadWeeklyChart() {
    const chartDiv = document.getElementById('weekly-chart');
    if(!chartDiv) return;
    const days = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    let last7Days = [];
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        last7Days.push({ dayName: days[d.getDay()], dateKey: d.toISOString().slice(0, 10), dist: 0 });
    }
    db.collection('users').doc(currentUser.uid).collection('runs')
      .where('timestamp', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .get().then(snap => {
          snap.forEach(doc => {
              const run = doc.data();
              if(run.timestamp) {
                  const runDate = run.timestamp.toDate().toISOString().slice(0, 10);
                  const targetDay = last7Days.find(d => d.dateKey === runDate);
                  if(targetDay) targetDay.dist += (run.dist || 0);
              }
          });
          let html = '';
          const maxDist = Math.max(...last7Days.map(d => d.dist), 5);
          last7Days.forEach(day => {
              const heightPerc = (day.dist / maxDist) * 100;
              let barClass = day.dist > 10 ? 'high' : (day.dist > 5 ? 'med' : 'low');
              if(day.dist === 0) barClass = 'low';
              html += `<div class="chart-column"><span class="bar-tooltip">${day.dist > 0 ? day.dist.toFixed(1) : ''}</span><div class="bar-bg"><div class="bar-fill ${barClass}" style="height: ${heightPerc}%"></div></div><span class="bar-label">${day.dayName}</span></div>`;
          });
          chartDiv.innerHTML = html;
      });
}
// ==================== تحديث عرض التحديات (Mission Style) ====================
function loadActiveChallenges() {
    const list = document.getElementById('challenges-list');
    const mini = document.getElementById('my-active-challenges'); 
    if(!list) return;
    
    // V1.5: عرض الهيكل العظمي
    list.innerHTML = getSkeletonHTML('challenges');

    db.collection('challenges').where('active','==',true).get().then(async snap => {
        // ... (باقي الكود كما هو) ...
        if(snap.empty) { 
            list.innerHTML = "<div style='text-align:center; padding:40px; color:#6b7280'><i class='ri-flag-line' style='font-size:40px'></i><br>لا توجد مهمات نشطة حالياً</div>"; 
            if(mini) mini.innerHTML="<div class='empty-state-mini'>لا تحديات</div>"; 
            return; 
        }

        let fullHtml = '<div class="challenges-grid">';
        let miniHtml = '';

        for(const doc of snap.docs) {
            const ch = doc.data();
            let isJoined = false; 
            let progress = 0;
            
            // التحقق من الانضمام
            if(currentUser) {
                const p = await doc.ref.collection('participants').doc(currentUser.uid).get();
                if(p.exists) { isJoined = true; progress = p.data().progress || 0; }
            }

            const perc = Math.min((progress/ch.target)*100, 100);
            
            // تصميم الكارت الجديد
            fullHtml += `
            <div class="mission-card">
                <div class="mission-bg-icon"><i class="ri-trophy-line"></i></div>
                
                <div class="mission-header">
                    <div>
                        <h3 class="mission-title">${ch.title}</h3>
                        <div class="mission-meta">
                            <span><i class="ri-calendar-line"></i> نشط الآن</span>
                            <span><i class="ri-group-line"></i> تحدي عام</span>
                        </div>
                    </div>
                    <div class="mission-target-badge">${ch.target} كم</div>
                </div>

                ${isJoined ? `
                    <div class="mission-progress-container">
                        <div class="mission-progress-bar" style="width:${perc}%"></div>
                    </div>
                    <div class="mission-stats">
                        <span>أنجزت: <strong style="color:#fff">${progress.toFixed(1)}</strong></span>
                        <span>${Math.floor(perc)}%</span>
                    </div>
                ` : `
                    <button class="btn-join-mission" onclick="joinChallenge('${doc.id}')">
                        <i class="ri-add-circle-line"></i> قبول التحدي
                    </button>
                `}
            </div>`;

            // الكارت المصغر للصفحة الرئيسية
            if(isJoined && mini) {
                miniHtml += `<div class="mini-challenge-card"><div class="mini-ch-title">${ch.title}</div><div class="mini-ch-progress"><div class="mini-ch-fill" style="width:${perc}%"></div></div></div>`;
            }
        }
        
        fullHtml += '</div>';
        list.innerHTML = fullHtml;
        if(mini) mini.innerHTML = miniHtml || "<div class='empty-state-mini'>لم تنضم لتحديات بعد</div>";
    });
}
async function setPersonalGoal() {
    const newGoal = prompt("حددي هدفك لهذا الشهر (كم):", userData.monthlyGoal || 0);
    if(newGoal && newGoal > 0) {
        await db.collection('users').doc(currentUser.uid).update({ monthlyGoal: parseFloat(newGoal) });
        userData.monthlyGoal = parseFloat(newGoal);
        updateUI();
    }
} 
// ==================== معركة المحافظات (V36: Data Rich & Arabic) ====================

// قاموس التعريب (يمكنك إضافة المزيد)
const REGION_AR = {
    "Cairo": "القاهرة", "Giza": "الجيزة", "Alexandria": "الإسكندرية",
    "Mansoura": "المنصورة", "Tanta": "طنطا", "Luxor": "الأقصر",
    "Aswan": "أسوان", "Red Sea": "البحر الأحمر", "Sinai": "سيناء",
    "Sharkia": "الشرقية", "Dakahlia": "الدقهلية", "Menofia": "المنوفية", 
    "Gharbia": "الغربية", "Beni Suef": "بني سويف"
};

// تم تحويل الدالة لـ async لتنتظر البيانات
async function loadRegionBattle() {
    const list = document.getElementById('region-battle-list');
    if (!list) return;
    
    list.innerHTML = '<div style="text-align:center; padding:20px; color:#9ca3af;">جاري تحليل جيوش المحافظات... 📡</div>';
    
    try {
        // نطلب البيانات من الدالة المركزية الآمنة
        const sourceData = await fetchTopRunners();
        
        // معالجة البيانات
        processRegionData(sourceData, list);
    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="text-align:center; color:red;">فشل تحميل البيانات</div>';
    }
}
// ================================================
function processRegionData(users, listElement) {
    let stats = {};

    // 1. تجميع البيانات
    users.forEach(u => {
        if(u.region) {
            // توحيد الاسم (أول حرف كبير للباقي صغير لتجنب التكرار مثل Cairo/cairo)
            let regKey = u.region.charAt(0).toUpperCase() + u.region.slice(1).toLowerCase();
            
            if (!stats[regKey]) {
                stats[regKey] = { totalDist: 0, players: 0 };
            }
            stats[regKey].totalDist += (u.totalDist || 0);
            stats[regKey].players += 1;
        }
    });

    // 2. الترتيب
    const sorted = Object.keys(stats)
        .map(key => ({ 
            originalName: key, 
            ...stats[key],
            avg: stats[key].totalDist / stats[key].players // حساب متوسط قوة الفرد
        }))
        .sort((a, b) => b.totalDist - a.totalDist);

    listElement.innerHTML = '<div class="squad-list">';
    
    if (sorted.length === 0) {
        listElement.innerHTML = '<div style="text-align:center;">لا توجد بيانات مناطق</div>';
        return;
    }

    const maxVal = sorted[0].totalDist || 1; 

    // 3. الرسم
    let html = '<div class="squad-list">';
    
    sorted.forEach((r, i) => {
        const rank = i + 1;
        const percent = (r.totalDist / maxVal) * 100;
        
        // التعريب (إذا وجد في القاموس وإلا يظهر الإنجليزي)
        const arabicName = REGION_AR[r.originalName] || r.originalName;
        
        // الستايل
        let rankClass = 'rank-other';
        let icon = '';
        if(rank === 1) { rankClass = 'rank-1'; icon = '👑'; }
        else if(rank === 2) { rankClass = 'rank-2'; }
        else if(rank === 3) { rankClass = 'rank-3'; }

        html += `
        <div class="squad-row ${rankClass}">
            <div class="squad-bg-bar" style="width:${percent}%"></div>
            
            <div class="squad-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="squad-rank">${rank}</div>
                    <div class="squad-name-box">
                        <h4>${icon} ${arabicName}</h4>
                    </div>
                </div>
                <div class="squad-total-badge">${r.totalDist.toFixed(0)} كم</div>
            </div>

            <div class="squad-stats-row">
                <div class="stat-item" title="عدد اللاعبين">
                    <i class="ri-user-3-line"></i> ${r.players} لاعب
                </div>
                <div style="width:1px; height:10px; background:#4b5563;"></div>
                <div class="stat-item" title="متوسط مساهمة الفرد">
                    <i class="ri-speed-line"></i> القوة: ${r.avg.toFixed(1)} كم/لاعب
                </div>
            </div>
        </div>`;
    });
    
    listElement.innerHTML = html + '</div>';
}
 
// ==================== 4. Feed (النسخة الكاملة مع التعليقات) ====================
function loadGlobalFeed() {
    const list = document.getElementById('global-feed-list');
    if(!list) return;

    // V1.5: عرض الهيكل العظمي عند التحميل الأولي فقط
    if(!list.hasChildNodes() || list.innerHTML.includes('جاري التحميل')) {
        list.innerHTML = getSkeletonHTML('feed');
    }

    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
        // ... (باقي الكود كما هو) ...
        let html = '';
        if(snap.empty) { 
            list.innerHTML = '<div style="text-align:center; font-size:12px; color:#6b7280;">لا توجد أنشطة مسجلة بعد<br>كن أول من يسجل!</div>'; 
            return; 
        }
        
        snap.forEach(doc => {
            const p = doc.data();
            const isLiked = p.likes && p.likes.includes(currentUser.uid);
            const commentsCount = p.commentsCount || 0; // عداد التعليقات
            
           // حساب الوقت باستخدام الدالة المساعدة (V1.3)
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
        list.innerHTML = `<div style="text-align:center; color:red; font-size:12px;">تأكد من قواعد البيانات (Rules)</div>`;
    });
}

// ==================== زر الطوارئ: إصلاح العدادات (V31 Improved) ====================
async function fixMyStats() {
    // 1. التأكيد
    if(!confirm("⚠️ تنبيه:\nسيقوم هذا الزر بمراجعة كل الجريات المسجلة في حسابك وإعادة جمعها من الصفر لتصحيح الرقم الإجمالي.\n\nهل تريد المتابعة؟")) return;
    
    const btn = document.getElementById('fix-btn');
    const originalText = btn ? btn.innerText : "إصلاح";
    if(btn) { btn.innerText = "جاري الفحص..."; btn.disabled = true; }

    try {
        const uid = currentUser.uid;
        console.log("Starting Fix for user:", uid);

        // 2. جلب كل الجريات
        const snapshot = await db.collection('users').doc(uid).collection('runs').get();
        
        let realTotalDist = 0;
        let realTotalRuns = 0;
        let runsFound = 0;

        // 3. الجمع الدقيق (مع تحويل النصوص لأرقام إجبارياً)
        snapshot.forEach(doc => {
            const run = doc.data();
            // تحويل القيمة لرقم عشري (Float) لتجنب جمع النصوص
            const dist = parseFloat(run.dist);
            
            // التأكد أن الرقم صالح (ليس NaN)
            if (!isNaN(dist)) {
                realTotalDist += dist;
            }
            realTotalRuns += 1;
            runsFound++;
        });

        // تصحيح الكسور العشرية (رقمين فقط)
        realTotalDist = Math.round(realTotalDist * 100) / 100;

        console.log(`Fix Result: Found ${runsFound} runs, Total Dist: ${realTotalDist}`);

        if (runsFound === 0) {
            alert("تنبيه: لم يتم العثور على أي جريات مسجلة في سجلك!\nسيتم تصفير العدادات.");
        }

        // 4. تحديث قاعدة البيانات
        await db.collection('users').doc(uid).update({
            totalDist: realTotalDist,
            totalRuns: realTotalRuns,
            // تحديث شهر "الحالي" فقط (حل مؤقت ذكي)
            monthDist: realTotalDist 
        });

        // 5. تحديث الواجهة فوراً
        userData.totalDist = realTotalDist;
        userData.totalRuns = realTotalRuns;
        userData.monthDist = realTotalDist;

        // تدمير الكاش لإظهار النتيجة في المتصدرين
        if (typeof allUsersCache !== 'undefined') allUsersCache = [];

        updateUI(); // تحديث الشاشة

        alert(`✅ تمت عملية الإصلاح بنجاح!\n\nعدد الجريات الفعلي: ${realTotalRuns}\nالمسافة الإجمالية الصحيحة: ${realTotalDist} كم`);

    } catch (e) {
        console.error("Fix Error:", e);
        alert("حدث خطأ أثناء الإصلاح:\n" + e.message);
    } finally {
        if(btn) { btn.innerText = originalText; btn.disabled = false; }
    }
}

// ==================== 8. Network Handling (V1.3) ====================

function initNetworkMonitor() {
    const banner = document.getElementById('offline-banner');
    
    // دالة لتحديث الحالة
    function updateStatus() {
        if (navigator.onLine) {
            banner.classList.remove('active');
            document.body.style.paddingTop = "0"; // إعادة الجسم لوضعه الطبيعي
        } else {
            banner.classList.add('active');
            // لا نحتاج لإزاحة الجسم لأن البانر fixed ويغطي جزء بسيط
        }
    }

    // الاستماع لأحداث المتصفح
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    
    // فحص أولي عند التشغيل
    updateStatus();
}

// تحسين دالة الإرسال لمنع الأخطاء عند انقطاع النت
// سنقوم بتعديل بسيط في بداية دالة submitRun الموجودة بالأعلى


// ==================== 9. PWA Installation Logic (V1.4) ====================

// 1. للأندرويد والكروم (BeforeInstallPrompt)
window.addEventListener('beforeinstallprompt', (e) => {
    // منع ظهور النافذة التلقائية المزعجة
    e.preventDefault();
    deferredPrompt = e;
    
    // إظهار زر التثبيت في الهيدر
    const btn = document.getElementById('header-install-btn');
    if(btn) btn.style.display = 'flex';
});

// 2. للآيفون (Detect iOS)
function checkIosInstall() {
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true; // هل هو مثبت بالفعل؟

    if (isIos && !isStandalone) {
        const btn = document.getElementById('header-install-btn');
        if(btn) btn.style.display = 'flex';
    }
}
// تشغيل فحص الآيفون عند البدء
checkIosInstall();


// 3. دالة التثبيت عند الضغط على الزر
async function installApp() {
    // منطق الأندرويد/الكمبيوتر
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Install choice: ${outcome}`);
        deferredPrompt = null;
        if(outcome === 'accepted') {
            document.getElementById('header-install-btn').style.display = 'none';
        }
        return;
    }

    // منطق الآيفون (تعليمات يدوية)
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIos) {
        alert("📲 لتثبيت التطبيق على الآيفون:\n\n1. اضغط على زر المشاركة (Share) في أسفل المتصفح ⬆️\n2. اختر 'إضافة إلى الشاشة الرئيسية' (Add to Home Screen) ➕");
    } else {
        // حالة نادرة: المتصفح لا يدعم التثبيت التلقائي ولا هو آيفون
        alert("يمكنك تثبيت التطبيق من خيارات المتصفح -> Add to Home Screen");
    }
}

// 4. إخفاء الزر بمجرد التثبيت الناجح
window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('header-install-btn');
    if(btn) btn.style.display = 'none';
});



// ==================== 10. Skeleton UI Generators (V1.5) ====================
function getSkeletonHTML(type) {
    if (type === 'leaderboard') {
        // يولد 5 صفوف وهمية
        return Array(5).fill('').map(() => `
            <div class="sk-leader-row">
                <div class="skeleton sk-circle" style="width:30px; height:30px;"></div>
                <div style="flex:1">
                    <div class="skeleton sk-line long"></div>
                    <div class="skeleton sk-line short"></div>
                </div>
                <div class="skeleton sk-line" style="width:40px;"></div>
            </div>
        `).join('');
    }
    
    if (type === 'feed') {
        // يولد 3 كروت وهمية
        return Array(3).fill('').map(() => `
            <div class="sk-feed-card">
                <div class="sk-header">
                    <div class="skeleton sk-circle"></div>
                    <div style="flex:1">
                        <div class="skeleton sk-line long"></div>
                        <div class="skeleton sk-line short"></div>
                    </div>
                </div>
                <div class="skeleton sk-line" style="width:100%; height:15px;"></div>
            </div>
        `).join('');
    }

    if (type === 'challenges') {
        return Array(2).fill('').map(() => `
            <div class="skeleton sk-challenge-card"></div>
        `).join('');
    }
    
    return '<div style="padding:20px; text-align:center;">جاري التحميل...</div>';
}
