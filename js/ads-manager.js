// ==========================================
// Ads Manager - Real Waterfall + 18s Lock Screen
// Priority: Adexium → Tads → Monetag
// RichAds always tries (optional)
// ==========================================

export const AdsManager = {

    richadsController: null,
    isAdShowing: false,
    adFinished: false,
    canClose: false,
    lockTimer: null,

    init() {
        // RichAds
        try {
            if (typeof TelegramAdsController !== "undefined") {
                this.richadsController = new TelegramAdsController();
                this.richadsController.initialize({
                    pubId: "987925",
                    appId: "3767",
                    debug: false
                });
                console.log("RichAds ready");
            }
        } catch (e) {
            console.log("RichAds init error:", e);
        }
    },

    // ===== Main Play Function =====
    async playAd() {
        return new Promise(async (resolve, reject) => {
            this.isAdShowing = true;
            this.adFinished = false;
            this.canClose = false;

            // Show Lock Screen
            this.showLockScreen();

            // Start 18 seconds lock
            this.startLockTimer(18);

            // 1. RichAds (optional)
            this.showRichAds();

            // 2. Waterfall
            let success = false;

            // Try Adexium
            success = await this.tryAdexium();
            if (success) {
                this.onAdSuccess(resolve);
                return;
            }

            // Try Tads
            success = await this.tryTads();
            if (success) {
                this.onAdSuccess(resolve);
                return;
            }

            // Try Monetag
            success = await this.tryMonetag();
            if (success) {
                this.onAdSuccess(resolve);
                return;
            }

            // কোনো অ্যাডই আসেনি
            this.hideLockScreen();
            reject("Ad skipped or failed.");
        });
    },

    onAdSuccess(resolve) {
        this.adFinished = true;
        console.log("Ad finished successfully");

        // যদি ১৮ সেকেন্ড শেষ হয়ে যায় বা অ্যাড শেষ হয় → resolve
        if (this.canClose || this.adFinished) {
            this.hideLockScreen();
            resolve(true);
        }
    },

    // ===== 18 Second Lock Screen =====
    showLockScreen() {
        let screen = document.getElementById("ad-lock-screen");
        if (!screen) {
            screen = document.createElement("div");
            screen.id = "ad-lock-screen";
            screen.innerHTML = `
                <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:sans-serif;">
                    <div class="spinner" style="width:50px;height:50px;border:5px solid #333;border-top:5px solid #ffd700;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:20px;"></div>
                    <div id="lock-timer-text" style="font-size:18px;color:#ffd700;">Please wait 18s...</div>
                    <div style="margin-top:10px;font-size:14px;opacity:0.7;">Loading reward...</div>
                </div>
                <style>
                    @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
                </style>
            `;
            document.body.appendChild(screen);
        }
        screen.style.display = "flex";
    },

    hideLockScreen() {
        const screen = document.getElementById("ad-lock-screen");
        if (screen) screen.style.display = "none";
        if (this.lockTimer) clearInterval(this.lockTimer);
    },

    startLockTimer(seconds) {
        let remaining = seconds;
        const textEl = document.getElementById("lock-timer-text");

        this.lockTimer = setInterval(() => {
            remaining--;
            if (textEl) {
                textEl.innerText = remaining > 0 ? `Please wait ${remaining}s...` : "You can continue";
            }

            if (remaining <= 0) {
                clearInterval(this.lockTimer);
                this.canClose = true;

                // যদি অ্যাড আগেই শেষ হয়ে যায়
                if (this.adFinished) {
                    this.hideLockScreen();
                }
            }
        }, 1000);
    },

    // ===== RichAds =====
    showRichAds() {
        if (!this.richadsController) return;
        this.richadsController.triggerNativeNotification()
            .catch(() => {});
    },

    // ===== Adexium =====
    tryAdexium() {
        return new Promise((resolve) => {
            if (typeof AdexiumWidget === "undefined") {
                return resolve(false);
            }

            try {
                const widget = new AdexiumWidget({
                    wid: "11907",
                    adFormat: "interstitial"
                });

                widget.autoMode();

                // Adexium-এর কোনো reliable callback নেই, তাই ৪ সেকেন্ড পর চেক
                setTimeout(() => {
                    // এখানে আমরা ধরে নিচ্ছি যদি SDK লোড হয় তাহলে চেষ্টা করেছে
                    resolve(true);
                }, 4000);

            } catch (e) {
                resolve(false);
            }
        });
    },

    // ===== Tads =====
    tryTads() {
        return new Promise((resolve) => {
            if (typeof window.tads === "undefined") {
                return resolve(false);
            }

            try {
                const adController = window.tads.init({
                    widgetId: "1751",
                    type: "fullscreen",
                    debug: false,
                    onShowReward: () => {
                        resolve(true);
                    },
                    onAdsNotFound: () => {
                        resolve(false);
                    }
                });

                // showAd কল
                if (adController && typeof adController.showAd === "function") {
                    adController.showAd().catch(() => resolve(false));
                } else {
                    // কিছু ভার্সনে init এর পর সরাসরি কাজ করে
                    setTimeout(() => resolve(false), 3000);
                }

                // Timeout
                setTimeout(() => resolve(false), 6000);

            } catch (e) {
                resolve(false);
            }
        });
    },

    // ===== Monetag =====
    tryMonetag() {
        return new Promise((resolve) => {
            if (typeof show_9669121 !== "function") {
                return resolve(false);
            }

            show_9669121()
                .then(() => resolve(true))
                .catch(() => resolve(false));

            setTimeout(() => resolve(false), 8000);
        });
    }
};

// Auto init
document.addEventListener("DOMContentLoaded", () => {
    AdsManager.init();
});
