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
    limit 
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
        // Web Browser Preview / Fallback
        return { id: "demo_12345", username: "DemoUser", fullName: "Demo Creator", photoUrl: "default-avatar.png" };
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
        }, 1200);
    },

    setupProfile: function(user) {
        const nameElem = document.getElementById('user-name');
        const avatarElem = document.getElementById('user-avatar');
        
        if (nameElem) nameElem.innerText = user.fullName;
        if (avatarElem && user.photoUrl) avatarElem.src = user.photoUrl;
    },

    openAdminApp: function() {
        const adminUrl = "https://t.me/YourAdminBot?start=publish";
        if (User_Controller.tg?.openTelegramLink) {
            User_Controller.tg.openTelegramLink(adminUrl);
        } else {
            window.location.href = adminUrl;
        }
    },

    updateProgressBar: function(opened, total) {
        const openedElem = document.getElementById('rp-opened');
        const totalElem = document.getElementById('rp-total');
        const fillElem = document.querySelector('.progress-fill');

        if (openedElem) openedElem.innerText = opened;
        if (totalElem) totalElem.innerText = total;

        if (fillElem && total > 0) {
            const percentage = Math.min(100, Math.round((opened / total) * 100));
            fillElem.style.width = `${percentage}%`;
        }
    },

    showSuccessAnimation: function(rewardInfo) {
        const giftBox = document.getElementById('gift-box-btn');
        const shareBtn = document.getElementById('share-btn');
        const openBtn = document.getElementById('open-btn');

        if (giftBox) {
            giftBox.style.transform = "scale(1.15)";
            giftBox.classList.remove('interactive-bounce');
        }

        this.showToast(`🎉 Claimed! You won ${rewardInfo}`);

        if (shareBtn) shareBtn.style.display = 'flex';
        if (openBtn) openBtn.style.display = 'none';
    }
};

window.UI_Controller = UI_Controller;

// ==========================================
// 4. ADSGRAM CONTROLLER
// ==========================================
export const Ads_Controller = {
    playAd: async function() {
        return new Promise((resolve, reject) => {
            if (!window.Adsgram) {
                console.warn("Adsgram SDK unavailable. Simulating ad completion...");
                setTimeout(() => resolve(true), 1000);
                return;
            }
            
            try {
                const AdController = window.Adsgram.init({ blockId: "431323" });
                AdController.show()
                    .then(() => resolve(true))
                    .catch((err) => reject("Ad skipped or failed."));
            } catch (err) {
                console.error("Adsgram Execution Error:", err);
                resolve(true); // Graceful fallback
            }
        });
    }
};

// ==========================================
// 5. PACKET LOGIC CONTROLLER
// ==========================================
export const Packet_Controller = {
    cooldownTime: 5 * 60 * 1000, // 5 Minutes in ms

    checkCooldown: function() {
        const lastOpen = localStorage.getItem('last_packet_open');
        if (!lastOpen) return true;

        const timeDiff = Date.now() - parseInt(lastOpen);
        if (timeDiff < this.cooldownTime) {
            const remainingSec = Math.ceil((this.cooldownTime - timeDiff) / 1000);
            const min = Math.floor(remainingSec / 60);
            const sec = remainingSec % 60;
            UI_Controller.showToast(`⏱️ Please wait ${min}m ${sec}s before claiming next packet.`);
            return false;
        }
        return true;
    },

    loadSpecificPacket: async function(packetId) {
        const viewSingle = document.getElementById('view-single');
        if (viewSingle) viewSingle.style.display = 'block';

        let limitCount = 500;
        let openedCount = 245;
        let channelName = "Crypto Drops Channel";
        let tokenDetails = "100 USDT Drop";

        // Attempt Firestore Fetch
        try {
            const packetRef = doc(db, "red_packets", packetId);
            const packetSnap = await getDoc(packetRef);
            
            if (packetSnap.exists()) {
                const data = packetSnap.data();
                limitCount = data.openLimit || limitCount;
                openedCount = data.opened || 0;
                channelName = data.channelName || channelName;
                tokenDetails = `${data.amount || '0'} ${data.tokenName || 'USDT'}`;
            }
        } catch (e) {
            console.log("Firestore fetch fallback to default values:", e);
        }

        // Update UI
        const chanElem = document.getElementById('rp-channel-name');
        const tokenElem = document.getElementById('rp-token-info');
        if (chanElem) chanElem.innerText = channelName;
        if (tokenElem) tokenElem.innerText = tokenDetails;

        UI_Controller.updateProgressBar(openedCount, limitCount);

        const openBtn = document.getElementById('open-btn');
        const giftBoxBtn = document.getElementById('gift-box-btn');

        const handleOpenAction = async () => {
            if (openedCount >= limitCount) {
                UI_Controller.showToast("❌ Red Packet Fully Claimed!");
                return;
            }

            if (!this.checkCooldown()) return;

            if (giftBoxBtn) giftBoxBtn.classList.add('shake');
            UI_Controller.showToast("🎬 Loading rewarded ad...");

            try {
                // 1. Play Ad
                await Ads_Controller.playAd();

                // 2. Perform DB Updates if available
                const user = User_Controller.getUserInfo();
                try {
                    await setDoc(doc(db, "claim_records", `${packetId}_${user.id}`), {
                        redPacketId: packetId,
                        telegramUserId: user.id,
                        username: user.username,
                        openedAt: new Date(),
                        reward: tokenDetails
                    });

                    await updateDoc(doc(db, "red_packets", packetId), {
                        opened: increment(1)
                    });
                } catch (dbErr) {
                    console.log("DB update skipped/demo mode:", dbErr);
                }

                // 3. Save Cooldown
                localStorage.setItem('last_packet_open', Date.now().toString());

                // 4. Update local state & trigger UI success
                if (giftBoxBtn) giftBoxBtn.classList.remove('shake');
                openedCount++;
                UI_Controller.updateProgressBar(openedCount, limitCount);
                UI_Controller.showSuccessAnimation(tokenDetails);

            } catch (error) {
                if (giftBoxBtn) giftBoxBtn.classList.remove('shake');
                UI_Controller.showToast(error === "Ad skipped or failed." ? "⚠️ You must watch the complete ad to claim!" : "❌ Connection Error.");
            }
        };

        if (openBtn) openBtn.onclick = handleOpenAction;
        if (giftBoxBtn) giftBoxBtn.onclick = handleOpenAction;
    },

    loadPacketList: async function() {
        const viewList = document.getElementById('view-list');
        const container = document.getElementById('packet-list-container');
        if (viewList) viewList.style.display = 'block';

        if (!container) return;

        // Render Active Packets (Demo UI or Firestore Collection)
        container.innerHTML = `
            <div class="packet-item-card">
                <div class="packet-info">
                    <h4>💎 Exclusive USDT Drop</h4>
                    <p>Limit: 500 | Claimed: 245</p>
                </div>
                <span style="color: var(--gold); font-weight: 700; font-size: 13px;">🟢 Active</span>
            </div>
            <div class="packet-item-card">
                <div class="packet-info">
                    <h4>🚀 TON Community Bonus</h4>
                    <p>Limit: 1000 | Claimed: 890</p>
                </div>
                <span style="color: var(--gold); font-weight: 700; font-size: 13px;">🟢 Active</span>
            </div>
        `;
    }
};

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

    // 3. Share Button Bindings
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const shareText = "🔥 I just claimed a free Red Packet! Claim yours before it expires 👇";
            const botLink = `https://t.me/YourBotName?startapp=${startParam || 'drop'}`;
            const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(shareText)}`;

            if (User_Controller.tg?.openTelegramLink) {
                User_Controller.tg.openTelegramLink(telegramShareUrl);
            } else {
                window.open(telegramShareUrl, '_blank');
            }
        });
    }

    // 4. Hide Splash
    if (User_Controller.tg?.ready) User_Controller.tg.ready();
    UI_Controller.hideSplash();
});
