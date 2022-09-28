import { useEffect, useState, useCallback, useMemo } from 'react'
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Container from 'react-bootstrap/Container'

import { trierString } from '@dugrema/millegrilles.utiljs/src/tri'
import { ListeFichiers, AlertTimeout } from '@dugrema/millegrilles.reactjs'

// import * as MessageDao from './redux/messageDao'

const PAGE_LIMIT = 200

function ModalContacts(props) {

    const { workers, show, fermer, ajouterAdresses, userId } = props

    const [colonnes, setColonnes] = useState(preparerColonnes())
    const [contacts, setContacts] = useState('')
    const [compteContacts, setCompteContacts] = useState(0)
    const [uuidContactSelectionne, setUuidContactSelectionne] = useState('')
    const [erreur, setErreur] = useState('')

    const isListeComplete = useMemo(()=>{
        if(contacts) return contacts.length === compteContacts
        return false
    }, [contacts, compteContacts])

    const erreurCb = useCallback((err, message)=>{
        console.error("Erreur generique %s : %O", err, message)
        setErreur({err, message})
    }, [setErreur])

    const appliquerCb = useCallback(()=>{
        const contactsSelectionnes = contacts
            .filter(item=>{
                if(item) return uuidContactSelectionne.includes(item.uuid_contact)
                return false
            })
        console.debug("Contacts selectionnes : %O (uuids: %O)", contactsSelectionnes, uuidContactSelectionne)
        ajouterAdresses(contactsSelectionnes)
        fermer()
    }, [uuidContactSelectionne, contacts, fermer, ajouterAdresses])

    const formatterContactsCb = useCallback(contacts=>{
        console.debug("formatterContactsCb : %O", contacts)
        formatterContacts(contacts, colonnes, userId, setContacts, setCompteContacts, erreurCb)
    }, [colonnes, userId, setContacts, setCompteContacts, erreurCb])

    const getContactsSuivants = useCallback(()=>{
        if(colonnes && userId) {
            const { colonne, ordre } = colonnes.tri
            throw new Error("fix me - redux")
            // MessageDao.getContacts(userId, {colonne, ordre, skip: contacts.length, limit: PAGE_LIMIT})
            //     .then(liste=>{
            //         const listeMaj = [...contacts, ...liste]
            //         return formatterContactsCb(listeMaj)
            //     })
            //     .catch(erreurCb)
        }
    }, [colonnes, contacts, formatterContactsCb, userId, erreurCb])

    const enteteOnClickCb = useCallback(colonne=>{
        // console.debug("Click entete nom colonne : %s", colonne)
        const triCourant = {...colonnes.tri}
        const colonnesCourant = {...colonnes}
        const colonneCourante = triCourant.colonne
        let ordre = triCourant.ordre || 1
        if(colonne === colonneCourante) {
            // Toggle direction
            ordre = ordre * -1
        } else {
            ordre = 1
        }
        colonnesCourant.tri = {colonne, ordre}
        // console.debug("Sort key maj : %O", colonnesCourant)
        setColonnes(colonnesCourant)
    }, [colonnes, setColonnes])

    // Charger liste initiale de idb
    useEffect(()=>{
        if(show && colonnes && userId) {
            const { colonne, ordre } = colonnes.tri
            throw new Error("fix me - redux")
            // MessageDao.getContacts(userId, {colonne, ordre, limit: PAGE_LIMIT})
            //     .then(formatterContactsCb)
            //     .catch(erreurCb)
        }
    }, [workers, show, colonnes, userId, formatterContactsCb, erreurCb])
    
    return (
        <Modal show={show} size="lg">
            <Modal.Header>
                Choisir des contacts a ajouter au message
            </Modal.Header>

            <Container>

                <AlertTimeout value={erreur} setValue={setErreur} titre="Erreur" variant="danger" />

                <AfficherListeContacts 
                    show={true} 
                    colonnes={colonnes}
                    contacts={contacts} 
                    compteContacts={compteContacts}
                    setUuidContactSelectionne={setUuidContactSelectionne} 
                    getContactsSuivants={getContactsSuivants}
                    isListeComplete={isListeComplete} 
                    enteteOnClickCb={enteteOnClickCb} 
                    userId={userId} 
                    erreurCb={erreurCb} />
            </Container>

            <Modal.Footer>
                <Button onClick={appliquerCb}>Ok</Button>
                <Button variant="secondary" onClick={fermer}>Annuler</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default ModalContacts

function AfficherListeContacts(props) {
    const { 
        contacts, compteContacts, colonnes, show, 
        setUuidContactSelectionne, getContactsSuivants, isListeComplete, 
        enteteOnClickCb,
    } = props
       
    if( !contacts || !show ) return ''

    return (
        <div>
            <Row>
                <Col className='buttonbar-right'><AfficherCompteContacts value={compteContacts} /></Col>
            </Row>

            <ListeFichiers 
                modeView='liste'
                colonnes={colonnes}
                rows={contacts} 
                onSelection={setUuidContactSelectionne}
                onClickEntete={enteteOnClickCb}
                suivantCb={isListeComplete?'':getContactsSuivants}
            />

        </div>     
    )

}

function AfficherCompteContacts(props) {
    const value = props.value
    if(value > 1) {
        return <p>{value} contacts</p>
    } else if(value === 1) {
        return <p>1 contact</p>
    } else {
        return <p>Aucun contacts</p>
    }
}

function preparerColonnes() {

    const params = {
        ordreColonnes: ['nom', 'adresse', 'boutonDetail'],
        paramsColonnes: {
            'nom': {'label': 'Nom', showThumbnail: false, xs: 12, md: 4},
            'adresse': {'label': 'Adresse', className: 'details', xs: 12, md: 5},
            'boutonDetail': {label: ' ', className: 'droite', showBoutonContexte: true, xs: 4, md: 3},
        },
        tri: {colonne: 'nom', ordre: 1},
    }
    return params
}

function formatterContacts(contacts, colonnes, userId, setContacts, setCompteContacts, erreurCb) {
    // console.debug("formatterContacts colonnes: %O", colonnes)
    const {colonne, ordre} = colonnes.tri
    // let contactsTries = [...contacts]

    let contactsTries = contacts.map(item=>{
        const fileId = item.uuid_contact
        const adresse = item.adresses?item.adresses[0]:''
        const nom = item.nom || 'Vide'
        return {...item, fileId, nom, adresse}
    })

    // console.debug("Contacts a trier : %O", contactsTries)

    switch(colonne) {
        // case 'adresse': contactsTries.sort(trierAdresses); break
        default: contactsTries.sort(trierNoms)
    }

    if(ordre < 0) contactsTries = contactsTries.reverse()

    setContacts(contactsTries)

    throw new Error("fix me - redux")
    // MessageDao.countContacts(userId)
    //     .then(setCompteContacts)
    //     .catch(erreurCb)
}

function trierNoms(a, b) {
    return trierString('nom', a, b)
}
