import fs from 'fs/promises'
import _ from 'lodash'
import { sendMessage } from './telegram'
import webPush from 'web-push'

const batchSize = 3
const interval = 100

export async function notifyBotSubscribers(text: string) {
  let subscribers = (await fs.readFile(__dirname + '/telegram-subscribers.txt', 'utf-8')).split('\n')
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

  console.log('Рассылка сообщений завершена. Разослано сообщений:', sent, 'Остановлено:', blocked, 'Ошибок всего:', errors)
}

const webPushEmail = process.env.WEB_PUSH_EMAIL
if (!webPushEmail) {
  throw new Error('WEB_PUSH_EMAIL is not set')
}
const webPushPublicKey = process.env.WEB_PUSH_PUBLIC_KEY
if (!webPushPublicKey) {
  throw new Error('NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY is not set')
}
const webPushPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY
if (!webPushPrivateKey) {
  throw new Error('WEB_PUSH_PRIVATE_KEY is not set')
}

webPush.setVapidDetails(
  `mailto:${webPushEmail}`,
  webPushPublicKey,
  webPushPrivateKey
)

export type PushNewPostPayload = {
  title: string
  message: string
  image?: string
  url: string
}

export async function notifyPushSubscribers({ title, text, url }: {
  title: string
  text: string
  url: string
}) {
  let subscriptionsSerialized: string
  try {
    subscriptionsSerialized = await fs.readFile(__dirname + '/push-subscribers.json', 'utf-8')
  } catch (e) {
    subscriptionsSerialized = '[]'
  }
  const subscriptions = JSON.parse(subscriptionsSerialized)
  let errors = 0, sent = 0
  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification(
        { endpoint: subscription.endpoint, keys: { auth: subscription.keys.auth, p256dh: subscription.keys.p256dh } },
        JSON.stringify({
          title: title,
          message: text,
          // image: ,
          url: url
        } satisfies PushNewPostPayload)
      )
      sent++
    } catch (e) {
      errors++
    }
  }
  console.log(`Рассылка пушей завершена. Разослано уведомлений: ${sent} Ошибок: ${errors}`)
}