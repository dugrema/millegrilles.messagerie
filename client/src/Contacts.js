import { useState, useCallback, useEffect, useMemo } from 'react'
import { proxy } from 'comlink'

import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Breadcrumb from 'react-bootstrap/Breadcrumb'
import Table from 'react-bootstrap/Table'

import EditerContact from './EditerContact'

import { trierString } from '@dugrema/millegrilles.utiljs/src/tri'
import { ListeFichiers } from '@dugrema/millegrilles.reactjs'

const PAGE_LIMIT = 20

function Contacts(props) {

    const { workers, etatAuthentifie, usager, setAfficherContacts } = props

    const [colonnes, setColonnes] = useState(preparerColonnes())
    const [contacts, setContacts] = useState('')
    const [uuidContactSelectionne, setUuidContactSelectionne] = useState('')
    const [evenementContact, addEvenementContact] = useState('')
    const [isListeComplete, setListeComplete] = useState(false)

    const nouveauContact = useCallback(()=>setUuidContactSelectionne(true), [setUuidContactSelectionne])
    const retour = useCallback(()=>setAfficherContacts(false), [setAfficherContacts])
    const retourContacts = useCallback(()=>setUuidContactSelectionne(false), [setUuidContactSelectionne])
    const formatterContactsCb = useCallback(contacts=>formatterContacts(contacts, colonnes, setContacts), [colonnes, setContacts])
    
    const getContactsSuivants = useCallback(()=>{
        const { colonne, ordre } = colonnes.tri
        workers.connexion.getContacts({colonne, ordre, skip: contacts.length, limit: PAGE_LIMIT})
            .then( reponse => {
                console.debug("Contacts suivant recus : %O", reponse)
                formatterContactsCb([...contacts, ...reponse.contacts]) 
                setListeComplete(reponse.contacts.length === 0)
            })
            .catch(err=>console.error("Erreur chargement contacts : %O", err))
    }, [colonnes, contacts], formatterContactsCb, setListeComplete)

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

    let contactSelectionne = ''
    if(contacts && contacts.length > 0 && uuidContactSelectionne) {
        contactSelectionne = contacts.filter(item=>item.uuid_contact===uuidContactSelectionne).shift()
    }

    useEffect(()=>{
        if(colonnes) {
            const { colonne, ordre } = colonnes.tri
            workers.connexion.getContacts({colonne, ordre, limit: PAGE_LIMIT})
                .then( reponse => {
                    // console.debug("Contacts recus : %O", reponse)
                    setListeComplete(reponse.contacts.length < PAGE_LIMIT)
                    formatterContactsCb(reponse.contacts) 
                })
                .catch(err=>console.error("Erreur chargement contacts : %O", err))
        }
    }, [colonnes, formatterContactsCb, setListeComplete])

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
        if(evenementContact) {
            addEvenementContact('')  // Clear event pour eviter cycle d'update

            console.debug("Evenement contact : %O", evenementContact)

            // Traiter message
            const message = evenementContact.message
            const { uuid_contact } = message
            let trouve = false
            const contactsMaj = contacts.map(item=>{
                if(item.uuid_contact === uuid_contact) {
                    trouve = true
                    return message  // Remplacer contact
                }
                return item
            })
            if(!trouve) contactsMaj.push(message)

            formatterContactsCb(contactsMaj)
        }
    }, [evenementContact, contacts, formatterContactsCb, addEvenementContact])

    return (
        <>
            <BreadcrumbContacts 
                uuidContactSelectionne={uuidContactSelectionne} 
                contacts={contacts}
                retourMessages={retour} 
                retourContacts={retourContacts} />

            <AfficherListeContacts 
                show={uuidContactSelectionne?false:true} 
                colonnes={colonnes}
                contacts={contacts} 
                nouveauContact={nouveauContact}
                retour={retour} 
                setUuidContactSelectionne={setUuidContactSelectionne} 
                getContactsSuivants={getContactsSuivants}
                isListeComplete={isListeComplete} 
                enteteOnClickCb={enteteOnClickCb} />

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
    const { 
        nouveauContact, retour, contacts, colonnes, show, 
        setUuidContactSelectionne, getContactsSuivants, isListeComplete, 
        enteteOnClickCb,
    } = props

    const [selection, setSelection] = useState('')
    const onSelectionLignes = useCallback(selection=>{setSelection(selection)}, [setSelection])

    const ouvrir = useCallback(event=>{
        event.preventDefault()
        event.stopPropagation()

        console.debug("Ouvrir event : %O, selection: %O", event, selection)
        if(selection.length > 0) {
            const uuid_contact = selection[0]
            setUuidContactSelectionne(uuid_contact)
        }
    }, [selection, setUuidContactSelectionne])

    // const contactsMappes = useMemo(()=>{
    //     if(contacts) {
    //         return contacts.map(item=>{
    //             const fileId = item.uuid_contact
    //             const adresse = item.adresses?item.adresses[0]:''
    //             return {...item, fileId, adresse}
    //         })
    //     }
    //     return []
    // }, [contacts])

    if( !contacts || !show ) return ''

    return (
        <div>
            <Row>
                <Col>
                    <Button variant="secondary" onClick={nouveauContact}><i className="fa fa-user-circle"/>{' '}Nouveau</Button>
                </Col>
            </Row>

            <h3>Contacts</h3>
            <ListeFichiers 
                modeView='liste'
                colonnes={colonnes}
                rows={contacts} 
                // onClick={onClick} 
                onDoubleClick={ouvrir}
                // onContextMenu={(event, value)=>onContextMenu(event, value, setContextuel)}
                onSelection={onSelectionLignes}
                onClickEntete={enteteOnClickCb}
                suivantCb={isListeComplete?'':getContactsSuivants}
            />
        </div>     
    )

    // return (
    //     <>
    //         <Row>
    //             <Col>
    //                 <Button variant="secondary" onClick={nouveauContact}><i className="fa fa-user-circle"/>{' '}Nouveau</Button>
    //             </Col>
    //         </Row>

    //         <Row className="liste-header">
    //             <Col xs={5} md={4}>Nom</Col>
    //             <Col xs={7} md={5}>Adresse</Col>
    //         </Row>

    //         <div className="liste">
    //             {contacts.map( (item, idx) => {
    //                 const className = idx%2===0?'even':'odd'
    //                 return <AfficherContactRow key={item.uuid_contact} className={className} value={item} ouvrir={ouvrir} />
    //             })}
    //         </div>
    //     </>
    // )
}

// function AfficherContactRow(props) {
//     const { ouvrir } = props
//     const className = props.className || ''
//     const { nom, adresses, uuid_contact } = props.value
//     const adresse = [...adresses].shift()

//     return (
//         <Row onClick={ouvrir} data-uuid={uuid_contact} className={className + " liste-row clickable"}>
//             <Col xs={12} md={4}>{nom}</Col>
//             <Col xs={12} md={5}>{adresse}</Col>
//             <Col className='buttonbar-right'>
//                 <Button onClick={ouvrir} value={uuid_contact} size="sm" variant="secondary">Ouvrir</Button>
//             </Col>
//         </Row>
//     )
// }

function preparerColonnes() {

    const params = {
        ordreColonnes: ['nom', 'adresse', 'boutonDetail'],
        paramsColonnes: {
            'nom': {'label': 'Nom', showThumbnail: false, xs: 12, md: 4},
            'adresse': {'label': 'Adresse', className: 'details', xs: 12, md: 5},
            'boutonDetail': {label: ' ', className: 'details', showBoutonContexte: true, xs: 4, md: 3},
        },
        tri: {colonne: 'nom', ordre: 1},
    }
    return params
}

function formatterContacts(contacts, colonnes, setContacts) {
    // console.debug("formatterContacts colonnes: %O", colonnes)
    const {colonne, ordre} = colonnes.tri
    // let contactsTries = [...contacts]

    let contactsTries = contacts.map(item=>{
        const fileId = item.uuid_contact
        const adresse = item.adresses?item.adresses[0]:''
        return {...item, fileId, adresse}
    })

    // console.debug("Contacts a trier : %O", contactsTries)

    switch(colonne) {
        case 'adresse': contactsTries.sort(trierAdresses); break
        default: contactsTries.sort(trierNoms)
    }

    if(ordre < 0) contactsTries = contactsTries.reverse()

    setContacts(contactsTries)
}

function trierNoms(a, b) {
    return trierString('nom', a, b)
}

function trierAdresses(a, b) {
    const chaine = trierNoms
    return trierString('adresse', a, b, {chaine})
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
