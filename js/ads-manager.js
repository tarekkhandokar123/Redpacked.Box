import { db } from './app.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

export const AdsManager = {
    config: {
        network1Enabled: true,
        adexiumZoneId: "9f52803f-59b8-42ff-b041-fe7a7863ea7c",

        network2Enabled: true,
        tadsKeys: ["11905", "11906", "11907"],

        network3Enabled: true,
        monetagFnName: "show_11714437"
    },

    async fetchConfig() {
        try {
            const configRef = doc(db, "app_config", "ad_settings");
            const snap = await getDoc(configRef);
            if (snap.exists()) {
                const data = snap.data();
                this.config = { ...this.config, ...data };
                
                // Firestore থেকে যদি tadsKeys স্ট্রিং হিসেবে আসে তা অ্যারেতে কনভার্ট করা
                if (typeof this.config.tadsKeys === 'string') {
                    this.config.tadsKeys = this.config.tadsKeys.split(',').map(k => k.trim());
                }
            }
        } catch (e) {
            console.warn("Could not load dynamic ad config, using defaults:", e);
        }
    },

    async playAd() {
        await this.fetchConfig();

        // 1. Try Adexium
        if (this.config.network1Enabled) {
            const resAdexium = await this.tryAdexium();
            if (resAdexium) return true;
        }

        // 2. Try Tadsads (3টি ID ক্রমান্বয়ে ট্রাই করবে)
        if (this.config.network2Enabled) {
            const keys = Array.isArray(this.config.tadsKeys) && this.config.tadsKeys.length > 0
                ? this.config.tadsKeys 
                : ["11905", "11906", "11907"];

            for (const key of keys) {
                const resTads = await this.tryTadsSingleKey(key);
                if (resTads) return true; // একটি আইডি কাজ করলে এখান থেকেই Success নিয়ে বের হয়ে যাবে
            }
        }

        // 3. Try Monetag
        if (this.config.network3Enabled) {
            const resMonetag = await this.tryMonetag();
            if (resMonetag) return true;
        }

        throw new Error("No ads available or ad failed to display.");
    },

    // ----- 1. Adexium -----
    tryAdexium() {
        return new Promise((resolve) => {
            if (typeof AdexiumWidget !== "undefined") {
                try {
                    const zoneId = this.config.adexiumZoneId || "9f52803f-59b8-42ff-b041-fe7a7863ea7c";
                    const widget = new AdexiumWidget({
                        wid: zoneId,
                        adFormat: "interstitial"
                    });
                    widget.autoMode();
                    
                    // Adexium লোড হওয়ার জন্য ৩ সেকেন্ড সময় দিয়ে Resolve করা
                    setTimeout(() => resolve(true), 3000);
                } catch (e) {
                    console.warn("Adexium failed:", e);
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        });
    },

    // ----- 2. Tadsads Single Key Attempt -----
    tryTadsSingleKey(key) {
        return new Promise((resolve) => {
            if (typeof window.tads === "undefined") {
                return resolve(false);
            }

            try {
                let isResolved = false;
                let fallbackTimer = null;

                const finish = (status) => {
                    if (!isResolved) {
                        isResolved = true;
                        if (fallbackTimer) clearTimeout(fallbackTimer);
                        resolve(status);
                    }
                };

                // যদি SDK কোন কারণে সাড়া না দেয় (যেমন নেটওয়ার্ক ব্লক), তবেই কেবল ১০ সেকেন্ড পর ফেল করবে
                fallbackTimer = setTimeout(() => {
                    finish(false);
                }, 10000);

                const adController = window.tads.init({
                    widgetId: String(key),
                    type: "fullscreen",
                    onShowReward: () => {
                        finish(true); // ইউজার অ্যাড শেষ পর্যন্ত দেখলে True হবে
                    },
                    onAdsNotFound: () => {
                        finish(false); // অ্যাড না পাওয়া গেলে সঙ্গে সঙ্গে পরের ID ট্রাই করবে
                    },
                    onError: () => {
                        finish(false);
                    },
                    onClose: () => {
                        // রিওয়ার্ড ছাড়া কেটে দিলে ১ সেকেন্ড পর ফেল ধরা হবে
                        setTimeout(() => finish(false), 1000);
                    }
                });

                if (adController && typeof adController.showAd === "function") {
                    adController.showAd().catch((err) => {
                        console.warn(`Tads showAd error for key ${key}:`, err);
                        finish(false);
                    });
                } else {
                    finish(false);
                }

            } catch (e) {
                console.warn(`Tads Exception Key ${key}:`, e);
                resolve(false);
            }
        });
    },

    // ----- 3. Monetag -----
    tryMonetag() {
        return new Promise((resolve) => {
            const fnName = this.config.monetagFnName || "show_11714437";
            const monetagFn = window[fnName] || window.show_11714437;

            if (typeof monetagFn === "function") {
                monetagFn()
                    .then(() => resolve(true))
                    .catch((err) => {
                        console.warn("Monetag view failed or skipped:", err);
                        resolve(false);
                    });
            } else {
                resolve(false);
            }
        });
    }
};
