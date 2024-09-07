import fs from 'fs/promises'

export async function sendMessage(chatId: number | string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_API_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  })
  if (res.status !== 200) {
    const response = await res.text()
    let error: any
    try {
      error = JSON.parse(response).description
    } catch {
      error = response
    }
    console.error('Failed to send freeleech message', res.status, )
    return { ok: false, error: error }
  }
  return { ok: true }
}

export async function processRequest(body: string) {
  try {
    const update = JSON.parse(body)
    if ('message' in update && 'chat' in update.message && 'type' in update.message.chat && update.message.chat.type === 'private' && 'id' in update.message.chat) {
      await fs.appendFile(__dirname + '/subscribers.txt', update.message.chat.id + '\n')
      await fs.appendFile(__dirname + '/subscribers.log', JSON.stringify({ username: update.message.chat.username, id: update.message.chat.id, first_name: update.message.chat.first_name, last_name: update.message.chat.last_name }) + '\n')
      let language = 'from' in update.message && 'language_code' in update.message.from ? update.message.from.language_code : 'en'
      if (language !== 'ru' && language !== 'en') {
        language = 'en'
      }
      const messages = {
        en: 'You have successfully subscribed to tapochek.net freeleech notifications. You will receive alert in this bot when freeleech is started.\n\nYou can also subscribe to push notifications on the website: https://tapochek.utidteam.com\n\nWe also post progress of freeleech by which you can guess when it will start there: @tapochekfreeleech',
        ru: 'Ты успешно подписался на уведомления о фриличах на tapochek.net и получишь уведомление в этом боте, когда начнется фрилич.\n\nТакже можешь подписаться на push-уведомления на сайте: https://tapochek.utidteam.com\n\nМы также публикуем прогресс фрилича, по которому можно примерно понять, через сколько он начнется, тут: @tapochekfreeleech'
      }
      await sendMessage(update.message.chat.id, messages[language as 'en' | 'ru'])
    }
  } catch (e) {
    console.error('Couldn\'t process telegram update', e)
  }
}