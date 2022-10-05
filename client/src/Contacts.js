import { useState, useCallback, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { proxy as comlinkProxy } from 'comlink'

import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Breadcrumb from 'react-bootstrap/Breadcrumb'

// import { trierString } from '@dugrema/millegrilles.utiljs/src/tri'
import { ListeFichiers } from '@dugrema/millegrilles.reactjs'

// import * as MessageDao from './redux/messageDao'
import useWorkers, {useEtatConnexion, useEtatAuthentifie, useEtatPret} from './WorkerContext'
import contactsAction, { thunks as contactsThunks } from './redux/contactsSlice'

import { EvenementsContactHandler } from './Evenements'
import EditerContact from './EditerContact'
import { MenuContextuelListeContacts, onContextMenu } from './MenuContextuel'

function Contacts(props) {

    const { retour, erreurCb } = props

    const workers = useWorkers()
    const etatPret = useEtatPret()
    const dispatch = useDispatch()

    const contacts = useSelector(state=>state.contacts.liste),
          uuidContactActif = useSelector(state=>state.contacts.uuidContactActif)

    // const [editerContact, setEditerContact] = useState(false)
    const [colonnes, setColonnes] = useState(preparerColonnes())

    const nouveauContact = useCallback(()=>{
        dispatch(contactsAction.setContactActif(''))
        // setEditerContact(true)
        dispatch(contactsAction.setContactActif(''))
    }, [dispatch])
    const editerContactHandler = useCallback(uuid_contact=>{
        dispatch(contactsAction.setContactActif(uuid_contact))
        // setEditerContact(true)
    }, [dispatch])
    const retourContacts = useCallback(()=>{
        dispatch(contactsAction.setContactActif(null))
        // setEditerContact(false)
    }, [dispatch])
    
    const supprimerContactsCb = useCallback(uuidContacts=>{
        // console.debug("Supprimer contacts %O", uuidContacts)
        workers.connexion.supprimerContacts(uuidContacts).catch(erreurCb)
            .then(reponse=>{
                // console.debug("Reponse supprimer contacts : %O", reponse)
                if(reponse.err) erreurCb(reponse.err, "Erreur de suppression de contacts")
            })
            .catch(err=>erreurCb(err, "Erreur suppression de contacts"))
    }, [workers, erreurCb])
    
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

    // Charger contacts
    useEffect(()=>{
        dispatch(contactsThunks.chargerContacts(workers))
    }, [workers])

    if(!contacts) return 'Chargement des contacts en cours ...'

    return (
        <>
            <AfficherListeContacts 
                show={uuidContactActif===null} 
                colonnes={colonnes}
                nouveauContact={nouveauContact}
                // editerContact={editerContactHandler}
                retour={retour} 
                enteteOnClickCb={enteteOnClickCb} 
                supprimerContacts={supprimerContactsCb} />

            <EditerContact 
                show={uuidContactActif!==null} 
                supprimerContacts={supprimerContactsCb} 
                retour={retourContacts} />

            <EvenementsContactHandler />
        </>
    )
}

export default Contacts

function BreadcrumbContacts(props) {

    console.debug("!!! BreadcrumbContacts Proppies ", props)

    const { retourMessages, retourContacts } = props

    const contacts = useSelector(state=>state.contacts.liste),
          uuidContactActif = useSelector(state=>state.contacts.uuidContactActif)

    const bc = [
        <Breadcrumb.Item key="messages" onClick={retourMessages}>Messages</Breadcrumb.Item>
    ]

    if(!uuidContactActif) {
        return (
            <Breadcrumb>
                {bc}
                <Breadcrumb.Item key="contacts" onClick={retourContacts} active>Contacts</Breadcrumb.Item>
            </Breadcrumb>
        )
    }

    bc.push(<Breadcrumb.Item key="contacts" onClick={retourContacts}>Contacts</Breadcrumb.Item>)

    if(uuidContactActif === true) {
        return (
            <Breadcrumb>
                {bc}
                <Breadcrumb.Item active>Nouveau</Breadcrumb.Item>
            </Breadcrumb>
        )
    } else {
        const contact = contacts.filter(item=>item.uuid_contact === uuidContactActif).pop()
        return (
            <Breadcrumb>
                {bc}
                <Breadcrumb.Item active>{contact.nom}</Breadcrumb.Item>
            </Breadcrumb>
        )
    }

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

function AfficherListeContacts(props) {
    const { 
        nouveauContact, colonnes, show, 
        editerContact, 
        enteteOnClickCb, 
        supprimerContacts,
    } = props

    const dispatch = useDispatch()
    const etatAuthentifie = useEtatAuthentifie()
    const contacts = useSelector(state=>state.contacts.liste)
    const compteContacts = contacts.length

    const [selection, setSelection] = useState('')
    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})

    const onSelectionLignes = useCallback(selection=>{setSelection(selection)}, [setSelection])
    const fermerContextuel = useCallback(()=>setContextuel(false), [setContextuel])
    const onContextMenuCb = useCallback((event, value)=>onContextMenu(event, value, setContextuel), [])

    const ouvrir = useCallback(event=>{
        event.preventDefault()
        event.stopPropagation()

        // console.debug("Ouvrir event : %O, selection: %O", event, selection)
        if(selection.length > 0) {
            const uuid_contact = selection[0]
            console.debug("Ouvrir contact ", uuid_contact)
            dispatch(contactsAction.setContactActif(uuid_contact))
        }
    }, [selection, dispatch])

    if( !contacts || !show ) return ''

    return (
        <div>
            <h3>Contacts</h3>

            <Row>
                <Col xs={12} md={8} className="buttonbar-left">
                    <Button onClick={nouveauContact}><i className="fa fa-user-circle"/>{' '}Nouveau</Button>
                </Col>
                <Col xs={12} md={4} className='buttonbar-right'><AfficherCompteContacts value={compteContacts} /></Col>
            </Row>

            {contacts.length > 0?
                <ListeFichiers 
                    modeView='liste'
                    colonnes={colonnes}
                    rows={contacts} 
                    // onClick={onClick} 
                    onDoubleClick={ouvrir}
                    onContextMenu={onContextMenuCb}
                    onSelection={onSelectionLignes}
                    onClickEntete={enteteOnClickCb}
                />
                :''
            }

            <MenuContextuelAfficherListeContacts 
                contextuel={contextuel} 
                fermerContextuel={fermerContextuel}
                selection={selection}
                etatAuthentifie={etatAuthentifie}
                supprimerContacts={supprimerContacts}
            />
        </div>     
    )

}

function MenuContextuelAfficherListeContacts(props) {
    const { contextuel, selection, supprimerContacts } = props

    const workers = useWorkers(),
          etatConnexion = useEtatConnexion(),
          etatAuthentifie = useEtatAuthentifie()

    const supprimerContactsHandler = useCallback(()=>{
        supprimerContacts(selection)
    }, [selection])

    if(!contextuel.show) return ''

    return (
        <MenuContextuelListeContacts {...props} 
            workers={workers} 
            etatConnexion={etatConnexion} 
            etatAuthentifie={etatAuthentifie}
            supprimerContacts={supprimerContactsHandler} />
    )
}

function preparerColonnes() {

    const rowLoader = (item, idx) => mapContact(item, idx)
    const idMapper = row => row.uuid_contact

    const params = {
        ordreColonnes: ['nom', 'adresse', 'boutonDetail'],
        paramsColonnes: {
            'nom': {'label': 'Nom', showThumbnail: false, xs: 12, md: 4},
            'adresse': {'label': 'Adresse', className: 'details', xs: 12, md: 5},
            'boutonDetail': {label: ' ', className: 'droite', showBoutonContexte: true, xs: 4, md: 3},
        },
        tri: {colonne: 'nom', ordre: 1},
        rowLoader,
        idMapper,
    }
    return params
}

function mapContact(contact, idx) {
    const fileId = contact.uuid_contact || idx
    let adresse = null
    if(contact.adresses && contact.adresses.length > 0) {
        adresse = contact.adresses[0]
    }
    const item = {...contact, fileId, adresse}
    return item
}
