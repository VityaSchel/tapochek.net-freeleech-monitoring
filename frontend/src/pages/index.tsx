import React from 'react'
import cx from 'classnames'

const base64ToUint8Array = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(b64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

const webPushPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY
if (!webPushPublicKey) {
  throw new Error('NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY is not set')
}

export function HomePage() {
  const [subscribed, setSubscribed] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null)

  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/worker/index.js?t=' + Date.now()).then((reg) => {
        console.log('Service Worker registered:', reg)
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
            setSubscribed(true)
          }
        }).finally(() => setLoading(false))
        setRegistration(reg)
      }).catch((error) => {
        console.error('Service Worker registration failed:', error)
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  const handleClick = async () => {
    if(loading) return
    if (registration === null) {
      alert('Ваш браузер не поддерживает push-уведомления, воспользуйтесь Telegram ботом')
      return
    }
    setLoading(true)
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('ServiceWorker не поддерживается')
      }
      if (!('PushManager' in window)) {
        throw new Error('PushManager не поддерживается')
      }
      if (subscribed) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
          throw new Error('Подписка не найдена')
        }
        const res = await fetch('/push-subscription', {
          method: 'DELETE',
          body: JSON.stringify(subscription),
          headers: { 'Content-Type': 'application/json' }
        })
        if(res.status !== 200) {
          throw new Error('Ошибка при отписке')
        }
        await subscription.unsubscribe()
        setSubscribed(false)
      } else {
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(webPushPublicKey)
        })
        const res = await fetch('/push-subscription', {
          method: 'POST',
          body: JSON.stringify(sub),
          headers: { 'Content-Type': 'application/json' }
        })
        if (res.status !== 200) {
          await sub.unsubscribe()
          throw new Error('Ошибка при отписке')
        }
        setSubscribed(true)
      }
    } catch(e) {
      console.error(e)
      alert('Что-то пошло не так. Возможно, ваш браузер не разрешает push-уведомления.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='flex items-center justify-center min-h-screen flex-col gap-8 px-16 py-8 text-center'>
      <h1 className='font-bold text-4xl'>Фрилич на tapochek.net: {Math.floor(Number(import.meta.env.VITE_BONUSES)/150000 * 100)}%</h1>
      <button className={cx('w-[200px] h-[80px] rounded-xl text-2xl font-bold shadow-[0px_12px_35px_rgba(78,70,229,0.51)] my-4 flex items-center justify-center shrink-0', {
        'bg-indigo-600 text-white': !subscribed && !loading,
        'outline-indigo-600 outline-4 outline -outline-offset-4 bg-white text-black': subscribed || loading
      })} onClick={handleClick}>
        {loading ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"><animateTransform attributeName="transform" dur="0.75s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"></animateTransform></path></svg>
        ) : subscribed ? 'Отписаться' : 'Подписаться'}
      </button>
      <p className='w-[600px] text-center max-w-full'>Нажав на кнопку выше, вы подпишитесь на push-уведомления о началах фриличей прямо в вашем браузере. Отписаться можно в любой момент, снова нажав эту же кнопку.</p>
      <div className='flex flex-col gap-4 text-sm font-semibold w-[400px] text-center max-w-full items-center'>
        <a href='https://t.me/tapochekfreeleech' className='hover:text-indigo-600 underline underline-offset-4' target='_blank' rel='nofollower noreferrer'>
          Телеграм канал с детальной информацией о прогрессе следующего фрилича (со списком вкладчиков бонусов)
        </a>
        <a href='https://t.me/tapochekfreeleech_bot' className='hover:text-indigo-600 underline underline-offset-4' target='_blank' rel='nofollower noreferrer'>
          Бот, который пришлет уведомление в Telegram
        </a>
      </div>
    </div>
  )
}