require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { exec, spawn } = require('child_process');
const fs = require('fs');

require('dotenv').config();
const token = process.env.TOKEN;

const bot = new TelegramBot(token, { polling: true });

const urlPattern = /(https?:\/\/[^\s]+)/g;
const userLinks = {};

const CHANNEL_USERNAME = '@everestevolution';
const GROUP_USERNAME = '@everestevolutiongroup';

// Kanal va guruh nomlari
const CHANNEL_NAME = 'EVEREST • EVOLUTION 💻';
const GROUP_NAME = 'Everest Evolution Group 💻';

function getSubscriptionKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '📢 Kanalga obuna bo‘lish', url: 'https://t.me/everestevolution' }
            ],
            [
                { text: '💬 Guruhga qo‘shilish', url: 'https://t.me/everestevolutiongroup' }
            ],
            [
                { text: '✅ Tekshirish', callback_data: 'check_subscription' }
            ]
        ]
    };
}

async function isUserSubscribed(bot, userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        const channelOk = ['member', 'administrator', 'creator'].includes(channelMember.status);
        const groupOk = ['member', 'administrator', 'creator'].includes(groupMember.status);
        return channelOk && groupOk;
    } catch (e) {
        return false;
    }
}

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const subscribed = await isUserSubscribed(bot, userId);
    if (!subscribed) {
        bot.sendMessage(chatId, 'Botdan foydalanish uchun quyidagi kanal va guruhga obuna bo‘ling:', {
            reply_markup: getSubscriptionKeyboard()
        });
        return;
    }
    bot.sendMessage(chatId, 'Xush kelibsiz! Endi botdan foydalanishingiz mumkin. YouTube yoki Instagram link yuboring.');
});

// Obuna tekshiruvi har bir xabarda
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/start')) return; // start komandasi alohida ishlangan
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const subscribed = await isUserSubscribed(bot, userId);
    if (!subscribed) {
        bot.sendMessage(chatId, 'Botdan foydalanish uchun quyidagi kanal va guruhga obuna bo‘ling:', {
            reply_markup: getSubscriptionKeyboard()
        });
        return;
    }
    if (!msg.text) return; // faqat matnli xabarlar uchun
    const messageId = msg.message_id;
    const text = msg.text;

    const match = text.match(urlPattern);

    if (match && match[0]) {
        const url = match[0];
        userLinks[chatId] = url;

        let captionText = '✅ Yuklandi!';
        if (url.includes('instagram.com')) {
            captionText = '✅ Instagramdan yuklandi!';
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            captionText = '✅ Youtubedan yuklandi!';
        }

        bot.sendMessage(chatId, '📥 Yuklab olinmoqda, biroz kuting...').then((loadingMessage) => {
            const loadingMessageId = loadingMessage.message_id;

            // Faqat RAMda saqlash uchun stream ishlatamiz
            const ytdlp = spawn('yt-dlp', ['-o', '-', url]);
            let chunks = [];
            let errorOccured = false;

            ytdlp.stdout.on('data', (data) => {
                chunks.push(data);
            });

            ytdlp.stderr.on('data', (data) => {
                // Agar xatolik bo'lsa, konsolga chiqaramiz
                console.error(`yt-dlp stderr: ${data}`);
            });

            ytdlp.on('error', (err) => {
                errorOccured = true;
                console.error('yt-dlp error:', err);
                bot.sendMessage(chatId, '❌ Yuklab olishda xatolik yuz berdi.');
                bot.deleteMessage(chatId, loadingMessageId).catch(() => {});
            });

            ytdlp.on('close', (code) => {
                if (errorOccured) return;
                if (code !== 0) {
                    bot.sendMessage(chatId, '❌ Yuklab olishda xatolik yuz berdi.');
                    bot.deleteMessage(chatId, loadingMessageId).catch(() => {});
                    return;
                }
                const buffer = Buffer.concat(chunks);
                // Foydalanuvchiga yuboramiz (video sifatida)
                bot.sendVideo(chatId, buffer, {
                    caption: captionText,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🎵 Musiqasini olish', callback_data: 'get_audio' }]
                        ]
                    }
                }).then(() => {
                    bot.deleteMessage(chatId, messageId).catch(() => {});
                    bot.deleteMessage(chatId, loadingMessageId).catch(() => {});
                }).catch((err) => {
                    console.error(err);
                    bot.sendMessage(chatId, '❌ Fayl yuborishda xatolik yuz berdi.');
                    bot.deleteMessage(chatId, loadingMessageId).catch(() => {});
                });
            });
        });

    } else {
        bot.sendMessage(chatId, 'Iltimos, YouTube yoki Instagram link yuboring.');
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data === 'check_subscription') {
        let channelMember, groupMember;
        try {
            channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        } catch (e) {
            channelMember = { status: 'left' };
        }
        try {
            groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        } catch (e) {
            groupMember = { status: 'left' };
        }
        const channelOk = ['member', 'administrator', 'creator'].includes(channelMember.status);
        const groupOk = ['member', 'administrator', 'creator'].includes(groupMember.status);

        if (channelOk && groupOk) {
            bot.sendMessage(chatId, "Bot to'liq ishlashga tayyor");
            return;
        }
        if (!channelOk && !groupOk) {
            bot.sendMessage(chatId, `Siz ${CHANNEL_NAME} kanaliga va ${GROUP_NAME} guruhiga obuna bo‘lmadingiz. Iltimos, ikkala joyga ham obuna bo‘ling!`, {
                reply_markup: getSubscriptionKeyboard()
            });
            return;
        }
        if (!channelOk) {
            bot.sendMessage(chatId, `Siz ${CHANNEL_NAME} kanaliga obuna bo‘lmadingiz.`, {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: '📢 Kanalga obuna bo‘lish', url: 'https://t.me/everestevolution' } ],
                        [ { text: '✅ Tekshirish', callback_data: 'check_subscription' } ]
                    ]
                }
            });
            return;
        }
        if (!groupOk) {
            bot.sendMessage(chatId, `Siz ${GROUP_NAME} guruhiga obuna bo‘lmadingiz.`, {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: '💬 Guruhga qo‘shilish', url: 'https://t.me/everestevolutiongroup' } ],
                        [ { text: '✅ Tekshirish', callback_data: 'check_subscription' } ]
                    ]
                }
            });
            return;
        }
    }

    // Har qanday callback uchun ham obuna tekshiruvi
    const subscribed = await isUserSubscribed(bot, userId);
    if (!subscribed) {
        bot.sendMessage(chatId, 'Botdan foydalanish uchun quyidagi kanal va guruhga obuna bo‘ling:', {
            reply_markup: getSubscriptionKeyboard()
        });
        return;
    }

    if (data === 'get_audio') {
        const url = userLinks[chatId];
        if (!url) {
            bot.sendMessage(chatId, '❌ Audio olish uchun avval video yuboring.');
            return;
        }

        bot.sendMessage(chatId, '🎵 Musiqani yuklab olyapman, biroz kuting...').then((audioLoadingMessage) => {
            const audioLoadingMessageId = audioLoadingMessage.message_id;
            const audioFile = `audio_${Date.now()}.mp3`;

            exec(`yt-dlp -f bestaudio -x --audio-format mp3 -o "${audioFile}" "${url}"`, (audioError) => {
                if (audioError) {
                    console.error(`Audio xatolik: ${audioError.message}`);
                    bot.sendMessage(chatId, '❌ Audio yuklashda xatolik yuz berdi.');
                    bot.deleteMessage(chatId, audioLoadingMessageId).catch(() => {});
                    return;
                }

                // Ba'zi holatlarda `.mp3` fayl aslida boshqa nomda bo'ladi, shuni aniqlaymiz:
                const baseName = audioFile.split(".")[0];
                const found = fs.readdirSync('.').find(f => f.startsWith(baseName) && f.endsWith('.mp3'));

                if (!found) {
                    bot.sendMessage(chatId, '❌ Audio fayl topilmadi.');
                    return;
                }

                bot.sendAudio(chatId, found, {
                    caption: '✅ Audio yuklandi!'
                }).then(() => {
                    fs.unlinkSync(found);
                    bot.deleteMessage(chatId, audioLoadingMessageId).catch(() => {});
                }).catch((err) => {
                    console.error(err);
                    bot.sendMessage(chatId, '❌ Audio yuborishda xatolik yuz berdi.');
                    bot.deleteMessage(chatId, audioLoadingMessageId).catch(() => {});
                });
            });
        });
    }
});
