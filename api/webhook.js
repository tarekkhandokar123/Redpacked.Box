export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('🚀 Users Verification API & Webhook Active!');
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;

    if (!BOT_TOKEN) {
        return res.status(500).json({ error: 'BOT_TOKEN Environment Variable is missing!' });
    }

    const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

    // Helper: Check if User is Admin/Owner in Channel
    const checkAdminStatus = async (channelId, userId) => {
        try {
            const response = await fetch(`${TELEGRAM_API}/getChatMember`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: channelId,
                    user_id: userId
                })
            });
            return await response.json();
        } catch (error) {
            return { ok: false, description: error.message };
        }
    };

    // Helper: Send Message to Telegram User
    const sendMessage = async (chatId, text) => {
        try {
            await fetch(`${TELEGRAM_API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                })
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const body = req.body || {};

    // ====================================================================
    // ১. পার্টনার প্যানেল / ওয়েব অ্যাপ (Web App) থেকে সরাসরি ভেরিফিকেশন API
    // ====================================================================
    if (body.action === 'verify' || (body.channelId && body.userId)) {
        const { channelId, userId } = body;

        if (!channelId || !userId) {
            return res.status(400).json({ ok: false, message: 'Missing channelId or userId' });
        }

        const memberResult = await checkAdminStatus(channelId, userId);

        if (memberResult.ok) {
            const status = memberResult.result.status;

            if (status === 'creator' || status === 'administrator') {
                return res.status(200).json({
                    ok: true,
                    isVerified: true,
                    role: status,
                    message: `✅ Channel ${channelId} verified successfully!`
                });
            } else {
                return res.status(200).json({
                    ok: false,
                    isVerified: false,
                    message: `❌ You are not an Admin/Owner of ${channelId}`
                });
            }
        } else {
            return res.status(200).json({
                ok: false,
                isVerified: false,
                message: `⚠️ Bot is not added as Admin in ${channelId} or Channel ID is invalid.`
            });
        }
    }

    // ====================================================================
    // ২. TELEGRAM BOT WEBHOOK UPDATES (শুধু প্রাইভেট ইনবক্সের জন্য)
    // ====================================================================
    const { message } = body;

    if (message) {
        // 🛑 গুরুত্বপূর্ণ: গ্রুপ, সুপারগ্রুপ বা চ্যানেলের সব মেসেজ ইগনোর করবে!
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
                `3️⃣ Submit your Channel Username & click <b>Verify</b>!`
            );
        }
    }

    return res.status(200).json({ status: 'success' });
}
