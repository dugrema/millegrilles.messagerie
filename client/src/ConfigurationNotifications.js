import { useState, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Form from 'react-bootstrap/Form'
import FormControl from 'react-bootstrap/FormControl'

import contactsActions, {thunks as contactsThunks} from './redux/contactsSlice'
import useWorkers from './WorkerContext'

const NOTIFICATIONS_WEBPUSH_DISPONIBLES = window.Notification && window.Notification.permission

function ConfigurationNotifications(props) {

    const { retour } = props

    const workers = useWorkers(),
          dispatch = useDispatch(),
          profil = useSelector(state=>state.contacts.profil)

    const [emailActif, setEmailActif] = useState(false)
    const [emailAdresse, setEmailAdresse] = useState('')

    const sauvegarderHandler = useCallback(()=>{
        Promise.resolve()
            .then(async () => {
                const emailChiffre = await chiffrerData(workers, profil, {email_adresse: emailAdresse})
                const commande = {
                    email_actif: emailActif, 
                    email_chiffre: emailChiffre,
                }
                console.debug("Sauvegarder ", commande)
                const reponse = await workers.connexion.sauvegarderUsagerConfigNotifications(commande)
                console.debug("sauvegarderUsagerConfigNotifications ", reponse)

                const profilMaj = {...profil, ...commande, email_adresse: emailAdresse}
                dispatch(contactsActions.setProfil(profilMaj))

                retour()
            })
            .catch(err=>console.error("Erreur sauvegarde configuration notifications ", err))
    }, [workers, emailActif, emailAdresse, retour])

    useEffect(()=>{
        console.debug("Profil ", profil)
        setEmailActif(!!profil.email_actif)
        setEmailAdresse(profil.email_adresse)
    }, [profil, setEmailActif, setEmailAdresse])

    return (
        <div>
            {NOTIFICATIONS_WEBPUSH_DISPONIBLES?
                <NotificationsWebpush />
                :
                <Alert variant='warning'>
                    <Alert.Heading>Notifications directes</Alert.Heading>
                    <p>Les notifications web push directes ne sont pas disponibles sur cet appareil.</p>
                    {!emailActif?
                        <p>Utiliser les notifications par email comme alternative.</p>
                        :''
                    }
                    
                </Alert>
            }
            

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

            <Row>
                <Col>
                    <Form.Check id="emailActif" aria-describedby="emailActif"
                        type="switch"
                        label="Activer notifications par email"
                        checked={emailActif}
                        onChange={toggleActifHandler} />
                </Col>
            </Row>

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

        </div>
    )
}

function NotificationsWebpush(props) {

    // const { webpushActif, setWebpushActif } = props
    const workers = useWorkers()

    const profil = useSelector(state=>state.contacts.profil)

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
                            const resultat = await retirerWebpush(workers)
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
                    if(subscription) {
                        console.debug("Subscription existante : ", JSON.parse(JSON.stringify(subscription)))
                    }                    
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
        const subscriptionJson = JSON.parse(JSON.stringify(subscription))
        console.debug("Reponse subscription json ", subscriptionJson)

        // Ajouter le endpoint au profil usager
        const commande = {
            endpoint: subscription.endpoint,
            expiration_time: subscription.expirationTime,
            keys_auth: subscriptionJson.keys.auth,
            keys_p256dh: subscriptionJson.keys.p256dh,
        }
        const reponse = await workers.connexion.sauvegarderSubscriptionWebpush(commande)
        console.debug("Reponse subscription webpush ", reponse)

        return true
    }
}

async function retirerWebpush(workers) {

    const registration = await trouverServiceWorker()

    const subscription = await registration.pushManager.getSubscription()
    console.debug("Push manager subscription existante", subscription)
    if(subscription) {
        // Retirer subscription
        const resultat = await subscription.unsubscribe()

        // Ajouter le endpoint au profil usager
        const commande = {endpoint: subscription.endpoint}
        const reponse = await workers.connexion.retirerSubscriptionWebpush(commande)
        console.debug("Reponse subscription webpush ", reponse)

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

async function chiffrerData(workers, profil, data) {
    console.debug("Chiffrer configuration email profil %O, %O", profil, data)
    const { chiffrage, clesDao } = workers

    // Recuperer cle de chiffrage
    const ref_hachage_bytes = profil.cle_ref_hachage_bytes
    const cle = await clesDao.getCleLocale(ref_hachage_bytes)
    const cleSecrete = cle.cleSecrete

    const champsChiffres = await chiffrage.chiffrage.updateChampsChiffres(data, cleSecrete)
    champsChiffres.ref_hachage_bytes = ref_hachage_bytes
    return champsChiffres
}
