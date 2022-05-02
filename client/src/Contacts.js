import { useState, useCallback, useEffect } from 'react'
import { proxy } from 'comlink'

import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Breadcrumb from 'react-bootstrap/Breadcrumb'

import EditerContact from './EditerContact'

function Contacts(props) {

    const { workers, etatAuthentifie, usager, setAfficherContacts } = props

    const [contacts, setContacts] = useState('')
    const [uuidContactSelectionne, setUuidContactSelectionne] = useState('')
    const [evenementContact, addEvenementContact] = useState('')

    const nouveauContact = useCallback(()=>setUuidContactSelectionne(true), [setUuidContactSelectionne])
    const retour = useCallback(()=>setAfficherContacts(false), [setAfficherContacts])
    const retourContacts = useCallback(()=>setUuidContactSelectionne(false), [setUuidContactSelectionne])

    let contactSelectionne = ''
    if(contacts && contacts.length > 0 && uuidContactSelectionne) {
        contactSelectionne = contacts.filter(item=>item.uuid_contact===uuidContactSelectionne).shift()
    }

    useEffect(()=>{
        workers.connexion.getContacts()
            .then( reponse => setContacts(reponse.contacts) )
            .catch(err=>console.error("Erreur chargement contacts : %O", err))
    }, [])

    // Contacts listener
    useEffect(()=>{
        const { connexion } = workers
        if(connexion && etatAuthentifie, usager) {
            const cb = proxy(addEvenementContact)
            const params = {}
            connexion.enregistrerCallbackEvenementContact(params, cb)
                .catch(err=>console.error("Erreur enregistrement evenements contacts : %O", err))
            return () => connexion.retirerCallbackEvenementContact(params, cb)
                .catch(err=>console.debug("Erreur retrait evenements contacts : %O", err))
        }
    }, [workers, etatAuthentifie, usager, addEvenementContact])

    // Event handling
    useEffect(()=>{
        console.debug("Evenement contact : %O", evenementContact)
    }, [evenementContact])

    return (
        <>
            <BreadcrumbContacts 
                uuidContactSelectionne={uuidContactSelectionne} 
                contacts={contacts}
                retourMessages={retour} 
                retourContacts={retourContacts} />

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

function BreadcrumbContacts(props) {

    const { contacts, uuidContactSelectionne, retourMessages, retourContacts } = props

    const bc = [
        <Breadcrumb.Item key="messages" onClick={retourMessages}>Messages</Breadcrumb.Item>
    ]

    if(!uuidContactSelectionne) {
        return (
            <Breadcrumb>
                {bc}
                <Breadcrumb.Item key="contacts" onClick={retourContacts} active>Contacts</Breadcrumb.Item>
            </Breadcrumb>
        )
    }

    bc.push(<Breadcrumb.Item key="contacts" onClick={retourContacts}>Contacts</Breadcrumb.Item>)

    if(uuidContactSelectionne === true) {
        return (
            <Breadcrumb>
                {bc}
                <Breadcrumb.Item active>Nouveau</Breadcrumb.Item>
            </Breadcrumb>
        )
    } else {
        const contact = contacts.filter(item=>item.uuid_contact === uuidContactSelectionne).pop()
        return (
            <Breadcrumb>
                {bc}
                <Breadcrumb.Item active>{contact.nom}</Breadcrumb.Item>
            </Breadcrumb>
        )
    }

}

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
