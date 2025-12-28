/* ERS Runners - V1.9 (Final Polish) */

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

// ==================== 1. Auth & Init ====================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                userData = doc.data();
                initApp();
            } else {
                userData = { name: "Runner", region: "Cairo", totalDist: 0, totalRuns: 0 };
                initApp();
            }
        } catch (e) { console.error("Auth Error:", e); }
    } else {
        currentUser = null;
        showAuthScreen();
    }
});

function initApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    updateUI();
    loadActivityLog();
    loadActiveChallenges(); 
    loadGlobalFeed();
    listenForNotifications();
}

// ==================== 2. UI Updates ====================
function updateUI() {
    try {
        const headerName = document.getElementById('headerName');
        const helloText = document.querySelector('.hello-text');
        
        if(helloText) helloText.innerText = "أهلاً كابتن👋"; 
        if (headerName) headerName.innerText = userData.name || "Runner";

        // Dashboard Stats
        const monthDistEl = document.getElementById('monthDist');
        const totalRunsEl = document.getElementById('totalRuns');
        if (monthDistEl) monthDistEl.innerText = (userData.monthDist || 0).toFixed(1);
        if (totalRunsEl) totalRunsEl.innerText = userData.totalRuns || 0;

        // Profile Stats
        const profileName = document.getElementById('profileName');
        const profileRegion = document.getElementById('profileRegion');
        const profileAvatar = document.getElementById('profileAvatar');
        const pTotalDist = document.getElementById('profileTotalDist');
        const pTotalRuns = document.getElementById('profileTotalRuns');

        if (profileName) profileName.innerText = userData.name;
        if (profileRegion) profileRegion.innerText = userData.region;
        if (profileAvatar) profileAvatar.innerText = (userData.name || "U").charAt(0);
        if (pTotalDist) pTotalDist.innerText = (userData.totalDist || 0).toFixed(1);
        if (pTotalRuns) pTotalRuns.innerText = userData.totalRuns || 0;

        // Rank Calculation
        const totalDist = userData.totalDist || 0;
        const rankData = calculateRank(totalDist);

        const rankBadge = document.getElementById('userRankBadge');
        const nextLevelDist = document.getElementById('nextLevelDist');
        const xpText = document.getElementById('xpText');
        const xpPerc = document.getElementById('xpPerc');
        const xpMessage = document.getElementById('xpMessage');
        const xpBar = document.getElementById('xpBar');
        const rankIcon = document.getElementById('rankIcon');

        if(rankBadge) {
            rankBadge.innerText = rankData.name;
            rankBadge.className = `rank-badge ${rankData.class}`;
        }
        if(rankIcon) rankIcon.className = `ri-medal-fill ${rankData.class}`;
        if(nextLevelDist) nextLevelDist.innerText = rankData.remaining.toFixed(1);
        
        if(xpBar) {
            xpBar.style.width = `${rankData.percentage}%`;
            xpBar.style.backgroundColor = `var(--rank-color)`;
            xpBar.parentElement.className = `xp-track ${rankData.class}`;
        }
        if(xpText) xpText.innerText = `${rankData.distInLevel.toFixed(1)} / ${rankData.distRequired} كم`;
        if(xpPerc) xpPerc.innerText = `${Math.floor(rankData.percentage)}%`;
        if(xpMessage) xpMessage.innerText = rankData.name === "أسطورة" ? "أنت الملك!" : `باقي ${rankData.remaining.toFixed(1)} كم للوصول لمستوى ${getNextRankName(rankData.name)}`;

        // Goal Ring
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
                
                if(remaining == 0) {
                    goalSub.innerText = "أنت أسطورة! 🎉";
                    goalSub.style.color = "#10b981";
                } else {
                    goalSub.innerText = `باقي ${remaining} كم`;
                    goalSub.style.color = "#a78bfa";
                }
                goalRing.style.background = `conic-gradient(#8b5cf6 ${deg}deg, rgba(255,255,255,0.1) 0deg)`;
            }
        }
    } catch (error) { console.error("UI Update Error:", error); }
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
    return { name: currentLevel.name, class: currentLevel.class, nextTarget: currentLevel.next, remaining: currentLevel.next - totalDist, percentage: percentage, distInLevel: distInLevel, distRequired: distRequired };
}

function getNextRankName(current) {
    if(current === "مبتدئ") return "هاوي"; if(current === "هاوي") return "عداء";
    if(current === "عداء") return "محترف"; if(current === "محترف") return "أسطورة"; return "";
}

renderBadges(); 
}
// ==================== 9. نظام الأوسمة (The Trophy Cabinet) ====================

// تعريف الأوسمة وشروطها
const BADGES_CONFIG = [
    { id: 'first_step', name: 'الانطلاقة', icon: '🚀', desc: 'أول نشاط لك في التطبيق' },
    { id: 'early_bird', name: 'طائر الصباح', icon: '🌅', desc: 'نشاط بين 5 و 8 صباحاً' },
    { id: 'night_owl', name: 'ساهر الليل', icon: '🌙', desc: 'نشاط بعد 10 مساءً' },
    { id: 'weekend_warrior', name: 'بطل العطلة', icon: '🎉', desc: 'نشاط يوم الجمعة' },
    { id: 'half_marathon', name: 'نصف ماراثون', icon: '🔥', desc: 'جرية واحدة +20 كم' },
    { id: 'club_100', name: 'نادي المئة', icon: '💎', desc: 'إجمالي مسافة 100 كم' },
    { id: 'club_500', name: 'المحترف', icon: '👑', desc: 'إجمالي مسافة 500 كم' },
    { id: 'sprinter', name: 'السرعة القصوى', icon: '⚡', desc: 'جرية سريعة (زمن قليل)' } // مثال
];

// دالة فحص الجوائز (تُستدعى بعد كل جرية)
async function checkNewBadges(currentRunDist, currentRunTime) {
    const myBadges = userData.badges || []; // الأوسمة التي أملكها حالياً
    let newBadgesEarned = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 5 = الجمعة

    // 1. وسام الانطلاقة (أول مرة يجري)
    if (!myBadges.includes('first_step')) {
        newBadgesEarned.push('first_step');
    }

    // 2. طائر الصباح (بين 5 و 8 صباحاً)
    if (!myBadges.includes('early_bird') && currentHour >= 5 && currentHour <= 8) {
        newBadgesEarned.push('early_bird');
    }

    // 3. ساهر الليل (بعد 10 مساءً)
    if (!myBadges.includes('night_owl') && (currentHour >= 22 || currentHour <= 3)) {
        newBadgesEarned.push('night_owl');
    }

    // 4. بطل العطلة (الجمعة)
    if (!myBadges.includes('weekend_warrior') && currentDay === 5) {
        newBadgesEarned.push('weekend_warrior');
    }

    // 5. نصف ماراثون (20 كم في مرة واحدة)
    if (!myBadges.includes('half_marathon') && currentRunDist >= 20) {
        newBadgesEarned.push('half_marathon');
    }

    // 6. نادي المئة (تراكمي)
    // ملاحظة: userData.totalDist تم تحديثه بالفعل في submitRun
    if (!myBadges.includes('club_100') && userData.totalDist >= 100) {
        newBadgesEarned.push('club_100');
    }
    
    // 7. نادي 500
    if (!myBadges.includes('club_500') && userData.totalDist >= 500) {
        newBadgesEarned.push('club_500');
    }

    // حفظ الجوائز الجديدة
    if (newBadgesEarned.length > 0) {
        // تحديث قاعدة البيانات
        await db.collection('users').doc(currentUser.uid).update({
            badges: firebase.firestore.FieldValue.arrayUnion(...newBadgesEarned)
        });

        // تحديث اللوكل
        if(!userData.badges) userData.badges = [];
        userData.badges.push(...newBadgesEarned);

        // إظهار احتفال للمستخدم 🎉
        const badgeNames = newBadgesEarned.map(b => BADGES_CONFIG.find(x => x.id === b).name).join(" و ");
        alert(`🎉 مبروووك! لقد فتحت إنجازاً جديداً:\n\n✨ ${badgeNames} ✨\n\nاستمر يا بطل!`);
    }
}

// دالة عرض الأوسمة في البروفايل (تحديث لـ updateUI)
function renderBadges() {
    const grid = document.getElementById('badges-grid');
    if(!grid) return;

    const myBadges = userData.badges || [];
    let html = '';

    BADGES_CONFIG.forEach(badge => {
        const isUnlocked = myBadges.includes(badge.id);
        const lockClass = isUnlocked ? 'unlocked' : '';
        const title = isUnlocked ? badge.desc : 'مغلق'; // تلميح يظهر عند اللمس

        html += `
            <div class="badge-item ${lockClass}" title="${title}" onclick="if(this.classList.contains('unlocked')) alert('${badge.desc}')">
                <span class="badge-icon">${badge.icon}</span>
                <span class="badge-name">${badge.name}</span>
            </div>
        `;
    });

    grid.innerHTML = html;
}
// ==================== 3. Core Features ====================
async function submitRun() {
    const btn = document.getElementById('save-run-btn');
    const dist = parseFloat(document.getElementById('log-dist').value);
    const time = parseFloat(document.getElementById('log-time').value);
    const type = document.getElementById('log-type').value;
    const link = document.getElementById('log-link').value;

    if (!dist || !time) return alert("البيانات ناقصة");
    if(btn) { btn.innerText = "جاري الحفظ..."; btn.disabled = true; }

    try {
        const uid = currentUser.uid;
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        const currentMonthKey = new Date().toISOString().slice(0, 7); 
        let newMonthDist = (userData.monthDist || 0) + dist;
        if(userData.lastMonthKey !== currentMonthKey) { newMonthDist = dist; }

        const runData = { dist, time, type, link, date: new Date().toISOString(), timestamp };

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

        // Update Challenges
        const activeCh = await db.collection('challenges').where('active', '==', true).get();
        const batch = db.batch();
        activeCh.forEach(doc => {
            batch.set(doc.ref.collection('participants').doc(uid), {
                progress: firebase.firestore.FieldValue.increment(dist),
                lastUpdate: timestamp, name: userData.name, region: userData.region
            }, { merge: true });
        });
        await batch.commit();

        userData.totalDist += dist; userData.totalRuns += 1;
        userData.monthDist = newMonthDist; userData.lastMonthKey = currentMonthKey;
        await checkNewBadges(dist, time);
        alert("تم الحفظ!");
        closeModal('modal-log');
        document.getElementById('log-dist').value = '';
        document.getElementById('log-time').value = '';
        document.getElementById('log-link').value = '';
        updateUI(); loadGlobalFeed(); loadActivityLog();

    } catch (error) { alert("خطأ: " + error.message); } 
    finally { if(btn) { btn.innerText = "حفظ النشاط"; btn.disabled = false; } }
}

async function setPersonalGoal() {
    const newGoal = prompt("حددي هدفك لهذا الشهر (كم):", userData.monthlyGoal || 0);
    if(newGoal && newGoal > 0) {
        await db.collection('users').doc(currentUser.uid).update({ monthlyGoal: parseFloat(newGoal) });
        userData.monthlyGoal = parseFloat(newGoal);
        updateUI();
    }
}

// ==================== 4. Feed (New Compact Design) ====================
function loadGlobalFeed() {
    const list = document.getElementById('global-feed-list');
    if(!list) return;

    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
        let html = '';
        if(snap.empty) { list.innerHTML = '<div style="text-align:center; font-size:12px; color:#6b7280;">لا توجد أنشطة</div>'; return; }
        
        snap.forEach(doc => {
            const p = doc.data();
            const isLiked = p.likes && p.likes.includes(currentUser.uid);
            
            let timeAgo = "الآن";
            if(p.timestamp) {
                const diff = (new Date() - p.timestamp.toDate()) / 60000;
                if(diff < 60) timeAgo = `${Math.floor(diff)} د`;
                else if(diff < 1440) timeAgo = `${Math.floor(diff/60)} س`;
                else timeAgo = `${Math.floor(diff/1440)} يوم`;
            }

            html += `
            <div class="feed-card-compact">
                <div class="feed-compact-content">
                    <div class="feed-compact-avatar">${(p.userName||"?").charAt(0)}</div>
                    <div>
                        <div class="feed-compact-text">
                            <strong>${p.userName}</strong> 
                            <span style="opacity:0.7">(${p.userRegion})</span>
                        </div>
                        <div class="feed-compact-text" style="margin-top:2px;">
                            ${p.type === 'Run' ? 'جري' : p.type} <span style="color:#10b981; font-weight:bold;">${p.dist} كم</span>
                        </div>
                    </div>
                </div>
                
                <div class="feed-compact-action">
                    ${p.link ? `<a href="${p.link}" target="_blank" style="text-decoration:none; color:#3b82f6; font-size:14px;"><i class="ri-link"></i></a>` : ''}
                    <button class="feed-compact-btn ${isLiked?'liked':''}" onclick="toggleLike('${doc.id}', '${p.uid}')">
                        <i class="${isLiked?'ri-heart-fill':'ri-heart-line'}"></i>
                        <span class="feed-compact-count">${(p.likes||[]).length || ''}</span>
                    </button>
                    <span class="feed-compact-meta" style="margin-right:5px;">${timeAgo}</span>
                </div>
            </div>`;
        });
        list.innerHTML = html;
    });
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

// ==================== 5. Navigation & Helper Functions ====================
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    
    const navMap = {'home': 0, 'challenges': 1, 'profile': 2};
    const navItems = document.querySelectorAll('.nav-item');
    if(navItems[navMap[viewId]]) navItems[navMap[viewId]].classList.add('active');
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

function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    document.getElementById('signup-fields').style.display = isSignupMode ? 'block' : 'none';
    document.getElementById('toggleAuthBtn').innerText = isSignupMode ? "لديك حساب؟" : "سجل الآن";
}
async function handleAuth() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    if(isSignupMode) {
        const name = document.getElementById('username').value;
        const region = document.getElementById('region').value;
        const c = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('users').doc(c.user.uid).set({name, region, email, totalDist:0, totalRuns:0});
    } else {
        await auth.signInWithEmailAndPassword(email, pass);
    }
}
function openLogModal() { document.getElementById('modal-log').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showAuthScreen() { document.getElementById('auth-screen').style.display = 'flex'; document.getElementById('app-content').style.display='none';}
function openSettingsModal() { document.getElementById('modal-settings').style.display='flex'; }
function showNotifications() { document.getElementById('modal-notifications').style.display='flex'; document.getElementById('notif-dot').classList.remove('active'); loadNotifications(); }
function openEditProfile() { document.getElementById('modal-edit-profile').style.display='flex'; }

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
async function sendNotification(receiverId, message) {
    try {
        await db.collection('users').doc(receiverId).collection('notifications').add({
            msg: message, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) {}
}

// ==================== 6. Admin & Updates (Fixed) ====================
function openAdminAuth() {
    const pin = prompt("أدخل كود المشرف:");
    if(pin === "a4450422") { 
        closeModal('modal-settings'); // نغلق المودال أولاً
        // تأخير بسيط لضمان اختفاء المودال قبل الانتقال
        setTimeout(() => {
            switchView('admin');
            loadAdminStats();
            loadAdminFeed();
        }, 100);
    } else {
        alert("كود خاطئ");
    }
}

async function forceUpdateApp() {
    if(confirm("تحديث؟")) {
        if('serviceWorker' in navigator) { (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister()); }
        window.location.reload(true);
    }
}

// 7. Challenges (New Mini Design)
function loadActiveChallenges() {
    const list = document.getElementById('challenges-list');
    const mini = document.getElementById('my-active-challenges');
    if(!list) return;
    
    db.collection('challenges').where('active', '==', true).get().then(async snap => {
        let html = '';
        let miniHtml = '';
        if(snap.empty) { 
            list.innerHTML = '<div style="text-align:center; padding:20px;">لا توجد تحديات</div>';
            mini.innerHTML = '<div class="empty-state-mini">لا توجد تحديات حالياً</div>';
            return; 
        }
        
        for (const doc of snap.docs) {
            const ch = doc.data();
            let isJoined = false; 
            let progress = 0;
            if(currentUser) {
                const part = await doc.ref.collection('participants').doc(currentUser.uid).get();
                if(part.exists) { isJoined = true; progress = part.data().progress || 0; }
            }
            const perc = Math.min((progress/ch.target)*100, 100);
            
            // الكارت الكبير (للصفحة الكاملة)
            html += `<div class="challenge-card">
                <h3>${ch.title} <small>${ch.target} كم</small></h3>
                ${isJoined ? `<div class="xp-track"><div class="xp-fill" style="width:${perc}%"></div></div>` : `<button onclick="joinChallenge('${doc.id}')">انضمام</button>`}
            </div>`;
            
            // الكارت المصغر (للصفحة الرئيسية)
            if(isJoined) {
                miniHtml += `
                <div class="mini-challenge-card">
                    <div class="mini-ch-title">${ch.title}</div>
                    <div class="mini-ch-progress"><div class="mini-ch-fill" style="width:${perc}%"></div></div>
                    <div class="mini-ch-stats"><span>${progress.toFixed(1)} كم</span><span>${Math.floor(perc)}%</span></div>
                </div>`;
            }
        }
        list.innerHTML = html;
        mini.innerHTML = miniHtml || '<div class="empty-state-mini" style="font-size:11px; color:#6b7280; padding:5px;">لم تنضم لتحديات</div>';
    });
}

// Admin Functions
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
    db.collection('users').get().then(snap => {
        statsDiv.innerHTML = `عدد الأعضاء: <strong style="color:#fff">${snap.size}</strong>`;
    });
}

// Activity Log & Leaderboard
function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if(!list) return;
    db.collection('users').doc(currentUser.uid).collection('runs').orderBy('timestamp', 'desc').limit(20)
      .onSnapshot(snap => {
          let html = '';
          if(snap.empty) { list.innerHTML = 'لا يوجد نشاط'; return; }
          snap.forEach(doc => {
              const r = doc.data();
              const dateStr = r.timestamp ? r.timestamp.toDate().toLocaleDateString('ar-EG') : '';
              html += `
              <div class="log-card">
                  <div class="log-info"><h4>${r.dist} كم <small>(${r.type})</small></h4><span>${dateStr}</span></div>
                  <button class="btn-delete" onclick="deleteRun('${doc.id}', ${r.dist})"><i class="ri-delete-bin-line"></i></button>
              </div>`;
          });
          list.innerHTML = html;
      });
}
async function deleteRun(id, dist) {
    if(confirm("حذف؟")) {
        await db.collection('users').doc(currentUser.uid).collection('runs').doc(id).delete();
        await db.collection('users').doc(currentUser.uid).update({
            totalDist: firebase.firestore.FieldValue.increment(-dist),
            totalRuns: firebase.firestore.FieldValue.increment(-1),
            monthDist: firebase.firestore.FieldValue.increment(-dist)
        });
        userData.totalDist -= dist;
        userData.totalRuns -= 1;
        userData.monthDist -= dist;
        updateUI();
    }
}
async function loadLeaderboard(filter) {
    const list = document.getElementById('leaderboard-list');
    if(!list) return;
    list.innerHTML = 'جاري التحميل...';
    const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(50).get();
    let users = [];
    snap.forEach(doc => users.push(doc.data()));
    if(filter === 'region') users = users.filter(u => u.region === userData.region);
    
    let html = '';
    users.forEach((u, i) => {
        let badge = i+1;
        if(i===0) badge='🥇'; if(i===1) badge='🥈'; if(i===2) badge='🥉';
        html += `<div class="leader-row"><div class="rank-col">${badge}</div><div class="info-col">${u.name} <small>(${u.region})</small></div><div class="dist-col">${u.totalDist.toFixed(1)}</div></div>`;
    });
    list.innerHTML = html || 'لا يوجد';
}
function filterLeaderboard(type) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
    loadLeaderboard(type);
}
async function loadRegionBattle() {
    const list = document.getElementById('region-battle-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center;">جاري الحساب...</div>';
    const snap = await db.collection('users').get();
    let regionMap = {};
    snap.forEach(doc => {
        const u = doc.data();
        if(u.region) {
            if (!regionMap[u.region]) regionMap[u.region] = 0;
            regionMap[u.region] += (u.totalDist || 0);
        }
    });
    const sortedRegions = Object.keys(regionMap).map(key => ({ name: key, total: regionMap[key] })).sort((a, b) => b.total - a.total);
    list.innerHTML = '';
    const maxVal = sortedRegions[0]?.total || 1; 
    sortedRegions.forEach((r, idx) => {
        const percent = (r.total / maxVal) * 100;
        list.innerHTML += `<div class="squad-card"><div class="squad-header"><span class="squad-rank">#${idx + 1}</span><span class="squad-name">${r.name}</span><span class="squad-total">${r.total.toFixed(0)} كم</span></div><div class="squad-bar-bg"><div class="squad-bar-fill" style="width:${percent}%"></div></div></div>`;
    });
}
async function saveProfileChanges() {
    const name = document.getElementById('edit-name').value;
    const region = document.getElementById('edit-region').value;
    if(name) {
        await db.collection('users').doc(currentUser.uid).update({ name, region });
        userData.name = name; userData.region = region;
        updateUI();
        closeModal('modal-edit-profile');
        alert("تم الحفظ");
    }
}


// ==================== تحديث: إضافة زر التعليق في الـ Feed ====================
// استبدل دالة loadGlobalFeed الحالية بهذه النسخة المحدثة
function loadGlobalFeed() {
    const list = document.getElementById('global-feed-list');
    if(!list) return;

    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
        let html = '';
        if(snap.empty) { list.innerHTML = '<div style="text-align:center; font-size:12px; color:#6b7280;">لا توجد أنشطة</div>'; return; }
        
        snap.forEach(doc => {
            const p = doc.data();
            const isLiked = p.likes && p.likes.includes(currentUser.uid);
            const commentsCount = p.commentsCount || 0; // سنحتاج لإضافة هذا العداد لاحقاً
            
            // ... (نفس كود حساب الوقت السابق) ...
            let timeAgo = "الآن";
            if(p.timestamp) {
                const diff = (new Date() - p.timestamp.toDate()) / 60000;
                if(diff < 60) timeAgo = `${Math.floor(diff)} د`;
                else if(diff < 1440) timeAgo = `${Math.floor(diff/60)} س`;
                else timeAgo = `${Math.floor(diff/1440)} يوم`;
            }

            html += `
            <div class="feed-card-compact">
                <div class="feed-compact-content">
                    <div class="feed-compact-avatar">${(p.userName||"?").charAt(0)}</div>
                    <div>
                        <div class="feed-compact-text">
                            <strong>${p.userName}</strong> <span style="opacity:0.7">(${p.userRegion})</span>
                        </div>
                        <div class="feed-compact-text" style="margin-top:2px;">
                            ${p.type === 'Run' ? 'جري' : p.type} <span style="color:#10b981; font-weight:bold;">${p.dist} كم</span>
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
                        <span class="feed-compact-count" id="count-${doc.id}">${commentsCount > 0 ? commentsCount : ''}</span>
                    </button>

                    <span class="feed-compact-meta" style="margin-right:5px;">${timeAgo}</span>
                </div>
            </div>`;
        });
        list.innerHTML = html;
    });
}

// ==================== جديد: نظام التعليقات (Logic) ====================
let currentPostId = null; // لنعرف نحن نعلق على أي بوست
let currentPostOwner = null;

function openComments(postId, postOwnerId) {
    currentPostId = postId;
    currentPostOwner = postOwnerId;
    
    document.getElementById('modal-comments').style.display = 'flex';
    document.getElementById('comment-text').value = ''; // مسح الخانة
    loadComments(postId);
}

function loadComments(postId) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '<div style="text-align:center; color:#6b7280; font-size:12px; margin-top:20px;">جاري تحميل المحادثة...</div>';

    // الاستماع للتعليقات في الوقت الفعلي
    db.collection('activity_feed').doc(postId).collection('comments')
      .orderBy('timestamp', 'asc')
      .onSnapshot(snap => {
          let html = '';
          if(snap.empty) {
              list.innerHTML = '<div style="text-align:center; color:#6b7280; font-size:12px; margin-top:50px; opacity:0.7;"><i class="ri-chat-1-line" style="font-size:30px;"></i><br>كن أول من يشجع الكابتن!</div>';
              return;
          }

          snap.forEach(doc => {
              const c = doc.data();
              const time = c.timestamp ? new Date(c.timestamp.toDate()).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '';
              
              html += `
                <div class="comment-item">
                    <div class="comment-avatar">${c.userName.charAt(0)}</div>
                    <div class="comment-bubble">
                        <span class="comment-user">${c.userName}</span>
                        <span class="comment-msg">${c.text}</span>
                        <span class="comment-time">${time}</span>
                    </div>
                </div>`;
          });
          list.innerHTML = html;
          // التمرير للأسفل تلقائياً لرؤية آخر تعليق
          list.scrollTop = list.scrollHeight;
      });
}

async function sendComment() {
    const input = document.getElementById('comment-text');
    const text = input.value.trim();
    
    if(!text || !currentPostId) return;
    
    input.value = ''; // مسح فوري لتحسين التجربة
    
    try {
        // 1. إضافة التعليق في Sub-collection
        await db.collection('activity_feed').doc(currentPostId).collection('comments').add({
            text: text,
            userId: currentUser.uid,
            userName: userData.name,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. تحديث عداد التعليقات في البوست الأصلي (اختياري لكن جيد للأداء)
        await db.collection('activity_feed').doc(currentPostId).update({
            commentsCount: firebase.firestore.FieldValue.increment(1)
        });

        // 3. إرسال إشعار لصاحب البوست (لو مش أنا اللي بعلق لنفسي)
        if(currentPostOwner !== currentUser.uid) {
            sendNotification(currentPostOwner, `علق ${userData.name} على نشاطك: "${text.substring(0, 20)}..."`);
        }

    } catch(e) {
        console.error("Comment Error:", e);
        alert("فشل إرسال التعليق");
    }
}
// ==================== 9. المنطقة الخطرة (حذف الحساب) ====================
async function deleteFullAccount() {
    // 1. تأكيد أول
    if(!confirm("⚠️ تحذير خطير!\nسيتم حذف حسابك وجميع بياناتك، جرياتك، تعليقاتك، وأرقامك نهائياً من قاعدة البيانات.\n\nهل أنت متأكد تماماً؟")) return;

    // 2. تأكيد ثاني (لزيادة الأمان)
    const confirmation = prompt("للتأكيد النهائي، اكتب كلمة (حذف) في المربع أدناه:");
    if (confirmation !== "حذف") {
        alert("لم يتم الحذف. الكلمة غير صحيحة.");
        return;
    }

    const btn = document.querySelector('.delete-danger');
    if(btn) {
        btn.innerHTML = '<span style="color:red;">جاري الحذف والتنظيف...</span>';
        btn.disabled = true;
    }

    try {
        const uid = currentUser.uid;

        // الخطوة 1: حذف الجريات الخاصة بالمستخدم (Sub-collection)
        const runsSnapshot = await db.collection('users').doc(uid).collection('runs').get();
        const batch = db.batch();
        runsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        // حذف الإشعارات أيضاً
        const notifSnapshot = await db.collection('users').doc(uid).collection('notifications').get();
        notifSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // الخطوة 2: حذف بوستات المستخدم من الـ Feed العام
        const feedSnapshot = await db.collection('activity_feed').where('uid', '==', uid).get();
        const feedBatch = db.batch();
        feedSnapshot.forEach(doc => {
            feedBatch.delete(doc.ref);
        });
        await feedBatch.commit();

        // الخطوة 3: حذف وثيقة المستخدم الرئيسية
        await db.collection('users').doc(uid).delete();

        // الخطوة 4: حذف المستخدم من نظام المصادقة (Auth)
        await currentUser.delete();

        alert("تم حذف الحساب بنجاح. سنفتقدك! 👋");
        window.location.reload();

    } catch (error) {
        console.error("Delete Error:", error);
        // أحياناً يطلب فايربيس إعادة تسجيل الدخول قبل الحذف الحساس
        if(error.code === 'auth/requires-recent-login') {
            alert("لأمانك، يرجى تسجيل الخروج والدخول مرة أخرى ثم المحاولة.");
            logout();
        } else {
            alert("حدث خطأ أثناء الحذف: " + error.message);
            if(btn) btn.disabled = false;
        }
    }
}
