// ==========================================
// FIREBASE IMPORTS (Modular SDK v11/v12)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBObsWUTRpIESXNW_wa2MvoblEmJc27TaQ",
  authDomain: "gift-box-io.firebaseapp.com",
  projectId: "gift-box-io",
  storageBucket: "gift-box-io.firebasestorage.app",
  messagingSenderId: "578138378445",
  appId: "1:578138378445:web:a74b708976e87c150d5984"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// VERIFY & SAVE CHANNEL TO FIREBASE
// ==========================================
/**
 * Verifies channel ownership and saves verified channel to Firebase Firestore.
 * @param {string} channelUsername - Channel username (e.g., "@CryptoDropXOfficial")
 * @param {string|number} telegramUserId - User's Telegram ID
 */
export async function verifyAndSaveChannel(channelUsername, telegramUserId) {
    if (!channelUsername || !telegramUserId) {
        if (window.UI_Controller) {
            window.UI_Controller.showToast("⚠️ Channel name or User ID missing!");
        } else {
            alert("⚠️ Channel name or User ID missing!");
        }
        return { success: false };
    }

    // Format username to start with @
    const formattedChannel = channelUsername.trim().startsWith('@') 
        ? channelUsername.trim() 
        : `@${channelUsername.trim()}`;

    try {
        if (window.UI_Controller) {
            window.UI_Controller.showToast("🔍 Verifying channel ownership...");
        }

        // 1. Verification API Call
        const response = await fetch('https://redpacked.vercel.app/api/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'verify',
                channelId: formattedChannel,
                userId: telegramUserId.toString()
            })
        });

        const result = await response.json();

        // 2. If Verification Successful -> Save to Firebase Firestore
        if (result.isVerified) {
            // Document ID Clean formatting (removes @ character)
            const cleanDocId = formattedChannel.replace('@', '').toLowerCase();

            // Save record in Firestore under "channels" collection
            await setDoc(doc(db, "channels", cleanDocId), {
                channelUsername: formattedChannel,
                ownerTelegramId: telegramUserId.toString(),
                userRole: result.role || "administrator",
                status: "active",
                createdAt: serverTimestamp()
            }, { merge: true });

            if (window.UI_Controller) {
                window.UI_Controller.showToast("✅ Channel Verified & Saved Successfully!");
            } else {
                alert(`✅ Success! Channel ${formattedChannel} verified and added to database.`);
            }

            return { success: true, channel: formattedChannel };

        } else {
            if (window.UI_Controller) {
                window.UI_Controller.showToast(result.message || "❌ Verification failed!");
            } else {
                alert(result.message || "❌ Verification failed!");
            }
            return { success: false, message: result.message };
        }

    } catch (error) {
        console.error("Verification and Firebase saving error:", error);
        if (window.UI_Controller) {
            window.UI_Controller.showToast("❌ Connection error during verification!");
        } else {
            alert("❌ Connection error during verification!");
        }
        return { success: false, error: error.message };
    }
}
