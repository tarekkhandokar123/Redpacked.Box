// ==========================================
// Ads Manager - Waterfall System
// Priority: Adexium → Tads → Monetag
// RichAds always shows on first click (optional)
// ==========================================

export const AdsManager = {
    // ===== Configuration =====
    adexiumWidgets: [
        "11905",   // Claim Box
        "11906",   // Claim Box
        "11907"    // Red Packet Claim
    ],
    tadsWidgetId: "1751",          // আপনার Tads Widget ID (সাইট আইডি)
    monetagZone: "9669121",

    richadsReady: false,
    richadsController: null,

    // ===== Initialize all networks =====
    init: function () {
        // RichAds Init
        if (typeof TelegramAdsController !== "undefined") {
            try {
                this.richadsController = new TelegramAdsController();
                this.richadsController.initialize({
                    pubId: "987925",
                    appId: "3767",
                    debug: false
                });
                this.richadsReady = true;
                console.log("✅ RichAds ready");
            } catch (e) {
                console.log("RichAds init failed", e);
            }
        }

        // Monetag SDK check
        if (typeof show_9669121 === "undefined") {
            console.warn("Monetag SDK not loaded");
        }

        // Tads check
        if (typeof window.tads === "undefined") {
            console.warn("Tads SDK not loaded");
        }

        console.log("AdsManager initialized");
    },

    // ===== Main Play Function (Waterfall) =====
    playAd: function () {
        return new Promise(async (resolve, reject) => {
            console.log("▶ Starting Ad Waterfall...");

            // ১. প্রথমে RichAds দেখানোর চেষ্টা (বাধ্যতামূলক না)
            this.showRichAds();

            // ২. Adexium চেষ্টা
            const adexiumSuccess = await this.tryAdexium();
            if (adexiumSuccess) {
                console.log("✅ Adexium Success");
                return resolve(true);
            }

            // ৩. Adexium ব্যর্থ → ১ সেকেন্ড পর Tads চেষ্টা
            console.log("Adexium failed → Trying Tads...");
            await this.delay(1000);

            const tadsSuccess = await this.tryTads();
            if (tadsSuccess) {
                console.log("✅ Tads Success");
                return resolve(true);
            }

            // ৪. Tads ব্যর্থ → Monetag চেষ্টা
            console.log("Tads failed → Trying Monetag...");
            const monetagSuccess = await this.tryMonetag();
            if (monetagSuccess) {
                console.log("✅ Monetag Success");
                return resolve(true);
            }

            // সব ব্যর্থ
            console.log("❌ All ad networks failed");
            reject("Ad skipped or failed.");
        });
    },

    // ===== RichAds (সবসময় প্রথম ক্লিকে আসবে, বাধ্যতামূলক না) =====
    showRichAds: function () {
        if (!this.richadsReady || !this.richadsController) return;

        try {
            this.richadsController.triggerNativeNotification()
                .then(() => console.log("RichAds shown"))
                .catch(() => console.log("RichAds not available"));
        } catch (e) {
            console.log("RichAds error", e);
        }
    },

    // ===== Adexium =====
    tryAdexium: function () {
        return new Promise((resolve) => {
            // Adexium Widget ব্যবহার (Fullscreen)
            // যেহেতু একাধিক widget আছে, একটার পর একটা চেষ্টা করব

            let tried = 0;
            const tryNext = () => {
                if (tried >= this.adexiumWidgets.length) {
                    return resolve(false);
                }

                const wid = this.adexiumWidgets[tried];
                tried++;

                try {
                    if (typeof AdexiumWidget === "undefined") {
                        return tryNext();
                    }

                    const widget = new AdexiumWidget({
                        wid: wid,
                        adFormat: "interstitial"
                    });

                    // timeout 4 seconds
                    const timeout = setTimeout(() => {
                        tryNext();
                    }, 4000);

                    widget.autoMode();

                    // যদি অ্যাড দেখায় তাহলে success ধরব
                    // (Adexium-এর অফিসিয়াল কলব্যাক সীমিত, তাই টাইমআউট ভিত্তিক)
                    setTimeout(() => {
                        clearTimeout(timeout);
                        resolve(true); // ধরে নিলাম দেখিয়েছে
                    }, 2500);

                } catch (e) {
                    tryNext();
                }
            };

            tryNext();
        });
    },

    // ===== Tads (Fullscreen) =====
    tryTads: function () {
        return new Promise((resolve) => {
            if (typeof window.tads === "undefined") {
                return resolve(false);
            }

            try {
                const adController = window.tads.init({
                    widgetId: this.tadsWidgetId,
                    type: "fullscreen",
                    debug: false,
                    onShowReward: () => {
                        resolve(true);
                    },
                    onAdsNotFound: () => {
                        resolve(false);
                    }
                });

                adController
                    .then(() => adController.showAd())
                    .then(() => resolve(true))
                    .catch(() => resolve(false));

                // Safety timeout
                setTimeout(() => resolve(false), 6000);

            } catch (e) {
                resolve(false);
            }
        });
    },

    // ===== Monetag =====
    tryMonetag: function () {
        return new Promise((resolve) => {
            if (typeof show_9669121 === "undefined") {
                return resolve(false);
            }

            try {
                show_9669121()
                    .then(() => {
                        resolve(true);
                    })
                    .catch(() => {
                        resolve(false);
                    });

                // Safety timeout
                setTimeout(() => resolve(false), 8000);

            } catch (e) {
                resolve(false);
            }
        });
    },

    // Helper
    delay: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Auto init when loaded
document.addEventListener("DOMContentLoaded", () => {
    AdsManager.init();
});
