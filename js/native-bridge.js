/* ERS Native Bridge 
   Handles communication between Web App and Android Native Layer via Capacitor
*/

const ERS_NATIVE = {
    isNative: false,
    watchId: null,

    // Initialize upon load
    init: async function () {
        // Check if running in Capacitor
        // Capacitor 3+ uses window.Capacitor
        if (typeof Capacitor !== 'undefined' && Capacitor.isNative) {
            this.isNative = true;
            console.log("📱 ERS Native Mode Detected");
            document.body.classList.add('is-native-app');
        } else {
            console.log("🌐 ERS Web Mode (Browser)");
        }
    },

    // Background GPS Tracker (Native)
    startBackgroundTracker: async function () {
        if (!this.isNative) {
            // Fallback for browser (works only if screen is on)
            showToast("تنبيه: في المتصفح، يجب إبقاء الشاشة مفتوحة ليعمل الـ GPS بدقة.", "warning");
            // navigator.geolocation code handles this in main.js
            return;
        }

        try {
            // Using Capacitor Geolocation Plugin
            const { Geolocation } = capacitorExports;

            // Request permission
            const perm = await Geolocation.checkPermissions();
            if (perm.location !== 'granted') {
                await Geolocation.requestPermissions();
            }

            // Start Watching
            this.watchId = await Geolocation.watchPosition({
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }, (position, err) => {
                if (err) {
                    console.error("GPS Error", err);
                    return;
                }
                if (position) {
                    this.onLocationUpdate(position.coords);
                }
            });

            // Keep Awake
            try {
                const { KeepAwake } = capacitorExports;
                if (KeepAwake) await KeepAwake.keep();

                // Cordvoa Background Mode (The Real Fix)
                if (window.cordova && window.cordova.plugins && window.cordova.plugins.backgroundMode) {
                    window.cordova.plugins.backgroundMode.enable();
                    window.cordova.plugins.backgroundMode.on('activate', function () {
                        window.cordova.plugins.backgroundMode.disableWebViewOptimizations();
                    });
                    console.log("🔋 Background Mode Enabled");
                }
            } catch (e) { console.warn("Background Mode Config Error", e); }

            showToast("تم تفعيل تتبع GPS (وضع Android) 🛰️", "success");

        } catch (e) {
            console.error("Native GPS Error", e);
            showToast("حدث خطأ في الـ GPS: " + e.message, "error");
        }
    },

    stopBackgroundTracker: async function () {
        if (this.watchId) {
            const { Geolocation } = capacitorExports;
            await Geolocation.clearWatch({ id: this.watchId });
            this.watchId = null;
        }
    },

    onLocationUpdate: function (coords) {
        // Dispatch event so main.js/map can listen
        const event = new CustomEvent('gps-update', {
            detail: {
                lat: coords.latitude,
                lng: coords.longitude,
                speed: coords.speed,
                acc: coords.accuracy
            }
        });
        window.dispatchEvent(event);
    },

    // Notifications
    scheduleNotification: async function (title, body, id = 1) {
        if (!this.isNative) return;

        try {
            const { LocalNotifications } = capacitorExports;
            await LocalNotifications.schedule({
                notifications: [{
                    title: title,
                    body: body,
                    id: id,
                    sound: 'beep.wav',
                    smallIcon: 'ic_stat_icon_config_sample'
                }]
            });
        } catch (e) { console.error("Notif Error", e); }
    },

    // Haptic Feedback
    triggerHaptic: function (type = 'medium') {
        if (typeof navigator === 'undefined' || !navigator.vibrate) return;

        // Patterns (ms)
        const patterns = {
            'light': 15,          // Tick, Switch
            'medium': 40,         // Button Press
            'heavy': 100,         // Alert, Stop
            'success': [50, 50, 50],
            'warning': [100, 50, 100]
        };

        try {
            navigator.vibrate(patterns[type] || 40);
        } catch (e) { /* Ignore */ }
    }
};

// Helper for importing Capacitor plugins globally if not using modules
const capacitorExports = (typeof Capacitor !== 'undefined') ? Capacitor.Plugins : {};

// Auto Init
window.addEventListener('load', () => ERS_NATIVE.init());
