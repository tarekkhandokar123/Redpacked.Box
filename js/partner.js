// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
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
// HELPER: EXTRACT TELEGRAM USERNAME FROM STRING/URL
// ==========================================
function parseTelegramUsername(input) {
    if (!input) return null;
    const clean = input.trim();
    if (clean.startsWith('-100')) return clean; // Channel ID support
    
    // Regex to extract username from t.me links or @username
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
        }, 1200);
    }
};
window.UI_Helper = UI_Helper;

// ==========================================
// 3. LAZY ROUTING SYSTEM & BOTTOM NAV / BACK BUTTON
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

            if (viewId === 'dashboard-view' && window.Dashboard_Module) {
                window.Dashboard_Module.loadDashboardData();
            } else if (viewId === 'profile-view' && window.Withdraw_Module) {
                window.Withdraw_Module.loadProfileData();
            } else if (viewId === 'create-view' && window.Dashboard_Module) {
                window.Dashboard_Module.checkCooldownStatus();
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
// 4. APP INITIALIZATION & VERIFICATION CHECK
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

    // CHECK FIREBASE: ইউজার আগে চ্যানেল ভেরিফাই করে একাউন্ট বানিয়েছে কিনা?
    try {
        const adminRef = doc(db, "admins", user.id.toString());
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
            // একাউন্ট ফায়ারবেসে থাকলে ড্যাশবোর্ডে যাবে
            Router.switchView('dashboard-view');
        } else {
            // একাউন্ট না থাকলে কেবল ভেরিফিকেশন পেজ দেখাবে (লক থাকবে)
            Router.switchView('verification-view');
            setupVerificationForm(user);
        }
    } catch (e) {
        console.error("Firebase read error during init:", e);
        // ফায়ারবেস কানেকশন ফেইল করলেও ভেরিফিকেশন ভিউতেই রাখবে
        Router.switchView('verification-view');
        setupVerificationForm(user);
    }

    Telegram_Controller.tg?.ready();
    UI_Helper.hideSplash();
});

// ==========================================
// 5. VERIFICATION & FIREBASE ACCOUNT CREATION
// ==========================================
function setupVerificationForm(user) {
    const form = document.getElementById('verify-form');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const chanNameInput = document.getElementById('chan-name');
        const chanLinkInput = document.getElementById('chan-link');
        
        const rawChanName = chanNameInput ? chanNameInput.value.trim() : '';
        const rawChanLink = chanLinkInput ? chanLinkInput.value.trim() : '';

        if (!rawChanName || !rawChanLink) {
            UI_Helper.showToast("⚠️ Please enter both Channel Name and Link.");
            return;
        }

        // Extract valid @username
        const validChannelUsername = parseTelegramUsername(rawChanLink) || parseTelegramUsername(rawChanName);

        if (!validChannelUsername) {
            UI_Helper.showToast("⚠️ Invalid Channel Username or Link!");
            return;
        }

        UI_Helper.showToast("🔍 Verifying channel admin status...");

        try {
            // API Request to Vercel Webhook
            const response = await fetch('https://redpacked.vercel.app/api/webhook', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    action: 'verify',
                    channelId: validChannelUsername,
                    userId: user.id.toString()
                })
            });

            if (!response.ok) {
                throw new Error(`Server status ${response.status}`);
            }

            const result = await response.json();

            if (result.isVerified) {
                const cleanDocId = validChannelUsername.replace('@', '').toLowerCase();

                UI_Helper.showToast("⏳ Saving account to Firebase...");

                // 1. Save Admin Profile in Firebase
                await setDoc(doc(db, "admins", user.id.toString()), {
                    telegramUserId: user.id.toString(),
                    username: user.username,
                    name: user.name,
                    channelName: rawChanName,
                    channelUsername: validChannelUsername,
                    channelLink: rawChanLink,
                    availableBalance: 0,
                    holdingBalance: 0,
                    withdrawableBalance: 0,
                    createdAt: serverTimestamp()
                }, { merge: true });

                // 2. Save Channel Data in Firebase
                await setDoc(doc(db, "channels", cleanDocId), {
                    channelUsername: validChannelUsername,
                    channelTitle: rawChanName,
                    channelLink: rawChanLink,
                    ownerTelegramId: user.id.toString(),
                    userRole: result.role || "administrator",
                    status: "active",
                    createdAt: serverTimestamp()
                }, { merge: true });

                UI_Helper.showToast("🎉 Verified & Account Created Successfully!");
                
                // একাউন্ট তৈরি হয়ে গেলে এখন ড্যাশবোর্ডে নিয়ে যাবে
                setTimeout(() => {
                    Router.switchView('dashboard-view');
                }, 1000);

            } else {
                UI_Helper.showToast(result.message || "❌ You must add the Bot as Admin in your channel!");
            }
        } catch (err) {
            console.error("Verification connection error:", err);
            UI_Helper.showToast(`❌ API Error: ${err.message || "Connection failed"}`);
        }
    };
                        }
