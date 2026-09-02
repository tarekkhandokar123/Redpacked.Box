// ==========================================
// FIREBASE IMPORTS (Modular SDK v12)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    setDoc, 
    serverTimestamp,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const BOT_USERNAME = "REDPACKETBOXBOT";
const API_BASE_URL = "https://redpacked.vercel.app"; // Vercel Absolute URL

const firebaseConfig = {
  apiKey: "AIzaSyBObsWUTRpIESXNW_wa2MvoblEmJc27TaQ",
  authDomain: "gift-box-io.firebaseapp.com",
  projectId: "gift-box-io",
  storageBucket: "gift-box-io.firebasestorage.app",
  messagingSenderId: "578138378445",
  appId: "1:578138378445:web:a74b708976e87c150d5984"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/**
 * Helper function to show notifications
 */
function notify(msg, isError = false) {
    if (window.UI_Controller && typeof window.UI_Controller.showToast === 'function') {
        window.UI_Controller.showToast(msg);
    } else if (window.UI_Helper && typeof window.UI_Helper.showToast === 'function') {
        window.UI_Helper.showToast(msg);
    } else {
        alert(msg);
    }
}

// ==========================================
// 1. FETCH USER'S VERIFIED CHANNELS
// ==========================================
export async function getUserVerifiedChannels(telegramUserId) {
    try {
        const userRef = doc(db, "admins", telegramUserId.toString());
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().channels) {
            return snap.data().channels;
        }
        return [];
    } catch (e) {
        console.error("Error fetching channels:", e);
        return [];
    }
}

// ==========================================
// 2. STRICT CHANNEL VERIFICATION & SAVE
// ==========================================
export async function verifyAndSaveChannel(channelUsername, telegramUserId) {
    if (!channelUsername || !telegramUserId) {
        notify("⚠️ Channel username or user ID not found!", true);
        return { success: false };
    }

    let formattedChannel = channelUsername.trim();
    if (!formattedChannel.startsWith('@') && !formattedChannel.startsWith('-100')) {
        formattedChannel = `@${formattedChannel}`;
    }

    try {
        notify("🔍 Verifying channel and bot permissions...");

        const response = await fetch(`${API_BASE_URL}/api/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'verify',
                channelInput: formattedChannel,
                userId: telegramUserId.toString()
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Server Error (${response.status}): ${errText.slice(0, 50)}`);
        }

        const data = await response.json();

        if (data.ok && data.isVerified) {
            const cleanDocId = data.channelId.toString().replace('-', '');
            const newChannelData = {
                id: data.channelId.toString(),
                username: data.channelUsername || formattedChannel,
                title: data.channelTitle,
                subscribers: data.subscriberCount || 0,
                verifiedAt: new Date().toISOString()
            };

            // 1. Save in individual "channels" collection
            await setDoc(doc(db, "channels", cleanDocId), {
                channelId: data.channelId.toString(),
                channelUsername: data.channelUsername || formattedChannel,
                channelTitle: data.channelTitle,
                ownerTelegramId: telegramUserId.toString(),
                subscriberCount: data.subscriberCount || 0,
                status: "active",
                createdAt: serverTimestamp()
            }, { merge: true });

            // 2. Append to user's channel list array in "admins"
            const userRef = doc(db, "admins", telegramUserId.toString());
            await setDoc(userRef, {
                ownerId: telegramUserId.toString(),
                channels: arrayUnion(newChannelData),
                updatedAt: serverTimestamp()
            }, { merge: true });

            notify(`✅ Success! Channel "${data.channelTitle}" verified and added successfully.`);
            return { success: true, channel: newChannelData };
        } else {
            throw new Error(data.message || "Channel verification failed!");
        }

    } catch (error) {
        console.error("Verification error:", error);
        notify(`❌ ${error.message}`, true);
        return { success: false, error: error.message };
    }
}

// ==========================================
// 3. RED PACKET CREATION LOCK CHECK
// ==========================================
export async function canUserCreatePacket(telegramUserId) {
    const channels = await getUserVerifiedChannels(telegramUserId);
    if (!channels || channels.length === 0) {
        notify("⚠️ You must verify at least one channel to create a Red Packet!", true);
        return false;
    }
    return true;
}

// ==========================================
// 4. RED PACKET CREATION & DATA SAVING
// ==========================================
export async function saveRedPacket(telegramUserId, packetDetails) {
    const isAllowed = await canUserCreatePacket(telegramUserId);
    if (!isAllowed) return { success: false };

    const packetId = "rp_" + Date.now();
    const packetData = {
        id: packetId,
        ownerId: telegramUserId.toString(),
        tokenName: packetDetails.tokenName,
        amountPerUser: packetDetails.amountPerUser,
        totalClaimLimit: parseInt(packetDetails.totalClaimLimit),
        binanceLink: packetDetails.binanceLink,
        claimedCount: 0,
        status: "active",
        createdAt: serverTimestamp()
    };

    try {
        await setDoc(doc(db, "red_packets", packetId), packetData);
        
        await setDoc(doc(db, "admins", telegramUserId.toString()), {
            latestPacket: packetData
        }, { merge: true });

        notify("🎉 Red Packet Created Successfully!");
        return { success: true, packet: packetData };
    } catch (e) {
        notify("❌ Error saving packet: " + e.message, true);
        return { success: false };
    }
}

// ==========================================
// 5. AUTOMATIC CHANNEL PUBLISHING
// ==========================================
export async function publishPacketToChannels(packetData, customCaption, targetChannelIds = []) {
    if (!targetChannelIds || targetChannelIds.length === 0) {
        notify("❌ Please select at least one channel!", true);
        return { success: false };
    }

    const claimLink = `https://t.me/${BOT_USERNAME}/claim?startapp=${packetData.id}`;
    
    const sanitizedCaption = (customCaption || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const formattedText = `<b>🔥 EXCLUSIVE CRYPTO RED PACKET DROP 🔥</b>\n\n<b>🎁 TOKEN:</b> ${packetData.tokenName}\n<b>💰 REWARD PER USER:</b> ${packetData.amountPerUser}\n\n${sanitizedCaption}`;

    try {
        notify("🚀 Publishing post to selected channel(s)...");

        const res = await fetch(`${API_BASE_URL}/api/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'publish',
                channelIds: targetChannelIds,
                message: formattedText,
                claimUrl: claimLink
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Server Error (${res.status}): ${errText.slice(0, 50)}`);
        }

        const data = await res.json();

        if (data.ok && data.successCount > 0) {
            notify(`🚀 Published successfully to ${data.successCount} channel(s)!`);
            return { success: true, count: data.successCount };
        } else {
            notify(data.message || "❌ Failed to publish post! Check bot admin permissions.", true);
            return { success: false };
        }
    } catch (e) {
        console.error("Publishing error:", e);
        notify(`❌ ${e.message}`, true);
        return { success: false };
    }
}
