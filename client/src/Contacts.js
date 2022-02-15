import { useState, useCallback, useEffect } from 'react'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import EditerContact from './EditerContact'

function Contacts(props) {

    const { workers, setAfficherContacts } = props

    const [contacts, setContacts] = useState('')
    const [uuidContactSelectionne, setUuidContactSelectionne] = useState('')

    const nouveauContact = useCallback(()=>setUuidContactSelectionne(true), [setUuidContactSelectionne])
    const retour = useCallback(()=>setAfficherContacts(false), [setAfficherContacts])

    let contactSelectionne = ''
    if(contacts && contacts.length > 0 && uuidContactSelectionne) {
        contactSelectionne = contacts.filter(item=>item.uuid_contact===uuidContactSelectionne).shift()
    }

    useEffect(()=>{
        workers.connexion.getContacts()
            .then( reponse => setContacts(reponse.contacts) )
            .catch(err=>console.error("Erreur chargement contacts : %O", err))
    }, [])

    return (
        <>
            <p>Contacts</p>

            <AfficherListeContacts 
                show={uuidContactSelectionne?false:true} 
                contacts={contacts} 
                nouveauContact={nouveauContact}
                retour={retour} 
                setUuidContactSelectionne={setUuidContactSelectionne} />

            <EditerContact 
                show={uuidContactSelectionne?true:false} 
                workers={workers}
                uuidContactSelectionne={uuidContactSelectionne} 
                setUuidContactSelectionne={setUuidContactSelectionne} 
                contact={contactSelectionne} />

        </>
    )
}

export default Contacts

function AfficherListeContacts(props) {
    const { nouveauContact, retour, contacts, show, setUuidContactSelectionne } = props

    const ouvrir = useCallback(event=>{
        const uuid_contact = event.currentTarget.value
        console.debug("Ouvrir : %O", uuid_contact)
        setUuidContactSelectionne(uuid_contact)
    }, [setUuidContactSelectionne])

    if( !contacts || !show ) return ''

    return (
        <>
            <Row>
                <Col>
                    <Button variant="secondary" onClick={nouveauContact}>Nouveau</Button>
                    <Button variant="secondary" onClick={retour}>Retour</Button>
                </Col>
            </Row>

            <Row>
                <Col>Nom</Col>
                <Col>Adresse</Col>
            </Row>
            {contacts.map( item => <AfficherContactRow key={item.uuid_contact} value={item} ouvrir={ouvrir} /> )}
        </>
    )
}

function AfficherContactRow(props) {
    const { ouvrir } = props
    const { nom, adresses, uuid_contact } = props.value
    const adresse = [...adresses].shift()

    return (
        <Row>
            <Col>{nom}</Col>
            <Col>{adresse}</Col>
            <Col>
                <Button onClick={ouvrir} value={uuid_contact}>Ouvrir</Button>
            </Col>
        </Row>
    )
}