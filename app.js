/* ERS Runners - V17 Ultimate (All Features) */

const firebaseConfig = {
  apiKey: "AIzaSyCHod8qSDNzKDKxRHj1yQlWgNAPXFNdAyg",
  authDomain: "ers-runners-app.firebaseapp.com",
  projectId: "ers-runners-app",
  storageBucket: "ers-runners-app.firebasestorage.app",
  messagingSenderId: "493110452684",
  appId: "1:493110452684:web:db892ab6e6c88b3e6dbd69"
};

// تهيئة التطبيق
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userData = {};
let isSignupMode = false;

// ==================== 1. نظام المصادقة (Auth) ====================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                userData = doc.data();
                initApp();
            } else {
                // حالة نادرة: المستخدم مسجل في Auth بس ملوش داتا
                console.warn("User data missing, creating default...");
                userData = { name: "Runner", region: "Cairo", totalDist: 0, totalRuns: 0 };
                initApp();
            }
        } catch (e) { console.error("Auth Data Error:", e); }
    } else {
        currentUser = null;
        showAuthScreen();
    }
});

function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    const fields = document.getElementById('signup-fields');
    const btn = document.getElementById('toggleAuthBtn');
    const mainBtn = document.querySelector('.auth-box .btn-primary');
    
    if (fields && btn && mainBtn) {
        if (isSignupMode) {
            fields.style.display = 'block';
            btn.innerText = "لديك حساب بالفعل؟ تسجيل الدخول";
            mainBtn.innerText = "إنشاء حساب جديد";
        } else {
            fields.style.display = 'none';
            btn.innerText = "ليس لديك حساب؟ سجل الآن";
            mainBtn.innerText = "دخول";
        }
    }
}

async function handleAuth() {
    const emailEl = document.getElementById('email');
    const passEl = document.getElementById('password');
    const msgEl = document.getElementById('auth-msg');
    
    if (!emailEl || !passEl) return;
    const email = emailEl.value;
    const pass = passEl.value;
    if (msgEl) msgEl.innerText = "";

    try {
        if (!email || !pass) throw new Error("يرجى ملء البيانات");

        if (isSignupMode) {
            const name = document.getElementById('username').value;
            const region = document.getElementById('region').value;
            if (!name || !region) throw new Error("أكمل البيانات المطلوبة");

            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await db.collection('users').doc(cred.user.uid).set({
                name: name, region: region, email: email,
                totalDist: 0, totalRuns: 0, level: "Mubtadi",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await auth.signInWithEmailAndPassword(email, pass);
        }
    } catch (err) {
        if (msgEl) msgEl.innerText = err.message;
    }
}

function logout() {
    if(confirm("خروج؟")) { auth.signOut(); window.location.reload(); }
}

// ==================== 2. إدارة الواجهة (UI Management) ====================
function showAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    const appContent = document.getElementById('app-content');
    if(authScreen) authScreen.style.display = 'flex';
    if(appContent) appContent.style.display = 'none';
}

function initApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    
    updateUI(); // تحديث الواجهة بكل البيانات
    loadActivityLog();
    loadActiveChallenges(); 
    loadGlobalFeed();
    listenForNotifications();
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    const view = document.getElementById('view-' + viewId);
    if(view) view.classList.add('active');
    
    const navMap = {'home': 0, 'challenges': 1, 'profile': 2};
    const navItems = document.querySelectorAll('.nav-item');
    if(navItems[navMap[viewId]]) navItems[navMap[viewId]].classList.add('active');
}

function setTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const targetTab = document.getElementById('tab-' + tabName);
    if(targetTab) targetTab.classList.add('active');
    
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');

    if (tabName === 'leaderboard') loadLeaderboard('all');
    if (tabName === 'squads') loadRegionBattle();
    if (tabName === 'active-challenges') loadActiveChallenges();
}

// ==================== 3. نظام المستويات (Rank Calculation) ====================
function calculateRank(totalDist) {
    // تعريف المستويات
    const levels = [
        { name: "مبتدئ", min: 0, class: "rank-mubtadi", next: 50 },
        { name: "هاوي", min: 50, class: "rank-hawy", next: 150 },
        { name: "عداء", min: 150, class: "rank-runner", next: 500 },
        { name: "محترف", min: 500, class: "rank-pro", next: 1000 },
        { name: "أسطورة", min: 1000, class: "rank-legend", next: 10000 }
    ];

    let currentLevel = levels[0];
    for (let i = levels.length - 1; i >= 0; i--) {
        if (totalDist >= levels[i].min) {
            currentLevel = levels[i];
            break;
        }
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

function getNextRankName(current) {
    if(current === "مبتدئ") return "هاوي";
    if(current === "هاوي") return "عداء";
    if(current === "عداء") return "محترف";
    if(current === "محترف") return "أسطورة";
    return "";
}

// ==================== 4. تحديث الواجهة الشامل (Update UI) ====================
function updateUI() {
    try {
        // أ) البيانات الأساسية
        const headerName = document.getElementById('headerName');
        if (headerName) headerName.innerText = userData.name || "Runner";

        const monthDistEl = document.getElementById('monthDist');
        const totalRunsEl = document.getElementById('totalRuns');
        if (monthDistEl) monthDistEl.innerText = (userData.monthDist || 0).toFixed(1); // استخدام الشهر الحالي
        if (totalRunsEl) totalRunsEl.innerText = userData.totalRuns || 0;

        // ب) البروفايل
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

        // ج) نظام المستويات (Rank & XP)
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

        // د) الهدف الشهري (Personal Goal) 🎯
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
                
                // رسم الدائرة
                goalRing.style.background = `conic-gradient(#8b5cf6 ${deg}deg, rgba(255,255,255,0.1) 0deg)`;
            }
        }

    } catch (error) {
        console.error("UpdateUI Error:", error);
    }
}

// ==================== 5. تسجيل النشاط (Run Logic) ====================
function openLogModal() { document.getElementById('modal-log').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

async function submitRun() {
    const btn = document.getElementById('save-run-btn');
    const dist = parseFloat(document.getElementById('log-dist').value);
    const time = parseFloat(document.getElementById('log-time').value);
    const type = document.getElementById('log-type').value;
    const link = document.getElementById('log-link').value;

    if (!dist || !time) { alert("المسافة والزمن مطلوبين!"); return; }
    
    if(btn) { btn.innerText = "جاري الحفظ..."; btn.disabled = true; }

    try {
        const uid = currentUser.uid;
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        
        // منطق حساب مسافة الشهر
        const currentMonthKey = new Date().toISOString().slice(0, 7); // "2023-12"
        let newMonthDist = (userData.monthDist || 0) + dist;
        // تصفير لو شهر جديد
        if(userData.lastMonthKey !== currentMonthKey) {
            newMonthDist = dist;
        }

        const runData = { dist, time, type, link, date: new Date().toISOString(), timestamp };

        // 1. حفظ في المستخدم
        await db.collection('users').doc(uid).collection('runs').add(runData);

        // 2. حفظ في الـ Feed
        await db.collection('activity_feed').add({
            uid: uid,
            userName: userData.name || "Unknown",
            userRegion: userData.region || "General",
            ...runData,
            likes: []
        });

        // 3. تحديث الإحصائيات (الإجمالي + الشهر)
        await db.collection('users').doc(uid).set({
            totalDist: firebase.firestore.FieldValue.increment(dist),
            totalRuns: firebase.firestore.FieldValue.increment(1),
            monthDist: newMonthDist,
            lastMonthKey: currentMonthKey
        }, { merge: true });

        // 4. تحديث التحديات
        const activeChCalls = await db.collection('challenges').where('active', '==', true).get();
        if (!activeChCalls.empty) {
            const batch = db.batch();
            activeChCalls.forEach(doc => {
                batch.set(doc.ref.collection('participants').doc(uid), {
                    progress: firebase.firestore.FieldValue.increment(dist),
                    lastUpdate: timestamp,
                    name: userData.name, region: userData.region
                }, { merge: true });
            });
            await batch.commit();
        }

        // تحديث البيانات المحلية فوراً
        userData.totalDist = (userData.totalDist || 0) + dist;
        userData.totalRuns = (userData.totalRuns || 0) + 1;
        userData.monthDist = newMonthDist;
        userData.lastMonthKey = currentMonthKey;
        
        alert("تم الحفظ بنجاح! 🚀");
        closeModal('modal-log');
        
        // تصفير الحقول
        document.getElementById('log-dist').value = '';
        document.getElementById('log-time').value = '';
        document.getElementById('log-link').value = '';
        
        updateUI(); // هذا سيحدث الدائرة وشريط المستويات
        loadGlobalFeed();
        loadActivityLog();

    } catch (error) {
        console.error(error);
        alert("خطأ: " + error.message);
    } finally {
        if(btn) { btn.innerText = "حفظ النشاط"; btn.disabled = false; }
    }
}

// ==================== 6. الهدف الشخصي (Set Goal) ====================
async function setPersonalGoal() {
    const currentGoal = userData.monthlyGoal || 0;
    const newGoal = prompt("حددي هدفك لهذا الشهر (كم):", currentGoal);
    
    if(newGoal !== null && newGoal > 0) {
        try {
            await db.collection('users').doc(currentUser.uid).update({
                monthlyGoal: parseFloat(newGoal)
            });
            userData.monthlyGoal = parseFloat(newGoal);
            alert("تم تحديد الهدف! 🎯");
            updateUI();
        } catch(e) { console.error(e); }
    }
}

// ==================== 7. الفيد واللايكات والإشعارات ====================
function loadGlobalFeed() {
    const feedContainer = document.getElementById('global-feed-list');
    if(!feedContainer) return;

    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(20)
      .onSnapshot(snap => {
          let html = '';
          if(snap.empty) {
              feedContainer.innerHTML = '<div style="text-align:center; color:#6b7280; padding:10px;">لا توجد أنشطة</div>';
              return;
          }

          snap.forEach(doc => {
              const post = doc.data();
              let timeAgo = "الآن";
              if(post.timestamp) {
                  const diff = new Date() - post.timestamp.toDate();
                  const mins = Math.floor(diff / 60000);
                  if(mins < 60) timeAgo = `منذ ${mins} د`;
                  else if(mins < 1440) timeAgo = `منذ ${Math.floor(mins/60)} س`;
                  else timeAgo = `منذ ${Math.floor(mins/1440)} يوم`;
              }
              
              let linkBtn = '';
              if(post.link && post.link.includes('http')) {
                  linkBtn = `<a href="${post.link}" target="_blank" class="btn-link-proof"><i class="ri-link"></i> إثبات</a>`;
              }

              const isLiked = post.likes && post.likes.includes(currentUser.uid);
              const likeClass = isLiked ? 'liked' : '';
              const likeIcon = isLiked ? 'ri-heart-fill' : 'ri-heart-line';

              html += `
                <div class="feed-card">
                    <div class="feed-header">
                        <div class="feed-user">
                            <div class="feed-avatar">${(post.userName||"?").charAt(0)}</div>
                            <div>
                                <div class="feed-name">${post.userName}</div>
                                <div class="feed-meta">${post.userRegion} • ${timeAgo}</div>
                            </div>
                        </div>
                        ${linkBtn}
                    </div>
                    <div class="feed-body">
                        أكمل <strong>${post.type}</strong> لمسافة <span class="highlight">${post.dist} كم</span> في ${post.time} دقيقة
                    </div>
                    <div class="feed-actions">
                        <button class="btn-like ${likeClass}" onclick="toggleLike('${doc.id}', '${post.uid}')">
                            <i class="${likeIcon}"></i> <span>${(post.likes||[]).length || ''}</span>
                        </button>
                    </div>
                </div>`;
          });
          feedContainer.innerHTML = html;
      });
}

async function toggleLike(postId, postOwnerId) {
    if(!currentUser) return;
    const postRef = db.collection('activity_feed').doc(postId);
    const uid = currentUser.uid;
    try {
        const doc = await postRef.get();
        if(!doc.exists) return;
        const likes = doc.data().likes || [];
        if (likes.includes(uid)) {
            await postRef.update({ likes: firebase.firestore.FieldValue.arrayRemove(uid) });
        } else {
            await postRef.update({ likes: firebase.firestore.FieldValue.arrayUnion(uid) });
            if(postOwnerId !== uid) sendNotification(postOwnerId, "قام " + userData.name + " بتشجيعك ❤️");
        }
    } catch(e) { console.error(e); }
}

async function sendNotification(receiverId, message) {
    try {
        await db.collection('users').doc(receiverId).collection('notifications').add({
            msg: message, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) {}
}

function showNotifications() {
    const modal = document.getElementById('modal-notifications');
    const list = document.getElementById('notifications-list');
    const badge = document.getElementById('notif-dot');
    if(modal) modal.style.display = 'flex';
    if(badge) badge.classList.remove('active');

    db.collection('users').doc(currentUser.uid).collection('notifications')
      .orderBy('timestamp', 'desc').limit(10).get()
      .then(snap => {
          if(snap.empty) {
              list.innerHTML = '<div style="text-align:center; padding:20px; color:#9ca3af;">لا توجد إشعارات</div>';
              return;
          }
          let html = '';
          snap.forEach(doc => {
              const n = doc.data();
              doc.ref.update({ read: true }); 
              html += `
                <div class="notif-item">
                    <div class="notif-icon"><i class="ri-notification-3-fill"></i></div>
                    <div class="notif-content">${n.msg}</div>
                </div>`;
          });
          list.innerHTML = html;
      });
}

function listenForNotifications() {
    if(!currentUser) return;
    db.collection('users').doc(currentUser.uid).collection('notifications')
      .where('read', '==', false)
      .onSnapshot(snap => {
          const badge = document.getElementById('notif-dot');
          if(!snap.empty && badge) badge.classList.add('active');
      });
}

// ==================== 8. الأدمن والإعدادات ====================
function openSettingsModal() { document.getElementById('modal-settings').style.display = 'flex'; }

function openAdminAuth() {
    const pin = prompt("أدخل كود المشرف:");
    if(pin === "1234") { 
        switchView('admin');
        loadAdminFeed();
        closeModal('modal-settings');
    } else {
        alert("كود خاطئ");
    }
}

async function createChallengeUI() {
    const title = document.getElementById('admin-ch-title').value;
    const desc = document.getElementById('admin-ch-desc').value;
    const target = parseFloat(document.getElementById('admin-ch-target').value);
    const days = parseInt(document.getElementById('admin-ch-days').value);

    if(!title || !target) return alert("البيانات ناقصة");

    try {
        await db.collection('challenges').add({
            title, desc, target,
            active: true, type: "distance",
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + days * 86400000).toISOString()
        });
        alert("تم النشر!");
        switchView('challenges');
    } catch(e) { alert("خطأ: " + e.message); }
}

function loadAdminFeed() {
    const list = document.getElementById('admin-feed-list');
    if(!list) return;
    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(10).get()
      .then(snap => {
          let html = '';
          snap.forEach(doc => {
              const p = doc.data();
              html += `
                <div class="feed-card" style="margin-bottom:10px; border-color:rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between;">
                        <span style="font-weight:bold;">${p.userName}</span>
                        <span>${p.dist} كم</span>
                    </div>
                    <button class="btn-admin-delete" onclick="adminDeletePost('${doc.id}')" style="margin-top:5px; color:red;">حذف</button>
                </div>`;
          });
          list.innerHTML = html || 'لا يوجد';
      });
}

async function adminDeletePost(id) {
    if(confirm("حذف؟")) {
        await db.collection('activity_feed').doc(id).delete();
        alert("تم الحذف");
        loadAdminFeed();
        loadGlobalFeed();
    }
}

async function forceUpdateApp() {
    if(confirm("تحديث التطبيق؟")) {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for(let reg of regs) await reg.unregister();
        }
        window.location.reload(true);
    }
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
