const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const fs = require('fs');

const token = '8065462921:AAEZDYvlP85SAy5e4hXqQBOULmP87nLNLdI';

const bot = new TelegramBot(token, { polling: true });

const urlPattern = /(https?:\/\/[^\s]+)/g;

// Har bir chat uchun oxirgi linkni saqlash
const userLinks = {};

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const text = msg.text;

    const match = text.match(urlPattern);

    if (match && match[0]) {
        const url = match[0];
        userLinks[chatId] = url; // Linkni saqlaymiz

        let captionText = '✅ Video yuklandi!';
        if (url.includes('instagram.com')) {
            captionText = '✅ Video Instagramdan yuklandi!';
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            captionText = '✅ Video Youtubedan yuklandi!';
        }

        bot.sendMessage(chatId, '📥 Videoni yuklab olyapman, biroz kuting...').then((loadingMessage) => {
            const loadingMessageId = loadingMessage.message_id;

            const videoFile = `video_${Date.now()}.mp4`;

            exec(`yt-dlp.exe -o "${videoFile}" "${url}"`, (videoError, videoStdout, videoStderr) => {
                if (videoError) {
                    console.error(`Video xatolik: ${videoError.message}`);
                    bot.sendMessage(chatId, '❌ Video yuklashda xatolik yuz berdi.');
                    bot.deleteMessage(chatId, loadingMessageId).catch(() => {});
                    return;
                }

                // Inline button yaratamiz
                const options = {
                    caption: captionText,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🎵 Musiqasini olish', callback_data: 'get_audio' }]
                        ]
                    }
                };

                bot.sendVideo(chatId, videoFile, options).then(() => {
                    fs.unlinkSync(videoFile);

                    bot.deleteMessage(chatId, messageId).catch(() => {});
                    bot.deleteMessage(chatId, loadingMessageId).catch(() => {});
                }).catch((err) => {
                    console.error(err);
                    bot.sendMessage(chatId, '❌ Video yuborishda xatolik yuz berdi.');
                    bot.deleteMessage(chatId, loadingMessageId).catch(() => {});
                });
            });
        });
    } else {
        bot.sendMessage(chatId, 'Iltimos, YouTube yoki Instagram link yuboring.');
    }
});

bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    if (data === 'get_audio') {
        const url = userLinks[chatId];
        if (!url) {
            bot.sendMessage(chatId, '❌ Audio olish uchun avval video yuboring.');
            return;
        }

        bot.sendMessage(chatId, '🎵 Musiqani yuklab olyapman, biroz kuting...').then((audioLoadingMessage) => {
            const audioLoadingMessageId = audioLoadingMessage.message_id;

            const audioFile = `audio_${Date.now()}.mp3`;

            exec(`yt-dlp.exe -f bestaudio -x --audio-format mp3 -o "${audioFile}" "${url}"`, (audioError, audioStdout, audioStderr) => {
                if (audioError) {
                    console.error(`Audio xatolik: ${audioError.message}`);
                    bot.sendMessage(chatId, '❌ Audio yuklashda xatolik yuz berdi.');
                    bot.deleteMessage(chatId, audioLoadingMessageId).catch(() => {});
                    return;
                }

                bot.sendAudio(chatId, audioFile, {
                    caption: '✅ Audio yuklandi!'
                }).then(() => {
                    fs.unlinkSync(audioFile);
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
