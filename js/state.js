/* ERS Core: Global state */


/* ==================== 🛠️ APP VERSION CONTROL ==================== */
// عدل البيانات دي كل ما ترفع تحديث جديد
const APP_VERSION = "V2.1.0"; 
const APP_CHANGELOG = [
    "🏆 إضافة دوري المحافظات الجديد (ERS League)",
    "💎 تحسين تصميم النافبار (Crystal Glass)",
    "⚡ تحسين سرعة التطبيق وإصلاح الأخطاء",
    "🏃‍♂️ إمكانية عرض سجل أبطال الشهر"
];

// دالة التشغيل
function initUpdateCheck() {
    // 1. كتابة البيانات في المودال
    document.getElementById('new-version-num').innerText = APP_VERSION;
    const list = document.getElementById('update-notes-list');
    if(list) {
        list.innerHTML = APP_CHANGELOG.map(note => `<li>${note}</li>`).join('');
    }
}

// ==================== 🗃️ Global State Variables ====================
// Global cursor/state for feed pagination
let globalFeedLastDoc = null;
let globalFeedHasMore = true;
let globalFeedLoading = false;
const GLOBAL_FEED_PAGE_SIZE = 5;

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

    // ✅ مهم: فعل نظام الكوتش بعد الدخول
    try {
        if (typeof setupCoachFeedOnce === 'function') setupCoachFeedOnce();
    } catch (e) {
        console.warn('[initApp] setupCoachFeedOnce failed:', e);
    }

    // ✅ مهم: لو عندك hero-week-dist خليها تتحدث هنا (مش في main.js)
    try {
        if (typeof updateHeroWeekDist === 'function') updateHeroWeekDist();
    } catch (e) {
        console.warn('[initApp] updateHeroWeekDist failed:', e);
    }

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
