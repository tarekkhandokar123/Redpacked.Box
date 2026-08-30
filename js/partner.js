// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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
// 1. TELEGRAM & USER SESSION CONTROLLER
// ==========================================
export const Telegram_Controller = {
    tg: window.Telegram.WebApp,
    getUser: function() {
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
        // Fallback for testing outside Telegram environment
        return { id: "test_admin_id_123", username: "DemoAdmin", name: "Demo Channel Admin", photoUrl: "" };
    }
};

// ==========================================
// 2. GLOBAL UI & TOAST NOTIFICATION
// ==========================================
export const UI_Helper = {
    showToast: function(message) {
        const toast = document.getElementById('toast-container');
        toast.innerText = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
    },
    hideSplash: function() {
        setTimeout(() => {
            document.getElementById('splash-screen').style.display = 'none';
            document.getElementById('admin-container').style.display = 'block';
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

        // Hide all views
        document.querySelectorAll('.view-section').forEach(section => {
            section.style.display = 'none';
        });

        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.style.display = 'block';

            // Add to history stack to remember navigation path
            if (pushHistory) {
                if (this.historyStack.length === 0 || this.historyStack[this.historyStack.length - 1] !== viewId) {
                    this.historyStack.push(viewId);
                }
            }

            // Bottom Navigation Active Class Update
            document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));
            if (viewId === 'dashboard-view') {
                document.querySelector('.bottom-nav-item:nth-child(1)')?.classList.add('active');
            } else if (viewId === 'create-view') {
                document.querySelector('.bottom-nav-item:nth-child(2)')?.classList.add('active');
            } else if (viewId === 'profile-view') {
                document.querySelector('.bottom-nav-item:nth-child(3)')?.classList.add('active');
            }

            // Telegram Native BackButton Display Logic
            if (tg && tg.BackButton) {
                if (viewId === 'dashboard-view' || viewId === 'verification-view') {
                    tg.BackButton.hide();
                    this.historyStack = [viewId];
                } else {
                    tg.BackButton.show();
                }
            }

            // Lazy Load Data
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

// Handle Global Back Button Click Event exactly ONCE
if (window.Telegram?.WebApp?.BackButton) {
    window.Telegram.WebApp.BackButton.onClick(() => {
        Router.goBack();
    });
}

// ==========================================
// 4. APP INITIALIZATION & VERIFICATION FLOW
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    const user = Telegram_Controller.getUser();
    
    // Set Header/Profile metadata
    document.getElementById('header-name').innerText = user.name;
    if (user.photoUrl) {
        document.getElementById('header-avatar').src = user.photoUrl;
        document.getElementById('prof-avatar').src = user.photoUrl;
    }
    document.getElementById('prof-name').innerText = user.name;
    document.getElementById('prof-username').innerText = `@${user.username}`;

    // Check if Admin Profile already exists in Database
    try {
        const adminRef = doc(db, "admins", user.id.toString());
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
            // Already verified, go directly to Dashboard
            Router.switchView('dashboard-view');
        } else {
            // First time: Show Channel Verification View
            Router.switchView('verification-view');
            setupVerificationForm(user);
        }
    } catch (e) {
        console.error("Initialization error:", e);
        Router.switchView('dashboard-view'); // Fallback
    }

    Telegram_Controller.tg.ready();
    UI_Helper.hideSplash();
});

function setupVerificationForm(user) {
    const form = document.getElementById('verify-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const chanName = document.getElementById('chan-name').value.trim();
        const chanLink = document.getElementById('chan-link').value.trim();

        if (!chanName || !chanLink) {
            UI_Helper.showToast("Please enter both Channel Name and Link.");
            return;
        }

        UI_Helper.showToast("Verifying channel admin status via Telegram Bot API...");

        // Simulated Backend verification (In production, backend checks Telegram getChatMember API)
        setTimeout(async () => {
            const isAdminVerified = true; // Set to false if API check fails

            if (isAdminVerified) {
                try {
                    // Create Admin Profile in Database ONLY after successful verification
                    await setDoc(doc(db, "admins", user.id.toString()), {
                        telegramUserId: user.id,
                        username: user.username,
                        name: user.name,
                        channelName: chanName,
                        channelLink: chanLink,
                        createdAt: new Date(),
                        availableBalance: 0,
                        holdingBalance: 0,
                        withdrawableBalance: 0
                    });

                    UI_Helper.showToast("✅ Channel Verified Successfully!");
                    Router.switchView('dashboard-view');
                } catch (err) {
                    UI_Helper.showToast("Error saving profile to database.");
                }
            } else {
                UI_Helper.showToast("❌ Channel verification failed. You must be an administrator.");
            }
        }, 1500);
    };
}
