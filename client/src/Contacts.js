import { useState, useCallback, useEffect, useMemo } from 'react'
import { proxy } from 'comlink'

import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Breadcrumb from 'react-bootstrap/Breadcrumb'
import Table from 'react-bootstrap/Table'

import EditerContact from './EditerContact'

import { ListeFichiers } from '@dugrema/millegrilles.reactjs'

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
            .then( reponse => {
                console.debug("Contacts recus : %O", reponse)
                setContacts(reponse.contacts) 
            })
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

    const colonnes = useMemo(()=>preparerColonnes(), [])

    const contactsMappes = useMemo(()=>{
        if(contacts) {
            return contacts.map(item=>{
                const fileId = item.uuid_contact
                const adresse = item.adresses?item.adresses[0]:''
                return {...item, fileId, adresse}
            })
        }
        return []
    }, [contacts])

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
                rows={contactsMappes} 
                // onClick={onClick} 
                onDoubleClick={ouvrir}
                // onContextMenu={(event, value)=>onContextMenu(event, value, setContextuel)}
                onSelection={onSelectionLignes}
                // onClickEntete={enteteOnClickCb}
                // suivantCb={(!cuuidCourant||isListeComplete)?'':suivantCb}
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