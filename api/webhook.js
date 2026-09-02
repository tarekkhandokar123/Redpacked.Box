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
        return res.status(200).send('🚀 Users Verification API & Webhook Active!');
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;

    if (!BOT_TOKEN) {
        return res.status(500).json({ error: 'BOT_TOKEN Environment Variable is missing!' });
    }

    const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

    // Helper: Normalize Link/Username/ID into Telegram Username format (@channel)
    const normalizeChannelInput = (input) => {
        if (!input) return null;
        let cleaned = input.trim();
        
        // Extract username from URL links (e.g. https://t.me/YourChannel or t.me/YourChannel)
        if (cleaned.includes('t.me/')) {
            const parts = cleaned.split('t.me/');
            cleaned = parts[1].split('/')[0].split('?')[0];
        }
        
        // Remove leading @ for clean processing
        cleaned = cleaned.replace(/^@/, '');
        
        // If numeric ID (e.g. -100123456789)
        if (/^-?\d+$/.test(cleaned)) {
            return cleaned;
        }
        
        return `@${cleaned}`;
    };

    // Helper: General Telegram API Fetcher
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

    // Helper: Send Message to Telegram User
    const sendMessage = async (chatId, text) => {
        try {
            await callTelegram('sendMessage', {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    let body = req.body || {};
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            body = {};
        }
    }

    // ====================================================================
    // ১. পার্টনার প্যানেল / ওয়েব অ্যাপ (Web App) থেকে সরাসরি ভেরিফিকেশন API
    // ====================================================================
    if (body.action === 'verify' || body.channelId || body.channelInput || body.channelLink || body.channelUsername) {
        const rawInput = body.channelInput || body.channelLink || body.channelUsername || body.channelId;
        const userId = body.userId;
        const customChannelName = body.channelName || '';

        if (!rawInput || !userId) {
            return res.status(400).json({ ok: false, message: 'Missing channel identifier or userId' });
        }

        const formattedChannelId = normalizeChannelInput(rawInput);

        // ১. Telegram API থেকে চ্যানেলের তথ্য আনা (Title, Username, Chat ID)
        const chatInfo = await callTelegram('getChat', { chat_id: formattedChannelId });

        if (!chatInfo.ok) {
            return res.status(200).json({
                ok: false,
                isVerified: false,
                message: `⚠️ Bot is not added as Admin in channel or Channel username/link is invalid (${formattedChannelId}).`
            });
        }

        const chatData = chatInfo.result;
        const actualChannelTitle = chatData.title || customChannelName || 'Telegram Channel';
        const actualChannelUsername = chatData.username ? `@${chatData.username}` : formattedChannelId;
        const actualChatId = chatData.id;

        // ২. চ্যানেলের সাবস্ক্রাইবার সংখ্যা চেক
        const countInfo = await callTelegram('getChatMemberCount', { chat_id: actualChatId });
        const subscriberCount = countInfo.ok ? countInfo.result : 0;

        const MIN_SUBSCRIBERS = 500;
        if (subscriberCount < MIN_SUBSCRIBERS) {
            return res.status(200).json({
                ok: false,
                isVerified: false,
                subscriberCount: subscriberCount,
                message: `❌ Minimum ${MIN_SUBSCRIBERS} subscribers required. Current: ${subscriberCount}`
            });
        }

        // ৩. ইউজার ওই চ্যানেলের Admin বা Owner কিনা তা যাচাই
        const memberResult = await callTelegram('getChatMember', {
            chat_id: actualChatId,
            user_id: userId
        });

        if (memberResult.ok) {
            const status = memberResult.result.status;

            if (status === 'creator' || status === 'administrator') {
                return res.status(200).json({
                    ok: true,
                    isVerified: true,
                    role: status,
                    channelId: actualChatId,
                    channelTitle: actualChannelTitle,
                    channelName: actualChannelTitle,
                    channelUsername: actualChannelUsername,
                    subscriberCount: subscriberCount,
                    message: `✅ Channel "${actualChannelTitle}" verified successfully!`
                });
            } else {
                return res.status(200).json({
                    ok: false,
                    isVerified: false,
                    message: `❌ You are not an Owner/Admin of "${actualChannelTitle}"`
                });
            }
        } else {
            return res.status(200).json({
                ok: false,
                isVerified: false,
                message: `⚠️ Could not verify Admin status for ${actualChannelTitle}.`
            });
        }
    }

    // ====================================================================
    // ২. TELEGRAM BOT WEBHOOK UPDATES (শুধুমাত্র প্রাইভেট ইনবক্সের জন্য)
    // ====================================================================
    const { message } = body;

    if (message) {
        // 🛑 গ্রুপ, সুপারগ্রুপ বা চ্যানেলের মেসেজ ইগনোর করবে
        if (message.chat && message.chat.type !== 'private') {
            return res.status(200).json({ status: 'ignored_group_message' });
        }

        // ইনবক্সে শুধুমাত্র /start কমান্ড দিলে মেসেজ পাঠাবে
        if (message.text === '/start') {
            await sendMessage(
                message.chat.id,
                `👋 <b>Welcome to Channel Verification Bot!</b>\n\n` +
                `This bot works automatically with our <b>Partner Panel Mini App</b>.\n\n` +
                `📌 <b>How to Use:</b>\n` +
                `1️⃣ Add this bot as an <b>Admin</b> in your channel.\n` +
                `2️⃣ Open our <b>Partner Panel App</b>.\n` +
                `3️⃣ Submit your Channel Link or Username & click <b>Verify & Add Channel</b>!`
            );
        }
    }

    return res.status(200).json({ status: 'success' });
}
