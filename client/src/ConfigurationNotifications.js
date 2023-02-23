import { useState, useCallback } from 'react'

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
                    <Button>Sauvegarder</Button>
                    {' '}
                    <Button variant='secondary'>Annuler</Button>
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
                        onChange={event=>setEmailAdresse(event.currentTarget.value)} />
                </Form.Group>
            </Row>

        </div>
    )
}

function NotificationsWebpush(props) {

    const { webpushActif, setWebpushActif } = props

    const toggleActifHandler = useCallback(event=>setWebpushActif(event.currentTarget.checked), [setWebpushActif])

    return (
        <div>
            <h3>Web push</h3>

            <p>Fonctionne sur Android, iOS 16.4+ et navigateur PC.</p>
            
            <p>Votre navigateur va recevoir les notifications. Sur PC, le navigateur doit etre demarre (e.g. en arriere plan).</p>

            <p>
                Les notifications web push doivent etre activees sur cette page avec chaque navigateur / appareil mobile qui doit
                les recevoir.
            </p>

            <Row>
                <Col>
                    <Form.Check id="webpushActif" aria-describedby="webpushActif"
                        type="switch"
                        label="Activer notifications par web push pour cet appareil"
                        checked={webpushActif}
                        onChange={toggleActifHandler} />
                </Col>
            </Row>            
        </div>
    )
}