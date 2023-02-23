import { useState, useCallback } from 'react'

import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Form from 'react-bootstrap/Form'
import FormControl from 'react-bootstrap/FormControl'

function ConfigurationNotifications(props) {

    const { retour } = props

    const [webpushActif, setWebpushActif] = useState(false)
    const [emailActif, setEmailActif] = useState(false)
    const [emailAdresse, setEmailAdresse] = useState('')

    const sauvegarderHandler = useCallback(()=>{
        const commande = {
            webpushActif, emailActif, emailAdresse
        }
        console.debug("Sauvegarder ", commande)
    }, [webpushActif, emailActif, emailAdresse])

    return (
        <div>
            <NotificationsWebpush 
                webpushActif={webpushActif}
                setWebpushActif={setWebpushActif} />

            <p></p>

            <NotificationsEmail 
                emailActif={emailActif}
                setEmailActif={setEmailActif}
                emailAdresse={emailAdresse}
                setEmailAdresse={setEmailAdresse} />
            
            <p></p>

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

    const { webpushActif, setWebpushActif } = props
    
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission)

    const toggleActifHandler = useCallback(event=>{
        const permission = Notification.permission
        setNotificationPermission(permission)
        if(permission === 'granted') {
            setWebpushActif(event.currentTarget.checked)
        } else {
            Notification.requestPermission()
            .then(resultat=>{
                console.debug("Resultat autorisation : ", resultat)
                setNotificationPermission(resultat)
                if(resultat === 'granted') {
                    setWebpushActif(true)
                }
            })
            .catch(err=>{
                console.error("Erreur autorisation notifications ", err)
            })
        }
    }, [notificationPermission, setNotificationPermission, setWebpushActif])

    return (
        <div>
            <h3>Web push</h3>

            <p>Fonctionne sur Android, iOS 16.4+ et navigateur PC.</p>
            
            <Row>

                <Col>
                    <Form.Check id="webpushActif" aria-describedby="webpushActif"
                        type="switch"
                        label="Activer notifications par web push pour cet appareil"
                        checked={webpushActif}
                        onChange={toggleActifHandler} 
                        disabled={notificationPermission === 'denied'} />
                </Col>
            </Row>            

            <p>Votre navigateur va recevoir les notifications. Sur PC, le navigateur doit etre demarre (e.g. en arriere plan).</p>

            <Alert variant='warning' show={notificationPermission === 'denied'}>
                <Alert.Heading>Notifications bloquees</Alert.Heading>
                <p>Votre navigateur bloque les notifications. Il faut retirer le blocage pour pouvoir poursuivre (settings du navigateur).</p>
            </Alert>

            <Alert show={webpushActif} variant='success'>
                <Alert.Heading>Notifications web push activees</Alert.Heading>

                <p>Les notifications web push sont activees sur cet appareil.</p>
            </Alert>

            <Alert show={webpushActif} variant='info'>
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