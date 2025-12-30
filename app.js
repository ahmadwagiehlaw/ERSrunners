/* ERS Runners - V2*/

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

// --- دالة مركزية لجلب البيانات بأمان ---
async function fetchTopRunners() {
    if (allUsersCache.length > 0) return allUsersCache;
    const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(50).get();
    allUsersCache = [];
    snap.forEach(doc => allUsersCache.push(doc.data()));
    return allUsersCache;
}

// --- دوال مساعدة ---
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
    if (user.gender === 'female') {
        return isNew ? '🐣' : '🏃‍♀️';
    } else {
        return isNew ? '🐣' : '🏃';
    }
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
    
    // إصلاح: تحديد الزر بشكل أدق لمنع الخطأ
    const activeBtn = document.getElementById('login-btn') || document.querySelector('.auth-box .btn-primary');
    
    if (!emailEl || !passEl) return;
    const email = emailEl.value;
    const pass = passEl.value;
    if (msgEl) msgEl.innerText = "";

    // حفظ النص الأصلي
    const originalText = activeBtn ? activeBtn.innerText : "دخول";
    
    if(activeBtn) {
        activeBtn.innerHTML = 'جاري الاتصال...';
        activeBtn.disabled = true;
        activeBtn.style.opacity = "0.7";
    }

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
        // عند النجاح، onAuthStateChanged سيتولى الأمر
    } catch (err) {
        if (msgEl) {
            if(err.code === 'auth/email-already-in-use') msgEl.innerText = "البريد مسجل مسبقاً";
            else if(err.code === 'auth/wrong-password') msgEl.innerText = "كلمة المرور خاطئة";
            else if(err.code === 'auth/user-not-found') msgEl.innerText = "المستخدم غير موجود";
            else if(err.code === 'auth/network-request-failed') msgEl.innerText = "تأكد من الإنترنت ⚠️";
            else msgEl.innerText = "خطأ: " + err.message;
        }
        console.error(err);
        
        // أهم جزء: إعادة الزر للحياة
        if(activeBtn) {
            activeBtn.innerHTML = originalText;
            activeBtn.disabled = false;
            activeBtn.style.opacity = "1";
        }
    }
}
function logout() {
    if(confirm("تسجيل خروج؟")) { auth.signOut(); window.location.reload(); }
}

// ==================== Auth State Observer (Fixed) ====================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                userData = doc.data();
                
                // فحص الحظر
                if (userData.isBanned) {
                    alert(`⛔ تم حظر حسابك.\nالسبب: ${userData.banReason || "مخالفة الشروط"}`);
                    auth.signOut();
                    return;
                }

                if (!userData.badges) userData.badges = [];
                initApp();
            } else {
                // حالة مستخدم جديد
                userData = { name: "Runner", region: "Cairo", totalDist: 0, totalRuns: 0, badges: [] };
                initApp();
            }
        } catch (e) { console.error("Auth Error:", e); }
    } else {
        // حالة تسجيل الخروج
        currentUser = null;
        const authScreen = document.getElementById('auth-screen');
        const appContent = document.getElementById('app-content');
        if(authScreen) authScreen.style.display = 'flex';
        if(appContent) appContent.style.display = 'none';
    }
});

// ==================== Init App ====================
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
    if(typeof loadWeeklyChart === 'function') loadWeeklyChart();
    
    initNetworkMonitor();
    checkSharedData(); 
}

// ==================== Leaderboard ====================
async function loadLeaderboard(filterType = 'all') {
    const list = document.getElementById('leaderboard-list');
    const podiumContainer = document.getElementById('podium-container');
    const teamTotalEl = document.getElementById('teamTotalDisplay');
    const teamBar = document.getElementById('teamGoalBar');

    if (!list) return;

    if (allUsersCache.length === 0) {
        list.innerHTML = getSkeletonHTML('leaderboard');
        if(podiumContainer) podiumContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#6b7280; font-size:12px;">جاري تجهيز المنصة... 🏆</div>';
    }

    await fetchTopRunners();

    let displayUsers = allUsersCache;
    if (filterType === 'region') {
        displayUsers = allUsersCache.filter(u => u.region === userData.region);
    }

    let teamTotal = 0;
    displayUsers.forEach(u => teamTotal += (u.totalDist || 0));
    if(teamTotalEl) teamTotalEl.innerText = teamTotal.toFixed(0);
    if(teamBar) {
        let perc = Math.min((teamTotal / 1000) * 100, 100);
        teamBar.style.width = `${perc}%`;
    }

    if (podiumContainer) {
        let podiumHtml = '';
        const u1 = displayUsers[0];
        const u2 = displayUsers[1];
        const u3 = displayUsers[2];

        if(u2) podiumHtml += createPodiumItem(u2, 2);
        if(u1) podiumHtml += createPodiumItem(u1, 1);
        if(u3) podiumHtml += createPodiumItem(u3, 3);

        podiumContainer.innerHTML = podiumHtml || '<div style="color:#9ca3af; font-size:12px;">لا يوجد أبطال بعد</div>';
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

// ==================== 4. UI Updates (Hero Card) ====================
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
            if (typeof getUserAvatar === 'function') {
                avatarIcon = getUserAvatar(userData);
            }
            if(rankData.name === 'أسطورة') avatarIcon = '👑';
            else if(rankData.name === 'محترف') avatarIcon = '🦅';

            statsCard.innerHTML = `
                <div style="padding: 20px; position:relative; z-index:2;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="bib-avatar" style="width:45px; height:45px; font-size:22px; background:rgba(255,255,255,0.1); border-radius:50%; display:flex; align-items:center; justify-content:center;">
                                ${avatarIcon}
                            </div>
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
                        <span>مستواك الحالي</span>
                        <span>هدف ${nextMilestone} كم</span>
                    </div>
                    
                    <div class="progress-track" style="background:rgba(255,255,255,0.05); height:8px; border-radius:10px; overflow:hidden;">
                        <div class="progress-fill" style="width: ${progressToNext}%; background: linear-gradient(90deg, var(--primary) 0%, #34d399 100%); height:100%; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); transition: width 1s ease;"></div>
                    </div>

                    <div class="stats-footer-row" style="display:flex; justify-content:space-between; margin-top:20px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
                        <div class="mini-stat" style="text-align:center; flex:1;">
                            <span style="display:block; font-size:10px; color:#9ca3af;">هذا الشهر 📅</span>
                            <strong style="display:block; font-size:14px; color:var(--primary); margin-top:3px;">${formatNumber(userData.monthDist || 0)}</strong>
                        </div>
                        <div class="mini-stat" style="text-align:center; flex:1; border-right:1px solid rgba(255,255,255,0.1); border-left:1px solid rgba(255,255,255,0.1);">
                            <span style="display:block; font-size:10px; color:#9ca3af;">أنشطة 🏃</span>
                            <strong style="display:block; font-size:14px; color:#fff; margin-top:3px;">${userData.totalRuns || 0}</strong>
                        </div>
                        <div class="mini-stat" style="text-align:center; flex:1;">
                            <span style="display:block; font-size:10px; color:#9ca3af;">حرق 🔥</span>
                            <strong style="display:block; font-size:14px; color:#fff; margin-top:3px;">
                                ${calories > 1000 ? (calories/1000).toFixed(1) + 'k' : calories}
                            </strong>
                        </div>
                    </div>
                </div>
            `;
        }

        renderBadges();
        if(typeof updateCoachAdvice === 'function') updateCoachAdvice();

        const adminBtn = document.getElementById('btn-admin-entry');
        if (adminBtn) {
            adminBtn.style.display = (userData.isAdmin === true) ? 'flex' : 'none';
        }

    } catch (error) { 
        console.error("UI Error:", error); 
    }
}

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
        distRequired: distRequired,
        icon: currentLevel.avatar
    };
}

// ==================== Smart Coach & Badges ====================
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
        showToast(`🎉 مبروووك! إنجاز جديد: ${badgeNames}`, "success");
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

// ==================== Activity Log & Submission ====================
// --- ✅ تم تصحيح الخطأ هنا (function بدل ffunction) ---
function openNewRun() {
    const btn = document.getElementById('save-run-btn');
    if(btn) { btn.innerText = "حفظ النشاط"; btn.disabled = false; }
    
    const dateInput = document.getElementById('log-date');
    if(dateInput && typeof getLocalInputDate === 'function') dateInput.value = getLocalInputDate();
    
    // تنظيف الحقول
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
    if (!navigator.onLine) {
        if(typeof showToast === 'function') showToast("لا يوجد اتصال بالإنترنت! ⚠️", "error");
        else alert("⚠️ لا يوجد اتصال بالإنترنت!");
        return;
    }

    const btn = document.getElementById('save-run-btn');
    const distInput = document.getElementById('log-dist');
    const timeInput = document.getElementById('log-time');
    const typeInput = document.getElementById('log-type');
    const linkInput = document.getElementById('log-link');
    const dateInput = document.getElementById('log-date');
    const imgUrlInput = document.getElementById('uploaded-img-url'); 

    const dist = parseFloat(distInput.value);
    const time = parseFloat(timeInput.value);
    const type = typeInput.value;
    const link = linkInput.value;
    const img = imgUrlInput ? imgUrlInput.value : ''; 

    if (!dist || !time) {
        alert("يرجى كتابة المسافة والزمن");
        return;
    }

    if(btn) { btn.innerText = "جاري الحفظ..."; btn.disabled = true; }

    try {
        const uid = currentUser.uid;
        
        const runData = {
            dist, time, type, 
            link: link || '', 
            img: img || '', 
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        if(dateInput && dateInput.value) {
            runData.date = dateInput.value;
            runData.timestamp = firebase.firestore.Timestamp.fromDate(new Date(dateInput.value));
        }

        await db.collection('users').doc(uid).collection('runs').add(runData);

        await db.collection('activity_feed').add({
            uid: uid, 
            userName: userData.name, 
            userRegion: userData.region,
            userGender: userData.gender || 'male',
            ...runData, 
            likes: [], 
            commentsCount: 0
        });

        const currentMonthKey = new Date().toISOString().slice(0, 7);
        let newMonthDist = (userData.monthDist || 0) + dist;
        if(userData.lastMonthKey !== currentMonthKey) newMonthDist = dist;

        await db.collection('users').doc(uid).set({
            totalDist: firebase.firestore.FieldValue.increment(dist),
            totalRuns: firebase.firestore.FieldValue.increment(1),
            monthDist: newMonthDist,
            lastMonthKey: currentMonthKey
        }, { merge: true });

        userData.totalDist += dist;
        userData.totalRuns += 1;
        userData.monthDist = newMonthDist;

        // التحقق من الأوسمة
        checkNewBadges(dist, time, runData.timestamp ? runData.timestamp.toDate() : new Date());

        distInput.value = ''; timeInput.value = ''; linkInput.value = '';
        if(imgUrlInput) imgUrlInput.value = '';
        const preview = document.getElementById('img-preview');
        if(preview) { preview.src = ''; preview.style.display = 'none'; }
        
        closeModal('modal-log');
        allUsersCache = [];
        updateUI();
        loadGlobalFeed();
        loadActivityLog();
        
        if(typeof showToast === 'function') showToast("تم حفظ الجرية! 🔥", "success");

    } catch (error) {
        console.error(error);
        alert("خطأ: " + error.message);
    } finally {
        if(btn) { btn.innerText = "حفظ النشاط"; btn.disabled = false; }
    }
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
    if(!confirm("هل أنت متأكد من حذف هذا النشاط؟")) return;
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
                .where('uid', '==', uid)
                .where('timestamp', '==', runData.timestamp)
                .get();
            const batch = db.batch();
            feedQuery.forEach(doc => batch.delete(doc.ref));
            await batch.commit(); 
        }

        userData.totalDist = Math.max(0, (userData.totalDist || 0) - dist);
        userData.totalRuns = Math.max(0, (userData.totalRuns || 0) - 1);
        userData.monthDist = Math.max(0, (userData.monthDist || 0) - dist);

        allUsersCache = [];
        updateUI();
        loadGlobalFeed();
        alert("تم الحذف");
    } catch (error) { console.error(error); alert("خطأ: " + error.message); }
}


// ==================== UI Helpers ====================
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

// ==================== Social Features ====================
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
    list.innerHTML = '<div style="text-align:center; padding:20px;">جاري التحميل...</div>';
    db.collection('activity_feed').doc(postId).collection('comments').orderBy('timestamp', 'asc').onSnapshot(snap => {
          let html = '';
          if(snap.empty) { list.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.7;">كن أول من يعلق!</div>'; return; }
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
        if(currentPostOwner !== currentUser.uid) { sendNotification(currentPostOwner, `علق ${userData.name} على نشاطك`); }
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

// ==================== Challenges & Battles ====================
function loadActiveChallenges() {
    const list = document.getElementById('challenges-list');
    const mini = document.getElementById('my-active-challenges'); 
    if(!list) return;
    list.innerHTML = getSkeletonHTML('challenges');

    db.collection('challenges').where('active','==',true).get().then(async snap => {
        if(snap.empty) { 
            list.innerHTML = "<div style='text-align:center; padding:40px; color:#6b7280'>لا توجد مهمات نشطة حالياً</div>"; 
            if(mini) mini.innerHTML="<div class='empty-state-mini'>لا تحديات</div>"; 
            return; 
        }

        let fullHtml = '<div class="challenges-grid">';
        let miniHtml = '';

        for(const doc of snap.docs) {
            const ch = doc.data();
            let isJoined = false; 
            let progress = 0;
            if(currentUser) {
                const p = await doc.ref.collection('participants').doc(currentUser.uid).get();
                if(p.exists) { isJoined = true; progress = p.data().progress || 0; }
            }
            const perc = Math.min((progress/ch.target)*100, 100);
            
            fullHtml += `
            <div class="mission-card">
                <div class="mission-bg-icon"><i class="ri-trophy-line"></i></div>
                <div class="mission-header">
                    <div>
                        <h3 class="mission-title">${ch.title}</h3>
                        <div class="mission-meta">
                            <span><i class="ri-calendar-line"></i> نشط الآن</span>
                        </div>
                    </div>
                    <div class="mission-target-badge">${ch.target} كم</div>
                </div>
                ${isJoined ? `
                    <div class="mission-progress-container"><div class="mission-progress-bar" style="width:${perc}%"></div></div>
                    <div class="mission-stats"><span>أنجزت: <strong>${progress.toFixed(1)}</strong></span><span>${Math.floor(perc)}%</span></div>
                ` : `
                    <button class="btn-join-mission" onclick="joinChallenge('${doc.id}')"><i class="ri-add-circle-line"></i> قبول التحدي</button>
                `}
            </div>`;

            if(isJoined && mini) {
                miniHtml += `<div class="mini-challenge-card"><div class="mini-ch-title">${ch.title}</div><div class="mini-ch-progress"><div class="mini-ch-fill" style="width:${perc}%"></div></div></div>`;
            }
        }
        
        fullHtml += '</div>';
        list.innerHTML = fullHtml;
        if(mini) mini.innerHTML = miniHtml || "<div class='empty-state-mini'>لم تنضم لتحديات بعد</div>";
    });
}

const REGION_AR = {
    "Cairo": "القاهرة", "Giza": "الجيزة", "Alexandria": "الإسكندرية",
    "Mansoura": "المنصورة", "Tanta": "طنطا", "Luxor": "الأقصر",
    "Aswan": "أسوان", "Red Sea": "البحر الأحمر", "Sinai": "سيناء",
    "Sharkia": "الشرقية", "Dakahlia": "الدقهلية", "Menofia": "المنوفية", 
    "Gharbia": "الغربية", "Beni Suef": "بني سويف"
};

async function loadRegionBattle() {
    const list = document.getElementById('region-battle-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center; padding:20px;">جاري التحميل...</div>';
    
    try {
        const sourceData = await fetchTopRunners();
        processRegionData(sourceData, list);
    } catch (e) {
        list.innerHTML = '<div style="text-align:center; color:red;">فشل تحميل البيانات</div>';
    }
}

function processRegionData(users, listElement) {
    let stats = {};
    users.forEach(u => {
        if(u.region) {
            let regKey = u.region.charAt(0).toUpperCase() + u.region.slice(1).toLowerCase();
            if (!stats[regKey]) { stats[regKey] = { totalDist: 0, players: 0 }; }
            stats[regKey].totalDist += (u.totalDist || 0);
            stats[regKey].players += 1;
        }
    });

    const sorted = Object.keys(stats)
        .map(key => ({ originalName: key, ...stats[key], avg: stats[key].totalDist / stats[key].players }))
        .sort((a, b) => b.totalDist - a.totalDist);

    if (sorted.length === 0) { listElement.innerHTML = '<div style="text-align:center;">لا توجد بيانات</div>'; return; }
    const maxVal = sorted[0].totalDist || 1; 

    let html = '<div class="squad-list">';
    sorted.forEach((r, i) => {
        const rank = i + 1;
        const percent = (r.totalDist / maxVal) * 100;
        const arabicName = REGION_AR[r.originalName] || r.originalName;
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
                    <div class="squad-name-box"><h4>${icon} ${arabicName}</h4></div>
                </div>
                <div class="squad-total-badge">${r.totalDist.toFixed(0)} كم</div>
            </div>
            <div class="squad-stats-row">
                <div class="stat-item"><i class="ri-user-3-line"></i> ${r.players} لاعب</div>
                <div style="width:1px; height:10px; background:#4b5563;"></div>
                <div class="stat-item">القوة: ${r.avg.toFixed(1)}</div>
            </div>
        </div>`;
    });
    listElement.innerHTML = html + '</div>';
}

function loadGlobalFeed() {
    const list = document.getElementById('global-feed-list');
    if(!list) return;
    if(!list.hasChildNodes() || list.innerHTML.includes('جاري التحميل')) {
        list.innerHTML = getSkeletonHTML('feed');
    }

    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
        let html = '';
        if(snap.empty) { list.innerHTML = '<div style="text-align:center; padding:20px;">لا توجد أنشطة</div>'; return; }
        
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
                    ${p.link ? `<a href="${p.link}" target="_blank" style="text-decoration:none; color:#3b82f6;"><i class="ri-link"></i></a>` : ''}
                    ${p.img ? `<button onclick="window.open('${p.img}', '_blank')" style="background:none; border:none; color:#8b5cf6;"><i class="ri-image-2-fill"></i> إثبات</button>` : ''}
                    <button class="feed-compact-btn ${isLiked?'liked':''}" onclick="toggleLike('${doc.id}', '${p.uid}')">
                        <i class="${isLiked?'ri-heart-fill':'ri-heart-line'}"></i> <span class="feed-compact-count">${(p.likes||[]).length || ''}</span>
                    </button>
                    <button class="feed-compact-btn" onclick="openComments('${doc.id}', '${p.uid}')">
                        <i class="ri-chat-3-line"></i> <span class="feed-compact-count">${commentsCount > 0 ? commentsCount : ''}</span>
                    </button>
                    <span class="feed-compact-meta">${timeAgo}</span>
                </div>
            </div>`;
        });
        list.innerHTML = html;
    });
}

// ==================== System & Helpers ====================
function initNetworkMonitor() {
    const banner = document.getElementById('offline-banner');
    function updateStatus() {
        if (navigator.onLine) banner.classList.remove('active');
        else banner.classList.add('active');
    }
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
}

// PWA Install
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('header-install-btn');
    if(btn) btn.style.display = 'flex';
});

async function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if(outcome === 'accepted') document.getElementById('header-install-btn').style.display = 'none';
        return;
    }
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIos) alert("📲 للآيفون: اضغط Share ثم Add to Home Screen");
    else alert("يمكنك تثبيت التطبيق من خيارات المتصفح");
}

function getSkeletonHTML(type) {
    if (type === 'leaderboard') return Array(5).fill('').map(() => `<div class="sk-leader-row"><div class="skeleton sk-circle"></div><div style="flex:1"><div class="skeleton sk-line long"></div></div></div>`).join('');
    if (type === 'feed') return Array(3).fill('').map(() => `<div class="sk-feed-card"><div class="sk-header"><div class="skeleton sk-circle"></div><div class="skeleton sk-line long"></div></div><div class="skeleton sk-line"></div></div>`).join('');
    return '<div style="padding:20px;">جاري التحميل...</div>';
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

function checkSharedData() {
    const urlParams = new URLSearchParams(window.location.search);
    const title = urlParams.get('title');
    const text = urlParams.get('text');
    const url = urlParams.get('url');

    if (title || text || url) {
        window.history.replaceState({}, document.title, window.location.pathname);
        const fullText = `${title || ''} ${text || ''} ${url || ''}`;
        const extractedUrl = (fullText.match(/https?:\/\/[^\s]+/) || [''])[0];

        setTimeout(() => {
            if(currentUser) {
                openNewRun(); 
                const linkInput = document.getElementById('log-link');
                if(linkInput && extractedUrl) {
                    linkInput.value = extractedUrl;
                    showToast("تم استلام الرابط 🔗", "success");
                }
                const distMatch = fullText.match(/(\d+(\.\d+)?)\s*(km|كم)/i);
                if(distMatch && distMatch[1]) document.getElementById('log-dist').value = distMatch[1];
            }
        }, 1500);
    }
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
                const extractedDist = parseFloat(distMatch[1]);
                if(confirm(`🤖 اكتشفت مسافة ${extractedDist} كم. هل أكتبها؟`)) {
                    distInput.value = extractedDist;
                    showToast("تم استخراج المسافة ⚡", "success");
                }
            }
            const urlMatch = text.match(/https?:\/\/[^\s]+/);
            if (urlMatch && urlMatch[0] !== text) linkInput.value = urlMatch[0]; 
        }, 100);
    });
}

async function uploadImageToImgBB() {
    const fileInput = document.getElementById('log-img-file');
    const status = document.getElementById('upload-status');
    const preview = document.getElementById('img-preview');
    const hiddenInput = document.getElementById('uploaded-img-url');
    const saveBtn = document.getElementById('save-run-btn');

    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];

    status.innerText = "جاري رفع الصورة... ⏳";
    status.style.color = "#f59e0b";
    if(saveBtn) { saveBtn.disabled = true; saveBtn.innerText = "انتظر..."; }

    const formData = new FormData();
    formData.append("image", file);
    const API_KEY = "0d0b1fefa53eb2fc054b27c6395af35c"; 

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, { method: "POST", body: formData });
        const data = await response.json();

        if (data.success) {
            const imageUrl = data.data.url;
            hiddenInput.value = imageUrl;
            preview.src = imageUrl;
            preview.style.display = 'block';
            status.innerText = "تم إرفاق الصورة ✅";
            status.style.color = "#10b981";
            if(saveBtn) { saveBtn.disabled = false; saveBtn.innerText = "حفظ النشاط"; }
            showToast("تم رفع الصورة 📸", "success");
        } else { throw new Error(data.error.message); }
    } catch (error) {
        console.error("ImgBB Error:", error);
        status.innerText = "فشل الرفع! ❌";
        status.style.color = "#ef4444";
        if(saveBtn) { saveBtn.disabled = false; saveBtn.innerText = "حفظ النشاط"; }
    }
}

// ==================== Weekly Chart (Fixed V2.2) ====================
function loadWeeklyChart() {
    const chartDiv = document.getElementById('weekly-chart');
    if(!chartDiv) return;
    
    const daysAr = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    let last7Days = [];
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        last7Days.push({ day: daysAr[d.getDay()], key: k, dist: 0 });
    }

    const start = new Date(); start.setDate(start.getDate()-7); start.setHours(0,0,0,0);
    
    db.collection('users').doc(currentUser.uid).collection('runs')
      .where('timestamp', '>=', start).get().then(snap => {
          snap.forEach(d => {
              const r = d.data();
              if(r.timestamp) {
                  const rd = r.timestamp.toDate();
                  const k = rd.getFullYear()+'-'+String(rd.getMonth()+1).padStart(2,'0')+'-'+String(rd.getDate()).padStart(2,'0');
                  const t = last7Days.find(x => x.key === k);
                  if(t) t.dist += (parseFloat(r.dist)||0);
              }
          });
          
          const max = Math.max(...last7Days.map(d=>d.dist), 5);
          let html = '';
          last7Days.forEach(d => {
              const h = (d.dist/max)*100;
              const cls = d.dist>10?'high':(d.dist>5?'med':'low');
              html += `<div class="chart-column"><span class="bar-tooltip" style="opacity:${d.dist>0?1:0}">${d.dist.toFixed(1)}</span><div class="bar-bg"><div class="bar-fill ${cls}" style="height:${d.dist==0?5:Math.max(h,10)}%;opacity:${d.dist==0?0.2:1}"></div></div><span class="bar-label">${d.day}</span></div>`;
          });
          chartDiv.innerHTML = html;
      });
}
// ==================== V2.0 Admin Logic (Recovered) ====================
function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'none');
    const target = document.getElementById('admin-tab-' + tabId);
    if(target) target.style.display = 'block';
    
    document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');

    if(tabId === 'anticheat') loadAntiCheatRadar();
    if(tabId === 'users') loadUserManager();
    if(tabId === 'overview') loadAdminOverview();
}

async function loadAdminOverview() {
    const grid = document.getElementById('admin-stats-grid');
    const regionChart = document.getElementById('admin-regions-chart');
    if(!grid) return;

    let users = allUsersCache;
    if(users.length === 0) users = await fetchTopRunners();

    const totalUsers = users.length;
    const totalDist = users.reduce((acc, u) => acc + (u.totalDist || 0), 0);
    const activeThisMonth = users.filter(u => (u.monthDist || 0) > 0).length;
    
    grid.innerHTML = `
        <div class="admin-stat-card"><span class="admin-stat-num">${totalUsers}</span><span class="admin-stat-label">عضو</span></div>
        <div class="admin-stat-card"><span class="admin-stat-num">${formatNumber(totalDist)}</span><span class="admin-stat-label">كم</span></div>
        <div class="admin-stat-card"><span class="admin-stat-num">${activeThisMonth}</span><span class="admin-stat-label">نشط</span></div>
    `;
    
    // شارت المناطق البسيط
    const regions = {};
    users.forEach(u => { const r = u.region||'غير محدد'; regions[r] = (regions[r]||0)+1; });
    let regionHtml = '';
    Object.entries(regions).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([reg, count]) => {
        const perc = (count/totalUsers)*100;
        regionHtml += `<div style="margin-bottom:5px; font-size:12px;"><div style="display:flex;justify-content:space-between;"><span>${reg}</span><span>${count}</span></div><div style="background:#374151;height:4px;border-radius:2px;"><div style="background:#3b82f6;width:${perc}%;height:100%"></div></div></div>`;
    });
    if(regionChart) regionChart.innerHTML = regionHtml;
}

function loadAntiCheatRadar() {
    const list = document.getElementById('anticheat-list');
    if(!list) return;
    list.innerHTML = 'جاري الفحص...';
    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(50).get().then(snap => {
        let html = '';
        let count = 0;
        snap.forEach(doc => {
            const r = doc.data();
            const pace = r.time / r.dist;
            if (r.dist > 0 && (pace < 2.5 || r.dist > 45)) {
                count++;
                html += `<div class="suspicious-row"><div><b>${r.userName}</b><br><span style="font-size:10px;color:#ef4444">${r.dist}km @ ${pace.toFixed(1)}/km</span></div><button class="btn-ban" onclick="adminDeleteActivity('${doc.id}')">حذف</button></div>`;
            }
        });
        list.innerHTML = count > 0 ? html : '<div style="text-align:center; padding:10px; color:#10b981">سجل نظيف ✅</div>';
    });
}

async function adminDeleteActivity(id) {
    if(confirm("حذف هذا النشاط؟")) {
        await db.collection('activity_feed').doc(id).delete();
        alert("تم الحذف");
        loadAntiCheatRadar();
    }
}

async function loadUserManager() {
    const list = document.getElementById('admin-users-list');
    if(!list) return;
    list.innerHTML = 'تحميل...';
    const snap = await db.collection('users').limit(50).get();
    let html = '';
    snap.forEach(doc => {
        const u = doc.data();
        html += `<div class="admin-user-row"><div class="admin-user-info"><h4>${u.name}</h4><span>${u.region}</span></div><button class="btn-ban" onclick="alert('قريباً')">إدارة</button></div>`;
    });
    list.innerHTML = html;
}

async function sendGlobalNotification() {
    const msg = document.getElementById('global-msg').value;
    if(!msg) return;
    if(confirm("إرسال للجميع؟")) {
        const snap = await db.collection('users').orderBy('totalDist','desc').limit(20).get();
        const batch = db.batch();
        snap.forEach(d => {
            batch.set(db.collection('users').doc(d.id).collection('notifications').doc(), {
                msg: `📢 إداري: ${msg}`, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        alert("تم الإرسال");
    }
}

async function createChallengeUI() {
    const t = prompt("عنوان التحدي:");
    const k = prompt("الهدف (كم):");
    if(t && k) {
        await db.collection('challenges').add({ title: t, target: parseFloat(k), active: true, startDate: new Date().toISOString() });
        alert("تم");
    }
}
