/* tracker.js - Real-time GPS Tracking Logic (V4: Audio Coach + Countdown) */

let trackInterval = null;
let trackStartTime = 0;
let trackElapsedTime = 0; // seconds
let trackDist = 0; // km
let trackPath = []; // Array of [lat, lng]
let isTracking = false;
let isPaused = false;
let mapInstance = null;
let polyline = null; // Legacy support
let mapSegments = []; // New Heatmap segments
let marker = null;
let lastLat = null;
let lastLng = null;

// Audio Coach State
let isAudioMuted = false;
let lastSpokenKm = 0;
let ghostTargetPace = null;
let isAutoPaused = false;
let autoPauseTimer = null;

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

/* ==================== 1. Flow Control (Countdown -> Start) ==================== */

function startTrackingFlow() {
    // 1. Check permissions first (Native or Web)
    // 2. Start Countdown
    startCountdown(() => {
        startTracking();
    });
}

function startCountdown(callback) {
    const overlay = document.getElementById('countdown-overlay');
    const numEl = document.getElementById('countdown-number');

    // Show Overlay
    overlay.style.display = 'flex';

    let count = 3;

    // Unlock Audio Context (Mobile Web Requirement)
    speak('');

    function tick() {
        if (count > 0) {
            numEl.innerText = count;
            numEl.className = 'countdown-pop'; // Trigger animation

            // Trigger reflow to restart animation
            void numEl.offsetWidth;

            speak(count.toString());
            if (window.ERS_NATIVE) window.ERS_NATIVE.triggerHaptic('light'); // Tick

            setTimeout(() => {
                count--;
                tick();
            }, 1000);
        } else {
            // GO!
            numEl.innerText = "GO!";
            speak("Go!");
            if (window.ERS_NATIVE) window.ERS_NATIVE.triggerHaptic('success'); // GO!

            setTimeout(() => {
                overlay.style.display = 'none';
                if (callback) callback();
            }, 800);
        }
    }

    tick();
}


/* ==================== 2. Tracking Logic ==================== */

function startTracking() {
    if (typeof ERS_NATIVE !== 'undefined' && !ERS_NATIVE.isNative) {
        // Web Fallback
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
    lastSpokenKm = 0;

    // UI Updates
    document.getElementById('track-btn-start').style.display = 'none';
    document.getElementById('track-btn-pause').style.display = 'block';

    trackStartTime = Date.now();
    isTracking = true;
    isPaused = false;

    // Start Timer
    trackInterval = setInterval(updateTimer, 1000);

    // Audio Feedback
    speak("Starting workout.");

    // Ghost Runner Init
    if (window.fetchBestPace) {
        window.fetchBestPace().then(pace => {
            if (pace) {
                ghostTargetPace = pace;
                console.log("👻 Ghost Runner Active! Target Pace:", pace, "s/km");
                speak("Ghost Runner active. Beat your best pace!");
            }
        });
    }

    // Start Native GPS
    if (typeof ERS_NATIVE !== 'undefined') {
        ERS_NATIVE.startBackgroundTracker();
    }

    // Listen for updates
    window.addEventListener('gps-update', handleGpsUpdate);
}

function pauseTracking() {
    isPaused = true;
    isTracking = false;
    clearInterval(trackInterval);

    document.getElementById('track-btn-pause').style.display = 'none';
    document.getElementById('track-btn-start').style.display = 'block';

    // Change Icon back to Play (Resume)
    const storedBtn = document.getElementById('track-btn-start');
    storedBtn.onclick = resumeTracking; // Switch handler
    storedBtn.innerHTML = '<i class="ri-play-fill"></i>';

    document.getElementById('track-btn-stop').style.display = 'block'; // Show Stop when paused

    speak("Workout paused.");
    if (window.ERS_NATIVE) window.ERS_NATIVE.triggerHaptic('medium');
}

function resumeTracking() {
    isPaused = false;
    isTracking = true;
    // Adjust start time to account for pause duration? 
    // Simplified: Just resume timer increment. 
    // Better: We track elapsed time accurately. 
    // For now simple interval is fine as long as we don't rely on Date.now() diff for "total duration" including pause.

    trackInterval = setInterval(updateTimer, 1000);

    // UI
    const startBtn = document.getElementById('track-btn-start');
    startBtn.style.display = 'none';
    startBtn.onclick = startTrackingFlow; // Reset handler for next fresh run

    document.getElementById('track-btn-pause').style.display = 'block';
    document.getElementById('track-btn-stop').style.display = 'none';

    speak("Resuming workout.");
    if (window.ERS_NATIVE) window.ERS_NATIVE.triggerHaptic('medium');
}

function stopTracking() {
    isTracking = false;
    isPaused = false;
    clearInterval(trackInterval);
    if (typeof ERS_NATIVE !== 'undefined') {
        ERS_NATIVE.stopBackgroundTracker();
    }

    speak("Workout completed. Great job!");
    if (window.ERS_NATIVE) window.ERS_NATIVE.triggerHaptic('heavy');

    // Celebration 🎉
    if (trackDist > 1.0) {
        if (window.triggerConfetti) window.triggerConfetti();
    }

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

    // --- AUTO PAUSE SYSTEM ---
    if (isAutoPaused) {
        // We are auto-paused, check if we should RESUME
        if (speed > 1.0) { // Moving faster than 3.6 km/h
            isAutoPaused = false;
            if (trackInterval == null) trackInterval = setInterval(updateTimer, 1000);

            speak("Resuming workout.");
            if (window.ERS_NATIVE) window.ERS_NATIVE.triggerHaptic('medium');

            // Visual Update
            document.getElementById('track-btn-pause').classList.remove('blink-pause');
            showToast("Auto-Resumed 🏃");
        } else {
            return; // Still stopped, do nothing
        }
    } else {
        // We are running, check if we should PAUSE
        if (speed < 0.6) { // Stopped or very slow walking (< 2 km/h)
            if (!autoPauseTimer) {
                // Start a grace period timer (5 seconds) before pausing
                autoPauseTimer = setTimeout(() => {
                    if (!isPaused && isTracking) {
                        isAutoPaused = true;
                        clearInterval(trackInterval);
                        trackInterval = null;

                        speak("Workout auto-paused.");
                        if (window.ERS_NATIVE) window.ERS_NATIVE.triggerHaptic('light');

                        // Visual Hint
                        document.getElementById('track-btn-pause').classList.add('blink-pause');
                        showToast("Auto-Paused (Stopped) ⏸️");
                    }
                    autoPauseTimer = null;
                }, 5000); // 5 Seconds wait
            }
        } else {
            // Speed is good, cancel any pending pause timer
            if (autoPauseTimer) {
                clearTimeout(autoPauseTimer);
                autoPauseTimer = null;
            }
        }
    }

    // console.log("GPS Update", lat, lng, acc);

    // Update Map (Heatmap Logic)
    if (mapInstance && !isAutoPaused) {
        const latLng = [lat, lng];

        if (!marker) {
            marker = L.circleMarker(latLng, { color: '#10b981', radius: 8 }).addTo(mapInstance);
        } else {
            marker.setLatLng(latLng);
        }

        mapInstance.setView(latLng); // Follow user

        // Heatmap: Draw segment from last point to current point
        if (lastLat && lastLng) {
            const prevLatLng = [lastLat, lastLng];

            // Determine Color
            let segColor = '#ef4444'; // Slow (Red) if < 6km/h
            // 1.6 m/s = 6 km/h, 2.7 m/s = 10 km/h
            if (speed > 2.7) segColor = '#10b981'; // Fast (> 10km/h) - Green
            else if (speed > 1.6) segColor = '#f59e0b'; // Medium (> 6km/h) - Yellow

            // Add Segment
            const segment = L.polyline([prevLatLng, latLng], { color: segColor, weight: 5, opacity: 0.9 }).addTo(mapInstance);
            mapSegments.push(segment);
        }

        // Keep trackPath for final saving
        trackPath.push(latLng);
    }

    // Calculate Distance
    if (lastLat && lastLng) {
        const d = calcDistance(lastLat, lastLng, lat, lng);
        // Basic filter for GPS noise (ignore jumps < 3m)
        if (d > 0.003) {
            trackDist += d;
            document.getElementById('track-dist').innerText = trackDist.toFixed(2);

            // --- AUDIO COACH CHECK ---
            // Check if we passed a new Kilometer mark
            if (Math.floor(trackDist) > lastSpokenKm) {
                lastSpokenKm = Math.floor(trackDist);

                // Calculate splice pace (last km pace) - Complex, so we use average pace for now
                const avgPaceMin = (trackElapsedTime / 60) / trackDist;
                const pMin = Math.floor(avgPaceMin);
                const pSec = Math.round((avgPaceMin - pMin) * 60);

                let msg = `Distance ${lastSpokenKm} kilometers. `;
                msg += `Pace ${pMin} minutes ${pSec} seconds per kilometer. `;

                // --- GHOST RUNNER LOGIC ---
                if (ghostTargetPace) {
                    // Current Pace (Seconds per km)
                    // We use average pace for stability (trackElapsedTime / trackDist)
                    const currentPaceSec = (trackElapsedTime / trackDist);

                    // Difference (Negative = Faster than ghost)
                    const diff = currentPaceSec - ghostTargetPace;

                    if (diff < -10) {
                        // Faster
                        msg += "You are fast! Ahead of your best by " + Math.abs(Math.round(diff)) + " seconds.";
                    } else if (diff > 10) {
                        // Slower
                        msg += "You are behind your best by " + Math.round(diff) + " seconds. Push harder!";
                    } else {
                        // On track
                        msg += "You are right on track with your best.";
                    }
                }

                speak(msg);
                if (window.ERS_NATIVE) window.ERS_NATIVE.triggerHaptic('heavy'); // Milestone Alert
            }

            // Pace Calculation (Real-time from speed)
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

    // Buttons
    document.getElementById('track-btn-start').style.display = 'block';
    document.getElementById('track-btn-start').onclick = startTrackingFlow; // Ensure flow is reset
    document.getElementById('track-btn-start').innerHTML = '<i class="ri-play-fill"></i>';

    document.getElementById('track-btn-pause').style.display = 'none';
    document.getElementById('track-btn-stop').style.display = 'none';

    // Clear Map
    if (polyline) polyline.setLatLngs([]); // Legacy clear
    // Clear Heatmap Segments
    if (mapSegments) {
        mapSegments.forEach(seg => mapInstance.removeLayer(seg));
        mapSegments = [];
    }
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

/* ==================== 3. Audio Coach Engine ==================== */

function toggleAudioCoach() {
    isAudioMuted = !isAudioMuted;
    const icon = document.getElementById('icon-audio');

    if (isAudioMuted) {
        icon.className = 'ri-volume-mute-line';
        showToast("Audio Coach Muted 🔇");
    } else {
        icon.className = 'ri-volume-up-line';
        speak("Audio Coach Enabled.");
        showToast("Audio Coach Active 🔊");
    }
}

function speak(text) {
    // 1. Check browser support
    if (!('speechSynthesis' in window)) return;

    // 2. Mute Check (allow empty text for unlocking context)
    if (isAudioMuted && text !== '') return;

    // 3. Cancel previous
    window.speechSynthesis.cancel();

    if (text === '') return; // Just unlocking

    // 4. Create Utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // 5. Config (English is safer for numbers)
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;

    // 6. Speak
    window.speechSynthesis.speak(utterance);
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

        // Add long press listener to unlock
        const icon = overlay.querySelector('.ri-lock-2-fill');
        icon.addEventListener('pointerdown', startUnlock);
        icon.addEventListener('pointerup', cancelUnlock);
        icon.addEventListener('pointerleave', cancelUnlock);

        // Mobile Touch Events
        icon.addEventListener('touchstart', startUnlock);
        icon.addEventListener('touchend', cancelUnlock);
    }
}

function startUnlock(e) {
    if (e.cancelable) e.preventDefault();

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
