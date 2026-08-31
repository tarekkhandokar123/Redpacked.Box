export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('🚀 Users Verification Bot Webhook is Active!');
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;

    if (!BOT_TOKEN) {
        return res.status(500).json({ error: 'BOT_TOKEN Environment Variable is missing!' });
    }

    const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
    const { message } = req.body || {};

    // Helper: Send Message to Telegram
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
                `👋 <b>Welcome to Channel Verification Bot!</b>\n\n` +
                `Easily verify your channel ownership to integrate with our platform.\n\n` +
                `📌 <b>How to Verify:</b>\n` +
                `1️⃣ Add this bot as an <b>Admin</b> in your channel.\n` +
                `2️⃣ Send your Channel Username (e.g., <code>@YourChannel</code>) or Channel ID here.\n\n` +
                `👇 <i>Send your channel username below to begin!</i>`
            );
        } else if (text.startsWith('@') || text.startsWith('-100')) {
            await sendMessage(chatId, `🔍 <b>Verifying channel authority...</b> Please wait a moment.`);

            const memberResult = await checkAdminStatus(text, userId);

            if (memberResult.ok) {
                const status = memberResult.result.status;

                if (status === 'creator' || status === 'administrator') {
                    await sendMessage(
                        chatId,
                        `🎉 <b>Verification Successful!</b>\n\n` +
                        `✅ You are a verified <b>${status.toUpperCase()}</b> of <code>${text}</code>.\n` +
                        ` Your channel is now authorized and ready for integration!`
                    );
                } else {
                    await sendMessage(
                        chatId,
                        `❌ <b>Verification Failed!</b>\n\n` +
                        `You are a member of <code>${text}</code>, but you do not have <b>Admin</b> or <b>Owner</b> privileges.`
                    );
                }
            } else {
                await sendMessage(
                    chatId,
                    `⚠️ <b>Verification Error!</b>\n\n` +
                    `Could not verify channel <code>${text}</code>.\n\n` +
                    `<b>Common Reasons:</b>\n` +
                    `• Bot is not added as an <b>Admin</b> in the channel.\n` +
                    `• Incorrect channel username/ID.\n\n` +
                    `👉 <i>Promote the bot to Admin and try again!</i>`
                );
            }
        } else {
            await sendMessage(
                chatId,
                `❓ <b>Invalid Format!</b>\n\n` +
                `Please send a valid channel username starting with <b>@</b> (e.g., <code>@ChannelName</code>) or Channel ID.`
            );
        }
    }

    return res.status(200).json({ status: 'success' });
}
