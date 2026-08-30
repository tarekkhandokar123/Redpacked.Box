// Import Firebase SDKs (আপনার দেওয়া কনফিগারেশন + Firestore Database)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import { getFirestore, doc, getDoc, updateDoc, increment, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================
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
const db = getFirestore(app);

// ==========================================
// 2. USER DATA CONTROLLER (Telegram)
// ==========================================
const User_Controller = {
    tg: window.Telegram.WebApp,
    getUserInfo: function() {
        this.tg.expand();
        const user = this.tg.initDataUnsafe?.user;
        if(user) {
            return {
                id: user.id,
                username: user.username || 'User',
                fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                photoUrl: user.photo_url || 'default-avatar.png'
            };
        }
        return { id: "test_user", username: "DemoUser", fullName: "Demo User", photoUrl: "" }; // Fallback
    }
};

// ==========================================
// 3. UI / ANIMATION CONTROLLER
// ==========================================
const UI_Controller = {
    showToast: function(message) {
        const toast = document.getElementById('toast-container');
        toast.innerText = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },
    hideSplash: function() {
        setTimeout(() => {
            document.getElementById('splash-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';
        }, 1500); // 1.5s professional load
    },
    setupProfile: function(user) {
        document.getElementById('user-name').innerText = user.fullName;
        if(user.photoUrl) document.getElementById('user-avatar').src = user.photoUrl;
    },
    openAdminApp: function() {
        // মেইন অ্যাপ যেখানে এডমিন ক্রিয়েট করতে পারবে তার লিংক
        window.location.href = "https://t.me/YourAdminBot?start=publish"; 
    },
    showSuccessAnimation: function(rewardInfo) {
        const giftBox = document.getElementById('gift-box-btn');
        giftBox.innerText = "✨"; // Box opened icon
        giftBox.style.transform = "scale(1.2)";
        this.showToast(`🎉 Success! You got ${rewardInfo}`);
        document.getElementById('share-btn').style.display = 'inline-block';
        document.getElementById('open-btn').style.display = 'none';
    }
};
// Make UI_Controller accessible globally for inline onclick functions
window.UI_Controller = UI_Controller;

// ==========================================
// 4. ADSGRAM CONTROLLER
// ==========================================
const Ads_Controller = {
    playAd: async function() {
        return new Promise((resolve, reject) => {
            if (!window.Adsgram) {
                console.error("Adsgram not loaded");
                resolve(true); // Fallback if adblock is on
                return;
            }
            const AdController = window.Adsgram.init({ blockId: "431323" });
            AdController.show()
                .then((result) => { resolve(true); }) // Ad watched successfully
                .catch((result) => { reject("Ad skipped or failed."); }); // User closed Ad early
        });
    }
};

// ==========================================
// 5. PACKET LOGIC CONTROLLER (Lazy Load System)
// ==========================================
const Packet_Controller = {
    cooldownTime: 5 * 60 * 1000, // 5 minutes in milliseconds

    checkCooldown: function() {
        const lastOpen = localStorage.getItem('last_packet_open');
        if (!lastOpen) return true; // No record, can open
        const timeDiff = Date.now() - parseInt(lastOpen);
        if (timeDiff < this.cooldownTime) {
            const minLeft = Math.ceil((this.cooldownTime - timeDiff) / 60000);
            UI_Controller.showToast(`Wait ${minLeft} minutes to open the next packet.`);
            return false;
        }
        return true;
    },

    loadSpecificPacket: async function(packetId) {
        // UI Update (Lazy Load)
        document.getElementById('view-single').style.display = 'block';
        
        // এখানে ফায়ারবেস থেকে প্যাকেট ডাটা ফেচ করার ডেমো
        // const docRef = doc(db, "red_packets", packetId);
        // const docSnap = await getDoc(docRef);
        
        document.getElementById('rp-channel-name').innerText = "Crypto Hunters"; // Dynamic from DB
        document.getElementById('rp-token-info').innerText = "USDT — 100 Accounts";
        
        const limit = 500;
        let opened = 245; 
        document.getElementById('rp-opened').innerText = opened;
        document.getElementById('rp-total').innerText = limit;

        const openBtn = document.getElementById('open-btn');
        const giftBoxBtn = document.getElementById('gift-box-btn');

        const handleOpen = async () => {
            if(opened >= limit) {
                UI_Controller.showToast("❌ Red Packet Fully Claimed");
                return;
            }
            if(!this.checkCooldown()) return; // চেক ৫ মিনিট লিমিট

            giftBoxBtn.classList.add('shake');
            UI_Controller.showToast("Opening...");

            try {
                // ১. Adsgram এড চালু হবে
                await Ads_Controller.playAd();
                
                // ২. এড শেষ হলে ডাটাবেইজে হিট হবে 
                const user = User_Controller.getUserInfo();
                
                // Data mapping for DB log (As per your REQUIREMENT logic)
                /* 
                await setDoc(doc(db, "claim_records", `${packetId}_${user.id}`), {
                    redPacketId: packetId,
                    telegramUserId: user.id,
                    username: user.username,
                    openedAt: new Date(),
                    reward: "1 USDT",
                    adminReward: 0.002
                });
                await updateDoc(doc(db, "red_packets", packetId), {
                    opened: increment(1)
                });
                */

                // ৩. Localstorage update for cooldown
                localStorage.setItem('last_packet_open', Date.now().toString());
                
                // ৪. Success Animation & Result
                giftBoxBtn.classList.remove('shake');
                opened++;
                document.getElementById('rp-opened').innerText = opened;
                UI_Controller.showSuccessAnimation("1 USDT");

            } catch(error) {
                giftBoxBtn.classList.remove('shake');
                UI_Controller.showToast(error === "Ad skipped or failed." ? "You must watch the ad completely!" : "Error opening packet.");
            }
        };

        openBtn.addEventListener('click', handleOpen);
        giftBoxBtn.addEventListener('click', handleOpen);
    },

    loadPacketList: function() {
        document.getElementById('view-list').style.display = 'block';
        // এখানে ফায়ারবেস থেকে সব এক্টিভ প্যাকেট লুপ করে #packet-list-container এ যুক্ত করতে হবে।
        // বর্তমানে ডেমো হিসেবে খালি রাখা হয়েছে, শুধু UI দেখানো হলো।
    }
};

// ==========================================
// 6. MAIN APP INITIALIZATION
// ==========================================
window.onload = () => {
    // 1. Get User
    const user = User_Controller.getUserInfo();
    UI_Controller.setupProfile(user);

    // 2. Routing System (Check if user came via a specific packet link)
    // Telegram Mini App a parameter pass kora hoy 'tgWebAppStartParam' diye.
    const startParam = User_Controller.tg.initDataUnsafe?.start_param; 
    
    if (startParam) {
        // ইউজার লিংকে ক্লিক করে আসছে 
        Packet_Controller.loadSpecificPacket(startParam);
    } else {
        // ইউজার ডিরেক্ট অ্যাপ ওপেন করেছে (সব এক্টিভ লিস্ট দেখাবে)
        Packet_Controller.loadPacketList();
    }

    // 3. Share Button functionality
    document.getElementById('share-btn').addEventListener('click', () => {
        const shareText = `I just claimed my Red Packet! Claim yours here:`;
        const botLink = `https://t.me/YourBotName?startapp=${startParam || 'default'}`;
        const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(shareText)}`;
        window.location.href = telegramShareUrl;
    });

    // 4. Hide splash screen after ready
    User_Controller.tg.ready();
    UI_Controller.hideSplash();
};