import { parseBonusPage } from './parser'
import { processRequest } from './telegram'

const server = Bun.serve({
  port: process.env.PORT || 3000,
  async fetch(request) {
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
  }
})

console.log(`Listening on localhost:${server.port}`);

parseBonusPage()