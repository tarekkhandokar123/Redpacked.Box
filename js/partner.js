// ==========================================
// FIREBASE IMPORTS (Modular SDK v12)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    arrayUnion,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// ==========================================
// CONFIGURATION & CONSTANTS
// (No sensitive BOT_TOKEN here! Keeping environment clean and secure)
// ==========================================
const BOT_USERNAME = "REDPACKETBOXBOT";
const USER_APP_CLAIM_URL = "https://t.me/REDPACKETBOXBOT/claim";

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
// HELPER FUNCTIONS
// ==========================================
function parseTelegramUsername(input) {
    if (!input) return null;
    const clean = input.trim();
    if (clean.startsWith('-100')) return clean;
    const match = clean.match(/(?:https?:\/\/)?(?:t\.me\/|telegram\.me\/)?@?([a-zA-Z0-9_]{5,32})/i);
    return match ? `@${match[1]}` : null;
}

// ==========================================
// 1. TELEGRAM & USER SESSION CONTROLLER
// ==========================================
export const Telegram_Controller = {
    tg: window.Telegram?.WebApp,
    getUser: function() {
        if (this.tg) {
            this.tg.expand();
            const user = this.tg.initDataUnsafe?.user;
            if (user) {
                return {
                    id: user.id,
                    username: user.username || 'AdminUser',
                    name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                    photoUrl: user.photo_url || 'default-avatar.png'
                };
            }
        }
        return { id: "test_admin_id_123", username: "DemoAdmin", name: "Demo Channel Admin", photoUrl: "default-avatar.png" };
    }
};

// ==========================================
// 2. GLOBAL UI & TOAST NOTIFICATION
// ==========================================
export const UI_Helper = {
    showToast: function(message) {
        const toast = document.getElementById('toast-container');
        if (toast) {
            toast.innerText = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 4000);
        } else {
            alert(message);
        }
    },
    hideSplash: function() {
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            const adminContainer = document.getElementById('admin-container');
            if (splash) splash.style.display = 'none';
            if (adminContainer) adminContainer.style.display = 'block';
        }, 1000);
    }
};
window.UI_Helper = UI_Helper;

// ==========================================
// 3. ROUTER & NAVIGATION
// ==========================================
export const Router = {
    historyStack: [], 
    
    switchView: function(viewId, pushHistory = true) {
        const tg = window.Telegram?.WebApp;

        document.querySelectorAll('.view-section').forEach(section => {
            section.style.display = 'none';
        });

        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.style.display = 'block';

            if (pushHistory) {
                if (this.historyStack.length === 0 || this.historyStack[this.historyStack.length - 1] !== viewId) {
                    this.historyStack.push(viewId);
                }
            }

            document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));
            if (viewId === 'dashboard-view') {
                document.querySelector('.bottom-nav-item:nth-child(1)')?.classList.add('active');
            } else if (viewId === 'create-view') {
                document.querySelector('.bottom-nav-item:nth-child(2)')?.classList.add('active');
            } else if (viewId === 'profile-view') {
                document.querySelector('.bottom-nav-item:nth-child(3)')?.classList.add('active');
            }

            if (tg && tg.BackButton) {
                if (viewId === 'dashboard-view' || viewId === 'verification-view') {
                    tg.BackButton.hide();
                    this.historyStack = [viewId];
                } else {
                    tg.BackButton.show();
                }
            }

            if (viewId === 'dashboard-view') {
                Dashboard_Module.loadDashboardData();
            } else if (viewId === 'create-view') {
                Dashboard_Module.checkCreateViewLock();
            }
        }
    },

    goBack: function() {
        if (this.historyStack.length > 1) {
            this.historyStack.pop();
            const previousView = this.historyStack[this.historyStack.length - 1];
            this.switchView(previousView, false);
        }
    }
};
window.Router = Router;

if (window.Telegram?.WebApp?.BackButton) {
    window.Telegram.WebApp.BackButton.onClick(() => {
        Router.goBack();
    });
}

// ==========================================
// 4. CHANNEL VERIFICATION
// Executed via Secure Vercel Serverless Backend API
// ==========================================
export const Channel_Verification_Module = {
    verifyAndAddChannel: async function(channelInput) {
        const user = Telegram_Controller.getUser();
        const validUsername = parseTelegramUsername(channelInput);

        if (!validUsername) {
            UI_Helper.showToast("⚠️ Please enter a valid channel username (@channel) or link!");
            return false;
        }

        UI_Helper.showToast("🔍 Verifying channel and bot permissions...");

        try {
            // Call Vercel Serverless API Route (Backend verifies with Telegram using process.env.BOT_TOKEN)
            const response = await fetch('/api/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verify',
                    channelInput: validUsername,
                    userId: user.id.toString()
                })
            });

            const data = await response.json();

            if (data.ok && data.isVerified) {
                const newChanObj = {
                    id: data.channelId,
                    username: data.channelUsername,
                    title: data.channelTitle,
                    subscribers: data.subscriberCount || 0,
                    addedAt: new Date().toISOString()
                };

                const adminRef = doc(db, "admins", user.id.toString());
                await setDoc(adminRef, {
                    telegramUserId: user.id.toString(),
                    username: user.username,
                    name: user.name,
                    channels: arrayUnion(newChanObj),
                    updatedAt: serverTimestamp()
                }, { merge: true });

                UI_Helper.showToast(`✅ Channel "${data.channelTitle}" verified successfully!`);
                await Dashboard_Module.loadDashboardData();
                Router.switchView('dashboard-view');
                return true;
            } else {
                UI_Helper.showToast(data.message || "❌ Channel verification failed!");
                return false;
            }
        } catch (err) {
            console.error("Verification error:", err);
            UI_Helper.showToast("❌ Network error while verifying channel!");
            return false;
        }
    }
};

// ==========================================
// 5. DASHBOARD & LOCK MANAGEMENT
// ==========================================
export const Dashboard_Module = {
    userChannels: [],
    latestPacket: null,

    loadDashboardData: async function() {
        const user = Telegram_Controller.getUser();
        try {
            const adminRef = doc(db, "admins", user.id.toString());
            const snap = await getDoc(adminRef);

            if (snap.exists()) {
                const data = snap.data();
                this.userChannels = data.channels || [];
                this.latestPacket = data.latestPacket || null;

                this.renderChannelsDropdown();
                this.renderLatestPacketWidget();
            } else {
                this.userChannels = [];
                this.latestPacket = null;
            }
        } catch (e) {
            console.error("Dashboard load error:", e);
        }
    },

    checkCreateViewLock: function() {
        const createForm = document.getElementById('create-packet-form');
        const lockWarning = document.getElementById('no-channel-warning');

        if (!this.userChannels || this.userChannels.length === 0) {
            if (createForm) createForm.style.display = 'none';
            if (lockWarning) {
                lockWarning.style.display = 'block';
                lockWarning.innerHTML = `
                    <div style="background: rgba(229, 57, 53, 0.15); border: 1px solid #e53935; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 15px;">
                        <p style="color: #ff6b6b; font-weight: bold; margin-bottom: 8px;">⚠️ No Verified Channel Found!</p>
                        <p style="font-size: 12px; color: #ccc; margin-bottom: 10px;">You must add and verify at least one Telegram Channel to create Red Packets.</p>
                        <button onclick="Router.switchView('verification-view')" style="background:#FFD700; color:#000; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">+ Add Channel Now</button>
                    </div>
                `;
            }
        } else {
            if (createForm) createForm.style.display = 'block';
            if (lockWarning) lockWarning.style.display = 'none';
        }
    },

    renderChannelsDropdown: function() {
        const selectElem = document.getElementById('channel-dropdown');
        if (!selectElem) return;

        if (this.userChannels.length === 0) {
            selectElem.innerHTML = `<option value="">No Channels Added</option>`;
        } else {
            selectElem.innerHTML = this.userChannels.map(c => 
                `<option value="${c.id}">${c.title} (${c.subscribers} subs)</option>`
            ).join('');
        }
    },

    renderLatestPacketWidget: function() {
        const widget = document.getElementById('latest-packet-widget');
        if (!widget) return;

        if (!this.latestPacket) {
            widget.style.display = 'none';
            return;
        }

        document.getElementById('latest-rp-title').innerText = `${this.latestPacket.tokenName} Red Packet`;
        document.getElementById('latest-rp-info').innerText = `Amount: ${this.latestPacket.amountPerUser} | Limit: ${this.latestPacket.openLimit} Users`;
        widget.style.display = 'block';
    }
};

// ==========================================
// 6. RED PACKET CREATION & SECURE PUBLISHING
// ==========================================
export const RedPacket_Module = {
    activePacket: null,

    createPacket: async function(formData) {
        const user = Telegram_Controller.getUser();

        if (!Dashboard_Module.userChannels || Dashboard_Module.userChannels.length === 0) {
            UI_Helper.showToast("❌ Please verify at least one channel first!");
            return;
        }

        const packetId = "rp_" + Date.now();
        const packetData = {
            id: packetId,
            partnerId: user.id.toString(),
            partnerName: user.name,
            tokenName: formData.tokenName,
            amountPerUser: formData.amountPerUser,
            openLimit: parseInt(formData.openLimit),
            binanceLink: formData.binanceLink,
            createdAt: serverTimestamp()
        };

        try {
            await setDoc(doc(db, "red_packets", packetId), packetData);

            await setDoc(doc(db, "admins", user.id.toString()), {
                latestPacket: packetData
            }, { merge: true });

            Dashboard_Module.latestPacket = packetData;
            Dashboard_Module.renderLatestPacketWidget();

            UI_Helper.showToast("🎉 Red Packet Created Successfully!");
            this.openPostModal(packetData);

        } catch (e) {
            console.error("Packet Create Error:", e);
            UI_Helper.showToast("❌ Error saving packet: " + e.message);
        }
    },

    getClaimTrackingUrl: function(packetId) {
        return `${USER_APP_CLAIM_URL}?startapp=${packetId}`;
    },

    copyClaimLink: function(packetId) {
        const link = this.getClaimTrackingUrl(packetId || Dashboard_Module.latestPacket?.id);
        navigator.clipboard.writeText(link);
        UI_Helper.showToast("📋 Claim Link Copied to Clipboard!");
    },

    openPostModal: function(packet = null) {
        const targetPacket = packet || Dashboard_Module.latestPacket;
        if (!targetPacket) return;

        this.activePacket = targetPacket;

        document.getElementById('modal-token-name').innerText = targetPacket.tokenName;
        document.getElementById('modal-token-amt').innerText = targetPacket.amountPerUser;

        const defaultCaption = `🔥 Exclusive ${targetPacket.tokenName} Crypto Drop!\nClaim your free reward right now before it runs out. Fast fingers only! 👇\n\n#Crypto #RedPacket #FreeReward`;
        document.getElementById('modal-post-caption').value = defaultCaption;

        const chanContainer = document.getElementById('modal-channel-list');
        const channels = Dashboard_Module.userChannels;

        if (channels.length === 1) {
            chanContainer.innerHTML = `
                <label style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:8px; border-radius:8px;">
                    <input type="checkbox" value="${channels[0].id}" checked disabled>
                    <span>${channels[0].title}</span>
                </label>
            `;
        } else {
            chanContainer.innerHTML = `
                <div style="margin-bottom:8px; display:flex; gap:8px;">
                    <button type="button" onclick="RedPacket_Module.toggleSelectAll(true)" style="font-size:11px; padding:3px 8px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; cursor:pointer;">Select All</button>
                    <button type="button" onclick="RedPacket_Module.toggleSelectAll(false)" style="font-size:11px; padding:3px 8px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; cursor:pointer;">Deselect All</button>
                </div>
            ` + channels.map(c => `
                <label style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; margin-bottom:6px;">
                    <input type="checkbox" class="post-chan-cb" value="${c.id}" checked>
                    <span>${c.title}</span>
                </label>
            `).join('');
        }

        document.getElementById('post-publish-modal').style.display = 'flex';
    },

    toggleSelectAll: function(status) {
        document.querySelectorAll('.post-chan-cb').forEach(cb => cb.checked = status);
    },

    closePostModal: function() {
        document.getElementById('post-publish-modal').style.display = 'none';
    },

    // Secure Publishing via Vercel Backend Route (/api/webhook)
    publishToSelectedChannels: async function() {
        if (!this.activePacket) return;

        const customCaption = document.getElementById('modal-post-caption').value;
        const checkboxes = document.querySelectorAll('#modal-channel-list input[type="checkbox"]:checked');
        const selectedChanIds = Array.from(checkboxes).map(cb => cb.value);

        if (selectedChanIds.length === 0) {
            UI_Helper.showToast("❌ Please select at least one channel to publish!");
            return;
        }

        const btn = document.getElementById('btn-final-publish');
        if (btn) { btn.disabled = true; btn.innerText = "Publishing..."; }

        const trackingClaimUrl = this.getClaimTrackingUrl(this.activePacket.id);
        const fullMessageText = `<b>🎁 TOKEN: ${this.activePacket.tokenName}</b>\n<b>💰 REWARD: ${this.activePacket.amountPerUser}</b>\n\n${customCaption.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;

        try {
            const res = await fetch('/api/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'publish',
                    channelIds: selectedChanIds,
                    message: fullMessageText,
                    claimUrl: trackingClaimUrl
                })
            });
            
            const data = await res.json();

            if (data.ok && data.successCount > 0) {
                UI_Helper.showToast(`🚀 Published successfully to ${data.successCount} channel(s)!`);
                Router.switchView('dashboard-view');
            } else {
                UI_Helper.showToast(data.message || "❌ Failed to publish post! Check bot permissions.");
            }
        } catch (e) {
            console.error("Publishing error:", e);
            UI_Helper.showToast("❌ Network error while publishing post!");
        }

        if (btn) { btn.disabled = false; btn.innerText = "Publish Now"; }
        this.closePostModal();
    }
};

window.RedPacket_Module = RedPacket_Module;
window.Channel_Verification_Module = Channel_Verification_Module;

// ==========================================
// 7. INITIALIZATION & FORM LISTENERS
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    const user = Telegram_Controller.getUser();

    const headerName = document.getElementById('header-name');
    const profName = document.getElementById('prof-name');
    const profUsername = document.getElementById('prof-username');
    const headerAvatar = document.getElementById('header-avatar');
    const profAvatar = document.getElementById('prof-avatar');

    if (headerName) headerName.innerText = user.name;
    if (profName) profName.innerText = user.name;
    if (profUsername) profUsername.innerText = `@${user.username}`;
    if (user.photoUrl) {
        if (headerAvatar) headerAvatar.src = user.photoUrl;
        if (profAvatar) profAvatar.src = user.photoUrl;
    }

    await Dashboard_Module.loadDashboardData();

    const verifyForm = document.getElementById('verify-form');
    if (verifyForm) {
        verifyForm.onsubmit = async (e) => {
            e.preventDefault();
            const input = document.getElementById('chan-link') || document.getElementById('chan-name');
            if (input) {
                await Channel_Verification_Module.verifyAndAddChannel(input.value);
            }
        };
    }

    const createForm = document.getElementById('create-packet-form');
    if (createForm) {
        createForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = {
                tokenName: document.getElementById('token-name').value,
                amountPerUser: document.getElementById('token-amount').value,
                openLimit: document.getElementById('open-limit').value,
                binanceLink: document.getElementById('binance-link').value
            };
            await RedPacket_Module.createPacket(formData);
        };
    }

    if (Dashboard_Module.userChannels.length > 0) {
        Router.switchView('dashboard-view');
    } else {
        Router.switchView('verification-view');
    }

    Telegram_Controller.tg?.ready();
    UI_Helper.hideSplash();
});
