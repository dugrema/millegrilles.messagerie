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

    useEffect(()=>{
        workers.connexion.getContacts()
            .then( reponse => {
                console.debug("Contacts : %O", reponse)
                setContacts(reponse.contacts)
            })
            .catch(err=>console.error("Erreur chargement contacts : %O", err))
    }, [])

    return (
        <>
            <p>Contacts</p>

            <AfficherListeContacts 
                show={uuidContactSelectionne?false:true} 
                contacts={contacts} 
                nouveauContact={nouveauContact}
                retour={retour} />

            <EditerContact 
                show={uuidContactSelectionne?true:false} 
                uuidContactSelectionne={uuidContactSelectionne} 
                setUuidContactSelectionne={setUuidContactSelectionne} />
                
        </>
    )
}

export default Contacts

function AfficherListeContacts(props) {
    console.debug("AfficherListeContacts proppys : %O", props)
    const { nouveauContact, retour, contacts, show } = props
    if( !contacts || !show ) return ''

    return (
        <>
            <Row>
                <Col>
                    <Button variant="secondary" onClick={nouveauContact}>Nouveau</Button>
                    <Button variant="secondary" onClick={retour}>Retour</Button>
                </Col>
            </Row>

            {contacts.map( item => <AfficherContactRow key={item.uuid_contact} value={item} /> )}
        </>
    )
}

function AfficherContactRow(props) {
    return (
        <>
            <p>Contact</p>
        </>
    )
}
