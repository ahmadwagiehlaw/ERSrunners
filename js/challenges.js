/* ERS Challenges & Leaderboards */

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


/* Challenge Engine */
// ==================== V5.0 Challenge Engine & Admin Tools ====================

var allChallengesCache = window.allChallengesCache || (window.allChallengesCache = []);


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

var currentReportFeedId = window.currentReportFeedId || null;
window.currentReportFeedId = currentReportFeedId;


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


/* Challenge Details & Joining */
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
// ==================== Hall of Fame (RUNS COLLECTION - SAFE) ====================
async function loadHallOfFame() {
    const listEl = document.getElementById('hall-of-fame-list');
    if (!listEl) return;

    listEl.innerHTML =
        '<div style="text-align:center; padding:10px; color:#6b7280;">جاري التحميل...</div>';

    try {
        const usersSnap = await db.collection('users').get();
        const ranking = [];

        for (const userDoc of usersSnap.docs) {
            const user = userDoc.data();

            // 🔹 جلب الجريات الحقيقية
            const runsSnap = await db
                .collection('users')
                .doc(userDoc.id)
                .collection('runs')
                .get();

            let totalRunDist = 0;

            runsSnap.forEach(runDoc => {
                const run = runDoc.data();
                const dist = Number(run.dist || run.distance || 0);
                if (dist > 0) totalRunDist += dist;
            });

            if (totalRunDist > 0) {
                ranking.push({
                    uid: userDoc.id,
                    name: user.name || 'عضو',
                    region: user.region || '',
                    gender: user.gender,
                    totalRunDist
                });
            }
        }

        if (ranking.length === 0) {
            listEl.innerHTML =
                '<div style="text-align:center; padding:10px; color:#6b7280;">لا توجد جريات مسجلة</div>';
            return;
        }

        ranking.sort((a, b) => b.totalRunDist - a.totalRunDist);

        listEl.innerHTML = ranking
            .slice(0, 5)
            .map((u, idx) => `
                <div class="hof-row" onclick="viewUserProfile('${u.uid}')">
                    <div class="hof-rank">${idx + 1}</div>
                    <div class="hof-avatar">${getUserAvatar(u)}</div>
                    <div class="hof-main">
                        <div class="hof-name">${u.name}</div>
                        <div class="hof-meta">${u.region}</div>
                    </div>
                    <div class="hof-dist">${u.totalRunDist.toFixed(1)} كم</div>
                </div>
            `)
            .join('');

    } catch (e) {
        console.error(e);
        listEl.innerHTML =
            '<div style="text-align:center; padding:10px; color:#ef4444;">خطأ في تحميل الترتيب</div>';
    }
}



// ==================== Coach Home Tabs (V3.3) ====================

document.addEventListener('DOMContentLoaded', ()=>{

    setupCoachHomeTabs();
    setupLogTypeUI();

    // Initial render for coach hero stats (may be updated again once runs load)
    try { 
        renderCoachHeroStats(); 
    } catch(e) {}
});


//============= Re-render coach hero stats whenever runs cache updates
// Re-render coach hero stats whenever runs cache updates
window.addEventListener('ers:runs-updated', () => {
    try {
        renderCoachHeroStats();
    } catch (e) {}

    // ✅ هنا المكان الصح
    try {
        if (typeof loadHallOfFame === 'function') {
            loadHallOfFame();
        }
    } catch (e) {
        console.error('Hall of Fame error:', e);
    }
});


// === دالة تحديث بيانات الكوتش (الهيرو) ===
// ==================== Coach Hero Stats (SAFE GLOBAL) ====================
window.renderCoachHeroStats = function () {
    const weekEl = document.getElementById('hero-week-dist');
    const monthEl = document.getElementById('hero-month-dist');
    const streakEl = document.getElementById('hero-streak');

    if (!weekEl) return;

    // Robust date parsing for legacy runs:
    // بعض النسخ القديمة كانت تحفظ التاريخ باسم مختلف أو بصيغة مختلفة،
    // فبنحاول نقرأه بأمان بدل ما تتحول الإحصائيات لصفر.
    function _ersToDate(val) {
        if (!val) return null;
        try {
            if (typeof val.toDate === 'function') {
                const d = val.toDate();
                return (d instanceof Date && !isNaN(d)) ? d : null;
            }
        } catch (e) {}

        // Firestore Timestamp-like object {seconds, nanoseconds}
        try {
            if (typeof val === 'object' && typeof val.seconds === 'number') {
                const d = new Date(val.seconds * 1000);
                return !isNaN(d) ? d : null;
            }
        } catch (e) {}

        // number (ms) or string (ISO)
        if (typeof val === 'number' || typeof val === 'string') {
            const d = new Date(val);
            return !isNaN(d) ? d : null;
        }

        if (val instanceof Date) return !isNaN(val) ? val : null;
        return null;
    }

    function _ersGetRunDate(r) {
        if (!r) return null;
        return (
            _ersToDate(r.timestamp) ||
            _ersToDate(r.date) ||
            _ersToDate(r.runDate) ||
            _ersToDate(r.createdAt) ||
            _ersToDate(r.timeStamp) ||
            _ersToDate(r.ts) ||
            _ersToDate(r.dateISO)
        );
    }

    const runs = Array.isArray(window._ersRunsCache) ? window._ersRunsCache : [];
    const now = new Date();

    let week = 0;
    let month = 0;
    const activeDayKeys = new Set();

    runs.forEach(r => {
        const d = _ersGetRunDate(r);
        if (!d) return;
        const dist = Number(r.dist) || 0;

        if ((now - d) / 86400000 <= 7) week += dist;
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            month += dist;
        }
        // streak considers core activities only (dist > 0)
        if (dist > 0) activeDayKeys.add(d.toISOString().slice(0, 10));
    });

    function computeStreakFromKeys(keysSet){
        if(!keysSet || keysSet.size === 0) return 0;
        const cursor = new Date();
        cursor.setHours(0,0,0,0);
        let k = cursor.toISOString().slice(0,10);
        // لو مفيش نشاط النهارده، نبدأ من امبارح
        if(!keysSet.has(k)){
            cursor.setDate(cursor.getDate()-1);
            k = cursor.toISOString().slice(0,10);
        }
        let streak = 0;
        while(keysSet.has(k)){
            streak++;
            cursor.setDate(cursor.getDate()-1);
            k = cursor.toISOString().slice(0,10);
        }
        return streak;
    }

    const streakFromRuns = computeStreakFromKeys(activeDayKeys);
    const userStreak = Number((window.userData && window.userData.currentStreak) || (typeof userData !== 'undefined' ? userData.currentStreak : 0));
    const safeStreak = (Number.isFinite(userStreak) && userStreak > 0) ? userStreak : streakFromRuns;

    weekEl.innerText = week.toFixed(1);
    if (monthEl) monthEl.innerText = month.toFixed(1);
    if (streakEl) streakEl.innerText = safeStreak;
};


function computeHeroStatsFromRuns(runs){
    const now = new Date();
    let weekDist = 0;
    let monthDist = 0;
    let daysSet = new Set();

    runs.forEach(r => {
        if(!r.timestamp || !r.dist) return;

        const d = r.timestamp.toDate();
        const diffDays = (now - d) / 86400000;

        // آخر 7 أيام
        if (diffDays <= 7) {
            weekDist += Number(r.dist) || 0;
        }

        // نفس الشهر
        if (
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
        ) {
            monthDist += Number(r.dist) || 0;
        }

        // ستريك (يوم فيه أي نشاط)
        daysSet.add(d.toISOString().slice(0,10));
    });

    return {
        weekDist: weekDist.toFixed(1),
        monthDist: monthDist.toFixed(1),
        streak: daysSet.size
    };
}
 