/* ERS Runners - V18 Ultimate (Clean Single File) */

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

// ==================== 2. UI Updates (The Captain Logic) ====================
function updateUI() {
    try {
        // Basic Info
        const headerName = document.getElementById('headerName');
        const helloText = document.querySelector('.hello-text');
        
        // تغيير الترحيب
        if(helloText) helloText.innerHTML = "أهلاً يا كابتن 👋"; 
        if (headerName) headerName.innerText = userData.name || "Runner";

        const monthDistEl = document.getElementById('monthDist');
        const totalRunsEl = document.getElementById('totalRuns');
        if (monthDistEl) monthDistEl.innerText = (userData.monthDist || 0).toFixed(1);
        if (totalRunsEl) totalRunsEl.innerText = userData.totalRuns || 0;

        // Profile
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

        // Rank & XP Bar
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

        // Goal Ring 🎯
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

// ==================== 3. Core Features (Run, Goal, Likes) ====================
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
        
        // Month Logic
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

        // Challenges Update
        const activeCh = await db.collection('challenges').where('active', '==', true).get();
        const batch = db.batch();
        activeCh.forEach(doc => {
            batch.set(doc.ref.collection('participants').doc(uid), {
                progress: firebase.firestore.FieldValue.increment(dist),
                lastUpdate: timestamp, name: userData.name, region: userData.region
            }, { merge: true });
        });
        await batch.commit();

        // Local Update
        userData.totalDist += dist; userData.totalRuns += 1;
        userData.monthDist = newMonthDist; userData.lastMonthKey = currentMonthKey;
        
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

// ==================== 4. Feed & Likes ====================
function loadGlobalFeed() {
    const list = document.getElementById('global-feed-list');
    if(!list) return;
    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
        let html = '';
        if(snap.empty) { list.innerHTML = '<div style="text-align:center; padding:10px;">لا توجد أنشطة</div>'; return; }
        snap.forEach(doc => {
            const p = doc.data();
            const isLiked = p.likes && p.likes.includes(currentUser.uid);
            const linkBtn = (p.link && p.link.includes('http')) ? `<a href="${p.link}" target="_blank" class="btn-link-proof"><i class="ri-link"></i> إثبات</a>` : '';
            
            html += `
            <div class="feed-card">
                <div class="feed-header">
                    <div class="feed-user">
                        <div class="feed-avatar">${(p.userName||"?").charAt(0)}</div>
                        <div><div class="feed-name">${p.userName}</div><div class="feed-meta">${p.userRegion}</div></div>
                    </div>
                    ${linkBtn}
                </div>
                <div class="feed-body">أكمل <strong>${p.type}</strong> لمسافة <span class="highlight">${p.dist} كم</span> في ${p.time} دقيقة</div>
                <div class="feed-actions">
                    <button class="btn-like ${isLiked?'liked':''}" onclick="toggleLike('${doc.id}', '${p.uid}')">
                        <i class="${isLiked?'ri-heart-fill':'ri-heart-line'}"></i> <span>${(p.likes||[]).length || ''}</span>
                    </button>
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

// ==================== 5. Helper Functions ====================
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

// Load Notifications logic
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

/ ==================== إصلاح مشكلة الأدمن (ترتيب العمليات) ====================
function openAdminAuth() {
    const pin = prompt("أدخل كود المشرف:");
    if(pin === "1234") { 
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
async function adminDelete(id) { await db.collection('activity_feed').doc(id).delete(); alert("حذف"); loadAdminFeed(); }
async function saveProfileChanges() {
    const name = document.getElementById('edit-name').value;
    await db.collection('users').doc(currentUser.uid).update({name});
    updateUI(); closeModal('modal-edit-profile');
}

// السجل الشخصي
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

// المتصدرين والتحديات
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

function loadActiveChallenges() {
    const list = document.getElementById('challenges-list');
    const mini = document.getElementById('my-active-challenges');
    if(!list) return;
    
    db.collection('challenges').where('active', '==', true).get().then(async snap => {
        let html = '';
        let miniHtml = '';
        if(snap.empty) { list.innerHTML = 'لا يوجد تحديات'; return; }
        
        for (const doc of snap.docs) {
            const ch = doc.data();
            let isJoined = false; 
            let progress = 0;
            if(currentUser) {
                const part = await doc.ref.collection('participants').doc(currentUser.uid).get();
                if(part.exists) { isJoined = true; progress = part.data().progress || 0; }
            }
            const perc = Math.min((progress/ch.target)*100, 100);
            
            html += `<div class="challenge-card">
                <h3>${ch.title} <small>${ch.target} كم</small></h3>
                ${isJoined ? `<div class="xp-track"><div class="xp-fill" style="width:${perc}%"></div></div>` : `<button onclick="joinChallenge('${doc.id}')">انضمام</button>`}
            </div>`;
            
            if(isJoined) miniHtml += `<div class="feed-card" style="min-width:150px;">${ch.title} <br> ${progress.toFixed(1)}%</div>`;
        }
        list.innerHTML = html;
        mini.innerHTML = miniHtml || 'لم تنضم لتحديات';
    });
}

window.joinChallenge = async function(id) {
    if(confirm("انضمام؟")) {
        await db.collection('challenges').doc(id).collection('participants').doc(currentUser.uid).set({
            progress: 0, name: userData.name, region: userData.region
        });
        alert("تم الانضمام");
        loadActiveChallenges();
    }
}

// 404 Fixer: Save Profile changes
window.saveProfileChanges = async function() {
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
