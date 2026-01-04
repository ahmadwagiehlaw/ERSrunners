/* ERS GPS Tracking (Optional) - local only, then fills manual log modal */

// Global state (kept intentionally small)
const ERS_GPS = {
  active: false,
  paused: false,
  watchId: null,
  timerId: null,
  startMs: null,
  lastMs: null,
  elapsedSec: 0,
  lastPos: null,
  points: 0,
  distM: 0,
  accSamples: [],
};

function _ersGpsHasGeo(){
  return !!(navigator && navigator.geolocation);
}

function _ersHaversineMeters(a, b){
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function _ersFmtTime(sec){
  const s = Math.max(0, Math.floor(sec || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function _ersAvg(nums){
  const a = (Array.isArray(nums) ? nums : []).filter(n => Number.isFinite(n));
  if(!a.length) return null;
  return a.reduce((x,y)=>x+y,0) / a.length;
}

function _ersGpsUpdateUI(){
  const distEl = document.getElementById('gps-live-dist');
  const timeEl = document.getElementById('gps-live-time');
  const paceEl = document.getElementById('gps-live-pace');
  const accEl  = document.getElementById('gps-live-acc');
  const ptsEl  = document.getElementById('gps-live-points');
  const statusEl = document.getElementById('gps-status');
  if(distEl) distEl.innerText = (ERS_GPS.distM / 1000).toFixed(2);
  if(timeEl) timeEl.innerText = _ersFmtTime(ERS_GPS.elapsedSec);

  const distKm = ERS_GPS.distM / 1000;
  const timeMin = ERS_GPS.elapsedSec / 60;
  const pace = (distKm > 0.05) ? (timeMin / distKm) : null;
  if(paceEl) paceEl.innerText = pace ? pace.toFixed(1) : '-';

  const avgAcc = _ersAvg(ERS_GPS.accSamples);
  if(accEl) accEl.innerText = avgAcc ? `${avgAcc.toFixed(0)}m` : '-';
  if(ptsEl) ptsEl.innerText = String(ERS_GPS.points || 0);

  if(statusEl){
    if(!_ersGpsHasGeo()){
      statusEl.innerText = 'المتصفح لا يدعم GPS على هذا الجهاز.';
    } else if(!ERS_GPS.active){
      statusEl.innerText = 'جاهز. اضغط "ابدأ".';
    } else if(ERS_GPS.paused){
      statusEl.innerText = 'موقوف مؤقتاً. اضغط "استكمال".';
    } else {
      statusEl.innerText = 'جاري التتبع… اترك GPS يعمل بدقة أعلى (High Accuracy).';
    }
  }
}

function _ersGpsSetButtons(){
  const startBtn = document.getElementById('gps-btn-start');
  const pauseBtn = document.getElementById('gps-btn-pause');
  const finishBtn = document.getElementById('gps-btn-finish');
  if(startBtn) startBtn.disabled = ERS_GPS.active;
  if(pauseBtn) pauseBtn.disabled = !ERS_GPS.active;
  if(finishBtn) finishBtn.disabled = !ERS_GPS.active || (ERS_GPS.elapsedSec < 10);
  if(pauseBtn) pauseBtn.innerText = ERS_GPS.paused ? 'استكمال' : 'إيقاف مؤقت';
}

function _ersGpsResetState(){
  ERS_GPS.active = false;
  ERS_GPS.paused = false;
  ERS_GPS.watchId = null;
  ERS_GPS.timerId = null;
  ERS_GPS.startMs = null;
  ERS_GPS.lastMs = null;
  ERS_GPS.elapsedSec = 0;
  ERS_GPS.lastPos = null;
  ERS_GPS.points = 0;
  ERS_GPS.distM = 0;
  ERS_GPS.accSamples = [];
}

function openGpsRunFromLog(){
  // close manual log and open gps
  try{ closeModal('modal-log'); }catch(e){}
  _ersGpsResetState();
  try{ openModal('modal-gps'); }catch(e){}
  _ersGpsUpdateUI();
  _ersGpsSetButtons();
  if(!_ersGpsHasGeo()){
    try{ showToast('GPS غير مدعوم على هذا الجهاز', 'error'); }catch(e){}
  }
}

function gpsStart(){
  if(!_ersGpsHasGeo()){
    try{ showToast('GPS غير مدعوم على هذا الجهاز', 'error'); }catch(e){}
    return;
  }
  if(ERS_GPS.active) return;

  ERS_GPS.active = true;
  ERS_GPS.paused = false;
  ERS_GPS.startMs = Date.now();
  ERS_GPS.lastMs = ERS_GPS.startMs;
  ERS_GPS.elapsedSec = 0;

  // timer
  ERS_GPS.timerId = setInterval(()=>{
    if(!ERS_GPS.active || ERS_GPS.paused) return;
    ERS_GPS.elapsedSec += 1;
    _ersGpsUpdateUI();
    _ersGpsSetButtons();
  }, 1000);

  const opts = { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 };
  ERS_GPS.watchId = navigator.geolocation.watchPosition(
    (pos)=>{
      if(!ERS_GPS.active || ERS_GPS.paused) return;

      const c = pos && pos.coords ? pos.coords : null;
      if(!c) return;

      const p = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, t: pos.timestamp };
      ERS_GPS.points += 1;
      if(Number.isFinite(p.acc)) ERS_GPS.accSamples.push(p.acc);

      // Filter: ignore very poor accuracy points
      const accOk = Number.isFinite(p.acc) ? (p.acc <= 35) : true;

      if(ERS_GPS.lastPos && accOk){
        const last = ERS_GPS.lastPos;
        const dt = Math.max(1, (p.t - last.t) / 1000);
        const dm = _ersHaversineMeters({lat:last.lat, lon:last.lon}, {lat:p.lat, lon:p.lon});

        // Filter spikes: unrealistic speed (> 7 m/s ~ 25 km/h)
        const speed = dm / dt;
        if(speed <= 7 && dm <= 250){
          ERS_GPS.distM += dm;
        }
      }

      // Update last pos even if accuracy not ok (but keep dist guarded)
      ERS_GPS.lastPos = p;
      _ersGpsUpdateUI();
      _ersGpsSetButtons();
    },
    (err)=>{
      console.warn('[GPS] error', err);
      try{ showToast('تعذر الوصول للـGPS. فعّل الموقع وجرّب تاني.', 'error'); }catch(e){}
      // keep active but allow user to cancel
      _ersGpsUpdateUI();
      _ersGpsSetButtons();
    },
    opts
  );

  _ersGpsUpdateUI();
  _ersGpsSetButtons();
}

function gpsTogglePause(){
  if(!ERS_GPS.active) return;
  ERS_GPS.paused = !ERS_GPS.paused;

  if(ERS_GPS.paused){
    // Stop watching to save battery
    try{ if(ERS_GPS.watchId != null) navigator.geolocation.clearWatch(ERS_GPS.watchId); }catch(e){}
    ERS_GPS.watchId = null;
  }else{
    // Resume
    try{ gpsStartResumeWatch(); }catch(e){}
  }

  _ersGpsUpdateUI();
  _ersGpsSetButtons();
}

function gpsStartResumeWatch(){
  if(!_ersGpsHasGeo()) return;
  if(!ERS_GPS.active) return;
  if(ERS_GPS.watchId != null) return;

  const opts = { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 };
  ERS_GPS.watchId = navigator.geolocation.watchPosition(
    (pos)=>{
      if(!ERS_GPS.active || ERS_GPS.paused) return;
      const c = pos && pos.coords ? pos.coords : null;
      if(!c) return;
      const p = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, t: pos.timestamp };
      ERS_GPS.points += 1;
      if(Number.isFinite(p.acc)) ERS_GPS.accSamples.push(p.acc);
      const accOk = Number.isFinite(p.acc) ? (p.acc <= 35) : true;
      if(ERS_GPS.lastPos && accOk){
        const last = ERS_GPS.lastPos;
        const dt = Math.max(1, (p.t - last.t) / 1000);
        const dm = _ersHaversineMeters({lat:last.lat, lon:last.lon}, {lat:p.lat, lon:p.lon});
        const speed = dm / dt;
        if(speed <= 7 && dm <= 250){
          ERS_GPS.distM += dm;
        }
      }
      ERS_GPS.lastPos = p;
      _ersGpsUpdateUI();
      _ersGpsSetButtons();
    },
    ()=>{},
    opts
  );
}

function gpsFinish(){
  if(!ERS_GPS.active) return;

  // stop watchers/timers
  try{ if(ERS_GPS.timerId) clearInterval(ERS_GPS.timerId); }catch(e){}
  ERS_GPS.timerId = null;
  try{ if(ERS_GPS.watchId != null) navigator.geolocation.clearWatch(ERS_GPS.watchId); }catch(e){}
  ERS_GPS.watchId = null;

  const endMs = Date.now();
  const distKm = ERS_GPS.distM / 1000;
  const timeMin = ERS_GPS.elapsedSec / 60;
  const pace = (distKm > 0.05) ? (timeMin / distKm) : 0;
  const avgAcc = _ersAvg(ERS_GPS.accSamples);

  const stepsToggle = document.getElementById('gps-steps-toggle');
  const wantSteps = !!(stepsToggle && stepsToggle.checked);
  const stepsEst = wantSteps ? Math.max(0, Math.round(ERS_GPS.distM / 0.78)) : null; // 0.78m/step approx

  // Store summary (pending until submit)
  window._ersLastGpsSummary = {
    pending: true,
    startMs: ERS_GPS.startMs,
    endMs,
    distKm,
    timeMin,
    pace,
    points: ERS_GPS.points,
    avgAccM: avgAcc,
    stepsEst,
  };

  // Fill log modal fields
  const distEl = document.getElementById('log-dist');
  const timeEl = document.getElementById('log-time');
  const typeEl = document.getElementById('log-type');
  const dateEl = document.getElementById('log-date');
  if(distEl) distEl.value = distKm > 0 ? distKm.toFixed(2) : '';
  if(timeEl) timeEl.value = timeMin > 0 ? timeMin.toFixed(0) : '';
  if(typeEl) typeEl.value = 'Run';
  if(dateEl){
    const d = new Date(ERS_GPS.startMs || endMs);
    const pad = (n)=>String(n).padStart(2,'0');
    // datetime-local: YYYY-MM-DDTHH:MM
    dateEl.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // update log panel badge
  try{ updateGpsLogPanel(); }catch(e){}

  // back to log modal
  try{ closeModal('modal-gps'); }catch(e){}
  try{ openModal('modal-log'); }catch(e){}
  try{ showToast('تم تعبئة بيانات GPS ✅', 'success'); }catch(e){}

  // reset runtime state (but keep summary)
  _ersGpsResetState();
  _ersGpsUpdateUI();
  _ersGpsSetButtons();
}

function gpsCancel(){
  // Stop and go back without saving
  try{ if(ERS_GPS.timerId) clearInterval(ERS_GPS.timerId); }catch(e){}
  try{ if(ERS_GPS.watchId != null && _ersGpsHasGeo()) navigator.geolocation.clearWatch(ERS_GPS.watchId); }catch(e){}
  _ersGpsResetState();
  try{ closeModal('modal-gps'); }catch(e){}
  try{ openModal('modal-log'); }catch(e){}
  _ersGpsUpdateUI();
  _ersGpsSetButtons();
}

function clearGpsSummary(){
  try{ window._ersLastGpsSummary = null; }catch(e){}
  try{ updateGpsLogPanel(); }catch(e){}
  try{ showToast('تم مسح بيانات GPS', 'success'); }catch(e){}
}

function updateGpsLogPanel(){
  const panel = document.getElementById('gps-log-panel');
  const badge = document.getElementById('gps-log-badge');
  const sub = document.getElementById('gps-log-sub');
  if(!panel || !sub) return;

  const s = window._ersLastGpsSummary;
  if(s && s.pending){
    if(badge) badge.style.display = 'inline-flex';
    const p = (s.pace && s.pace > 0) ? ` • بيس: ${s.pace.toFixed(1)} د/كم` : '';
    const st = (s.stepsEst != null) ? ` • خطوات (تقديري): ${s.stepsEst}` : '';
    sub.innerText = `جاهز للحفظ من GPS: ${s.distKm.toFixed(2)} كم • ${Math.round(s.timeMin)} دقيقة${p}${st}`;
  }else{
    if(badge) badge.style.display = 'none';
    sub.innerText = 'الوضع الافتراضي مانيوال. اضغط لبدء تتبّع GPS ثم سيتم تعبئة المسافة/الوقت تلقائيًا.';
  }
}

// keep panel in sync when runs update or when modal opens
document.addEventListener('DOMContentLoaded', ()=>{
  try{ updateGpsLogPanel(); }catch(e){}
  // When log modal opens (if app uses display style), we refresh the badge
  document.addEventListener('click', (e)=>{
    const t = e && e.target;
    if(!t) return;
    // if user opened log modal from any button with openModal('modal-log') inline
    // we refresh after a tick
    if(t.getAttribute && String(t.getAttribute('onclick')||'').includes("openModal('modal-log')")){
      setTimeout(()=>{ try{ updateGpsLogPanel(); }catch(e){} }, 50);
    }
  });
});
