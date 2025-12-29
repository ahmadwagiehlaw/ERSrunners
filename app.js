/* ERS Runners - V33 (Restored Full Features + Smart System) */

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

// === متغيرات النظام ===
let currentUser = null;
let userData = {};
let isSignupMode = false;
let editingRunId = null;
let editingOldDist = 0;
let allUsersCache = []; 
let currentPostId = null; // للتعليقات

// متغيرات النظام الذكي
let deferredPrompt; 
let latestServerVersion = null;
const CURRENT_VERSION = "1.0"; // ⚠️ غير هذا الرقم يدوياً عند كل تحديث

// ==================== 1. تهيئة التطبيق (Init) ====================
function initApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    
    // ضبط التاريخ
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const dateInput = document.getElementById('log-date');
    if(dateInput) dateInput.value = now.toISOString().slice(0,16);

    // تشغيل الموديولات
    updateUI();
    loadActivityLog();
    loadActiveChallenges(); 
    loadGlobalFeed();
    listenForNotifications();
    if(typeof loadWeeklyChart === 'function') loadWeeklyChart();
    if(typeof checkAnnouncements === 'function') checkAnnouncements(); // لو أضفت التنويهات

    // 🚀 تشغيل الأنظمة الذكية
    checkAppVersion();
    checkInstallPrompt();
}

// ==================== 2. النظام الذكي (تحديث + تثبيت) 🧠 ====================
async function checkAppVersion() {
    try {
        const doc = await db.collection('system').doc('config').get();
        if (doc.exists) {
            latestServerVersion = doc.data().version;
            const acknowledgedVersion = localStorage.getItem('last_acknowledged_version');

            if (latestServerVersion && 
                latestServerVersion !== CURRENT_VERSION && 
                latestServerVersion !== acknowledgedVersion) {
                console.log(`Update available: ${latestServerVersion}`);
                document.getElementById('modal-update').style.display = 'flex';
            }
        }
    } catch (e) { console.error("Version Check Error:", e); }
}

function performUpdate() {
    if(latestServerVersion) {
        localStorage.setItem('last_acknowledged_version', latestServerVersion);
    }
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
            for(let r of regs) r.unregister();
        });
    }
    window.location.reload(true);
}

// تثبيت التطبيق
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

function checkInstallPrompt() {
    if (!localStorage.getItem('install_dismissed')) {
        setTimeout(() => {
            if (deferredPrompt) document.getElementById('modal-install').style.display = 'flex';
        }, 5000);
    }
}

document.addEventListener('click', async (e) => {
    if(e.target && e.target.id === 'btn-install-app') {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
        }
        document.getElementById('modal-install').style.display = 'none';
    }
});

function closeInstallModal() {
    document.getElementById('modal-install').style.display = 'none';
    localStorage.setItem('install_dismissed', 'true');
}

// ==================== 3. المصادقة (Auth) ====================
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
        if(activeBtn) { activeBtn.innerText = isSignupMode ? "إنشاء حساب" : "دخول"; activeBtn.disabled = false; }
    }
}

function logout() { if(confirm("خروج؟")) { auth.signOut(); window.location.reload(); } }

// ==================== 4. الواجهة والمنطق (UI Logic) ====================
function updateUI() {
    try {
        if(document.getElementById('headerName')) document.getElementById('headerName').innerText = userData.name;
        document.getElementById('monthDist').innerText = (userData.monthDist || 0).toFixed(1);
        document.getElementById('totalRuns').innerText = userData.totalRuns || 0;

        const rankData = calculateRank(userData.totalDist || 0);
        
        // شارة الرتبة
        const rBadge = document.getElementById('userRankBadge');
        if(rBadge) { rBadge.innerText = rankData.name; rBadge.className = `rank-badge ${rankData.class}`; }
        
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
        renderBadges();
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
    return { name: current.name, class: current.class, avatar: current.avatar, nextTarget: current.next, remaining: current.next - totalDist, percentage: perc, distInLevel: distIn, distRequired: distReq };
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

// ==================== 5. إصلاح العدادات (Fix Stats) ====================
async function fixMyStats() {
    if(!confirm("⚠️ إعادة حساب إجمالي المسافات بدقة.. هل تريد المتابعة؟")) return;
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
        allUsersCache = [];
        updateUI();
        alert(`✅ تم الإصلاح!\nإجمالي المسافة: ${tDist} كم`);
    } catch(e) { alert("خطأ: " + e.message); }
    finally { if(btn) btn.innerText = "إصلاح العدادات"; }
}

// ==================== 6. الأنشطة والسجل (Activities) ====================
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
            await checkNewBadges(dist, time, date);
            alert("تم الحفظ");
        }
        allUsersCache = []; 
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

// ==================== 7. الفريق والتعليقات (Restored!) ====================
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
            // حساب الوقت المنقضي
            let timeAgo = "الآن";
            if(p.timestamp) {
                const diff = (new Date() - p.timestamp.toDate()) / 60000;
                if(diff < 60) timeAgo = `${Math.floor(diff)} د`;
                else if(diff < 1440) timeAgo = `${Math.floor(diff/60)} س`;
                else timeAgo = `${Math.floor(diff/1440)} يوم`;
            }

            h += `
            <div class="feed-card-compact">
                <div class="feed-compact-content">
                    <div class="feed-compact-avatar">${p.userName.charAt(0)}</div>
                    <div>
                        <div class="feed-compact-text"><strong>${p.userName}</strong> (${p.userRegion})</div>
                        <div class="feed-compact-text">${p.type} <span style="color:#10b981; font-weight:bold;">${p.dist} كم</span></div>
                    </div>
                </div>
                <div class="feed-compact-action">
                    ${p.link ? `<a href="${p.link}" target="_blank" style="text-decoration:none; color:#3b82f6;"><i class="ri-link"></i></a>` : ''}
                    <button class="feed-compact-btn ${liked}" onclick="toggleLike('${d.id}','${p.uid}')">
                        <i class="ri-heart-${liked?'fill':'line'}"></i> <span class="feed-compact-count">${p.likes?p.likes.length:''}</span>
                    </button>
                    <button class="feed-compact-btn" onclick="openComments('${d.id}','${p.uid}')" style="margin-right:8px;">
                        <i class="ri-chat-3-line"></i> <span class="feed-compact-count">${comments>0?comments:''}</span>
                    </button>
                    <span class="feed-compact-meta" style="margin-right:5px;">${timeAgo}</span>
                </div>
            </div>`;
        });
        list.innerHTML = h;
    });
}

// دوال التعليقات واللايكات المفقودة (تمت إعادتها)
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

function openComments(pid, uid) {
    currentPostId = pid;
    document.getElementById('modal-comments').style.display = 'flex';
    document.getElementById('comment-text').value = '';
    loadComments(pid);
}

function loadComments(pid) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '<div style="text-align:center;">تحميل...</div>';
    db.collection('activity_feed').doc(pid).collection('comments').orderBy('timestamp','asc').onSnapshot(s => {
        let h = '';
        if(s.empty) { list.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.5;">كن أول من يعلق</div>'; return; }
        s.forEach(d => {
            const c = d.data();
            h += `<div class="comment-item"><div class="comment-avatar">${c.userName.charAt(0)}</div><div class="comment-bubble"><span class="comment-user">${c.userName}</span><span class="comment-msg">${c.text}</span></div></div>`;
        });
        list.innerHTML = h;
        list.scrollTop = list.scrollHeight;
    });
}

async function sendComment() {
    const t = document.getElementById('comment-text').value;
    if(t && currentPostId) {
        await db.collection('activity_feed').doc(currentPostId).collection('comments').add({
            text: t, userId: currentUser.uid, userName: userData.name, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('activity_feed').doc(currentPostId).update({ commentsCount: firebase.firestore.FieldValue.increment(1) });
        document.getElementById('comment-text').value = '';
    }
}

// ==================== 8. المتصدرين والتحديات (Restored!) ====================
async function loadLeaderboard(filterType = 'all') {
    const list = document.getElementById('leaderboard-list');
    const podiumContainer = document.getElementById('podium-container');
    const teamTotalEl = document.getElementById('teamTotalDisplay');
    const teamBar = document.getElementById('teamGoalBar');

    if (!list) return;

    if (allUsersCache.length === 0) {
        const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(50).get();
        allUsersCache = [];
        snap.forEach(doc => allUsersCache.push(doc.data()));
    }

    let displayUsers = allUsersCache;
    if (filterType === 'region') displayUsers = allUsersCache.filter(u => u.region === userData.region);

    // إجمالي الفريق
    let teamTotal = 0;
    displayUsers.forEach(u => teamTotal += (u.totalDist || 0));
    if(teamTotalEl) teamTotalEl.innerText = teamTotal.toFixed(0);
    if(teamBar) {
        let perc = Math.min((teamTotal / 1000) * 100, 100);
        teamBar.style.width = `${perc}%`;
    }

    // المنصة
    if (podiumContainer) {
        let podiumHtml = '';
        const u1 = displayUsers[0], u2 = displayUsers[1], u3 = displayUsers[2];
        if(u2) podiumHtml += createPodiumItem(u2, 2);
        if(u1) podiumHtml += createPodiumItem(u1, 1);
        if(u3) podiumHtml += createPodiumItem(u3, 3);
        podiumContainer.innerHTML = podiumHtml || '<div style="font-size:12px;">لا يوجد أبطال</div>';
    }

    // القائمة
    list.innerHTML = '';
    const restUsers = displayUsers.slice(3);
    restUsers.forEach((u, index) => {
        const isMe = (u.name === userData.name) ? 'border:1px solid #10b981; background:rgba(16,185,129,0.1);' : '';
        list.innerHTML += `<div class="leader-row" style="${isMe}"><div class="rank-col">#${index+4}</div><div class="info-col">${u.name} <small>(${u.region})</small></div><div class="dist-col">${(u.totalDist||0).toFixed(1)}</div></div>`;
    });
}

function createPodiumItem(u, r) {
    let crown = r===1 ? '<div class="crown-icon">👑</div>' : '';
    return `<div class="podium-item rank-${r}">${crown}<div class="podium-avatar">${u.name.charAt(0)}</div><div class="podium-name">${u.name}</div><div class="podium-dist">${u.totalDist.toFixed(1)}</div></div>`;
}

function filterLeaderboard(t) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(event.target) event.target.classList.add('active');
    loadLeaderboard(t);
}

function loadRegionBattle() {
    const list = document.getElementById('region-battle-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center;">جاري الحساب...</div>';
    db.collection('users').get().then(snap => {
        let regionMap = {};
        snap.forEach(doc => {
            const u = doc.data();
            if(u.region) { if (!regionMap[u.region]) regionMap[u.region] = 0; regionMap[u.region] += (u.totalDist || 0); }
        });
        const sorted = Object.keys(regionMap).map(k => ({ n: k, t: regionMap[k] })).sort((a, b) => b.t - a.t);
        list.innerHTML = '';
        const max = sorted[0]?.t || 1; 
        sorted.forEach((r, i) => {
            const p = (r.t / max) * 100;
            list.innerHTML += `<div class="squad-card"><div class="squad-header"><span>#${i+1} ${r.n}</span><span>${r.t.toFixed(0)} كم</span></div><div class="squad-bar-bg"><div class="squad-bar-fill" style="width:${p}%"></div></div></div>`;
        });
    });
}

// ==================== 9. الميزات المساعدة (Charts, Admin, Notifications) ====================
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
              html += `<div class="chart-column"><span class="bar-tooltip">${day.dist.toFixed(1)}</span><div class="bar-bg"><div class="bar-fill ${barClass}" style="height: ${heightPerc}%"></div></div><span class="bar-label">${day.dayName}</span></div>`;
          });
          chartDiv.innerHTML = html;
      });
}

// الإشعارات
function loadNotifications() {
    const list = document.getElementById('notifications-list');
    db.collection('users').doc(currentUser.uid).collection('notifications').orderBy('timestamp','desc').limit(10).get().then(snap => {
        let html = '';
        snap.forEach(d => { html += `<div class="notif-item"><div class="notif-content">${d.data().msg}</div></div>`; d.ref.update({read:true}); });
        list.innerHTML = html || '<div style="text-align:center; padding:10px;">لا يوجد إشعارات</div>';
    });
}
function listenForNotifications() {
    if(!currentUser) return;
    db.collection('users').doc(currentUser.uid).collection('notifications').where('read','==',false).onSnapshot(s => {
        if(!s.empty) document.getElementById('notif-dot').classList.add('active');
    });
}
async function sendNotification(rid, msg) {
    try { await db.collection('users').doc(rid).collection('notifications').add({ msg, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp() }); } catch(e) {}
}

// الأدمن
function openAdminAuth() {
    const pin = prompt("كود المشرف:");
    if(pin === "1234") { closeModal('modal-settings'); setTimeout(() => { switchView('admin'); loadAdminStats(); loadAdminFeed(); }, 100); } 
    else alert("خطأ");
}
function loadAdminFeed() {
    const list = document.getElementById('admin-feed-list');
    db.collection('activity_feed').orderBy('timestamp','desc').limit(10).get().then(s => {
        let h = ''; s.forEach(d => {
            const data = d.data();
            h += `<div class="admin-feed-item"><div class="admin-feed-info"><strong>${data.userName}</strong> ${data.dist} كم</div><button class="btn-admin-del" onclick="adminDelete('${d.id}')">حذف</button></div>`;
        });
        list.innerHTML = h;
    });
}
async function adminDelete(id) { await db.collection('activity_feed').doc(id).delete(); alert("حذف"); loadAdminFeed(); loadGlobalFeed(); }
function loadAdminStats() {
    const statsDiv = document.getElementById('admin-stats');
    db.collection('users').get().then(snap => { statsDiv.innerHTML = `الأعضاء: ${snap.size}`; });
}
async function createChallengeUI() {
    const t = document.getElementById('admin-ch-title').value;
    const target = document.getElementById('admin-ch-target').value;
    await db.collection('challenges').add({title:t, target:parseFloat(target), active:true, startDate: new Date().toISOString()});
    alert("تم");
}

// مشاركة الصور
function generateShareCard(dist, time) {
    document.getElementById('share-name').innerText = userData.name;
    const r = calculateRank(userData.totalDist);
    document.getElementById('share-rank').innerText = r.name;
    document.getElementById('share-avatar').innerText = r.avatar;
    document.getElementById('share-dist').innerText = dist;
    document.getElementById('share-time').innerText = time + "m";
    document.getElementById('share-pace').innerText = (time/dist).toFixed(1) + "/km";
    document.getElementById('modal-share').style.display = 'flex';
    document.getElementById('final-share-img').style.display = 'none';
    setTimeout(() => {
        html2canvas(document.getElementById('capture-area'), { backgroundColor: null, scale: 2 }).then(canvas => {
            document.getElementById('final-share-img').src = canvas.toDataURL("image/png");
            document.getElementById('final-share-img').style.display = 'block';
        });
    }, 100);
}

// تحديث الكوتش
function updateCoachAdvice() {
    const msgEl = document.getElementById('coach-message');
    if(!msgEl) return;
    const dist = userData.totalDist || 0;
    const hour = new Date().getHours();
    let m = "استمر في الجري!";
    if(dist < 10) m = "بداية موفقة! اكسر حاجز الـ 10 كم.";
    else if(hour < 9) m = "صباح النشاط! ☀️";
    else if(hour > 20) m = "جرية مسائية؟ فكرة رائعة 🌙";
    msgEl.innerText = m;
}

// إدارة التحديات
function loadActiveChallenges() {
    const list = document.getElementById('challenges-list');
    const mini = document.getElementById('my-active-challenges');
    if(!list) return;
    db.collection('challenges').where('active','==',true).get().then(async snap => {
        if(snap.empty) { list.innerHTML = "<div style='text-align:center;'>لا يوجد تحديات</div>"; mini.innerHTML="<div class='empty-state-mini'>لا تحديات</div>"; return; }
        let h = '', mh = '';
        for(const doc of snap.docs) {
            const ch = doc.data();
            let joined = false, prog = 0;
            if(currentUser) {
                const p = await doc.ref.collection('participants').doc(currentUser.uid).get();
                if(p.exists) { joined = true; prog = p.data().progress || 0; }
            }
            const perc = Math.min((prog/ch.target)*100, 100);
            h += `<div class="challenge-card"><h3>${ch.title} <small>${ch.target} كم</small></h3>${joined ? `<div class="xp-track"><div class="xp-fill" style="width:${perc}%"></div></div>` : `<button onclick="joinChallenge('${doc.id}')">انضمام</button>`}</div>`;
            if(joined) mh += `<div class="mini-challenge-card"><div class="mini-ch-title">${ch.title}</div><div class="mini-ch-progress"><div class="mini-ch-fill" style="width:${perc}%"></div></div></div>`;
        }
        list.innerHTML = h; mini.innerHTML = mh || "<div class='empty-state-mini'>لم تنضم لتحديات</div>";
    });
}
window.joinChallenge = async function(id) {
    if(confirm("انضمام؟")) {
        await db.collection('challenges').doc(id).collection('participants').doc(currentUser.uid).set({
            progress: 0, name: userData.name, region: userData.region
        });
        alert("تم الانضمام"); loadActiveChallenges();
    }
}

// أوسمة وبادجات
const BADGES = [
    { id: 'first_step', name: 'الانطلاقة', icon: '🚀' },
    { id: 'club_100', name: 'نادي المئة', icon: '💎' }
];
async function checkNewBadges(d, t, date) {
    let earned = [];
    if(!userData.badges.includes('first_step')) earned.push('first_step');
    if(userData.totalDist >= 100 && !userData.badges.includes('club_100')) earned.push('club_100');
    if(earned.length > 0) {
        await db.collection('users').doc(currentUser.uid).update({ badges: firebase.firestore.FieldValue.arrayUnion(...earned) });
        alert("🎉 مبروك! وسام جديد");
    }
}
function renderBadges() {
    const grid = document.getElementById('badges-grid');
    if(!grid) return;
    let h = '';
    BADGES.forEach(b => {
        const unlocked = userData.badges.includes(b.id);
        h += `<div class="badge-item ${unlocked?'unlocked':'locked'}"><span class="badge-icon">${b.icon}</span><span class="badge-name">${b.name}</span></div>`;
    });
    grid.innerHTML = h;
}

// Helpers
function openLogModal() { document.getElementById('modal-log').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function openSettingsModal() { document.getElementById('modal-settings').style.display='flex'; }
function showNotifications() { document.getElementById('modal-notifications').style.display='flex'; document.getElementById('notif-dot').classList.remove('active'); loadNotifications(); }
function openEditProfile() { document.getElementById('modal-edit-profile').style.display='flex'; }
async function saveProfileChanges() {
    const n = document.getElementById('edit-name').value;
    const r = document.getElementById('edit-region').value;
    if(n) {
        await db.collection('users').doc(currentUser.uid).update({ name: n, region: r });
        userData.name = n; userData.region = r;
        updateUI(); closeModal('modal-edit-profile'); alert("تم الحفظ");
    }
}
function switchView(id) {
    document.querySelectorAll('.view').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    document.getElementById('view-'+id).classList.add('active');
    // Active Nav Logic Simplified
    if(id === 'home') document.querySelectorAll('.nav-item')[0].classList.add('active');
    if(id === 'challenges') document.querySelectorAll('.nav-item')[1].classList.add('active');
    if(id === 'profile') document.querySelectorAll('.nav-item')[2].classList.add('active');
}
function setTab(t) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.getElementById('tab-'+t).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(e => e.classList.remove('active'));
    if(event.target) event.target.classList.add('active');
    if(t === 'leaderboard') loadLeaderboard('all');
    if(t === 'squads') loadRegionBattle();
    if(t === 'active-challenges') loadActiveChallenges();
}
function forceUpdateApp() { if(confirm("تحديث؟")) performUpdate(); }
async function deleteFullAccount() { if(confirm("حذف؟")) { await db.collection('users').doc(currentUser.uid).delete(); await currentUser.delete(); window.location.reload(); } }
async function setPersonalGoal() { 
    const g = prompt("هدفك الشهري (كم):", userData.monthlyGoal||0); 
    if(g) { await db.collection('users').doc(currentUser.uid).update({monthlyGoal: parseFloat(g)}); userData.monthlyGoal=parseFloat(g); updateUI(); }
}
