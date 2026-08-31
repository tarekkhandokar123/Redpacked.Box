export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('UsersVerificationBot Webhook Active!');
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;

    if (!BOT_TOKEN) {
        return res.status(500).json({ error: 'BOT_TOKEN Environment Variable is missing!' });
    }

    const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
    const { message } = req.body || {};

    // Helper: Send Message to Telegram
    const sendMessage = async (chatId, text) => {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });
    };

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

    if (message && message.text) {
        const chatId = message.chat.id;
        const userId = message.from.id;
        const text = message.text.trim();

        if (text === '/start') {
            await sendMessage(
                chatId,
                `<b>👋 স্বাগতম!</b>\n\nআপনি যে চ্যানেলটি যুক্ত করতে চান সেটির Username (যেমন: <code>@YourChannel</code>) অথবা Channel ID পাঠাও।\n\n<b>⚠️ শর্তাবলী:</b>\n১. বটটিকে অবশ্যই আপনার চ্যানেলে এডমিন হিসেবে যোগ করতে হবে।\n২. এরপর চ্যানেলের ইউজারনেমটি এখানে লিখে পাঠান।`
            );
        } else if (text.startsWith('@') || text.startsWith('-100')) {
            await sendMessage(chatId, `🔍 <b>ভেরিফাই করা হচ্ছে...</b> অনুগ্রহ করে অপেক্ষা করুন।`);

            const memberResult = await checkAdminStatus(text, userId);

            if (memberResult.ok) {
                const status = memberResult.result.status;

                if (status === 'creator' || status === 'administrator') {
                    await sendMessage(
                        chatId,
                        `✅ <b>ভেরিফিকেশন সফল হয়েছে!</b>\n\nআপনি <code>${text}</code> চ্যানেলের একজন বৈধ এডমিন/মালিক। চ্যানেলটি সফলভাবে ডাটাবেজে যুক্ত করা যেতে পারে।`
                    );
                } else {
                    await sendMessage(
                        chatId,
                        `❌ <b>ভেরিফিকেশন ব্যর্থ হয়েছে!</b>\n\nআপনি <code>${text}</code> চ্যানেলের সদস্য, কিন্তু এডমিন বা মালিক নন।`
                    );
                }
            } else {
                await sendMessage(
                    chatId,
                    `⚠️ <b>ত্রুটি!</b>\n\nচ্যানেলটি ভেরিফাই করা সম্ভব হয়নি।\n\n<b>কারণসমূহ:</b>\n১. বটটিকে চ্যানেলে <b>Admin</b> হিসেবে যুক্ত করা হয়নি।\n২. চ্যানেল ইউজারনেম ভুল লিখেছেন।\n\nবটকে চ্যানেলে এডমিন বানিয়ে আবার চেষ্টা করুন।`
                );
            }
        } else {
            await sendMessage(
                chatId,
                `বিবরণ বুঝতে পারিনি। চ্যানেল ভেরিফাই করতে চ্যানেলের ইউজারনেম পাঠাও (যেমন: <code>@ChannelName</code>)।`
            );
        }
    }

    return res.status(200).json({ status: 'success' });
}
