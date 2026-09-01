// ==========================================
// FIREBASE IMPORTS (Modular SDK v11/v12)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    setDoc, 
    collection,
    query,
    where,
    getDocs,
    serverTimestamp,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Telegram Bot Configuration
const BOT_TOKEN = "7963495475:AAHV4L...YOUR_BOT_TOKEN"; // Replace with your actual Bot Token
const BOT_USERNAME = "REDPACKETBOXBOT";

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
export const db = getFirestore(app);

/**
 * Helper function to show toast messages or alerts
 */
function notify(msg, isError = false) {
    if (window.UI_Controller && typeof window.UI_Controller.showToast === 'function') {
        window.UI_Controller.showToast(msg);
    } else {
        alert(msg);
    }
}

// ==========================================
// REQ 1 & 3: FETCH USER'S VERIFIED CHANNELS
// ==========================================
export async function getUserVerifiedChannels(telegramUserId) {
    try {
        const userRef = doc(db, "admin_users", telegramUserId.toString());
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
// REQ 2: STRICT CHANNEL VERIFICATION & SAVE
// (Owner Check + Min 500 Subs + Bot Admin Perms)
// ==========================================
export async function verifyAndSaveChannel(channelUsername, telegramUserId) {
    if (!channelUsername || !telegramUserId) {
        notify("⚠️ Channel username or user ID not found!", true);
        return { success: false };
    }

    // Format username
    let formattedChannel = channelUsername.trim();
    if (!formattedChannel.startsWith('@') && !formattedChannel.startsWith('-100')) {
        formattedChannel = `@${formattedChannel}`;
    }

    try {
        notify("🔍 Verifying channel and bot permissions...");

        // A. Telegram API: Fetch basic channel information
        const chatRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${formattedChannel}`);
        const chatData = await chatRes.json();
        if (!chatData.ok) {
            throw new Error("Channel not found! Check username accuracy and ensure the bot is added to the channel.");
        }

        const chatId = chatData.result.id.toString();
        const chatTitle = chatData.result.title;

        // B. Telegram API: Subscriber count check (Minimum 500 required)
        const countRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMemberCount?chat_id=${chatId}`);
        const countData = await countRes.json();
        const subCount = countData.ok ? countData.result : 0;

        if (subCount < 500) {
            throw new Error(`Channel must have at least 500 subscribers! Current count: ${subCount}`);
        }

        // C. Telegram API: Check if user is the Channel Owner/Creator
        const userMemberRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${telegramUserId}`);
        const userMemberData = await userMemberRes.json();

        if (!userMemberData.ok || userMemberData.result.status !== 'creator') {
            throw new Error("You are not the Owner of this channel! Only the channel Creator can connect channels.");
        }

        // D. Telegram API: Check bot status & required permissions
        const botMeRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const botMe = await botMeRes.json();

        const botMemberRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${botMe.result.id}`);
        const botMemberData = await botMemberRes.json();

        if (!botMemberData.ok || botMemberData.result.status !== 'administrator') {
            throw new Error(`Bot @${BOT_USERNAME} must be added as an Administrator in your channel!`);
        }

        const perms = botMemberData.result;
        if (!perms.can_post_messages || !perms.can_edit_messages || !perms.can_delete_messages) {
            throw new Error("Bot requires Post Messages, Edit Messages, and Delete Messages permissions!");
        }

        // E. Save Channel Data to Firestore (Multi-Channel Support)
        const cleanDocId = chatId.replace('-', '');
        const newChannelData = {
            id: chatId,
            username: formattedChannel,
            title: chatTitle,
            subscribers: subCount,
            verifiedAt: new Date().toISOString()
        };

        // 1. Save in individual "channels" collection
        await setDoc(doc(db, "channels", cleanDocId), {
            channelId: chatId,
            channelUsername: formattedChannel,
            channelTitle: chatTitle,
            ownerTelegramId: telegramUserId.toString(),
            subscriberCount: subCount,
            status: "active",
            createdAt: serverTimestamp()
        }, { merge: true });

        // 2. Append to user's channel list array
        const userRef = doc(db, "admin_users", telegramUserId.toString());
        await setDoc(userRef, {
            ownerId: telegramUserId.toString(),
            channels: arrayUnion(newChannelData),
            updatedAt: serverTimestamp()
        }, { merge: true });

        notify(`✅ Success! Channel "${chatTitle}" verified and added successfully.`);
        return { success: true, channel: newChannelData };

    } catch (error) {
        console.error("Verification error:", error);
        notify(`❌ ${error.message}`, true);
        return { success: false, error: error.message };
    }
}

// ==========================================
// REQ 1: RED PACKET CREATION LOCK CHECK
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
// REQ 4: RED PACKET CREATION & DATA SAVING
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
        // Save latest created Red Packet ID under user document
        await setDoc(doc(db, "admin_users", telegramUserId.toString()), {
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
// REQ 5: AUTOMATIC CHANNEL PUBLISHING (Bot API sendMessage)
// ==========================================
export async function publishPacketToChannels(packetData, customCaption, targetChannelIds = []) {
    if (!targetChannelIds || targetChannelIds.length === 0) {
        notify("❌ Please select at least one channel!", true);
        return { success: false };
    }

    const claimLink = `https://t.me/${BOT_USERNAME}/claim?startapp=${packetData.id}`;
    
    // Catchy Crypto Title & Post Template
    const formattedText = `<b>🔥 EXCLUSIVE CRYPTO RED PACKET DROP 🔥</b>\n\n<b>🎁 TOKEN:</b> ${packetData.tokenName}\n<b>💰 REWARD PER USER:</b> ${packetData.amountPerUser}\n\n${customCaption}`;

    const inlineKeyboard = {
        inline_keyboard: [
            [{ text: "🎁 CLAIM RED PACKET NOW", url: claimLink }]
        ]
    };

    let publishedCount = 0;

    for (const chanId of targetChannelIds) {
        try {
            const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chanId,
                    text: formattedText,
                    parse_mode: 'HTML',
                    reply_markup: inlineKeyboard
                })
            });
            const data = await res.json();
            if (data.ok) publishedCount++;
        } catch (e) {
            console.error(`Failed to post on channel ${chanId}:`, e);
        }
    }

    if (publishedCount > 0) {
        notify(`🚀 Published successfully to ${publishedCount} channel(s)!`);
        return { success: true, count: publishedCount };
    } else {
        notify("❌ Failed to publish post! Please check bot admin permissions.", true);
        return { success: false };
    }
}
