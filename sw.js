/* L'ancienne application (Athlos) installait un service worker à cette adresse. Celui-ci le remplace,
   se désinscrit et recharge les onglets ouverts, pour que la nouvelle application s'affiche partout. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.navigate(client.url));
  })());
});
