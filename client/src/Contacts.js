import { useState, useCallback, useEffect, useMemo } from 'react'
import { Provider as ReduxProvider, useDispatch, useSelector } from 'react-redux'

import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Breadcrumb from 'react-bootstrap/Breadcrumb'

import { trierString } from '@dugrema/millegrilles.utiljs/src/tri'
import { ListeFichiers, AlertTimeout } from '@dugrema/millegrilles.reactjs'

// import * as MessageDao from './redux/messageDao'
import useWorkers, {useEtatConnexion, useEtatAuthentifie, WorkerProvider, useUsager, useEtatPret} from './WorkerContext'
import contactsAction, { thunks as contactsThunks } from './redux/contactsSlice'

import EditerContact from './EditerContact'
import { MenuContextuelListeContacts, onContextMenu } from './MenuContextuel'

const PAGE_LIMIT = 200,
      SYNC_LIMIT = 1000

function Contacts(props) {

    const { setAfficherContacts, erreurCb } = props

    const workers = useWorkers()
    const etatPret = useEtatPret()
    const dispatch = useDispatch()

    const contacts = useSelector(state=>state.contacts.liste)
    const uuidContactActif = useSelector(state=>state.contacts.uuidContactActif)

    const [editerContact, setEditerContact] = useState(false)
    const [colonnes, setColonnes] = useState(preparerColonnes())

    const nouveauContact = useCallback(()=>{
        dispatch(contactsAction.setContactActif(''))
        setEditerContact(true)
    }, [])
    const retour = useCallback(()=>setAfficherContacts(false), [setAfficherContacts])
    const retourContacts = useCallback(()=>{
        dispatch(contactsAction.setContactActif(null))
        setEditerContact(false)
    }, [setEditerContact])
    
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

    // Contacts listener
    useEffect(()=>{
        const { connexion } = workers
        if(etatPret) {
            console.error("!TODO! Enregistrer evenements contacts")
            // const cb = proxy(addEvenementContact)
            // const params = {}
            // connexion.enregistrerCallbackEvenementContact(params, cb)
            //     .catch(err=>console.error("Erreur enregistrement evenements contacts : %O", err))
            // return () => connexion.retirerCallbackEvenementContact(params, cb)
            //     .catch(err=>console.debug("Erreur retrait evenements contacts : %O", err))
        }
    }, [workers, etatPret])

    // Event handling
    // useEffect(()=>{
    //     if(evenementContact && userId) {
    //         addEvenementContact('')  // Clear event pour eviter cycle d'update

    //         // console.debug("Evenement contact : %O", evenementContact)

    //         // Traiter message
    //         const routing = evenementContact.routingKey,
    //               action = routing.split('.').pop()
    //         const message = evenementContact.message

    //         if(action === 'majContact') {
    //             // Conserver information de contact
    //             const date_modification = message['en-tete'].estampille
    //             const contactMaj = {...message, user_id: userId, date_modification}
    //             delete contactMaj['en-tete']
    //             delete contactMaj['_certificat']
    //             delete contactMaj['_signature']

    //             throw new Error("fix me - redux")
    //             // MessageDao.updateContact(contactMaj)
    //             //     .catch(err=>console.error("Erreur maj contact sur evenement : %O", err))

    //             const { uuid_contact } = message
    //             let trouve = false
    //             const contactsMaj = contacts.map(item=>{
    //                 if(item.uuid_contact === uuid_contact) {
    //                     trouve = true
    //                     return message  // Remplacer contact
    //                 }
    //                 return item
    //             })
    //             if(!trouve) contactsMaj.push(contactMaj)
    //             formatterContactsCb(contactsMaj)
    //         } else if(action === 'contactsSupprimes') {
    //             const uuid_contacts = message.uuid_contacts
    //             throw new Error("fix me - redux")
    //             // MessageDao.supprimerContacts(uuid_contacts)
    //             //     .then(()=>{
    //             //         const contactsMaj = contacts.filter(item=>!uuid_contacts.includes(item.uuid_contact))
    //             //         formatterContactsCb(contactsMaj)
    //             //     })
    //             //     .catch(err=>console.error("Erreur maj contact sur evenement : %O", err))
    //         } else {
    //             console.error("Recu message contact de type inconnu : %O", evenementContact)
    //         }
    //     }
    // }, [evenementContact, contacts, userId, formatterContactsCb, addEvenementContact])

    if(!contacts) return 'todo fix chargement contacts'

    return (
        <>
            <BreadcrumbContacts 
                retourMessages={retour} 
                retourContacts={retourContacts} />

            <AfficherListeContacts 
                show={editerContact?false:true} 
                colonnes={colonnes}
                nouveauContact={nouveauContact}
                retour={retour} 
                enteteOnClickCb={enteteOnClickCb} 
                supprimerContacts={supprimerContactsCb} />

            <EditerContact 
                show={editerContact} 
                supprimerContacts={supprimerContactsCb} />

        </>
    )
}

export default Contacts

function BreadcrumbContacts(props) {

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
        setUuidContactSelectionne, 
        enteteOnClickCb, 
    } = props

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
            setUuidContactSelectionne(uuid_contact)
        }
    }, [selection, setUuidContactSelectionne])

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

            <MenuContextuelAfficherListeContacts 
                contextuel={contextuel} 
                fermerContextuel={fermerContextuel}
                selection={selection}
                etatAuthentifie={etatAuthentifie}
            />
        </div>     
    )

}

function MenuContextuelAfficherListeContacts(props) {
    const { contextuel } = props

    const workers = useWorkers(),
          etatConnexion = useEtatConnexion(),
          etatAuthentifie = useEtatAuthentifie()

    const supprimerContactCb = useCallback(event=>{
        throw new Error("supprimerContactCb Todo")
    }, [])

    if(!contextuel.show) return ''

    return (
        <MenuContextuelListeContacts {...props} 
            workers={workers} 
            etatConnexion={etatConnexion} 
            etatAuthentifie={etatAuthentifie}
            supprimerContactCb={supprimerContactCb} />
    )
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
        case 'adresse': contactsTries.sort(trierAdresses); break
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

function trierAdresses(a, b) {
    const chaine = trierNoms
    return trierString('adresse', a, b, {chaine})
}

export async function chargerContenuContacts(workers, userId) {
    // console.debug("Traiter contacts nouveaux/stale pour userId : %s", userId)
    let listeUuids = []
    {
        throw new Error("fix me - redux")
        // const uuidNouveau = await MessageDao.getUuidContactsParEtatChargement(userId, 'nouveau')
        // const uuidStale = await MessageDao.getUuidContactsParEtatChargement(userId, 'stale')
        // // console.debug("UUID nouveaux contacts : %O, stales : %O", uuidNouveau, uuidStale)

        // listeUuids = [...uuidNouveau, ...uuidStale]
    }

    const BATCH_SIZE = 2
    let batchUuids = []
    for await (let uuidContact of listeUuids) {
        batchUuids.push(uuidContact)

        if(batchUuids.length === BATCH_SIZE) {
            await chargerBatchContacts(workers, userId, batchUuids)
            batchUuids = []
        }
    }
    // Derniere batch
    if(batchUuids.length > 0) await chargerBatchContacts(workers, userId, batchUuids)

    return listeUuids
}

async function chargerBatchContacts(workers, userId, batchUuids) {
    // console.debug("Charger batch contacts %s : %O", userId, batchUuids)
    const reponse = await workers.connexion.getContacts({uuid_contacts: batchUuids, limit: batchUuids.length})
    if(!reponse.err) {
        const contacts = reponse.contacts
        // console.debug("Contacts recus : %O", contacts)
        for await (let contact of contacts) {
            throw new Error("fix me - redux")
            // await MessageDao.updateContact({...contact, '_etatChargement': 'charge'})
        }
    } else {
        throw reponse.err
    }
}

// function trierString(nomChamp, a, b, opts) {
//     opts = opts || {}

//     const nomA = a?a[nomChamp]:'',
//           nomB = b?b[nomChamp]:''
//     if(nomA === nomB) {
//         if(opts.chaine) return opts.chaine(a, b)
//         return 0
//     }
//     if(!nomA) return 1
//     if(!nomB) return -1
//     return nomA.localeCompare(nomB)
// }

// function trierNombre(nomChamp, a, b, opts) {
//     opts = opts || {}

//     const tailleA = a?a[nomChamp]:'',
//           tailleB = b?b[nomChamp]:''
//     if(tailleA === tailleB) {
//         if(opts.chaine) return opts.chaine()
//         return 0    
//     }
//     if(!tailleA) return 1
//     if(!tailleB) return -1
//     return tailleA - tailleB
// }
