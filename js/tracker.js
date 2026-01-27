/* tracker.js - Real-time GPS Tracking Logic */

let trackInterval = null;
let trackStartTime = 0;
let trackElapsedTime = 0; // seconds
let trackDist = 0; // km
let trackPath = []; // Array of [lat, lng]
let isTracking = false;
let isPaused = false;
let mapInstance = null;
let polyline = null;
let marker = null;
let lastLat = null;
let lastLng = null;

// Initialize Map
function initMap() {
    if (mapInstance) return; // Already initialized

    // Default to Egypt
    mapInstance = L.map('track-map', { zoomControl: false }).setView([30.0444, 31.2357], 13);

    // Dark Mode Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap & CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(mapInstance);
}

// Start Tracking
function startTracking() {
    if (!ERS_NATIVE.isNative) {
        // Web Fallback or Alert
        // alert("Starting Web GPS..."); 
    }

    if (isPaused) {
        resumeTracking();
        return;
    }

    // Reset Data
    trackElapsedTime = 0;
    trackDist = 0;
    trackPath = [];
    lastLat = null;
    lastLng = null;

    // UI Updates
    document.getElementById('track-btn-start').style.display = 'none';
    document.getElementById('track-btn-pause').style.display = 'block';

    trackStartTime = Date.now();
    isTracking = true;
    isPaused = false;

    // Start Timer
    trackInterval = setInterval(updateTimer, 1000);

    // Start Native GPS
    ERS_NATIVE.startBackgroundTracker();

    // Listen for updates
    window.addEventListener('gps-update', handleGpsUpdate);

    // Wake Lock
    if (ERS_NATIVE.isNative) {
        // Capacitor KeepAwake is handled in background mode plugin usually,
        // but we can request it if plugin available
    }
}

function pauseTracking() {
    isPaused = true;
    isTracking = false;
    clearInterval(trackInterval);

    document.getElementById('track-btn-pause').style.display = 'none';
    document.getElementById('track-btn-start').style.display = 'block';
    document.getElementById('track-btn-start').innerHTML = '<i class="ri-play-fill"></i>';
    document.getElementById('track-btn-stop').style.display = 'block'; // Show Stop when paused
}

function resumeTracking() {
    isPaused = false;
    isTracking = true;
    trackStartTime = Date.now() - (trackElapsedTime * 1000);
    trackInterval = setInterval(updateTimer, 1000);

    document.getElementById('track-btn-start').style.display = 'none';
    document.getElementById('track-btn-pause').style.display = 'block';
    document.getElementById('track-btn-stop').style.display = 'none';
}

function stopTracking() {
    isTracking = false;
    isPaused = false;
    clearInterval(trackInterval);
    ERS_NATIVE.stopBackgroundTracker();

    // Open Save Modal with Data
    closeModal('modal-track');
    openModal('modal-log');

    // Pre-fill
    document.getElementById('log-dist').value = trackDist.toFixed(2);
    // Convert seconds to minutes for the specific input
    document.getElementById('log-time').value = (trackElapsedTime / 60).toFixed(0);

    // Trigger Pace Calc
    if (window.calcPace) window.calcPace();

    // Reset UI
    resetTrackUI();
}

function updateTimer() {
    trackElapsedTime++;
    const m = Math.floor(trackElapsedTime / 60);
    const s = trackElapsedTime % 60;
    document.getElementById('track-time').innerText =
        `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function handleGpsUpdate(e) {
    if (!isTracking || isPaused) return;

    const { lat, lng, speed, acc } = e.detail;

    console.log("GPS Update", lat, lng, acc);

    // Update Map
    if (mapInstance) {
        const latLng = [lat, lng];

        if (!marker) {
            marker = L.circleMarker(latLng, { color: '#10b981', radius: 8 }).addTo(mapInstance);
        } else {
            marker.setLatLng(latLng);
        }

        mapInstance.setView(latLng); // Follow user

        // Draw Path
        trackPath.push(latLng);
        if (!polyline) {
            polyline = L.polyline(trackPath, { color: '#10b981', weight: 4 }).addTo(mapInstance);
        } else {
            polyline.setLatLngs(trackPath);
        }
    }

    // Calculate Distance
    if (lastLat && lastLng) {
        const d = calcDistance(lastLat, lastLng, lat, lng);
        // Basic filter for GPS noise (optional: ignore very small jumps if necessary)
        if (d > 0.002) { // Only count if moved > 2 meters
            trackDist += d;
            document.getElementById('track-dist').innerText = trackDist.toFixed(2);

            // Pace Calculation
            // speed is m/s
            // pace is min/km
            if (speed > 0.5) { // If moving
                const paceSecondsPerKm = 1000 / speed;
                const pM = Math.floor(paceSecondsPerKm / 60);
                const pS = Math.floor(paceSecondsPerKm % 60);
                document.getElementById('track-pace').innerText = `${pM}:${pS.toString().padStart(2, '0')}`;
            }
        }
    }

    lastLat = lat;
    lastLng = lng;
}

// Create Start Button logic to open this modal
function openTrackModal() {
    openModal('modal-track');
    setTimeout(initMap, 500); // Wait for transition
    resetTrackUI();
}

function resetTrackUI() {
    document.getElementById('track-dist').innerText = "0.00";
    document.getElementById('track-time').innerText = "00:00";
    document.getElementById('track-pace').innerText = "--:--";
    document.getElementById('track-btn-start').style.display = 'block';
    document.getElementById('track-btn-pause').style.display = 'none';
    document.getElementById('track-btn-stop').style.display = 'none';

    // Clear Map
    if (polyline) polyline.setLatLngs([]);
    trackPath = [];
}

// Haversine Formula (km)
function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Screen Lock
let isLocked = false;
let lockTimeout;
function toggleScreenLock() {
    // Just simple overlay for now
    const overlay = document.getElementById('lock-overlay');

    if (!isLocked) {
        overlay.style.display = 'flex';
        isLocked = true;
        // Logic to prevent touches on buttons handled by overlay z-index

        // Add long press listener to unlock
        const icon = overlay.querySelector('.ri-lock-2-fill');
        icon.addEventListener('pointerdown', startUnlock);
        icon.addEventListener('pointerup', cancelUnlock);
        icon.addEventListener('pointerleave', cancelUnlock);
    }
}

function startUnlock() {
    const icon = document.querySelector('#lock-overlay .ri-lock-2-fill');
    icon.style.transform = 'scale(1.5)';
    icon.style.transition = 'transform 1s';

    lockTimeout = setTimeout(() => {
        document.getElementById('lock-overlay').style.display = 'none';
        isLocked = false;
        icon.style.transform = 'scale(1)';
        showToast('Screen Unlocked');
    }, 1000); // 1 second hold
}

function cancelUnlock() {
    clearTimeout(lockTimeout);
    const icon = document.querySelector('#lock-overlay .ri-lock-2-fill');
    icon.style.transform = 'scale(1)';
}
