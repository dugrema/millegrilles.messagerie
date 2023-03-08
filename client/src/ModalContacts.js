import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Container from 'react-bootstrap/Container'

import { trierString } from '@dugrema/millegrilles.utiljs/src/tri'
import { ListeFichiers, AlertTimeout } from '@dugrema/millegrilles.reactjs'

import contactsAction from './redux/contactsSlice'

// import * as MessageDao from './redux/messageDao'

const PAGE_LIMIT = 200

function ModalContacts(props) {

    const { workers, show, fermer, ajouterAdresses, erreurCb } = props

    const contacts = useSelector(state=>state.contacts.liste),
          userId = useSelector(state=>state.contacts.userId),
          compteContacts = contacts?contacts.length:0

    const [colonnes, setColonnes] = useState(preparerColonnes())
    const [uuidContactSelectionne, setUuidContactSelectionne] = useState('')
    const [erreur, setErreur] = useState('')

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
       
    const [selection, setSelection] = useState([])

    const onSelectHandler = useCallback( items => {
        const itemsMaj = items.filter(item=>item)
        setSelection(itemsMaj)
        setUuidContactSelectionne(itemsMaj)
    }, [setSelection, setUuidContactSelectionne])

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
                selection={selection}
                onSelect={onSelectHandler}
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
        ordreColonnes: ['nom', 'adresse', /*'boutonDetail'*/ ],
        paramsColonnes: {
            'nom': {'label': 'Nom', showThumbnail: false, xs: 12, md: 4},
            'adresse': {'label': 'Adresse', className: 'details', xs: 12, md: 5},
            // 'boutonDetail': {label: ' ', className: 'droite', showBoutonContexte: true, xs: 4, md: 3},
        },
        tri: {colonne: 'nom', ordre: 1},
        idMapper: data => data.uuid_contact,
    }
    return params
}
