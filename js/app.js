// ==========================================
// 1. FIREBASE SDK IMPORTS & INITIALIZATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc, 
    increment, 
    setDoc, 
    collection, 
    getDocs, 
    query, 
    where,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBObsWUTRpIESXNW_wa2MvoblEmJc27TaQ",
  authDomain: "gift-box-io.firebaseapp.com",
  projectId: "gift-box-io",
  storageBucket: "gift-box-io.firebasestorage.app",
  messagingSenderId: "578138378445",
  appId: "1:578138378445:web:a74b708976e87c150d5984",
  measurementId: "G-FDP0VKK5EL"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);

// ==========================================
// 2. USER DATA CONTROLLER (Telegram WebApp)
// ==========================================
export const User_Controller = {
    tg: window.Telegram?.WebApp || null,
    
    getUserInfo: function() {
        if (this.tg) {
            try { this.tg.expand(); } catch (e) {}
            const user = this.tg.initDataUnsafe?.user;
            if (user) {
                return {
                    id: user.id.toString(),
                    username: user.username || 'user_' + user.id,
                    fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Telegram User',
                    photoUrl: user.photo_url || 'default-avatar.png'
                };
            }
        }
        return { id: "guest_user", username: "Guest", fullName: "Guest User", photoUrl: "default-avatar.png" };
    }
};

// ==========================================
// 3. UI / ANIMATION CONTROLLER
// ==========================================
export const UI_Controller = {
    showToast: function(message) {
        const toast = document.getElementById('toast-container');
        if (!toast) return;
        toast.innerText = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3200);
    },

    hideSplash: function() {
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            const appContainer = document.getElementById('app-container');
            if (splash) splash.style.display = 'none';
            if (appContainer) appContainer.style.display = 'block';
        }, 1000);
    },

    setupProfile: function(user) {
        const nameElem = document.getElementById('user-name');
        const avatarElem = document.getElementById('user-avatar');
        
        if (nameElem) nameElem.innerText = user.fullName;
        if (avatarElem && user.photoUrl) avatarElem.src = user.photoUrl;
    },

    openAdminApp: function() {
        const partnerUrl = "https://t.me/REDPACKETBOXBOT/partner";
        if (User_Controller.tg?.openTelegramLink) {
            User_Controller.tg.openTelegramLink(partnerUrl);
        } else if (User_Controller.tg?.openLink) {
            User_Controller.tg.openLink(partnerUrl);
        } else {
            window.location.href = partnerUrl;
        }
    },

    updateProgressBar: function(opened, total) {
        const openedElem = document.getElementById('rp-opened');
        const totalElem = document.getElementById('rp-total');
        const fillElem = document.getElementById('rp-progress-fill') || document.querySelector('.progress-fill');

        if (openedElem) openedElem.innerText = opened.toLocaleString();
        if (totalElem) totalElem.innerText = total.toLocaleString();

        if (fillElem && total > 0) {
            const percentage = Math.min(100, Math.floor((opened / total) * 100));
            fillElem.style.width = `${percentage}%`;
        }
    }
};

window.UI_Controller = UI_Controller;

// ==========================================
// 4. ADSGRAM CONTROLLER (Updated for t.me/PPCoin_bot/ads)
// ==========================================
export const Ads_Controller = {
    playAd: function() {
        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();

            // Result listener (যদি postMessage কাজ করে)
            const messageHandler = function(event) {
                const data = event.data;

                if (data && data.type === "ADSGRAM_RESULT" && data.requestId === requestId) {
                    window.removeEventListener("message", messageHandler);

                    if (data.status === "success") {
                        resolve(true);
                    } else {
                        reject("Ad skipped or failed.");
                    }
                }
            };

            window.addEventListener("message", messageHandler);

// ===== সবচেয়ে গুরুত্বপূর্ণ অংশ =====
            // Telegram Mini App লিংক খোলা
            const adLink = `https://t.me/REDPACKETBOXBOT/adsplay?startapp=${requestId}`;

            if (window.Telegram?.WebApp) {
                // সঠিক পদ্ধতি: openTelegramLink ব্যবহার করুন
                window.Telegram.WebApp.openTelegramLink(adLink);
            } else {
                // fallback
                window.open(adLink, "_blank");
            }

            // Safety timeout (৭০ সেকেন্ড)
            setTimeout(() => {
                window.removeEventListener("message", messageHandler);
                reject("Ad timeout.");
            }, 70000);
        });
    }
};

// ==========================================
// 5. PACKET LOGIC CONTROLLER
// ==========================================
export const Packet_Controller = {
    currentPacketData: null,
    currentPacketId: null,

    handleBackButtonClick: function() {
        Packet_Controller.loadPacketList();
    },

    loadSpecificPacket: async function(packetId) {
        this.currentPacketId = packetId;
        const viewSingle = document.getElementById('view-single');
        const viewList = document.getElementById('view-list');
        if (viewSingle) viewSingle.style.display = 'block';
        if (viewList) viewList.style.display = 'none';

        // Telegram Native Back Button শো করা
        if (User_Controller.tg?.BackButton) {
            User_Controller.tg.BackButton.show();
            User_Controller.tg.BackButton.offClick(this.handleBackButtonClick);
            User_Controller.tg.BackButton.onClick(this.handleBackButtonClick);
        }

        try {
            const packetRef = doc(db, "red_packets", packetId);
            const packetSnap = await getDoc(packetRef);
            
            if (!packetSnap.exists()) {
                UI_Controller.showToast("❌ Red Packet not found or expired.");
                return;
            }

            this.currentPacketData = packetSnap.data();
            const data = this.currentPacketData;

            const limitCount = data.openLimit || 0;
            const openedCount = data.opened || 0;
            const channelName = data.channelTitle || data.channelName || data.channelUsername || "Official Drop";
            const tokenDetails = `${data.tokenName || 'USDT'} — ${limitCount} Accounts`;

            // Update UI
            const chanElem = document.getElementById('rp-channel-name');
            const tokenElem = document.getElementById('rp-token-info');
            if (chanElem) chanElem.innerText = channelName;
            if (tokenElem) tokenElem.innerText = tokenDetails;

            UI_Controller.updateProgressBar(openedCount, limitCount);

            const openBtn = document.getElementById('open-btn');
            if (openedCount >= limitCount && openBtn) {
                openBtn.disabled = true;
                openBtn.innerHTML = `<span>CLAIM LIMIT REACHED</span>`;
                openBtn.style.opacity = "0.6";
            }

        } catch (e) {
            console.error("Error loading packet:", e);
            UI_Controller.showToast("⚠️ Error loading packet details.");
        }

        const openBtn = document.getElementById('open-btn');
        const giftBoxBtn = document.getElementById('gift-box-btn');

        const handleOpenAction = async () => {
            if (!this.currentPacketData || !this.currentPacketId) {
                UI_Controller.showToast("⚠️ Invalid Red Packet.");
                return;
            }

            const openedCount = this.currentPacketData.opened || 0;
            const limitCount = this.currentPacketData.openLimit || 0;

            if (openedCount >= limitCount) {
                UI_Controller.showToast("❌ Red Packet Fully Claimed!");
                return;
            }

            const user = User_Controller.getUserInfo();
            const claimRecordId = `\( {this.currentPacketId}_ \){user.id}`;

            try {
                // ১. চেক করা ইউজার আগে থেকে ক্লেইম করেছে কিনা
                const claimRef = doc(db, "claim_records", claimRecordId);
                const claimSnap = await getDoc(claimRef);
                if (claimSnap.exists()) {
                    UI_Controller.showToast("❌ You have already claimed this Red Packet!");
                    return;
                }

                if (giftBoxBtn) giftBoxBtn.classList.add('shake');
                UI_Controller.showToast("🎬 Loading rewarded ad...");

                // ২. Adsgram এড রান করা (External Ad Screen)
                await Ads_Controller.playAd();

                // ৩. ফায়ারবেসে ক্লেইম রেকর্ড ও কাউন্ট আপডেট করা
                await setDoc(doc(db, "claim_records", claimRecordId), {
                    redPacketId: this.currentPacketId,
                    telegramUserId: user.id,
                    username: user.username,
                    adWatched: true,
                    openedAt: serverTimestamp()
                });

                await updateDoc(doc(db, "red_packets", this.currentPacketId), {
                    opened: increment(1)
                });

                // ৪. লোকাল স্টেট ও ইউজার ইন্টারফেস আপডেট
                if (giftBoxBtn) giftBoxBtn.classList.remove('shake');
                this.currentPacketData.opened = openedCount + 1;
                UI_Controller.updateProgressBar(this.currentPacketData.opened, limitCount);
                UI_Controller.showToast("✅ Ad completed! Opening Binance Link...");

                // ৫. ইউজারকে সরাসরি গোপন বিন্যান্স লিংকে রিডাইরেক্ট করা
                const binanceUrl = this.currentPacketData.binanceLink;
                if (binanceUrl) {
                    if (User_Controller.tg?.openLink) {
                        User_Controller.tg.openLink(binanceUrl);
                    } else {
                        window.location.href = binanceUrl;
                    }
                } else {
                    UI_Controller.showToast("❌ Binance Link not available.");
                }

            } catch (error) {
                if (giftBoxBtn) giftBoxBtn.classList.remove('shake');
                UI_Controller.showToast(error === "Ad skipped or failed." ? "⚠️ You must watch the complete ad to claim!" : "❌ Error processing claim.");
            }
        };

        if (openBtn) openBtn.onclick = handleOpenAction;
        if (giftBoxBtn) giftBoxBtn.onclick = handleOpenAction;
    },

    loadPacketList: async function() {
        const viewSingle = document.getElementById('view-single');
        const viewList = document.getElementById('view-list');
        const container = document.getElementById('packet-list-container');
        
        if (viewSingle) viewSingle.style.display = 'none';
        if (viewList) viewList.style.display = 'block';

        // Telegram Native Back Button হাইড করা (লিস্ট ভিউতে থাকলে দরকার নেই)
        if (User_Controller.tg?.BackButton) {
            User_Controller.tg.BackButton.hide();
            User_Controller.tg.BackButton.offClick(this.handleBackButtonClick);
        }

        if (!container) return;

        try {
            const q = query(collection(db, "red_packets"), where("status", "==", "active"));
            const snap = await getDocs(q);

            if (snap.empty) {
                container.innerHTML = `<div style="text-align:center; padding: 20px; color:#888;">No active Red Packets right now.</div>`;
                return;
            }

            let html = "";
            snap.forEach((docSnap) => {
                const data = docSnap.data();
                const id = docSnap.id;
                html += `
                    <div class="packet-item-card" onclick="Packet_Controller.loadSpecificPacket('${id}')" style="background: rgba(255,255,255,0.05); padding:14px; margin-bottom:10px; border-radius:12px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                        <div class="packet-info">
                            <h4 style="margin:0; color:var(--gold); font-size:15px;">💎 ${data.tokenName || 'USDT'} Red Packet</h4>
                            <p style="margin:4px 0 0 0; color:#aaa; font-size:12px;">Channel: ${data.channelTitle || data.channelName || 'VIP Channel'}</p>
                        </div>
                        <span style="color: #4CAF50; font-weight: 700; font-size: 13px;">\( {data.opened || 0}/ \){data.openLimit || 0}</span>
                    </div>
                `;
            });
            container.innerHTML = html;
        } catch (e) {
            console.error("Error loading active packets list:", e);
            container.innerHTML = `<div style="text-align:center; padding: 20px; color:#e53935;">Failed to load packets list.</div>`;
        }
    }
};

window.Packet_Controller = Packet_Controller;

// ==========================================
// 6. APPLICATION BOOTSTRAP
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // 1. User Initialization
    const user = User_Controller.getUserInfo();
    UI_Controller.setupProfile(user);

    // 2. Start Parameter / Route Checking
    const startParam = User_Controller.tg?.initDataUnsafe?.start_param;

    if (startParam) {
        Packet_Controller.loadSpecificPacket(startParam);
    } else {
        Packet_Controller.loadPacketList();
    }

    // 3. Partner / Publish Button Binding
    const publishBtn = document.getElementById('publish-btn') || document.querySelector('.publish-btn');
    if (publishBtn) {
        publishBtn.addEventListener('click', () => {
            UI_Controller.openAdminApp();
        });
    }

    // 4. Share Button Bindings
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const startParam = User_Controller.tg?.initDataUnsafe?.start_param || Packet_Controller.currentPacketId || '';
            const shareText = "🔥 I just claimed a free Red Packet! Claim yours before it expires 👇";
            const botLink = `https://t.me/REDPACKETBOXBOT/claim?startapp=${startParam}`;
            const telegramShareUrl = `https://t.me/share/url?url=\( {encodeURIComponent(botLink)}&text= \){encodeURIComponent(shareText)}`;

            if (User_Controller.tg?.openTelegramLink) {
                User_Controller.tg.openTelegramLink(telegramShareUrl);
            } else {
                window.open(telegramShareUrl, '_blank');
            }
        });
    }

    // 5. Hide Splash & Signal Ready
    if (User_Controller.tg?.ready) User_Controller.tg.ready();
    UI_Controller.hideSplash();
});
