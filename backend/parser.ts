import fs from 'fs/promises'
import _ from 'lodash'
import cookie from 'cookie'
import iconv from 'iconv-lite'
import * as cheerio from 'cheerio'
import { notifyBotSubscribers } from './notification'
import { sendMessage } from './telegram'

function toBuffer(arrayBuffer: ArrayBuffer): Buffer {
  const buffer = Buffer.alloc(arrayBuffer.byteLength);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; ++i) {
    buffer[i] = view[i];
  }
  return buffer;
}

function progressBar(progress: number): string {
  const length = 20
  return '■'.repeat(Math.floor(progress * length)) + '□'.repeat(length - Math.floor(progress * length)) + ` [${Math.floor(progress * 100)}%]`
}

export async function parseBonusPage() {
  const TAPOCHEK_COOKIE_BB_DATA = process.env.TAPOCHEK_COOKIE_BB_DATA
  const TAPOCHEK_COOKIE_BB_LAST_REL = process.env.TAPOCHEK_COOKIE_BB_LAST_REL
  const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID
  const TELEGRAM_ADMIN_USER_ID = process.env.TELEGRAM_ADMIN_USER_ID
  if (!TAPOCHEK_COOKIE_BB_DATA || !TAPOCHEK_COOKIE_BB_LAST_REL || !TELEGRAM_CHANNEL_ID || !TELEGRAM_ADMIN_USER_ID) {
    throw new Error('Fill .env')
  }
  
  let dbSerialized: string
  try {
    dbSerialized = await fs.readFile(__dirname + '/db.json', 'utf-8')
  } catch {
    dbSerialized = '{}'
  }

  let db: { isFreeleech: boolean, contributors: { name: string, contribution: number }[], bonusesLeft: number } = { isFreeleech: false, contributors: [], bonusesLeft: -1 }
  try {
    const dbJson = JSON.parse(dbSerialized)
    if('isFreeleech' in dbJson && typeof dbJson.isFreeleech === 'boolean') {
      db.isFreeleech = dbJson.isFreeleech
    }
    if('contributors' in dbJson && Array.isArray(dbJson.contributors)) {
      db.contributors = dbJson.contributors
    }
    if('bonusesLeft' in dbJson && Number.isSafeInteger(dbJson.bonusesLeft)) {
      db.bonusesLeft = dbJson.bonusesLeft
    }
  } catch {0}

  const response = await fetch('https://tapochek.net/bonus.php', {
    headers: {
      cookie: [
        cookie.serialize('bb_data', TAPOCHEK_COOKIE_BB_DATA),
        cookie.serialize('bb_last_rel', TAPOCHEK_COOKIE_BB_LAST_REL)
      ].join('; ')
    }
  })
    .then(response => response.arrayBuffer())
    .then(buffer => {
      return iconv.decode(toBuffer(buffer), 'win1251')
    })
  const $ = cheerio.load(response)

  const bonusesLeft = 0//Number($('#freeleech_bank').text().trim())
  const contributorsRows = $('#mec_freeleech_bank').find('tr').toArray().slice(1)
  const contributors = contributorsRows.map(row => ({ name: $(row.children[0]).text(), contribution: Number($(row.children[1]).text().trim()) }))

  if (Number.isSafeInteger(bonusesLeft)) {
    if (bonusesLeft === 0) {
      if(db.isFreeleech === false) {
        const text = '❗️ FREELECH STARTED ❗️\n❗️ НАЧАЛСЯ ФРИЛИЧ ❗️\n🚀 https://tapochek.net 🚀'
        const result = await sendMessage(TELEGRAM_CHANNEL_ID, text)
        if (result.ok) {
          await notifyBotSubscribers(text)
        }
      }
    } else {
      if (!_.isEqual(db.contributors, contributors) || db.bonusesLeft !== bonusesLeft) {
        await sendMessage(TELEGRAM_CHANNEL_ID, `[${150000 - bonusesLeft}/150000]\n\n${progressBar((150000 - bonusesLeft) / 150000)}\n\n${contributors.map(c => `${c.name}: ${c.contribution}`).join('\n')}`)
      }
    }
    db.contributors = contributors
    db.isFreeleech = bonusesLeft === 0
    db.bonusesLeft = bonusesLeft
    await fs.writeFile(__dirname + '/db.json', JSON.stringify(db))
  } else {
    console.error(response)
    await sendMessage(TELEGRAM_ADMIN_USER_ID, 'Failed to parse bonuses left')
  }
}