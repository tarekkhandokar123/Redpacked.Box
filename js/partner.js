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
    updateDoc, 
    arrayUnion,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const BOT_TOKEN = "7963495475:AAHV4L...YOUR_BOT_TOKEN"; // আপনার বটের আসল API Token
const BOT_USERNAME = "REDPACKETBOXBOT";
const USER_APP_CLAIM_URL = "https://t.me/REDPACKETBOXBOT/claim"; // ইউজার অ্যাপ ক্লেইম লিংক

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
// 4. CHANNEL VERIFICATION (REQ 2 & REQ 3)
// Owner Check + Min 500 Subs + Bot Admin Perms
// ==========================================
export const Channel_Verification_Module = {
    verifyAndAddChannel: async function(channelInput) {
        const user = Telegram_Controller.getUser();
        const validUsername = parseTelegramUsername(channelInput);

        if (!validUsername) {
            UI_Helper.showToast("⚠️ সঠিক চ্যানেল ইউজারনেম (@channel) অথবা আইডি দিন!");
            return false;
        }

        UI_Helper.showToast("🔍 চ্যানেল এবং বটের পারমিশন যাচাই করা হচ্ছে...");

        try {
            // A. Get Chat Details
            const chatRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${validUsername}`);
            const chatData = await chatRes.json();
            if (!chatData.ok) {
                throw new Error("চ্যানেল পাওয়া যায়নি! ইউজারনেম সঠিক আছে কিনা এবং বটকে চ্যানেলে এড করেছেন কিনা চেক করুন।");
            }

            const chatId = chatData.result.id.toString();
            const chatTitle = chatData.result.title;

            // B. Minimum 500 Subscribers Check
            const countRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMemberCount?chat_id=${chatId}`);
            const countData = await countRes.json();
            const subCount = countData.ok ? countData.result : 0;

            if (subCount < 500) {
                throw new Error(`চ্যানেলে সর্বনিম্ন ৫০০ সাবস্ক্রাইবার থাকতে হবে! বর্তমান সাবস্ক্রাইবার: ${subCount}`);
            }

            // C. Channel Owner (Creator) Check Only
            const userMemberRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${user.id}`);
            const userMemberData = await userMemberRes.json();

            if (!userMemberData.ok || userMemberData.result.status !== 'creator') {
                throw new Error("আপনি এই চ্যানেলের মূল ওনার (Owner) নন! শুধুমাত্র চ্যানেল Owner এড করতে পারবে।");
            }

            // D. Bot Admin & Permissions Check
            const botMeRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
            const botMe = await botMeRes.json();

            const botMemberRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${botMe.result.id}`);
            const botMemberData = await botMemberRes.json();

            if (!botMemberData.ok || botMemberData.result.status !== 'administrator') {
                throw new Error(`বট @${BOT_USERNAME} কে আপনার চ্যানেলে Administrator বানাতে হবে!`);
            }

            const perms = botMemberData.result;
            if (!perms.can_post_messages || !perms.can_edit_messages || !perms.can_delete_messages) {
                throw new Error("বটকে অবশ্যই Post, Edit, এবং Delete Messages এর পারমিশন দিতে হবে!");
            }

            // E. Save Channel Data to Firestore
            const newChanObj = {
                id: chatId,
                username: validUsername,
                title: chatTitle,
                subscribers: subCount,
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

            UI_Helper.showToast(`✅ ${chatTitle} চ্যানেল সফলভাবে ভেরিফাই ও সেভ করা হয়েছে!`);
            await Dashboard_Module.loadDashboardData();
            Router.switchView('dashboard-view');
            return true;

        } catch (err) {
            console.error("Verification error:", err);
            UI_Helper.showToast(`❌ ${err.message}`);
            return false;
        }
    }
};

// ==========================================
// 5. DASHBOARD & LOCK MANAGEMENT (REQ 1 & REQ 4)
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

    // REQ 1: চ্যানেল এড না করা পর্যন্ত রেড প্যাকেট ফর্ম ব্লক রাখা
    checkCreateViewLock: function() {
        const createForm = document.getElementById('create-packet-form');
        const lockWarning = document.getElementById('no-channel-warning');

        if (!this.userChannels || this.userChannels.length === 0) {
            if (createForm) createForm.style.display = 'none';
            if (lockWarning) {
                lockWarning.style.display = 'block';
                lockWarning.innerHTML = `
                    <div style="background: rgba(229, 57, 53, 0.15); border: 1px solid #e53935; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 15px;">
                        <p style="color: #ff6b6b; font-weight: bold; margin-bottom: 8px;">⚠️ কোনো চ্যানেল ভেরিফাই করা নেই!</p>
                        <p style="font-size: 12px; color: #ccc; margin-bottom: 10px;">রেড প্যাকেট তৈরি করতে আপনাকে অবশ্যই অন্তত একটি চ্যানেল এড ও ভেরিফাই করতে হবে।</p>
                        <button onclick="Router.switchView('verification-view')" style="background:#FFD700; color:#000; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">+ Add Channel Now</button>
                    </div>
                `;
            }
        } else {
            if (createForm) createForm.style.display = 'block';
            if (lockWarning) lockWarning.style.display = 'none';
        }
    },

    // REQ 3: মাল্টি-চ্যানেল ড্রপডাউন এবং প্লাস আইকন হ্যান্ডলিং
    renderChannelsDropdown: function() {
        const selectElem = document.getElementById('channel-dropdown');
        if (!selectElem) return;

        if (this.userChannels.length === 0) {
            selectElem.innerHTML = `<option value="">No Channel Added</option>`;
        } else {
            selectElem.innerHTML = this.userChannels.map(c => 
                `<option value="${c.id}">${c.title} (${c.subscribers} subs)</option>`
            ).join('');
        }
    },

    // REQ 4: সর্বশেষ রেড প্যাকেট কার্ড ভিজ্যুয়ালাইজেশন
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
// 6. RED PACKET CREATION & PUBLISHING (REQ 5)
// Tracking URL & Interactive Modal
// ==========================================
export const RedPacket_Module = {
    activePacket: null,

    // প্যাকেট তৈরি
    createPacket: async function(formData) {
        const user = Telegram_Controller.getUser();

        if (!Dashboard_Module.userChannels || Dashboard_Module.userChannels.length === 0) {
            UI_Helper.showToast("❌ আগে অন্তত একটি চ্যানেল ভেরিফাই করুন!");
            return;
        }

        const packetId = "rp_" + Date.now();
        const packetData = {
            id: packetId,
            partnerId: user.id.toString(), // পার্টনার রেভিনিউ ট্র্যাকিং আইডি
            partnerName: user.name,
            tokenName: formData.tokenName,
            amountPerUser: formData.amountPerUser,
            openLimit: parseInt(formData.openLimit),
            binanceLink: formData.binanceLink,
            createdAt: serverTimestamp()
        };

        try {
            // ১. red_packets কালেকশনে সেভ
            await setDoc(doc(db, "red_packets", packetId), packetData);

            // ২. পার্টনারের প্রোফাইলে latestPacket সেভ
            await setDoc(doc(db, "admins", user.id.toString()), {
                latestPacket: packetData
            }, { merge: true });

            Dashboard_Module.latestPacket = packetData;
            Dashboard_Module.renderLatestPacketWidget();

            UI_Helper.showToast("🎉 Red Packet Created Successfully!");
            
            // পোস্ট ও কপি ডায়ালগ মোডাল ওপেন
            this.openPostModal(packetData);

        } catch (e) {
            console.error("Packet Create Error:", e);
            UI_Helper.showToast("❌ Error saving packet: " + e.message);
        }
    },

    // ক্লেইম ট্র্যাকিং লিংক জেনারেট
    getClaimTrackingUrl: function(packetId) {
        return `${USER_APP_CLAIM_URL}?startapp=${packetId}`;
    },

    // লিংক কপি
    copyClaimLink: function(packetId) {
        const link = this.getClaimTrackingUrl(packetId || Dashboard_Module.latestPacket?.id);
        navigator.clipboard.writeText(link);
        UI_Helper.showToast("📋 Claim Link Copied to Clipboard!");
    },

    // REQ 5: পোস্ট কাস্টমাইজেশন ও চ্যানেল সিলেক্ট মোডাল
    openPostModal: function(packet = null) {
        const targetPacket = packet || Dashboard_Module.latestPacket;
        if (!targetPacket) return;

        this.activePacket = targetPacket;

        // টোকেন নেম ও অ্যামাউন্ট পার ইউজার হাইলাইট সেট
        document.getElementById('modal-token-name').innerText = targetPacket.tokenName;
        document.getElementById('modal-token-amt').innerText = targetPacket.amountPerUser;

        // আকর্ষণীয় ডিফল্ট ক্যাপশন (ইউজার এডিট করতে পারবে)
        const defaultCaption = `🔥 Exclusive ${targetPacket.tokenName} Crypto Drop!\nClaim your free reward right now before it runs out. Fast fingers only! 👇\n\n#Crypto #RedPacket #FreeReward`;
        document.getElementById('modal-post-caption').value = defaultCaption;

        // চ্যানেল সিলেক্টর রেন্ডার (১টি থাকলে অটো সিলেক্ট, একাধিক থাকলে সিলেক্ট করার সুযোগ)
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

    // টেলিগ্রাম চ্যানেলে অটোমেটিক পোস্ট পাবলিশিং
    publishToSelectedChannels: async function() {
        if (!this.activePacket) return;

        const customCaption = document.getElementById('modal-post-caption').value;
        const checkboxes = document.querySelectorAll('#modal-channel-list input[type="checkbox"]:checked');
        const selectedChanIds = Array.from(checkboxes).map(cb => cb.value);

        if (selectedChanIds.length === 0) {
            UI_Helper.showToast("❌ পোস্ট করার জন্য অন্তত একটি চ্যানেল সিলেক্ট করুন!");
            return;
        }

        const btn = document.getElementById('btn-final-publish');
        if (btn) { btn.disabled = true; btn.innerText = "Publishing..."; }

        const trackingClaimUrl = this.getClaimTrackingUrl(this.activePacket.id);

        // টপ ফিক্সড ইনফো + ইউজারের কাস্টমাইজ করা টেক্সট
        const fullMessageText = `<b>🎁 TOKEN: ${this.activePacket.tokenName}</b>\n<b>💰 REWARD: ${this.activePacket.amountPerUser}</b>\n\n${customCaption.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;

        const inlineKeyboard = {
            inline_keyboard: [
                [{ text: "🎁 CLAIM RED PACKET", url: trackingClaimUrl }]
            ]
        };

        let successCount = 0;

        for (const chanId of selectedChanIds) {
            try {
                const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chanId,
                        text: fullMessageText,
                        parse_mode: 'HTML',
                        reply_markup: inlineKeyboard
                    })
                });
                const data = await res.json();
                if (data.ok) successCount++;
            } catch (e) {
                console.error("Error posting to channel " + chanId, e);
            }
        }

        if (btn) { btn.disabled = false; btn.innerText = "Publish Now"; }
        this.closePostModal();

        if (successCount > 0) {
            UI_Helper.showToast(`🚀 ${successCount} টি চ্যানেলে সফলভাবে পোস্ট পাবলিশ হয়েছে!`);
            Router.switchView('dashboard-view');
        } else {
            UI_Helper.showToast("❌ পোস্ট করা যায়নি! বটের পারমিশন আবার চেক করুন।");
        }
    }
};

window.RedPacket_Module = RedPacket_Module;
window.Channel_Verification_Module = Channel_Verification_Module;

// ==========================================
// 7. INITIALIZATION & FORM LISTENERS
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    const user = Telegram_Controller.getUser();

    // DOM العناصر আপডেট
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

    // প্রাথমিক ডেটা লোড
    await Dashboard_Module.loadDashboardData();

    // ভেরিফিকেশন ফর্মে সাবমিট লিসেনার
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

    // ক্রিয়েট রেড প্যাকেট ফর্মে সাবমিট লিসেনার
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

    // ভিউ লক চেক ও রাউটিং
    if (Dashboard_Module.userChannels.length > 0) {
        Router.switchView('dashboard-view');
    } else {
        Router.switchView('verification-view');
    }

    Telegram_Controller.tg?.ready();
    UI_Helper.hideSplash();
});
