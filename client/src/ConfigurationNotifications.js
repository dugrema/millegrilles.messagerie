import { useState, useCallback, useEffect } from 'react'

import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Form from 'react-bootstrap/Form'
import FormControl from 'react-bootstrap/FormControl'

import useWorkers from './WorkerContext'

function ConfigurationNotifications(props) {

    const { retour } = props

    const [emailActif, setEmailActif] = useState(false)
    const [emailAdresse, setEmailAdresse] = useState('')

    const sauvegarderHandler = useCallback(()=>{
        const commande = {
            emailActif, emailAdresse
        }
        console.debug("Sauvegarder ", commande)
    }, [emailActif, emailAdresse])

    return (
        <div>
            <NotificationsWebpush />

            <p></p>

            <NotificationsEmail 
                emailActif={emailActif}
                setEmailActif={setEmailActif}
                emailAdresse={emailAdresse}
                setEmailAdresse={setEmailAdresse} />
            
            <br/><br/>

            <Row>
                <Col>
                    <Button onClick={sauvegarderHandler}>Sauvegarder</Button>
                    {' '}
                    <Button variant='secondary' onClick={retour}>Annuler</Button>
                </Col>
            </Row>
        </div>
    )
}

export default ConfigurationNotifications

function NotificationsEmail(props) {

    const { emailActif, setEmailActif, emailAdresse, setEmailAdresse } = props

    const toggleActifHandler = useCallback(event=>{
        const checked = event.currentTarget.checked
        setEmailActif(checked)
    }, [setEmailActif])

    return (
        <div>
            <h3>Email</h3>

            <p>Recevoir des notifications par email.</p>

            <Row>
                <Form.Group as={Col}>
                    <Form.Label>Adresse email</Form.Label>
                    <FormControl id="emailAddress" aria-describedby="emailAddress"
                        placeholder="exemple : mail@myserver.com"
                        value={emailAdresse}
                        onChange={event=>setEmailAdresse(event.currentTarget.value)} 
                        type='text' inputMode='email'
                        autoComplete='false' autoCorrect='false' autoCapitalize='false' spellCheck='false' />
                </Form.Group>
            </Row>

            <Row>
                <Col>
                    <Form.Check id="emailActif" aria-describedby="emailActif"
                        type="switch"
                        label="Activer notifications par email"
                        checked={emailActif}
                        onChange={toggleActifHandler} />
                </Col>
            </Row>

        </div>
    )
}

function NotificationsWebpush(props) {

    // const { webpushActif, setWebpushActif } = props
    const workers = useWorkers()
    
    const [webpushActif, setWebpushActif] = useState('')
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission)

    const toggleActifHandler = useCallback(event=>{
        const checked = event.currentTarget.checked
        const permission = Notification.permission
        setNotificationPermission(permission)
        // if(permission === 'granted') {
        //     setWebpushActif(event.currentTarget.checked)
        // } else {
            Notification.requestPermission()
                .then(async resultat => {
                    console.debug("Resultat autorisation : ", resultat)
                    if(resultat === 'granted') {
                        if(checked) {
                            await enregistrerWebpush(workers)
                            setWebpushActif(true)
                        } else {
                            const resultat = await retirerWebpush()
                            setWebpushActif(!resultat)
                        }
                    }
                })
                .catch(err=>{
                    console.error("Erreur autorisation notifications ", err)
                    // setWebpushActif(false)
                })
        // }
    }, [notificationPermission, setNotificationPermission, setWebpushActif])

    // Charger etat subscriptions
    useEffect(()=>{
        if(webpushActif !== '') return
        if(notificationPermission === 'granted') {
            // Verifier si subscription existe
            trouverServiceWorker()
                .then(async registration => {
                    const subscription = await registration.pushManager.getSubscription()
                    console.debug("Push manager subscription", subscription)
                    setWebpushActif(!!subscription)
                })
                .catch(err=>console.error("Erreur verification subscription state ", err))
        }
    }, [webpushActif, notificationPermission, setWebpushActif])

    return (
        <div>
            <h3>Web push</h3>

            <p>Fonctionne sur Android, iOS 16.4+ et navigateur PC.</p>
            
            <Row>

                <Col>
                    <Form.Check id="webpushActif" aria-describedby="webpushActif"
                        type="switch"
                        label="Activer notifications par web push pour cet appareil"
                        checked={!!webpushActif}
                        onChange={toggleActifHandler} 
                        disabled={notificationPermission === 'denied'} />
                </Col>
            </Row>            

            <p>Votre navigateur va recevoir les notifications. Sur PC, le navigateur doit etre demarre (e.g. en arriere plan).</p>

            <Alert variant='warning' show={notificationPermission === 'denied'}>
                <Alert.Heading>Notifications bloquees</Alert.Heading>
                <p>Votre navigateur bloque les notifications. Il faut retirer le blocage pour pouvoir poursuivre (settings du navigateur).</p>
            </Alert>

            <Alert show={!!webpushActif} variant='success'>
                <Alert.Heading>Notifications web push activees</Alert.Heading>

                <p>Les notifications web push sont activees sur cet appareil.</p>
            </Alert>

            <Alert show={!!webpushActif} variant='info'>
                <Alert.Heading>Notice</Alert.Heading>
                <p>Seuls les appareils actives vont recevoir les notifications.</p>
                <p>
                    Si vous voulez recevoir les notifications sur d'autres appareils ou navigateurs sur PC, vous devez 
                    visiter cette page et activer chaque appareil individuellement.
                </p>
            </Alert>

        </div>
    )
}

async function trouverServiceWorker() {
    if(!navigator.serviceWorker || !navigator.serviceWorker.getRegistrations) {
        throw new Error("Service worker non supporte")
    }
    const registrations = await navigator.serviceWorker.getRegistrations()
    console.debug('Liste service workers ', registrations)
    
    const registration = registrations.filter(item=>{
        const url = new URL(item.active.scriptURL)
        return url.pathname === '/messagerie/service-worker.js'
    }).pop()
    
    console.debug("Registration ", registration)
    if(!registration) {
        throw new Error("Service worker non disponible")
    }

    // Tenter de communiquer avec le Service Worker
    const serviceWorker = registration.active
    if(!serviceWorker) throw new Error("Aucun service worker actif")

    return registration
}

async function enregistrerWebpush(workers) {

    const registration = await trouverServiceWorker()

    const subscription = await registration.pushManager.getSubscription()
    console.debug("Push manager subscription existante ", subscription)
    if(!subscription) {
        // Recuperer information webpush
        const cleWebpush = await workers.connexion.getClepubliqueWebpush()
        console.debug("Cle webpush ", cleWebpush)

        const vapidPublicKey = cleWebpush.cle_publique_urlsafe
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)
        
        console.debug("Subscription avec cle ", convertedVapidKey)
    
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        })
    
        console.debug("Reponse subscription ", subscription)
        return true
    }
}

async function retirerWebpush() {

    const registration = await trouverServiceWorker()

    const subscription = await registration.pushManager.getSubscription()
    console.debug("Push manager subscription existante", subscription)
    if(subscription) {
        // Retirer subscription
        const resultat = await subscription.unsubscribe()
        return resultat
    }

    return false
}

// async function postMessageServiceWorker(registration, message) {
//     const messageChannel = new MessageChannel()

//     const promise = new Promise((resolve, reject) => {
//         const timeoutReject = setTimeout(()=>reject('Timeout'), 15_000)
//         messageChannel.port1.onmessage = e => {
//             clearTimeout(timeoutReject)
//             resolve(e)
//         }
//         messageChannel.port1.onmessageerror = e => {
//             clearTimeout(timeoutReject)
//             reject(e)
//         }
//     })

//     serviceWorker.postMessage(message, [messageChannel.port2])

//     return promise
// }

// This function is needed because Chrome doesn't accept a base64 encoded string
// as value for applicationServerKey in pushManager.subscribe yet
// https://bugs.chromium.org/p/chromium/issues/detail?id=802280
function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
   
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
   
    for (var i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
