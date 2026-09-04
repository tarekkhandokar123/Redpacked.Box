export default async function handler(req, res) {
    // ====================================================================
    // 0. CORS HEADERS (Fixes "Failed to fetch" browser block)
    // ====================================================================
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Preflight OPTIONS Request Handle
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(200).send('🚀 Red Packet Box API & Webhook Active!');
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;

    if (!BOT_TOKEN) {
        return res.status(500).json({ ok: false, message: 'BOT_TOKEN Environment Variable is missing in Vercel!' });
    }

    const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

    // Helper: Telegram API Fetcher
    const callTelegram = async (method, bodyData) => {
        try {
            const response = await fetch(`${TELEGRAM_API}/${method}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            return await response.json();
        } catch (error) {
            return { ok: false, description: error.message };
        }
    };

    // Helper: Normalize Channel Link/Username to Telegram format (@channel or Chat ID)
    const normalizeChannelInput = (input) => {
        if (!input) return null;
        let cleaned = String(input).trim();
        
        if (cleaned.includes('t.me/')) {
            const parts = cleaned.split('t.me/');
            cleaned = parts[1].split('/')[0].split('?')[0];
        }
        
        cleaned = cleaned.replace(/^@/, '');
        
        if (/^-?\d+$/.test(cleaned)) {
            return cleaned;
        }
        
        return `@${cleaned}`;
    };

    // Parse Request Body Safely
    let body = req.body || {};
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            body = {};
        }
    }

    // ====================================================================
    // ১. CHANNEL VERIFICATION ROUTE (action: 'verify')
    // ====================================================================
    if (body.action === 'verify' || (body.channelInput && body.userId)) {
        const rawInput = body.channelInput || body.channelLink || body.channelUsername || body.channelId;
        const userId = body.userId;

        if (!rawInput || !userId) {
            return res.status(400).json({ ok: false, message: 'Missing channel input or userId' });
        }

        const formattedTarget = normalizeChannelInput(rawInput);

        // A. Telegram API: Fetch Chat Info
        const chatInfo = await callTelegram('getChat', { chat_id: formattedTarget });

        if (!chatInfo.ok) {
            return res.status(200).json({
                ok: false,
                isVerified: false,
                message: `⚠️ Channel not found! Make sure the bot @REDPACKETBOXBOT is added as an Admin in your channel.`
            });
        }

        const chatData = chatInfo.result;
        const actualChatId = chatData.id;
        const actualChannelTitle = chatData.title || 'Telegram Channel';
        const actualChannelUsername = chatData.username ? `@${chatData.username}` : formattedTarget;

        // B. Telegram API: Check Subscriber Count (Minimum 500)
        const countInfo = await callTelegram('getChatMemberCount', { chat_id: actualChatId });
        const subscriberCount = countInfo.ok ? countInfo.result : 0;

        const MIN_SUBSCRIBERS = 500;
        if (subscriberCount < MIN_SUBSCRIBERS) {
            return res.status(200).json({
                ok: false,
                isVerified: false,
                subscriberCount: subscriberCount,
                message: `❌ Minimum ${MIN_SUBSCRIBERS} subscribers required! Current subscribers: ${subscriberCount}`
            });
        }

        // C. Telegram API: Verify User Role in Channel (Creator / Administrator)
        const userMember = await callTelegram('getChatMember', {
            chat_id: actualChatId,
            user_id: userId
        });

        if (!userMember.ok) {
            return res.status(200).json({
                ok: false,
                isVerified: false,
                message: `⚠️ Could not verify your Admin status in "${actualChannelTitle}". Make sure the bot is an Admin!`
            });
        }

        const userStatus = userMember.result.status;
        if (userStatus !== 'creator' && userStatus !== 'administrator') {
            return res.status(200).json({
                ok: false,
                isVerified: false,
                message: `❌ You must be an Owner or Admin of "${actualChannelTitle}" to add it!`
            });
        }

        // D. Telegram API: Check Bot Status & Admin Permissions
        const botMe = await callTelegram('getMe', {});
        if (botMe.ok) {
            const botMember = await callTelegram('getChatMember', {
                chat_id: actualChatId,
                user_id: botMe.result.id
            });

            if (!botMember.ok || botMember.result.status !== 'administrator') {
                return res.status(200).json({
                    ok: false,
                    isVerified: false,
                    message: `⚠️ Bot must be added as an Administrator in "${actualChannelTitle}"!`
                });
            }

            if (botMember.result.can_post_messages === false) {
                return res.status(200).json({
                    ok: false,
                    isVerified: false,
                    message: `⚠️ Bot needs "Post Messages" permission in "${actualChannelTitle}"!`
                });
            }
        }

        return res.status(200).json({
            ok: true,
            isVerified: true,
            role: userStatus,
            channelId: actualChatId.toString(),
            channelTitle: actualChannelTitle,
            channelUsername: actualChannelUsername,
            subscriberCount: subscriberCount,
            message: `✅ Channel "${actualChannelTitle}" verified successfully!`
        });
    }

    // ====================================================================
    // ২. CHANNEL PUBLISHING ROUTE (action: 'publish')
    // ====================================================================
    if (body.action === 'publish') {
        const { channelIds, message: msgText, claimUrl, buttonText, photo, imageUrl } = body;

        if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
            return res.status(400).json({ ok: false, message: 'No target channels selected for publishing!' });
        }

        // ফ্রন্টএন্ড থেকে আসা বাটন টেক্সট অথবা ডিফল্ট টেক্সট
        const btnLabel = buttonText || "🎁 CLAIM RED PACKET NOW";

        // পিকচার URL (ফ্রন্টএন্ড থেকে না আসলে ডিফল্ট লিঙ্ক)
        const photoUrl = photo || imageUrl || "https://t.me/dogscoin_channel/360";

        const inlineKeyboard = claimUrl ? {
            inline_keyboard: [
                [{ text: btnLabel, url: claimUrl }]
            ]
        } : undefined;

        let successCount = 0;
        const errorDetails = [];

        for (const chanId of channelIds) {
            // ১. ছবি সহ পোস্ট করার জন্য sendPhoto ব্যবহার করা হচ্ছে
            let sendRes = await callTelegram('sendPhoto', {
                chat_id: chanId,
                photo: photoUrl,
                caption: msgText,
                parse_mode: 'HTML',
                reply_markup: inlineKeyboard
            });

            // ২. যদি কোনো কারণে sendPhoto ফেল করে, তবে sendMessage fallback হিসেবে কাজ করবে
            if (!sendRes.ok) {
                sendRes = await callTelegram('sendMessage', {
                    chat_id: chanId,
                    text: msgText,
                    parse_mode: 'HTML',
                    disable_web_page_preview: false, // প্রিভিউ এনাবল রাখা হয়েছে
                    reply_markup: inlineKeyboard
                });
            }

            if (sendRes.ok) {
                successCount++;
            } else {
                errorDetails.push(sendRes.description || `Failed on ${chanId}`);
            }
        }

        if (successCount > 0) {
            return res.status(200).json({
                ok: true,
                successCount: successCount,
                message: `🚀 Successfully posted Red Packet to ${successCount} channel(s)!`
            });
        } else {
            return res.status(200).json({
                ok: false,
                successCount: 0,
                message: `❌ Failed to publish post. Reason: ${errorDetails.join(', ')}`
            });
        }
    }

    // ====================================================================
    // ৩. TELEGRAM BOT WEBHOOK UPDATES (Bot Inbox Commands)
    // ====================================================================
    const { message } = body;

    if (message) {
        if (message.chat && message.chat.type !== 'private') {
            return res.status(200).json({ status: 'ignored_group_message' });
        }

        if (message.text && message.text.startsWith('/start')) {
            await callTelegram('sendMessage', {
                chat_id: message.chat.id,
                text: `👋 <b>Welcome to Red Packet Box Bot!</b>\n\n` +
                      `This bot works automatically with our <b>Partner Panel Mini App</b>.\n\n` +
                      `📌 <b>How to Use:</b>\n` +
                      `1️⃣ Add this bot as an <b>Admin</b> in your channel.\n` +
                      `2️⃣ Open our <b>Partner Panel Web App</b>.\n` +
                      `3️⃣ Enter your channel username to verify and publish Red Packets!`,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
        }
    }

    return res.status(200).json({ status: 'success' });
    }
