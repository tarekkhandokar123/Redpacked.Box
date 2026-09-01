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
const BOT_TOKEN = "7963495475:AAHV4L...YOUR_BOT_TOKEN"; // আপনার বটের আসল API Token এখানে দিন
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
 * টোস্ট মেসেজ বা অ্যালার্ট দেখানোর হেল্পার
 */
function notify(msg, isError = false) {
    if (window.UI_Controller && typeof window.UI_Controller.showToast === 'function') {
        window.UI_Controller.showToast(msg);
    } else {
        alert(msg);
    }
}

// ==========================================
// REQ 1 & 3: ইউজারের ভেরিফাইড চ্যানেলের তালিকা দেখা
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
// REQ 2: কঠোর চ্যানেল ভেরিফিকেশন ও সেভ
// (Owner Check + Min 500 Subs + Bot Admin Perms)
// ==========================================
export async function verifyAndSaveChannel(channelUsername, telegramUserId) {
    if (!channelUsername || !telegramUserId) {
        notify("⚠️ চ্যানেল ইউজারনেম অথবা ইউজার আইডি পাওয়া যায়নি!", true);
        return { success: false };
    }

    // ইউজারনেম ফরম্যাট করা
    let formattedChannel = channelUsername.trim();
    if (!formattedChannel.startsWith('@') && !formattedChannel.startsWith('-100')) {
        formattedChannel = `@${formattedChannel}`;
    }

    try {
        notify("🔍 চ্যানেল এবং বটের পারমিশন যাচাই করা হচ্ছে...");

        // A. Telegram API: চ্যানেলের বেসিক তথ্য আনা
        const chatRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${formattedChannel}`);
        const chatData = await chatRes.json();
        if (!chatData.ok) {
            throw new Error("চ্যানেলটি পাওয়া যায়নি! ইউজারনেম সঠিক দিন এবং বটকে চ্যানেলে এড করুন।");
        }

        const chatId = chatData.result.id.toString();
        const chatTitle = chatData.result.title;

        // B. Telegram API: সাবস্ক্রাইবার সংখ্যা চেক (সর্বনিম্ন ৫০০)
        const countRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMemberCount?chat_id=${chatId}`);
        const countData = await countRes.json();
        const subCount = countData.ok ? countData.result : 0;

        if (subCount < 500) {
            throw new Error(`চ্যানেলে সর্বনিম্ন ৫০০ সাবস্ক্রাইবার থাকতে হবে! আপনার আছে: ${subCount}`);
        }

        // C. Telegram API: ইউজার চ্যানেলের Owner/Creator কিনা চেক
        const userMemberRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${telegramUserId}`);
        const userMemberData = await userMemberRes.json();

        if (!userMemberData.ok || userMemberData.result.status !== 'creator') {
            throw new Error("আপনি এই চ্যানেলের মূল ওনার (Owner) নন! শুধুমাত্র ওনার চ্যানেল এড করতে পারবেন।");
        }

        // D. Telegram API: বটের পারমিশন চেক (Admin + Post, Edit, Delete Messages)
        const botMeRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const botMe = await botMeRes.json();

        const botMemberRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${botMe.result.id}`);
        const botMemberData = await botMemberRes.json();

        if (!botMemberData.ok || botMemberData.result.status !== 'administrator') {
            throw new Error(`বট @${BOT_USERNAME} কে চ্যানেলে এডমিন করতে হবে!`);
        }

        const perms = botMemberData.result;
        if (!perms.can_post_messages || !perms.can_edit_messages || !perms.can_delete_messages) {
            throw new Error("বটকে অবশ্যই Post, Edit, এবং Delete Messages এর পারমিশন দিতে হবে!");
        }

        // E. Firebase Firestore-এ চ্যানেল সেভ করা (Multi-Channel Support)
        const cleanDocId = chatId.replace('-', '');
        const newChannelData = {
            id: chatId,
            username: formattedChannel,
            title: chatTitle,
            subscribers: subCount,
            verifiedAt: new Date().toISOString()
        };

        // 1. ইন্ডিভিজুয়াল "channels" কালেকশনে সেভ
        await setDoc(doc(db, "channels", cleanDocId), {
            channelId: chatId,
            channelUsername: formattedChannel,
            channelTitle: chatTitle,
            ownerTelegramId: telegramUserId.toString(),
            subscriberCount: subCount,
            status: "active",
            createdAt: serverTimestamp()
        }, { merge: true });

        // 2. ইউজারের আন্ডারে চ্যানেলের লিস্টে যুক্ত করা (Array Append)
        const userRef = doc(db, "admin_users", telegramUserId.toString());
        await setDoc(userRef, {
            ownerId: telegramUserId.toString(),
            channels: arrayUnion(newChannelData),
            updatedAt: serverTimestamp()
        }, { merge: true });

        notify(`✅ Success! ${chatTitle} চ্যানেল সফলভাবে ভেরিফাই ও এড করা হয়েছে।`);
        return { success: true, channel: newChannelData };

    } catch (error) {
        console.error("Verification error:", error);
        notify(`❌ ${error.message}`, true);
        return { success: false, error: error.message };
    }
}

// ==========================================
// REQ 1: চ্যানেল না থাকলে রেড প্যাকেট ব্লক চেক
// ==========================================
export async function canUserCreatePacket(telegramUserId) {
    const channels = await getUserVerifiedChannels(telegramUserId);
    if (!channels || channels.length === 0) {
        notify("⚠️ রেড প্যাকেট সেট করতে অন্তত একটি চ্যানেল ভেরিফাই করতে হবে!", true);
        return false;
    }
    return true;
}

// ==========================================
// REQ 4: রেড প্যাকেট তৈরি ও ফাইল সেভ
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
        // ইউজারের সর্বশেষ ক্রিয়েট করা রেড প্যাকেট আইডি সেভ করা
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
// REQ 5: অটোমেটিক চ্যানেল পাবলিশিং (Bot API sendMessage)
// ==========================================
export async function publishPacketToChannels(packetData, customCaption, targetChannelIds = []) {
    if (!targetChannelIds || targetChannelIds.length === 0) {
        notify("❌ কমপক্ষে একটি চ্যানেল সিলেক্ট করুন!", true);
        return { success: false };
    }

    const claimLink = `https://t.me/${BOT_USERNAME}/claim?startapp=${packetData.id}`;
    
    // হাইলাইট অংশ (টোকেন নাম ও কত পাবে) + ইউজারের লেখা কাস্টম ক্যাপশন
    const formattedText = `<b>🎁 TOKEN: ${packetData.tokenName}</b>\n<b>💰 REWARD: ${packetData.amountPerUser}</b>\n\n${customCaption}`;

    const inlineKeyboard = {
        inline_keyboard: [
            [{ text: "🎁 CLAIM RED PACKET", url: claimLink }]
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
        notify(`🚀 ${publishedCount} টি চ্যানেলে সফলভাবে পোস্ট করা হয়েছে!`);
        return { success: true, count: publishedCount };
    } else {
        notify("❌ পোস্ট করা সম্ভব হয়নি! বটের পারমিশন চেক করুন।", true);
        return { success: false };
    }
}
