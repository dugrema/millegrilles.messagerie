import { useEffect, useState, useCallback } from 'react'
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Container from 'react-bootstrap/Container'
import Form from 'react-bootstrap/Form'

function ModalContacts(props) {

    const { workers, show, fermer, ajouterAdresses } = props

    const [contacts, setContacts] = useState('')
    const [selection, setSelection]= useState([])

    const appliquerCb = useCallback(()=>{
        const contactsSelectionnes = contacts.filter(item=>selection[item.uuid_contact])
        console.debug("Contacts selectionnes : %O", contactsSelectionnes)
        ajouterAdresses(contactsSelectionnes)
        fermer()
    }, [selection, contacts, fermer, ajouterAdresses])

    useEffect(()=>{
        if(contacts) return  // Empecher boucle
        if(show) {
            workers.connexion.getContacts()
                .then( reponse => setContacts(reponse.contacts) )
                .catch(err=>console.error("Erreur chargement contacts : %O", err))
        }
    }, [show, contacts, setContacts])

    return (
        <Modal show={show} size="lg">
            <Modal.Header>
                Choisir des contacts
            </Modal.Header>

            <Container>
                <AfficherContacts workers={workers} contacts={contacts} setSelection={setSelection} />
            </Container>

            <Modal.Footer>
                <Button onClick={appliquerCb}>Ok</Button>
                <Button variant="secondary" onClick={fermer}>Annuler</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default ModalContacts

function AfficherContacts(props) {

    const { contacts, selection, setSelection } = props

    const setSelectionCb = useCallback( event => {
        const {value, checked} = event.currentTarget
        const copie = {...selection}
        copie[value] = checked?true:false
        setSelection(copie)
    }, [selection, setSelection])

    if(!contacts) return ''

    return (
        <>
            <Row>
                <Col md={1}>X</Col>
                <Col md={4}>Nom</Col>
                <Col md={7}>Adresse</Col>
            </Row>

            {contacts.map( (item, idx) => <AfficherContactRow key={idx} value={item} setSelection={setSelectionCb} /> )}
        </>
    )
}

function AfficherContactRow(props) {
    const { setSelection, value } = props

    let adresse = ''
    if(value.adresses && value.adresses.length > 0) adresse = value.adresses[0]

    return (
        <Row>
            <Col md={1}>
                <Form.Check type='checkbox' value={value.uuid_contact} onChange={setSelection} />
            </Col>
            <Col md={4}>{value.nom}</Col>
            <Col md={7}>{adresse}</Col>
        </Row>
    )
}