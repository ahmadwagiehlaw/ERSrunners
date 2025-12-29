/* ERS Runners - V32 (Smart Update Loop Fix + Install Prompt) */

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

// متغيرات النظام
let currentUser = null;
let userData = {};
let isSignupMode = false;
let editingRunId = null;
let editingOldDist = 0;
let allUsersCache = []; 
let deferredPrompt; // لتثبيت التطبيق
let latestServerVersion = null; // لحفظ النسخة القادمة من السيرفر

// 🔥 رقم النسخة الحالية في الكود (يمكنك تغييره يدوياً أو تركه)
const CURRENT_VERSION = "1.0"; 

// ==================== 1. Init & Checks ====================
function initApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const dateInput = document.getElementById('log-date');
    if(dateInput) dateInput.value = now.toISOString().slice(0,16);

    updateUI();
    loadActivityLog();
    loadActiveChallenges(); 
    loadGlobalFeed();
    listenForNotifications();
    if(typeof loadWeeklyChart === 'function') loadWeeklyChart();

    // 🚀 تشغيل الأنظمة الذكية (تحديث + تثبيت)
    checkAppVersion();
    checkInstallPrompt();
}

// ==================== 2. Smart Updater (The Fix) 🧠 ====================
async function checkAppVersion() {
    try {
        // قراءة النسخة من فايربيس
        const doc = await db.collection('system').doc('config').get();
        
        if (doc.exists) {
            latestServerVersion = doc.data().version; // مثلاً "1.5"
            
            // قراءة آخر نسخة قام المستخدم بتحديثها بالفعل (من ذاكرة الهاتف)
            const acknowledgedVersion = localStorage.getItem('last_acknowledged_version');

            // الشرط الذكي:
            // 1. نسخة السيرفر مختلفة عن نسخة الكود الحالية
            // 2. وكمان المستخدم لم يضغط "تحديث" لهذه النسخة من قبل
            if (latestServerVersion && 
                latestServerVersion !== CURRENT_VERSION && 
                latestServerVersion !== acknowledgedVersion) {
                
                console.log(`Update available: ${latestServerVersion}`);
                document.getElementById('modal-update').style.display = 'flex';
            }
        }
    } catch (e) {
        console.error("Version Check Error:", e);
    }
}

function performUpdate() {
    // 1. تسجيل أن المستخدم وافق على هذه النسخة (لكسر اللوب)
    if(latestServerVersion) {
        localStorage.setItem('last_acknowledged_version', latestServerVersion);
    }

    // 2. مسح الكاش (Service Worker)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
                registration.unregister();
            }
        });
    }
    
    // 3. إعادة تحميل الصفحة بقوة
    window.location.reload(true);
}

// ==================== 3. Install Prompt (Pop-up) 📲 ====================
window.addEventListener('beforeinstallprompt', (e) => {
    // منع الكروم من إظهار الشريط الافتراضي
    e.preventDefault();
    deferredPrompt = e;
    // حفظ الحدث لاستخدامه لاحقاً
});

function checkInstallPrompt() {
    // التأكد ان المستخدم لم يرفض التثبيت مسبقاً
    if (!localStorage.getItem('install_dismissed')) {
        // ننتظر قليلاً (5 ثواني) ثم نظهر المودال ليكون غير مزعج
        setTimeout(() => {
            if (deferredPrompt) {
                document.getElementById('modal-install').style.display = 'flex';
            }
        }, 5000);
    }
}

// تفعيل زر التثبيت داخل المودال (يجب أن يكون الزر موجوداً في HTML)
// ملاحظة: تأكد أنك أضفت onclick="installPWA()" للزر في HTML أو استخدم هذا المستمع:
document.addEventListener('click', async (e) => {
    if(e.target && e.target.id === 'btn-install-app') {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to install: ${outcome}`);
            deferredPrompt = null;
        }
        document.getElementById('modal-install').style.display = 'none';
    }
});

function closeInstallModal() {
    document.getElementById('modal-install').style.display = 'none';
    // لن نظهره مرة أخرى (احترام رغبة المستخدم)
    localStorage.setItem('install_dismissed', 'true');
}

// ==================== 4. Auth System ====================
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
                userData = { name: "Runner", region: "Cairo", totalDist: 0, totalRuns: 0, badges: [] };
                initApp();
            }
        } catch (e) { 
            console.error(e);
            userData = { name: "Runner", region: "Cairo", totalDist: 0, totalRuns: 0, badges: [] };
            initApp();
        }
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
});

function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    const fields = document.getElementById('signup-fields');
    const btn = document.getElementById('toggleAuthBtn');
    const mainBtn = document.querySelector('.auth-box .btn-primary');
    if (fields) {
        fields.style.display = isSignupMode ? 'block' : 'none';
        btn.innerText = isSignupMode ? "لديك حساب؟ دخول" : "ليس لديك حساب؟ سجل الآن";
        mainBtn.innerText = isSignupMode ? "إنشاء حساب" : "دخول";
    }
}

async function handleAuth() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const activeBtn = document.querySelector('.auth-box .btn-primary');
    const msgEl = document.getElementById('auth-msg');
    
    if(msgEl) msgEl.innerText = "";
    if(activeBtn) {
        activeBtn.innerHTML = 'جاري الاتصال... <span class="loader-btn"></span>';
        activeBtn.disabled = true;
    }

    try {
        if (isSignupMode) {
            const name = document.getElementById('username').value;
            const region = document.getElementById('region').value;
            const c = await auth.createUserWithEmailAndPassword(email, pass);
            await db.collection('users').doc(c.user.uid).set({
                name, region, email, totalDist: 0, totalRuns: 0, badges: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await auth.signInWithEmailAndPassword(email, pass);
        }
    } catch (e) {
        if(msgEl) msgEl.innerText = "خطأ: " + e.message;
        if(activeBtn) { activeBtn.innerText = "محاولة مجددة"; activeBtn.disabled = false; }
    }
}

function logout() { if(confirm("خروج؟")) { auth.signOut(); window.location.reload(); } }

// ==================== 5. UI & Logic ====================
function updateUI() {
    try {
        if(document.getElementById('headerName')) document.getElementById('headerName').innerText = userData.name;
        document.getElementById('monthDist').innerText = (userData.monthDist || 0).toFixed(1);
        document.getElementById('totalRuns').innerText = userData.totalRuns || 0;

        const rankData = calculateRank(userData.totalDist || 0);
        document.getElementById('userRankBadge').innerText = rankData.name;
        document.getElementById('userRankBadge').className = `rank-badge ${rankData.class}`;
        
        // XP Bar
        document.getElementById('nextLevelDist').innerText = rankData.remaining.toFixed(1);
        document.getElementById('xpBar').style.width = `${rankData.percentage}%`;
        document.getElementById('xpText').innerText = `${rankData.distInLevel.toFixed(1)} / ${rankData.distRequired} كم`;
        document.getElementById('xpPerc').innerText = `${Math.floor(rankData.percentage)}%`;

        // Profile
        document.getElementById('profileName').innerText = userData.name;
        document.getElementById('profileRegion').innerText = userData.region;
        document.getElementById('profileTotalDist').innerText = (userData.totalDist || 0).toFixed(1);
        document.getElementById('profileTotalRuns').innerText = userData.totalRuns || 0;
        document.getElementById('profileRankText').innerText = rankData.name;
        
        const avatar = document.getElementById('profileAvatar');
        if(avatar) {
            avatar.innerText = rankData.avatar;
            avatar.style.background = "#111827"; 
            avatar.style.color = "#fff";
            avatar.style.border = "2px solid var(--primary)";
        }

        updateGoalRing();
        if(typeof updateCoachAdvice === 'function') updateCoachAdvice();

    } catch (e) { console.error(e); }
}

function calculateRank(totalDist) {
    const levels = [
        { name: "مبتدئ", min: 0, class: "rank-mubtadi", next: 50, avatar: "🥚" },
        { name: "هاوي", min: 50, class: "rank-hawy", next: 150, avatar: "🐣" },
        { name: "عداء", min: 150, class: "rank-runner", next: 500, avatar: "🏃" },
        { name: "محترف", min: 500, class: "rank-pro", next: 1000, avatar: "🦅" },
        { name: "أسطورة", min: 1000, class: "rank-legend", next: 10000, avatar: "👑" }
    ];
    let current = levels[0];
    for(let i=levels.length-1; i>=0; i--) { if(totalDist >= levels[i].min) { current = levels[i]; break; } }
    const distReq = current.next - current.min;
    const distIn = totalDist - current.min;
    let perc = (distIn / distReq) * 100; if(perc > 100) perc = 100;
    return { name: current.name, class: current.class, avatar: current.avatar, remaining: current.next - totalDist, percentage: perc, distInLevel: distIn, distRequired: distReq };
}

function updateGoalRing() {
    const ring = document.getElementById('goalRing');
    const txt = document.getElementById('goalText');
    const sub = document.getElementById('goalSub');
    if(ring && txt) {
        const goal = userData.monthlyGoal || 0;
        const cur = userData.monthDist || 0;
        if(goal === 0) {
            txt.innerText = "اضغط لتحديد هدف";
            ring.style.background = `conic-gradient(#374151 0deg, rgba(255,255,255,0.05) 0deg)`;
        } else {
            const p = Math.min((cur/goal)*100, 100);
            const deg = (p/100)*360;
            txt.innerText = `${cur.toFixed(1)} / ${goal} كم`;
            sub.innerText = cur >= goal ? "أنت أسطورة! 🎉" : `باقي ${(goal-cur).toFixed(1)} كم`;
            ring.style.background = `conic-gradient(#8b5cf6 ${deg}deg, rgba(255,255,255,0.1) 0deg)`;
        }
    }
}

// ==================== 6. Fix Stats Logic (V31) ====================
async function fixMyStats() {
    if(!confirm("⚠️ سيقوم هذا الإجراء بإعادة حساب إجمالي المسافات بدقة.\nهل تريد المتابعة؟")) return;
    const btn = document.getElementById('fix-btn');
    if(btn) btn.innerText = "جاري الفحص...";
    try {
        const snap = await db.collection('users').doc(currentUser.uid).collection('runs').get();
        let tDist = 0, tRuns = 0;
        snap.forEach(d => {
            const val = parseFloat(d.data().dist);
            if(!isNaN(val)) tDist += val;
            tRuns++;
        });
        tDist = Math.round(tDist*100)/100;
        
        await db.collection('users').doc(currentUser.uid).update({ totalDist: tDist, totalRuns: tRuns, monthDist: tDist });
        userData.totalDist = tDist; userData.totalRuns = tRuns; userData.monthDist = tDist;
        if(typeof allUsersCache !== 'undefined') allUsersCache = [];
        updateUI();
        alert(`✅ تم الإصلاح!\nإجمالي المسافة: ${tDist} كم`);
    } catch(e) { alert("خطأ: " + e.message); }
    finally { if(btn) btn.innerText = "إصلاح العدادات"; }
}

// ==================== 7. Activities & Feed ====================
function openNewRun() {
    editingRunId = null; editingOldDist = 0;
    document.getElementById('log-dist').value = '';
    document.getElementById('log-time').value = '';
    document.getElementById('save-run-btn').innerText = "حفظ النشاط";
    openLogModal();
}

async function submitRun() {
    const dist = parseFloat(document.getElementById('log-dist').value);
    const time = parseFloat(document.getElementById('log-time').value);
    const type = document.getElementById('log-type').value;
    const link = document.getElementById('log-link').value;
    const dateInput = document.getElementById('log-date').value;
    
    if(!dist || !time) return alert("أدخل البيانات");
    const btn = document.getElementById('save-run-btn');
    btn.innerText = "جاري الحفظ..."; btn.disabled = true;

    try {
        const date = new Date(dateInput);
        const ts = firebase.firestore.Timestamp.fromDate(date);
        
        if(editingRunId) {
            const diff = dist - editingOldDist;
            await db.collection('users').doc(currentUser.uid).collection('runs').doc(editingRunId).update({dist, time, type, link});
            await db.collection('users').doc(currentUser.uid).update({
                totalDist: firebase.firestore.FieldValue.increment(diff),
                monthDist: firebase.firestore.FieldValue.increment(diff)
            });
            alert("تم التعديل");
        } else {
            await db.collection('users').doc(currentUser.uid).collection('runs').add({dist, time, type, link, date: date.toISOString(), timestamp: ts});
            await db.collection('activity_feed').add({uid: currentUser.uid, userName: userData.name, userRegion: userData.region, dist, time, type, link, timestamp: ts, likes: [], commentsCount: 0});
            await db.collection('users').doc(currentUser.uid).update({
                totalDist: firebase.firestore.FieldValue.increment(dist),
                totalRuns: firebase.firestore.FieldValue.increment(1),
                monthDist: firebase.firestore.FieldValue.increment(dist)
            });
            userData.totalDist += dist; userData.totalRuns += 1; userData.monthDist += dist;
            alert("تم الحفظ");
        }
        allUsersCache = []; // Reset Leaderboard Cache
        closeModal('modal-log');
        updateUI(); loadGlobalFeed(); loadActivityLog();
    } catch(e) { alert("خطأ: " + e.message); }
    finally { btn.innerText = "حفظ النشاط"; btn.disabled = false; }
}

window.editRun = function(id, d, t, ty, l) {
    editingRunId = id; editingOldDist = d;
    document.getElementById('log-dist').value = d;
    document.getElementById('log-time').value = t;
    document.getElementById('log-type').value = ty;
    document.getElementById('log-link').value = l || '';
    document.getElementById('save-run-btn').innerText = "تعديل النشاط";
    openLogModal();
}

async function deleteRun(id, dist) {
    if(confirm("حذف؟")) {
        await db.collection('users').doc(currentUser.uid).collection('runs').doc(id).delete();
        await db.collection('users').doc(currentUser.uid).update({
            totalDist: firebase.firestore.FieldValue.increment(-dist),
            totalRuns: firebase.firestore.FieldValue.increment(-1),
            monthDist: firebase.firestore.FieldValue.increment(-dist)
        });
        userData.totalDist = Math.max(0, userData.totalDist - dist);
        userData.totalRuns = Math.max(0, userData.totalRuns - 1);
        allUsersCache = [];
        updateUI(); loadActivityLog();
    }
}

function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if(!list) return;
    db.collection('users').doc(currentUser.uid).collection('runs').orderBy('timestamp','desc').limit(30).onSnapshot(s => {
        if(s.empty) { list.innerHTML = "<div style='text-align:center; padding:20px; color:#6b7280'>ابدأ الجري!</div>"; return; }
        let h = '';
        s.forEach(d => {
            const r = d.data();
            const date = r.timestamp ? r.timestamp.toDate().toLocaleDateString('ar-EG') : '';
            h += `<div class="log-row-compact"><div class="log-col-main"><strong>${r.dist} كم</strong> <small>${r.type}</small></div><div class="log-col-meta">${date}</div><div class="log-col-actions"><button class="btn-mini-action btn-share" onclick="generateShareCard('${r.dist}','${r.time}')"><i class="ri-share-forward-line"></i></button><button class="btn-mini-action" onclick="editRun('${d.id}',${r.dist},${r.time},'${r.type}','${r.link}')"><i class="ri-pencil-line"></i></button><button class="btn-mini-action btn-del" onclick="deleteRun('${d.id}',${r.dist})"><i class="ri-delete-bin-line"></i></button></div></div>`;
        });
        list.innerHTML = h;
    });
}

function loadGlobalFeed() {
    const list = document.getElementById('global-feed-list');
    if(!list) return;
    db.collection('activity_feed').orderBy('timestamp','desc').limit(20).onSnapshot(s => {
        if(s.empty) { list.innerHTML = "<div style='text-align:center; padding:10px; color:#6b7280'>لا يوجد نشاط</div>"; return; }
        let h = '';
        s.forEach(d => {
            const p = d.data();
            const liked = p.likes && p.likes.includes(currentUser.uid) ? 'liked' : '';
            const comments = p.commentsCount || 0;
            h += `<div class="feed-card-compact"><div class="feed-compact-content"><div class="feed-compact-avatar">${p.userName.charAt(0)}</div><div><div class="feed-compact-text"><strong>${p.userName}</strong> (${p.userRegion})</div><div class="feed-compact-text">${p.type} <span style="color:#10b981">${p.dist} كم</span></div></div></div><div class="feed-compact-action"><button class="feed-compact-btn ${liked}" onclick="toggleLike('${d.id}','${p.uid}')"><i class="ri-heart-${liked?'fill':'line'}"></i> ${p.likes?p.likes.length:''}</button><button class="feed-compact-btn" onclick="openComments('${d.id}','${p.uid}')" style="margin-right:10px;"><i class="ri-chat-3-line"></i> ${comments>0?comments:''}</button></div></div>`;
        });
        list.innerHTML = h;
    });
}

// الدوال المساعدة (توليد الصور، التعليقات، اللايكات) موجودة واختصرتها لعدم الإطالة، تأكد أنها موجودة في ملفك.
// ... (GenerateShareCard, ToggleLike, OpenComments, etc...)
// لقد دمجت الأساسيات، إذا كانت هناك دوال أخرى (مثل loadLeaderboard) تأكد من وجودها.
// هذا الملف يحتوي على التعديلات الجوهرية (التحديث الذكي + التثبيت).
