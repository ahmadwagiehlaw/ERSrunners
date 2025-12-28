/* ERS Runners - V1.3 (Stable Build) */

const firebaseConfig = {
  apiKey: "AIzaSyCHod8qSDNzKDKxRHj1yQlWgNAPXFNdAyg",
  authDomain: "ers-runners-app.firebaseapp.com",
  projectId: "ers-runners-app",
  storageBucket: "ers-runners-app.firebasestorage.app",
  messagingSenderId: "493110452684",
  appId: "1:493110452684:web:db892ab6e6c88b3e6dbd69"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userData = {};
let isSignupMode = false;

// -------------------------------- Auth Logic --------------------------------
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            userData = doc.data();
            initApp();
        }
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
        console.error("Auth Error:", err);
    }
}

function logout() {
    if(confirm("خروج؟")) { auth.signOut(); window.location.reload(); }
}

// -------------------------------- UI & Core --------------------------------
function showAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    const appContent = document.getElementById('app-content');
    if(authScreen) authScreen.style.display = 'flex';
    if(appContent) appContent.style.display = 'none';
}

function initApp() {
    const authScreen = document.getElementById('auth-screen');
    const appContent = document.getElementById('app-content');
    if(authScreen) authScreen.style.display = 'none';
    if(appContent) appContent.style.display = 'block';
    
    updateUI();
    loadActivityLog();
    loadActiveChallenges(); 
listenForNotifications(); // <--- ضيف السطر ده عشان الجرس ينور لو جالك إشعار

loadGlobalFeed(); // <--- ضيف السطر ده
}
// الدالة المؤمنة بالكامل لتحديث الواجهة
function updateUI() {
    // 1. تحديث الاسم في الهيدر
    const headerName = document.getElementById('headerName');
    if (headerName) headerName.innerText = userData.name || "Runner";

    // 2. كارت الإحصائيات
    const monthDistEl = document.getElementById('monthDist');
    const totalRunsEl = document.getElementById('totalRuns');
    
    if (monthDistEl) monthDistEl.innerText = (userData.totalDist || 0).toFixed(1);
    if (totalRunsEl) totalRunsEl.innerText = userData.totalRuns || 0;
    
    // 3. البروفايل
    const profileName = document.getElementById('profileName');
    const profileRegion = document.getElementById('profileRegion');
    const profileAvatar = document.getElementById('profileAvatar');

    if (profileName) profileName.innerText = userData.name;
    if (profileRegion) profileRegion.innerHTML = `<i class="ri-map-pin-line"></i> ${userData.region}`;
    if (profileAvatar) profileAvatar.innerText = (userData.name || "U").charAt(0); 
    
    // 4. حساب الرتبة
    let rank = "مبتدئ";
    const d = userData.totalDist || 0;
    if (d > 50) rank = "هاوي";
    if (d > 100) rank = "محترف";
    if (d > 500) rank = "نخبة";
    
    const rankBadge = document.getElementById('userRankBadge');
    if (rankBadge) rankBadge.innerText = rank;
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

    // تحميل البيانات عند الضغط
    if (tabName === 'leaderboard') loadLeaderboard('all');
    if (tabName === 'squads') loadRegionBattle();
    if (tabName === 'active-challenges') loadActiveChallenges();
}

function openLogModal() { 
    const m = document.getElementById('modal-log');
    if(m) m.style.display = 'flex'; 
}
function closeModal(id) { 
    const m = document.getElementById(id);
    if(m) m.style.display = 'none'; 
}

// -------------------------------- CHALLENGES ENGINE --------------------------------

function loadActiveChallenges() {
    const list = document.getElementById('challenges-list');
    const miniList = document.getElementById('my-active-challenges');
    
    // أمان: لو العناصر مش موجودة، وقف الدالة
    if(!list || !miniList) return;

    db.collection('challenges').where('active', '==', true).get().then(async (snap) => {
        list.innerHTML = '';
        miniList.innerHTML = '';
        
        if(snap.empty) {
            list.innerHTML = '<div style="text-align:center; padding:20px;">لا توجد تحديات نشطة</div>';
            miniList.innerHTML = '<div class="empty-state-mini">لا توجد تحديات حالياً</div>';
            return;
        }

        for (const doc of snap.docs) {
            const ch = doc.data();
            const chId = doc.id;
            
            // تحقق من الاشتراك
            let isJoined = false;
            let progress = 0;
            
            if(currentUser) {
                const partRef = await db.collection('challenges').doc(chId).collection('participants').doc(currentUser.uid).get();
                if(partRef.exists) {
                    isJoined = true;
                    progress = partRef.data().progress || 0;
                }
            }

            const percentage = Math.min((progress / ch.target) * 100, 100);

            // رسم الكارت الكبير
            list.innerHTML += `
                <div class="challenge-card" style="background: linear-gradient(135deg, #1f2937, #111827); border:1px solid #374151; border-radius:15px; padding:15px; margin-bottom:15px; position:relative; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px;">${ch.title}</h3>
                        <span style="font-size:11px; background:${isJoined ? '#10b981' : '#3b82f6'}; padding:2px 8px; border-radius:4px; color:#fff;">${isJoined ? 'مشترك' : 'جديد'}</span>
                    </div>
                    <p style="font-size:12px; color:#9ca3af; margin:5px 0;">${ch.desc}</p>
                    <div style="font-size:12px; margin-top:10px;">الهدف: <strong>${ch.target} كم</strong></div>
                    
                    ${isJoined ? `
                        <div style="margin-top:10px;">
                            <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:3px;">
                                <span>التقدم</span>
                                <span>${progress.toFixed(1)} / ${ch.target}</span>
                            </div>
                            <div style="height:6px; background:#374151; border-radius:10px; overflow:hidden;">
                                <div style="height:100%; width:${percentage}%; background:#10b981; transition:width 0.5s;"></div>
                            </div>
                        </div>
                    ` : `
                        <button onclick="joinChallenge('${chId}')" style="width:100%; margin-top:10px; background:#3b82f6; border:none; padding:8px; border-radius:8px; color:#fff; cursor:pointer;">انضم للتحدي</button>
                    `}
                </div>
            `;

            // رسم الكارت المصغر
            if(isJoined) {
                miniList.innerHTML += `
                    <div style="min-width:140px; background:#1f2937; padding:10px; border-radius:10px; margin-left:10px; border:1px solid #374151;">
                        <div style="font-size:12px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ch.title}</div>
                        <div style="height:4px; background:#374151; margin-top:8px; border-radius:2px;">
                            <div style="height:100%; width:${percentage}%; background:#10b981;"></div>
                        </div>
                        <div style="font-size:10px; color:#9ca3af; margin-top:4px; text-align:left;">${Math.floor(percentage)}%</div>
                    </div>
                `;
            }
        }
    });
}

window.joinChallenge = async function(challengeId) {
    if(!confirm("تأكيد الانضمام لهذا التحدي؟")) return;
    try {
        await db.collection('challenges').doc(challengeId).collection('participants').doc(currentUser.uid).set({
            name: userData.name, region: userData.region, progress: 0,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("تم الانضمام بنجاح!");
        initApp();
    } catch(e) { console.error(e); alert("حدث خطأ"); }
}

// -------------------------------- RUN LOGGING & ENGINE --------------------------------

// ==================== تعديل: إضافة النشاط للـ Feed العام ====================
// ==================== تحديث: حفظ الرابط مع الجرية ====================
async function submitRun() {
    const btn = document.getElementById('save-run-btn');
    const dist = parseFloat(document.getElementById('log-dist').value);
    const time = parseFloat(document.getElementById('log-time').value);
    const type = document.getElementById('log-type').value;
    const link = document.getElementById('log-link').value; // <--- الجديد

    if (!dist || !time) { alert("المسافة والزمن مطلوبين!"); return; }
    
    if(btn) { btn.innerText = "جاري الحفظ..."; btn.disabled = true; }

    try {
        const uid = currentUser.uid;
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        
        // تجهيز بيانات الجرية
        const runData = {
            dist, time, type, link, // حفظ الرابط
            date: new Date().toISOString(),
            timestamp
        };

        // 1. حفظ في البروفايل
        await db.collection('users').doc(uid).collection('runs').add(runData);

        // 2. حفظ في الـ Feed العام
        await db.collection('activity_feed').add({
            uid: uid,
            userName: userData.name || "Unknown",
            userRegion: userData.region || "General",
            ...runData, // نسخ نفس البيانات (بما فيها الرابط)
            likes: []
        });

        // 3. تحديث الإجمالي
        await db.collection('users').doc(uid).set({
            totalDist: firebase.firestore.FieldValue.increment(dist),
            totalRuns: firebase.firestore.FieldValue.increment(1)
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

        alert("تم الحفظ بنجاح! 🚀");
        closeModal('modal-log');
        
        // تنظيف وتحديث
        document.getElementById('log-dist').value = '';
        document.getElementById('log-time').value = '';
        document.getElementById('log-link').value = ''; // مسح الرابط
        userData.totalDist += dist; 
        userData.totalRuns += 1;
        updateUI();
        loadActivityLog(); 
        loadGlobalFeed();

    } catch (error) {
        console.error(error);
        alert("خطأ: " + error.message);
    } finally {
        if(btn) { btn.innerText = "حفظ النشاط"; btn.disabled = false; }
    }
}

// ==================== تحديث: عرض الرابط في الـ Feed ====================
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
              // ... (نفس كود الوقت السابق) ...
              let timeAgo = "الآن"; // اختصاراً للكود، انسخ منطق الوقت من ملفك السابق
              
              // زر الرابط (يظهر فقط لو فيه رابط)
              let linkBtn = '';
              if(post.link && post.link.startsWith('http')) {
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
                                <div class="feed-meta">${post.userRegion}</div>
                            </div>
                        </div>
                        ${linkBtn} </div>
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

// ==================== دوال الأدمن والتحديث الإجباري ====================

// 1. زر التحديث الإجباري (Force Update)
function forceUpdate() {
    if(confirm("سيتم مسح الذاكرة المؤقتة وتحديث التطبيق. هل توافق؟")) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.unregister();
                }
            });
        }
        window.location.reload(true);
    }
}

// ==================== تحديث: دخول الأدمن وتحميل البيانات ====================
function openAdminAuth() {
    const pin = prompt("أدخل كود المشرف:");
    if(pin === "1234") { 
        switchView('admin');
        loadAdminStats();
        loadAdminFeed(); // <--- دالة جديدة
        closeModal('modal-settings'); // نغلق المودال
    } else {
        alert("كود خاطئ");
    }
}

// ==================== جديد: تحميل البوستات للأدمن (مع زر الحذف) ====================
function loadAdminFeed() {
    const list = document.getElementById('admin-feed-list');
    if(!list) return;

    list.innerHTML = '<div style="text-align:center;">جاري التحميل...</div>';

    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(10).get()
      .then(snap => {
          let html = '';
          snap.forEach(doc => {
              const p = doc.data();
              html += `
                <div class="feed-card" style="margin-bottom:10px; border-color:rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; font-weight:bold;">${p.userName}</span>
                        <span style="font-size:10px; color:#9ca3af;">${p.dist} كم</span>
                    </div>
                    <div style="margin-top:5px; font-size:11px; color:#d1d5db;">
                        ${p.link ? '<span style="color:#3b82f6">[يوجد رابط]</span>' : ''} 
                        ${new Date(p.timestamp?.toDate()).toLocaleDateString('ar-EG')}
                    </div>
                    <div style="margin-top:10px; text-align:left;">
                        <button class="btn-admin-delete" onclick="adminDeletePost('${doc.id}')">
                            <i class="ri-delete-bin-line"></i> حذف نهائي
                        </button>
                    </div>
                </div>
              `;
          });
          list.innerHTML = html || '<div style="text-align:center;">لا توجد منشورات</div>';
      });
}

// ==================== جديد: تنفيذ الحذف كأدمن ====================
async function adminDeletePost(postId) {
    if(!confirm("تحذير: سيتم حذف هذا البوست من الـ Feed العام. هل أنت متأكد؟")) return;
    
    try {
        await db.collection('activity_feed').doc(postId).delete();
        alert("تم الحذف بنجاح 👮‍♂️");
        loadAdminFeed(); // تحديث القائمة
        loadGlobalFeed(); // تحديث الصفحة الرئيسية أيضاً
    } catch(e) {
        console.error(e);
        alert("حدث خطأ");
    }
}

// 3. إنشاء تحدي
async function createChallengeUI() {
    const title = document.getElementById('admin-ch-title').value;
    const desc = document.getElementById('admin-ch-desc').value;
    const target = parseFloat(document.getElementById('admin-ch-target').value);
    const days = parseInt(document.getElementById('admin-ch-days').value);

    if(!title || !target) return alert("أكمل البيانات");

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

// ==================== تحديث دالة الـ Feed (مع اللايكات) ====================
function loadGlobalFeed() {
    const feedContainer = document.getElementById('global-feed-list');
    if(!feedContainer) return;

    db.collection('activity_feed')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .onSnapshot(snap => {
          let html = '';
          if(snap.empty) {
              feedContainer.innerHTML = '<div style="text-align:center; color:#6b7280; padding:10px;">لا توجد أنشطة حديثة</div>';
              return;
          }

          snap.forEach(doc => {
              const post = doc.data();
              const postId = doc.id;
              
              let timeAgo = "الآن";
              if(post.timestamp) {
                  const diff = new Date() - post.timestamp.toDate();
                  const mins = Math.floor(diff / 60000);
                  if(mins < 60) timeAgo = `منذ ${mins} د`;
                  else if(mins < 1440) timeAgo = `منذ ${Math.floor(mins/60)} س`;
                  else timeAgo = `منذ ${Math.floor(mins/1440)} يوم`;
              }

              // منطق اللايك ❤️
              const likes = post.likes || [];
              const isLiked = currentUser && likes.includes(currentUser.uid);
              const likeCount = likes.length;
              const likeClass = isLiked ? 'liked' : '';
              const likeIcon = isLiked ? 'ri-heart-fill' : 'ri-heart-line';

              html += `
                <div class="feed-card">
                    <div class="feed-header">
                        <div class="feed-user">
                            <div class="feed-avatar">${(post.userName || "?").charAt(0)}</div>
                            <div>
                                <div class="feed-name">${post.userName}</div>
                                <div class="feed-meta">${post.userRegion} • ${timeAgo}</div>
                            </div>
                        </div>
                    </div>
                    <div class="feed-body">
                        أكمل <strong>${post.type === 'Run' ? 'جرية' : post.type === 'Walk' ? 'مشية' : 'سباق'}</strong> لمسافة 
                        <span class="highlight">${post.dist} كم</span> 
                        في ${post.time} دقيقة 🔥
                    </div>
                    <div class="feed-actions">
                        <button class="btn-like ${likeClass}" onclick="toggleLike('${postId}', '${post.uid}')">
                            <i class="${likeIcon}"></i>
                            <span>${likeCount > 0 ? likeCount : 'تشجيع'}</span>
                        </button>
                    </div>
                </div>
              `;
          });
          feedContainer.innerHTML = html;
      });
}

// ==================== دوال التفاعل والإشعارات ====================

async function toggleLike(postId, postOwnerId) {
    if(!currentUser) return;
    
    const postRef = db.collection('activity_feed').doc(postId);
    const uid = currentUser.uid;

    try {
        const doc = await postRef.get();
        if(!doc.exists) return;

        const likes = doc.data().likes || [];
        
        if (likes.includes(uid)) {
            await postRef.update({
                likes: firebase.firestore.FieldValue.arrayRemove(uid)
            });
        } else {
            await postRef.update({
                likes: firebase.firestore.FieldValue.arrayUnion(uid)
            });
            if(postOwnerId !== uid) {
                sendNotification(postOwnerId, "قام " + userData.name + " بتشجيعك ❤️");
            }
        }
    } catch(e) { console.error("Like Error:", e); }
}

async function sendNotification(receiverId, message) {
    try {
        await db.collection('users').doc(receiverId).collection('notifications').add({
            msg: message,
            read: false,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) { console.error(e); }
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
              const time = n.timestamp ? new Date(n.timestamp.toDate()).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '';
              html += `
                <div class="notif-item">
                    <div class="notif-icon"><i class="ri-notification-3-fill"></i></div>
                    <div class="notif-content">${n.msg}<span class="notif-time">${time}</span></div>
                </div>
              `;
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
// ==================== 1. تحديث دالة عرض السجل (بشكل محترف) ====================
function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if(!list) return;
    
    // استخدام onSnapshot للتحديث اللحظي (Real-time)
    // لاحظ: في التطبيق الكبير يفضل استخدام pagination، لكن هنا سنعرض آخر 20
    db.collection('users').doc(currentUser.uid).collection('runs')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .onSnapshot((snap) => {
          let html = '';
          if(snap.empty) {
              list.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:#6b7280;">
                    <i class="ri-run-line" style="font-size:32px; display:block; margin-bottom:10px; opacity:0.5;"></i>
                    ابدأ رحلتك وسجل أول نشاط!
                </div>`;
              return;
          }

          snap.forEach(doc => {
              const r = doc.data();
              const dateObj = r.timestamp ? r.timestamp.toDate() : new Date();
              // تنسيق التاريخ: "الجمعة، 20 أكتوبر"
              const dateStr = dateObj.toLocaleDateString('ar-EG', { weekday: 'long', month: 'short', day: 'numeric' });
              
              // أيقونة حسب النوع
              let iconClass = 'ri-run-line type-run';
              if(r.type === 'Walk') iconClass = 'ri-walk-line type-walk';

              html += `
              <div class="log-card">
                  <div class="log-info">
                      <h4>
                          <i class="${iconClass} type-icon"></i>
                          ${r.dist} كم
                      </h4>
                      <div class="log-meta">
                          <span><i class="ri-time-line"></i> ${r.time} دقيقة</span>
                          <span>|</span>
                          <span>${dateStr}</span>
                      </div>
                  </div>
                  <div class="log-actions">
                      <button class="btn-delete" onclick="deleteRun('${doc.id}', ${r.dist})">
                          <i class="ri-delete-bin-line"></i>
                      </button>
                  </div>
              </div>`;
          });
          list.innerHTML = html;
      });
}

// ==================== 2. دالة حذف النشاط (Delete) ====================
async function deleteRun(runId, dist) {
    if(!confirm("هل أنت متأكد من حذف هذا النشاط؟ سيتم خصم المسافة من رصيدك.")) return;

    try {
        // 1. حذف الوثيقة
        await db.collection('users').doc(currentUser.uid).collection('runs').doc(runId).delete();

        // 2. خصم المسافة من الإجمالي
        await db.collection('users').doc(currentUser.uid).update({
            totalDist: firebase.firestore.FieldValue.increment(-dist),
            totalRuns: firebase.firestore.FieldValue.increment(-1)
        });

        // 3. (اختياري) خصمها من التحديات - معقد قليلاً سنتركه للمرحلة القادمة أو نقوم به الآن
        // للتبسيط الآن: سنكتفي بخصمها من البروفايل

        // تحديث الواجهة
        userData.totalDist -= dist;
        userData.totalRuns -= 1;
        updateUI();
        
    } catch(e) {
        console.error(e);
        alert("حدث خطأ أثناء الحذف");
    }
}

// ==================== 3. دوال تعديل البروفايل ====================
function openEditProfile() {
    document.getElementById('edit-name').value = userData.name || "";
    document.getElementById('edit-region').value = userData.region || "Cairo";
    document.getElementById('modal-edit-profile').style.display = 'flex';
}

async function saveProfileChanges() {
    const newName = document.getElementById('edit-name').value;
    const newRegion = document.getElementById('edit-region').value;
    
    if(!newName) return alert("الاسم مطلوب");

    const btn = document.querySelector('#modal-edit-profile .btn-primary');
    btn.innerText = "جاري الحفظ...";
    btn.disabled = true;

    try {
        await db.collection('users').doc(currentUser.uid).update({
            name: newName,
            region: newRegion
        });

        // تحديث البيانات المحلية
        userData.name = newName;
        userData.region = newRegion;
        
        updateUI();
        closeModal('modal-edit-profile');
        alert("تم تحديث بياناتك بنجاح ✅");

    } catch(e) {
        console.error(e);
        alert("فشل التحديث");
    } finally {
        btn.innerText = "حفظ التغييرات";
        btn.disabled = false;
    }
}

// ==================== 4. تحديث دالة updateUI لتعرض الإحصائيات الجديدة ====================
function updateUI() {
    // الهيدر
    const headerName = document.getElementById('headerName');
    if (headerName) headerName.innerText = userData.name || "Runner";

    // الداشبورد الرئيسية
    const monthDistEl = document.getElementById('monthDist');
    const totalRunsEl = document.getElementById('totalRuns');
    if (monthDistEl) monthDistEl.innerText = (userData.totalDist || 0).toFixed(1);
    if (totalRunsEl) totalRunsEl.innerText = userData.totalRuns || 0;
    
    // === تحديث قسم البروفايل الجديد ===
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
    
    // الرتبة
    let rank = "مبتدئ";
    const d = userData.totalDist || 0;
    if (d > 50) rank = "هاوي";
    if (d > 100) rank = "محترف";
    if (d > 500) rank = "نخبة";
    const rankBadge = document.getElementById('userRankBadge');
    if (rankBadge) rankBadge.innerText = rank;
}

// -------------------------------- COMPETITION (Leaderboard & Squads) --------------------------------

let allUsersCache = []; 

async function loadLeaderboard(filterType = 'all') {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center; padding:20px; color:#9ca3af;">جاري تحميل الأبطال...</div>';

    if (allUsersCache.length === 0) {
        const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(50).get();
        snap.forEach(doc => allUsersCache.push(doc.data()));
    }

    let displayUsers = allUsersCache;
    if (filterType === 'region') {
        displayUsers = allUsersCache.filter(u => u.region === userData.region);
    }

    list.innerHTML = '';
    if (displayUsers.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px;">لا يوجد منافسين!</div>';
        return;
    }

    displayUsers.forEach((u, index) => {
        let rankBadge = `<span class="rank-num">${index + 1}</span>`;
        if (index === 0) rankBadge = '🥇';
        if (index === 1) rankBadge = '🥈';
        if (index === 2) rankBadge = '🥉';

        const isMe = (u.email === userData.email) ? 'border:1px solid #10b981; background:rgba(16,185,129,0.1);' : '';

        list.innerHTML += `
            <div class="leader-row" style="${isMe}">
                <div class="rank-col">${rankBadge}</div>
                <div class="avatar-col">${(u.name || "?").charAt(0)}</div>
                <div class="info-col">
                    <div class="name">${u.name} ${isMe ? '(أنت)' : ''}</div>
                    <div class="region">${u.region}</div>
                </div>
                <div class="dist-col">${(u.totalDist||0).toFixed(1)} كم</div>
            </div>
        `;
    });
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

    const sortedRegions = Object.keys(regionMap)
        .map(key => ({ name: key, total: regionMap[key] }))
        .sort((a, b) => b.total - a.total);

    list.innerHTML = '';
    const maxVal = sortedRegions[0]?.total || 1; 

    sortedRegions.forEach((r, idx) => {
        const percent = (r.total / maxVal) * 100;
        list.innerHTML += `
            <div class="squad-card">
                <div class="squad-header">
                    <span class="squad-rank">#${idx + 1}</span>
                    <span class="squad-name">${r.name}</span>
                    <span class="squad-total">${r.total.toFixed(0)} كم</span>
                </div>
                <div class="squad-bar-bg">
                    <div class="squad-bar-fill" style="width:${percent}%"></div>
                </div>
            </div>
        `;
    });
}


// ==================== دوال الإعدادات والتحديث ====================

function openSettingsModal() {
    document.getElementById('modal-settings').style.display = 'flex';
}

// ⚠️ الدالة السحرية للتحديث الإجباري
async function forceUpdateApp() {
    const btn = document.querySelector('.setting-item i.ri-refresh-line').parentElement;
    btn.innerHTML = '<div class="spinner"></div>'; // مؤشر تحميل بسيط

    if(confirm("سيتم تحديث التطبيق الآن للحصول على أحدث الميزات. هل أنت متأكد؟")) {
        try {
            // 1. إلغاء تسجيل الـ Service Worker (المسؤول عن الكاش)
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for(let registration of registrations) {
                    await registration.unregister();
                }
            }
            
            // 2. مسح الكاش المخزن
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            }
            
            alert("تم مسح النسخة القديمة! سيتم إعادة التحميل الآن.");
            
            // 3. إعادة تحميل الصفحة بقوة (من السيرفر مباشرة)
            window.location.reload(true);
            
        } catch(e) {
            console.error("Update Error:", e);
            alert("حدث خطأ، يرجى مسح بيانات المتصفح يدوياً.");
            window.location.reload();
        }
    }
}
// ==================== 5. لوحة تحكم الأدمن (Admin Dashboard) ====================

// 1. التحقق من الصلاحية (دخول بكلمة سر)
function openAdminAuth() {
    const pin = prompt("أدخل كود المشرف:");
    // يمكنك تغيير "1234" لأي رقم سري تريده
    if(pin === "a4450422") {
        switchView('admin');
        loadAdminStats();
    } else {
        alert("كود خاطئ! 🚫");
    }
}

// 2. إنشاء تحدي من الواجهة
async function createChallengeUI() {
    const title = document.getElementById('admin-ch-title').value;
    const desc = document.getElementById('admin-ch-desc').value;
    const target = parseFloat(document.getElementById('admin-ch-target').value);
    const days = parseInt(document.getElementById('admin-ch-days').value);

    if(!title || !target) return alert("البيانات ناقصة!");

    const btn = document.querySelector('#view-admin .btn-primary');
    btn.innerText = "جاري النشر...";
    btn.disabled = true;

    try {
        await db.collection('challenges').add({
            title: title,
            desc: desc,
            target: target,
            active: true,
            type: "distance",
            startDate: new Date().toISOString(),
            // حساب تاريخ النهاية
            endDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() 
        });

        alert("تم نشر التحدي بنجاح! 🚀");
        
        // تنظيف الحقول
        document.getElementById('admin-ch-title').value = "";
        document.getElementById('admin-ch-desc').value = "";
        document.getElementById('admin-ch-target').value = "";
        
        // العودة للرئيسية
        switchView('home');
        loadActiveChallenges(); // تحديث القائمة

    } catch(e) {
        console.error(e);
        alert("حدث خطأ: " + e.message);
    } finally {
        btn.innerText = "نشر التحدي";
        btn.disabled = false;
    }
}

// 3. إحصائيات سريعة
function loadAdminStats() {
    const statsDiv = document.getElementById('admin-stats');
    db.collection('users').get().then(snap => {
        const usersCount = snap.size;
        // ممكن نضيف حاجات تانية هنا مستقبلاً
        statsDiv.innerHTML = `عدد الأعضاء المسجلين: <strong style="color:#fff">${usersCount}</strong>`;
    });
}

