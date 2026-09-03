// ==========================================
// Dynamic Waterfall Ad Controller
// Priority Sequence: Adsgram → Adexium/Tads → Monetag
// User MUST view an ad successfully to collect Red Packet
// ==========================================
import { db } from './app.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

export const AdsManager = {
    config: {
        network1Enabled: true,
        adsgramBlockId: "431323",
        network2Enabled: true,
        adexiumZoneId: "11907",
        tadsadsKey: "1751",
        network3Enabled: true,
        monetagId: "9669121"
    },

    async fetchConfig() {
        try {
            const configRef = doc(db, "app_config", "ad_settings");
            const snap = await getDoc(configRef);
            if (snap.exists()) {
                this.config = { ...this.config, ...snap.data() };
            }
        } catch (e) {
            console.warn("Could not load dynamic ad config, using defaults:", e);
        }
    },

    async playAd() {
        await this.fetchConfig();

        // 1. Try Network 1: Adsgram
        if (this.config.network1Enabled) {
            const res1 = await this.tryAdsgram();
            if (res1) return true;
        }

        // 2. Try Network 2: Adexium / Tads
        if (this.config.network2Enabled) {
            const res2 = await this.tryAdexium();
            if (res2) return true;

            const resTads = await this.tryTads();
            if (resTads) return true;
        }

        // 3. Try Network 3: Monetag
        if (this.config.network3Enabled) {
            const res3 = await this.tryMonetag();
            if (res3) return true;
        }

        throw new Error("Ad skipped or failed.");
    },

    // ----- Ad Network 1: Adsgram -----
    tryAdsgram() {
        return new Promise((resolve) => {
            const blockId = this.config.adsgramBlockId || "431323";
            if (window.Adsgram) {
                try {
                    const AdController = window.Adsgram.init({ blockId: blockId });
                    AdController.show()
                        .then((result) => {
                            if (result && result.done) resolve(true);
                            else resolve(false);
                        })
                        .catch(() => resolve(false));
                } catch (e) {
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        });
    },

    // ----- Ad Network 2: Adexium -----
    tryAdexium() {
        return new Promise((resolve) => {
            if (typeof AdexiumWidget !== "undefined") {
                try {
                    const zoneId = this.config.adexiumZoneId || "11907";
                    const widget = new AdexiumWidget({
                        wid: zoneId,
                        adFormat: "interstitial"
                    });
                    widget.autoMode();
                    setTimeout(() => resolve(true), 3500);
                } catch (e) {
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        });
    },

    // ----- Ad Network 2 Fallback: Tads -----
    tryTads() {
        return new Promise((resolve) => {
            if (typeof window.tads !== "undefined") {
                try {
                    const key = this.config.tadsadsKey || "1751";
                    const adController = window.tads.init({
                        widgetId: key,
                        type: "fullscreen",
                        onShowReward: () => resolve(true),
                        onAdsNotFound: () => resolve(false)
                    });
                    if (adController && typeof adController.showAd === "function") {
                        adController.showAd().catch(() => resolve(false));
                    } else {
                        setTimeout(() => resolve(false), 2500);
                    }
                } catch (e) {
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        });
    },

    // ----- Ad Network 3: Monetag -----
    tryMonetag() {
        return new Promise((resolve) => {
            const monetagFn = window.show_9669121 || window.show_11714437;
            if (typeof monetagFn === "function") {
                monetagFn()
                    .then(() => resolve(true))
                    .catch(() => resolve(false));
                setTimeout(() => resolve(false), 6000);
            } else {
                resolve(false);
            }
        });
    }
};
