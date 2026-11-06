/* Service worker for push notifications (Firebase Cloud Messaging).
 *
 * It does not load the Firebase SDK: the browser delivers the push event and this
 * worker shows the notification itself, so a click can open the right page.
 * The server sends a data-only FCM message { title, body, link } for the web;
 * the parser also accepts a { notification: { title, body } } payload.
 *
 * No secrets live here (this file is public). It never makes a network request.
 */

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  var payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  var data = (payload && payload.data) || {};
  var notification = (payload && payload.notification) || {};
  var title = String(data.title || notification.title || "Northbound").slice(0, 100);
  var body = String(data.body || notification.body || "").slice(0, 200);
  var link = String(data.link || "/");

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      data: { link: link },
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var link = (event.notification.data && event.notification.data.link) || "/";
  var target;
  try {
    target = new URL(link, self.location.origin);
  } catch {
    return;
  }
  // Only ever open pages of this shop, whatever the message said.
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        if (windows[i].url === target.href && "focus" in windows[i]) return windows[i].focus();
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
