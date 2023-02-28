console.info("Chargement service worker")

self.addEventListener('message', async m => {

    try {
        const action = m.data.action,
              port = m.ports[0]

        try {
            switch(action) {
                default:
                    port.postMessage({err: `action non supporee : ${action}`})
            }
        } catch(err) {
            port.postMessage({err})
        }

    } catch(err) {
        console.error("Erreur traitement message %O : %O", m, err)
    }
    
})

// Register event listener for the 'push' event.
self.addEventListener('push', function(event) {
    // Keep the service worker alive until the notification is created.
    console.info("Message push recu : ", event)

    try {
        const res = JSON.parse(event.data.text());
        const { title, body, url, icon } = res.payload;
        const options = {
        body,
        icon,
        vibrate: [100],
        data: { url }
        };
        console.info("Message push recu %s : %O", title, options)

        self.registration.showNotification(title, options)
    } catch(err) {
        console.error("Erreur traitement message push ", err)
    }
})

const cacheFirst = async (request) => {
    // const responseFromCache = await caches.match(request);
    // if (responseFromCache) {
    //     return responseFromCache;
    // }

    console.debug("Fetch %O", request)

    const url = new URL(request.url)
    console.debug("Fetch url ", url)
    if(request.method === 'GET') {
        if(url.pathname === '/messagerie/sw/webpush') {
            const subscription = await registration.pushManager.getSubscription()
            const subscriptionStr = JSON.stringify(subscription)
            console.debug("Subscription info ", subscriptionStr)
            return new Response(subscriptionStr, {status: 200})
        }
    }

    const responseFromNetwork = await fetch(request);
    // putInCache(request, responseFromNetwork.clone());
    return responseFromNetwork;
}
  
self.addEventListener("fetch", (event) => {
    event.respondWith(cacheFirst(event.request));
})
