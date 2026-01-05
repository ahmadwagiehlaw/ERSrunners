/* ERS Core: Utilities */

// ==================== 0. Helpers & Utilities ====================

// 0.1 تحديد ما إذا كان نوع النشاط "Core/XT" (يعتمد على الوقت أكثر من المسافة)
// ملاحظة: هذا يساعد في عرض السجل وحفظ البيانات (dist/time/xtDist).
function _ersIsCoreType(type) {
    const t = String(type || '').trim().toLowerCase();
    if (!t) return false;

    // أنواع الجري الشائعة (ليست Core)
    const nonCore = new Set(['run','running','walk','walking','jog','jogging','race','interval','tempo','long','easy']);
    if (nonCore.has(t)) return false;

    // أي نوع يشير لتدريب قوة/كروس/مرونة يعتبر Core
    const coreHints = ['strength', 'cross', 'wod', 'hiit', 'mobility', 'yoga', 'gym', 'xt'];
    return coreHints.some(h => t.includes(h));
}
window._ersIsCoreType = window._ersIsCoreType || _ersIsCoreType;


// 1. تحريك الأرقام (Animation)
function animateValue(obj, start, end, duration) {
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = progress * (end - start) + start;
        obj.innerHTML = Number.isInteger(end) ? Math.floor(value) : value.toFixed(1);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = Number.isInteger(end) ? end : end.toFixed(1);
        }
    };
    window.requestAnimationFrame(step);
}

// 2. جلب البيانات بأمان (Caching)
async function fetchTopRunners() {
    if (allUsersCache.length > 0) return allUsersCache;
    try {
        const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(50).get();
        allUsersCache = [];
        snap.forEach(doc => {
            allUsersCache.push({ uid: doc.id, ...doc.data() }); 
        });
        return allUsersCache;
    } catch(e) {
        console.error("Network Error:", e);
        return [];
    }
}

// 3. دوال التاريخ والأرقام
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
    if (user.gender === 'female') return isNew ? '🐣' : '🏃‍♀️';
    return isNew ? '🐣' : '🏃';
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

 


function _escapeHtml(str){
    return (str||'')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}


function _toYouTubeEmbed(url){
    if(!url) return null;
    try{
        const u = new URL(url);
        let id = '';
        if(u.hostname.includes('youtu.be')){
            id = u.pathname.replace('/','').trim();
        }else if(u.hostname.includes('youtube.com')){
            if(u.pathname.startsWith('/watch')) id = u.searchParams.get('v') || '';
            if(u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] || '';
            if(u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2] || '';
        }
        if(!id) return null;
        return `https://www.youtube-nocookie.com/embed/${id}`;
    }catch(e){
        return null;
    }
}

// 4. Network Monitor (SAFE)
// بعض النسخ كانت تستدعي initNetworkMonitor داخل initApp بدون تعريفها.
// هذه النسخة "لا تغيّر" أي صفحة أخرى: فقط تضيف listeners وتحدّث مؤشر اختياري إن وجد.
function initNetworkMonitor() {
    try {
        const el = document.getElementById('network-indicator') || document.getElementById('net-indicator');
        const apply = () => {
            const online = (typeof navigator !== 'undefined') ? navigator.onLine : true;
            document.documentElement.classList.toggle('is-offline', !online);
            if (el) {
                el.textContent = online ? 'متصل' : 'غير متصل';
                el.style.opacity = online ? '0.7' : '1';
            }
        };
        window.addEventListener('online', () => apply(), { passive: true });
        window.addEventListener('offline', () => apply(), { passive: true });
        apply();
    } catch (e) {
        console.warn('[initNetworkMonitor] failed:', e);
    }
}
window.initNetworkMonitor = window.initNetworkMonitor || initNetworkMonitor;
