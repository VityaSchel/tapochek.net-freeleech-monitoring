import fs from 'fs/promises'
import { z } from 'zod'
import { parseBonusPage } from './parser'
import { processRequest } from './telegram'

const server = Bun.serve({
  port: process.env.PORT || 3000,
  async fetch(request) {
    console.log(request.url)
    if(request.url.endsWith('/webhook')) {
      if (request.headers.get('x-telegram-bot-api-secret-token') !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response('{"ok":false}', {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      processRequest(await request.text())
      return new Response('{"ok":true}', {
        headers: { 'Content-Type': 'application/json' }
      })
    } else if(request.url.endsWith('/push-subscription')) {
      if(request.method === 'POST') {
        const body = await z.object({
          endpoint: z.string().url(),
          keys: z.object({
            p256dh: z.string().min(1),
            auth: z.string().min(1),
          }),
        }).safeParseAsync(await request.json())
        if (!body.success) {
          return new Response(null, { status: 400 })
        }
        let subscribersSerialized: string
        try {
          subscribersSerialized = await fs.readFile(__dirname + '/push-subscribers.json', 'utf-8')
        } catch(e) {
          subscribersSerialized = '[]'
        }
        if(subscribersSerialized.trim() === '') {
          subscribersSerialized = '[]'
        }
        const subscribers = JSON.parse(subscribersSerialized)
        subscribers.push({
          endpoint: body.data.endpoint,
          keys: {
            p256dh: body.data.keys.p256dh,
            auth: body.data.keys.auth
          }
        })
        await fs.writeFile(__dirname + '/push-subscribers.json', JSON.stringify(subscribers))
      } else if(request.method === 'DELETE') {
        const url = new URL(request.url)
        const endpoint = await z.string().url().safeParseAsync(url.searchParams.get('endpoint'))
        if (endpoint.success) {
          let subscribersSerialized: string
          try {
            subscribersSerialized = await fs.readFile(__dirname + '/push-subscribers.json', 'utf-8')
          } catch(e) {
            subscribersSerialized = '[]'
          }
          if (subscribersSerialized.trim() === '') {
            subscribersSerialized = '[]'
          }
          let subscribers = JSON.parse(subscribersSerialized)
          subscribers = subscribers.filter((s: any) => s.endpoint !== endpoint.data)
          await fs.writeFile(__dirname + '/push-subscribers.json', JSON.stringify(subscribers))
          return new Response(null, { status: 200 })
        } else {
          return new Response(null, { status: 400 })
        }
      } else {
        return new Response(null, { status: 405 })
      }
      return new Response(null, { status: 200 })
    } else {
      return new Response(null, { status: 404 })
    }
  }
})

console.log(`Listening on localhost:${server.port}`);

parseBonusPage()