import fs from 'fs/promises'
import _ from 'lodash'
import { sendMessage } from './telegram'

const batchSize = 3
const interval = 100

export async function notifyBotSubscribers(text: string) {
  let subscribers = (await fs.readFile(__dirname + '/subscribers.txt', 'utf-8')).split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => Number(s))
    .filter(s => Number.isSafeInteger(s))

  subscribers = Array.from(new Set(subscribers))

  let sent = 0, blocked = 0, errors = 0
  const batches = _.chunk(subscribers, batchSize)
  for(const batch of batches) {
    await Promise.all(
      batch.map(async userId => {
        try {
          const result = await sendMessage(userId, text)
          if (result.error) {
            throw new Error(result.error)
          } else {
            sent++
          }
        } catch (e) {
          const BOT_WAS_BLOCKED = 'bot was blocked by the user'
          const USER_IS_DEAD = 'user is deactivated'
          if (e instanceof Error) {
            if(e.message.includes(BOT_WAS_BLOCKED)) {
              blocked++
            } else if (e?.message !== USER_IS_DEAD) {
              console.error('Ошибка во время рассылки: userID=' + userId + ', error:', e?.message)
              errors
            }
          }
        }
      })
    )
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  console.log('Рассылка завершена. Разослано сообщений:', sent, 'Остановлено:', blocked, 'Ошибок всего:', errors)
}