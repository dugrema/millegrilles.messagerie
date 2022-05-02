import { useState, useEffect, useCallback } from 'react'
import Breadcrumb from 'react-bootstrap/Breadcrumb'

import { pki } from '@dugrema/node-forge'
import { trierString, trierNombre } from '@dugrema/millegrilles.utiljs/src/tri'
import { FormatterDate, forgecommon } from '@dugrema/millegrilles.reactjs'

import { dechiffrerMessage } from './cles'
import ListeMessages from './Reception'

const { extraireExtensionsMillegrille } = forgecommon

const PAGE_LIMIT = 20

function Accueil(props) {

    const { 
        workers, etatConnexion, etatAuthentifie, usager, downloadAction, setUuidSelectionne,
        colonnes, setColonnes, listeMessages, isListeComplete,
     } = props

    // const [listeMessages, setListeMessages] = useState([])
    // const [colonnes, setColonnes] = useState('')
    // const [isListeComplete, setListeComplete] = useState(false)
    // const [evenementMessage, addEvenementMessage] = useState('')

    // const formatterMessagesCb = useCallback(messages=>formatterMessages(messages, colonnes, setListeMessages), [colonnes, setListeMessages])

    const ouvrirMessage = useCallback(event=>{
        let uuidMessage = event
        if(event.currentTarget) uuidMessage = event.currentTarget.value
        // console.debug("Ouvrir message : %O", uuidMessage)
        setUuidSelectionne(uuidMessage)
    }, [setUuidSelectionne])

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

    // useEffect(()=>{
    //     if(workers) setColonnes(preparerColonnes(workers))
    // }, [workers, setColonnes])

    // // Charger liste initiale
    // useEffect(()=>{
    //     if(!workers || !etatConnexion || !etatAuthentifie) return

    //     if(colonnes) {
    //         const { colonne, ordre } = colonnes.tri
    //         workers.connexion.getMessages({colonne, ordre, limit: PAGE_LIMIT})
    //             .then( reponse => {
    //                 console.debug("Messages recus : %O", reponse)
    //                 const liste = reponse.messages
    //                 setListeComplete(liste.length < PAGE_LIMIT)
    //                 formatterMessagesCb(liste) 
    //             })
    //             .catch(err=>console.error("Erreur chargement contacts : %O", err))
    //     }
    // }, [workers, etatConnexion, etatAuthentifie, colonnes, formatterMessagesCb, setListeComplete])

    return (
        <>
            <BreadcrumbMessages />

            <ListeMessages 
                workers={workers} 
                messages={listeMessages} 
                colonnes={colonnes}
                isListeComplete={isListeComplete}
                ouvrirMessage={ouvrirMessage} 
                enteteOnClickCb={enteteOnClickCb} />
        </>
    )

}

export default Accueil

function BreadcrumbMessages(props) {
    return (
        <Breadcrumb>
            <Breadcrumb.Item active>Messages</Breadcrumb.Item>
        </Breadcrumb>
    )
}

// function preparerColonnes(workers) {

//     const params = {
//         ordreColonnes: ['date_reception', 'from', 'subject', 'boutonDetail'],
//         paramsColonnes: {
//             'date_reception': {'label': 'Date', formatteur: FormatterDate, xs: 6, md: 3, lg: 2},
//             'from': {'label': 'Auteur', xs: 6, md: 4, lg: 4},
//             'subject': {'label': 'Sujet', xs: 10, md: 4, lg: 5},
//             'boutonDetail': {label: ' ', className: 'droite', showBoutonContexte: true, xs: 2, md: 1, lg: 1},
//         },
//         tri: {colonne: 'date_reception', ordre: -1},
//         // rowLoader: data => dechiffrerMessage(workers, data)
//         rowLoader: async data => {
//             console.debug("Row loader : %O", data)
//             // return data
//             const messageDechiffre = await dechiffrerMessage(workers, data)
//             console.debug("Message dechiffre : %O", messageDechiffre)
//             return {...data, ...messageDechiffre}
//         }
//     }

//     return params
// }

// function formatterMessages(messages, colonnes, setMessagesFormattes) {
//     // console.debug("formatterContacts colonnes: %O", colonnes)
//     const {colonne, ordre} = colonnes.tri
//     // let contactsTries = [...contacts]

//     let messagesTries = messages.map(item=>{
//         const certificat = item.certificat_message
//         let from = ''
//         if(certificat) {
//             const cert = pki.certificateFromPem(certificat)
//             const extensions = extraireExtensionsMillegrille(cert)
//             from = cert.subject.getField('CN').value
//         }

//         const fileId = item.uuid_transaction
//         // const adresse = item.adresses?item.adresses[0]:''
//         return {...item, fileId, from}
//     })

//     // console.debug("Contacts a trier : %O", contactsTries)

//     switch(colonne) {
//         case 'from': messagesTries.sort(trierFrom); break
//         case 'subject': messagesTries.sort(trierSubject); break
//         default: messagesTries.sort(trierDate)
//     }

//     if(ordre < 0) messagesTries = messagesTries.reverse()

//     setMessagesFormattes(messagesTries)
// }

// function trierDate(a, b) {
//     return trierNombre('date_reception', a, b)
// }

// function trierSubject(a, b) {
//     return trierString('subject', a, b, {chaine: trierDate})
// }

// function trierFrom(a, b) {
//     return trierString('from', a, b, {chaine: trierDate})
// }

// const { lu, date_reception, uuid_transaction, certificat_message } = message

// const [messageDechiffre, setMessageDechiffre] = useState('')
// const [auteur, setAuteur] = useState('')

// useEffect(()=>{
//     const cert = pki.certificateFromPem(message.certificat_message)
//     const extensions = extraireExtensionsMillegrille(cert)
//     const cn = cert.subject.getField('CN').value
//     // console.debug("CN: %O, extensions: %O", cn, extensions)
//     setAuteur(cn)

//     dechiffrerMessage(workers, message)
//         .then(messageDechiffre1=>{
//             // console.debug("Message dechiffre 1 %O", messageDechiffre1)
//             setMessageDechiffre(messageDechiffre1)
//         })
//         .catch(err=>console.error("Erreur dechiffrage message1 : %O", err))
// }, [message, setMessageDechiffre, setAuteur])
