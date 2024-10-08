'use strict'

self.addEventListener('push', function (event) {
  const data = JSON.parse(event.data.text())
  try {
    event.waitUntil(
      registration.showNotification(data.title, {
        body: data.message,
        icon: 'https://tapochek.utidteam.com/android-chrome-192x192.png',
        badge: 'https://tapochek.utidteam.com/safari-pinned-tab.svg',
        data: { url: data.url },
        image: data.image,
      })
    )
  } catch(e) {
    console.log('Could not show notification', e)
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  clients.openWindow(event.notification.data.url)
})