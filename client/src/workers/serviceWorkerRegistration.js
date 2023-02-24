// This optional code is used to register a service worker.
// register() is not called by default.

// This lets the app load faster on subsequent visits in production, and gives
// it offline capabilities. However, it also means that developers (and users)
// will only see deployed updates on subsequent visits to a page, after all the
// existing tabs open on the page have been closed, since previously cached
// resources are updated in the background.

// To learn more about the benefits of this model and instructions on how to
// opt-in, read https://cra.link/PWA

const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
        // [::1] is the IPv6 localhost address.
        window.location.hostname === '[::1]' ||
        // 127.0.0.0/8 are considered localhost for IPv4.
        window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);
  
export function register(config) {
    window.addEventListener('load', () => {
        const url = new URL(window.location.href)
        url.pathname = '/messagerie/service-worker.js'
        // console.info("Charger service worker a ", url.href)
        const swUrl = url.href  // '/service-worker-1.js'
        console.info("Charger service worker a ", swUrl)
        registerValidSW(swUrl, config)
    })
}
  
function registerValidSW(swUrl, config) {
    navigator.serviceWorker
        .register(swUrl)
        .then(async (registration) => {

            console.debug('registerValidSW registration ', registration)

            // await registerPushApi(registration)

            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker == null) {
                    return;
                }
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // At this point, the updated precached content has been fetched,
                            // but the previous service worker will still serve the older
                            // content until all client tabs are closed.
                            console.log(
                            'New content is available and will be used when all ' +
                                'tabs for this page are closed. See https://cra.link/PWA.'
                            );
            
                            // Execute callback
                            if (config && config.onUpdate) {
                                config.onUpdate(registration);
                            }
                        } else {
                            // At this point, everything has been precached.
                            // It's the perfect time to display a
                            // "Content is cached for offline use." message.
                            console.log('Content is cached for offline use.');
            
                            // Execute callback
                            if (config && config.onSuccess) {
                                config.onSuccess(registration);
                            }
                        }
                    }
                };
            };
        })
        .catch((error) => {
            console.error('Error during service worker registration:', error);
        });
}
  
// function checkValidServiceWorker(swUrl, config) {
//     // Check if the service worker can be found. If it can't reload the page.
//     fetch(swUrl, {
//         headers: { 'Service-Worker': 'script' },
//     })
//         .then((response) => {
//             // Ensure service worker exists, and that we really are getting a JS file.
//             const contentType = response.headers.get('content-type');
//             if (
//                 response.status === 404 ||
//                 (contentType != null && contentType.indexOf('javascript') === -1)
//             ) {
//                 // No service worker found. Probably a different app. Reload the page.
//                 navigator.serviceWorker.ready.then((registration) => {
//                     registration.unregister().then(() => {
//                         window.location.reload();
//                     });
//                 });
//             } else {
//                 // Service worker found. Proceed as normal.
//                 registerValidSW(swUrl, config);
//             }
//         })
//       .catch(() => {
//         console.log('No internet connection found. App is running in offline mode.');
//       });
// }

export function unregister() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then((registration) => {
                registration.unregister();
            })
            .catch((error) => {
                console.error(error.message);
            });
    }
}

// async function registerPushApi(registration) {
//     // Use the PushManager to get the user's subscription to the push service.
//     let subscription = await registration.pushManager.getSubscription()
  
//     if(!subscription) {
//         // Get the server's public key
//         // const response = await fetch('https://mg-dev1.maple.maceroc.com/pushapi/vapidPublicKey');
//         // const vapidPublicKey = await response.text();
//         const vapidPublicKey = 'BK7hZcjDuZp43WQb2QXiMtlDjKirdX_2HGpJTa4tkc-oWBm__erlxXOTVmyEA9GyE4flzgY2KiW3kqBYNZxrxYc'
//         // Chrome doesn't accept the base64-encoded (string) vapidPublicKey yet
//         // urlBase64ToUint8Array() is defined in /tools.js
//         const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
    
//         // Otherwise, subscribe the user (userVisibleOnly allows to specify that we don't plan to
//         // send notifications that don't have a visible effect for the user).
//         const notificationPermission = Notification.permission
//         if(Notification !== undefined && Notification.permission === 'granted') {
//             subscription = await registration.pushManager.subscribe({
//                 userVisibleOnly: true,
//                 applicationServerKey: convertedVapidKey
//             });
            
//             // Send the subscription details to the server using the Fetch API.
//             const reponse = await fetch('https://mg-dev1.maple.maceroc.com/pushapi/register', {
//                 method: 'post',
//                 headers: {
//                     'Content-type': 'application/json'
//                 },
//                 body: JSON.stringify({
//                     subscription: subscription
//                 }),
//             })

//             console.info("Reponse push api register : ", reponse)
//         } else {
//             console.warn("Notifications API - non permis ", notificationPermission)
//         }
//     }

//     console.info("Subscription push api : ", subscription)
  
//     // document.getElementById('doIt').onclick = function() {
//     //   const delay = document.getElementById('notification-delay').value;
//     //   const ttl = document.getElementById('notification-ttl').value;
  
//     //   // Ask the server to send the client a notification (for testing purposes, in actual
//     //   // applications the push notification is likely going to be generated by some event
//     //   // in the server).
//     //   fetch('./sendNotification', {
//     //     method: 'post',
//     //     headers: {
//     //       'Content-type': 'application/json'
//     //     },
//     //     body: JSON.stringify({
//     //       subscription: subscription,
//     //       delay: delay,
//     //       ttl: ttl,
//     //     }),
//     //   });
//     // };
  
// }

// This function is needed because Chrome doesn't accept a base64 encoded string
// as value for applicationServerKey in pushManager.subscribe yet
// https://bugs.chromium.org/p/chromium/issues/detail?id=802280
// function urlBase64ToUint8Array(base64String) {
//     var padding = '='.repeat((4 - base64String.length % 4) % 4);
//     var base64 = (base64String + padding)
//       .replace(/\-/g, '+')
//       .replace(/_/g, '/');
   
//     var rawData = window.atob(base64);
//     var outputArray = new Uint8Array(rawData.length);
   
//     for (var i = 0; i < rawData.length; ++i) {
//       outputArray[i] = rawData.charCodeAt(i);
//     }
//     return outputArray;
// }

// async function handleNotifications(sw) {
//     const notifications = sw.getNotifications()
//     console.debug("Notification handler : ", notifications)
// }
