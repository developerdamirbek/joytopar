require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.use(session());

const categories = [
    { name: '🍽️ Restoranlar', type: 'restaurant' },
    { name: '⛽ Gaz stansiyalari', type: 'gas_station' },
    { name: '🛒 Do‘konlar', type: 'grocery_or_supermarket' },
    { name: '🏥 Kasalxonalar/Poliklinikalar', type: 'hospital' },
    { name: '🛍️ Savdo markazlari', type: 'shopping_mall' },
    { name: '🏨 Yotoqxona', type: 'lodging' },
    { name: '🌳 Parks', type: 'park' },
    { name: '🏋️‍♂️ Sport zallari', type: 'gym' },
];

bot.start((ctx) => {
    ctx.session = ctx.session || {};
    
    ctx.reply('Xush kelibsiz! Iltimos, yaqin atrofdagi joylarni topish uchun toifani tanlang.', {
        reply_markup: {
            inline_keyboard: categories.map((category) => [
                {
                    text: category.name,
                    callback_data: category.type,
                },
            ]),
        },
    });
});

bot.on('callback_query', (ctx) => {
    const selectedCategory = ctx.callbackQuery.data;
    const categoryName = categories.find(cat => cat.type === selectedCategory).name;

    ctx.reply(`Siz ${categoryName} turini tanlading. Iltimos, ${categoryName}lar yaqinida topish uchun joylashuvingizni yuboring.`, {
        reply_markup: {
            keyboard: [
                [{ text: '📍 Joylashuvni yuborish', request_location: true }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        },
    });

    ctx.session = ctx.session || {};
    ctx.session.selectedCategory = selectedCategory;
    ctx.answerCbQuery();

    ctx.deleteMessage(ctx.callbackQuery.message.message_id);
});

bot.on('location', async (ctx) => {
    const { latitude, longitude } = ctx.message.location;
    const selectedCategory = ctx.session.selectedCategory;

    const categoryName2 = categories.find(cat => cat.type === selectedCategory).name;

    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json`,
            {
                params: {
                    location: `${latitude},${longitude}`,
                    radius: 2000,
                    type: selectedCategory,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            }
        );

        const places = response.data.results;

        if (places.length > 0) {
            let replyMessage = `Yaqin atrofdagi ${categoryName2}lar:\n\n`;
            const limitedPlaces = places.slice(0, 10);

            limitedPlaces.forEach((place, index) => {
                const mapsLink = `https://www.google.com/maps/search/?api=1&query=${place.geometry.location.lat},${place.geometry.location.lng}`;
                replyMessage += `${index + 1}. *${place.name}*\n`; 
                replyMessage += `📍 **Manzil:** [${place.vicinity}](${mapsLink})\n`;

                if (place.rating) replyMessage += `⭐ **Reyting:** ${place.rating}\n`;

                if (place.opening_hours) {
                    const openingHours = place.opening_hours.weekday_text;
                    if (openingHours && openingHours.length > 0) {
                        replyMessage += `🕒 **Ochilish vaqti:** ${openingHours.join('\n')}\n`; // Opening hours for the week
                    } else {
                        const periods = place.opening_hours.periods;
                        if (periods && periods.length > 0) {
                            replyMessage += `🕒 **Ochilish vaqti:**\n`;
                            periods.forEach(period => {
                                const openDay = period.open.day;
                                const closeDay = period.close.day;
                                const openTime = period.open.time;
                                const closeTime = period.close.time;
                                
                                const formattedOpenTime = `${openTime.slice(0, 2)}:${openTime.slice(2)} AM`;
                                const formattedCloseTime = `${closeTime.slice(0, 2)}:${closeTime.slice(2)} PM`;
                                
                                replyMessage += `Day ${openDay + 1}: ${formattedOpenTime} – ${formattedCloseTime}\n`;
                            });
                        } else {
                            replyMessage += `🕒 **Ish vaqti:** Ma'lumot yo'q\n`;
                        }
                    }
                } else {
                    replyMessage += `🕒 **Ish vaqti:** Ma'lumot yo'q\n`;
                }

                replyMessage += `\n`;
            });
            await ctx.replyWithMarkdown(replyMessage);
        } else {
            await ctx.reply(`${selectedCategory}lar yaqin atrofda topilmadi. 🤷‍♂️`);
        }

        ctx.reply('Kategoriyalar:', {
            reply_markup: {
                keyboard: [[{ text: 'Kategoriyalar' }]],
                resize_keyboard: true,
                one_time_keyboard: true,
            },
        });

    } catch (error) {
        console.error('Error fetching places:', error);
        await ctx.reply('An error occurred while searching for places.');
    }
});




bot.hears('Kategoriyalar', (ctx) => {
    ctx.reply('Iltimos, yaqin atrofdagi joylarni topish uchun toifani tanlang.', {
        reply_markup: {
            inline_keyboard: categories.map((category) => [
                {
                    text: category.name,
                    callback_data: category.type,
                },
            ]),
        },
    });
});

bot.launch().then(() => {
    console.log('Bot is up and running');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
