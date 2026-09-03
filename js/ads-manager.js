// ==========================================
// Ads Manager - Simple & Stable Waterfall
// Priority: Adexium → Tads → Monetag
// RichAds shows on every click (optional)
// ==========================================

export const AdsManager = {

    richadsController: null,

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

    // ===== Main Function =====
    async playAd() {
        console.log("Starting ad waterfall...");

        // 1. RichAds (optional - always try)
        this.showRichAds();

        // 2. Try Adexium
        const adexiumOk = await this.tryAdexium();
        if (adexiumOk) {
            console.log("Adexium success");
            return true;
        }

        // 3. Try Tads
        const tadsOk = await this.tryTads();
        if (tadsOk) {
            console.log("Tads success");
            return true;
        }

        // 4. Try Monetag
        const monetagOk = await this.tryMonetag();
        if (monetagOk) {
            console.log("Monetag success");
            return true;
        }

        // সব ব্যর্থ
        throw "Ad skipped or failed.";
    },

    // ===== RichAds =====
    showRichAds() {
        if (!this.richadsController) return;

        this.richadsController.triggerNativeNotification()
            .then(() => console.log("RichAds shown"))
            .catch(() => console.log("RichAds not available"));
    },

    // ===== Adexium =====
    tryAdexium() {
        return new Promise((resolve) => {
            if (typeof AdexiumWidget === "undefined") {
                console.log("Adexium SDK not found");
                return resolve(false);
            }

            try {
                const widget = new AdexiumWidget({
                    wid: "11907",           // Red Packet Claim
                    adFormat: "interstitial"
                });

                widget.autoMode();

                // ৩ সেকেন্ড পর success ধরে নেওয়া হচ্ছে
                setTimeout(() => resolve(true), 3000);

            } catch (e) {
                console.log("Adexium error:", e);
                resolve(false);
            }
        });
    },

    // ===== Tads =====
    tryTads() {
        return new Promise((resolve) => {
            if (typeof window.tads === "undefined") {
                console.log("Tads SDK not found");
                return resolve(false);
            }

            try {
                const controller = window.tads.init({
                    widgetId: "1751",
                    type: "fullscreen",
                    debug: false,
                    onShowReward: () => resolve(true),
                    onAdsNotFound: () => resolve(false)
                });

                controller
                    .then(c => c.showAd())
                    .then(() => resolve(true))
                    .catch(() => resolve(false));

                // Timeout
                setTimeout(() => resolve(false), 5000);

            } catch (e) {
                console.log("Tads error:", e);
                resolve(false);
            }
        });
    },

    // ===== Monetag =====
    tryMonetag() {
        return new Promise((resolve) => {
            if (typeof show_9669121 !== "function") {
                console.log("Monetag SDK not found");
                return resolve(false);
            }

            show_9669121()
                .then(() => resolve(true))
                .catch(() => resolve(false));

            // Timeout
            setTimeout(() => resolve(false), 7000);
        });
    }
};

// Auto init
document.addEventListener("DOMContentLoaded", () => {
    AdsManager.init();
});
