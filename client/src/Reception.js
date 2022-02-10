import { useState, useEffect } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

import { pki } from '@dugrema/node-forge'
import { FormatterDate, forgecommon } from '@dugrema/millegrilles.reactjs'
import { dechiffrerMessage } from './cles'
const { extraireExtensionsMillegrille } = forgecommon

function ListeMessages(props) {

    // console.debug("ListeMessages proppys : %O", props)

    const { messages, workers } = props
    if(!messages) return ''

    return (
        <>
            <h2>Reception</h2>

            <Row>
                <Col>Date Reception</Col>
                <Col>Auteur</Col>
                <Col>Sujet</Col>
                <Col>Actions</Col>
            </Row>

            {messages.map(item=>{
                return <LigneMessage 
                    key={item.uuid_transaction} 
                    workers={workers} 
                    message={item} 
                    ouvrirMessage={props.ouvrirMessage} />
            })}
        </>
    )

}

export default ListeMessages

function LigneMessage(props) {
    // console.debug("LigneMessage Proppys : %O", props)
    const { message, workers } = props

    const { lu, date_reception, uuid_transaction, certificat_message } = message

    const [messageDechiffre, setMessageDechiffre] = useState('')
    const [auteur, setAuteur] = useState('')

    useEffect(()=>{
        const cert = pki.certificateFromPem(message.certificat_message)
        const extensions = extraireExtensionsMillegrille(cert)
        const cn = cert.subject.getField('CN').value
        // console.debug("CN: %O, extensions: %O", cn, extensions)
        setAuteur(cn)

        dechiffrerMessage(workers, message)
            .then(messageDechiffre1=>{
                console.debug("Message dechiffre 1 %O", messageDechiffre1)
                setMessageDechiffre(messageDechiffre1)
            })
            .catch(err=>console.error("Erreur dechiffrage message1 : %O", err))
    }, [message, setMessageDechiffre, setAuteur])

    let className = ''
    if(!lu) className += ' nouveau'

    let champAuteur = '@' + auteur
    if(messageDechiffre && messageDechiffre.from) {
        champAuteur = messageDechiffre.from
    }

    return (
        <Row className={className}>
            <Col><FormatterDate value={date_reception}/></Col>
            <Col>{champAuteur}</Col>
            <Col>{messageDechiffre.subject}</Col>
            <Col>
                <Button onClick={props.ouvrirMessage} value={uuid_transaction}>Ouvrir</Button>
            </Col>
        </Row>
    )
}

// async function chargerClesMessages(workers, listeMessages) {
//     const { connexion, chiffrage } = workers

//     if(!listeMessages || listeMessages.length === 0) return  // Rien a faire

//     const uuidMessages = listeMessages.map(item=>item.uuid_transaction)
//     const reponseCles = await connexion.getPermissionMessages(uuidMessages)
//     const cles = reponseCles.cles
//     // console.debug("Reponse permission dechiffrage messages : %O", reponseCles)

//     const messagesDechiffres = []
//     for(let idx=0; idx<listeMessages.length; idx++) {
//         const message = listeMessages[idx]
//         // console.debug("Dechiffrer message : %O", message)
//         const {uuid_transaction, hachage_bytes, message_chiffre} = message
//         const cle = cles[hachage_bytes]
//         // Dechiffrer cle asymmetrique
//         const cleDechiffree = await chiffrage.dechiffrerCleSecrete(cle.cle)
//         // const cleDechiffrerBuffer = Buffer.from(cleDechiffree, 'binary').buffer
//         console.debug("Cle secrete dechiffree : %O", cleDechiffree)
//         const messageDechiffre = await chiffrage.chiffrage.dechiffrer(message_chiffre, cleDechiffree, cle.iv, cle.tag, {DEBUG: false})

//         // const messageDechiffre = await chiffrage.chiffrage.testDecipher(message_chiffre, cleDechiffree, cle.iv, {tag: cle.tag})
//         const messageTexte = JSON.parse(new TextDecoder().decode(messageDechiffre))
//         // console.debug("Message texte : %O", messageTexte)
//         // console.debug("Dechiffrage du message")
//         // const messageDechiffre = await decipher.update(message_chiffre)
//         // console.debug("Message dechiffre : %O", messageDechiffre)

//         // Verification du certificat du message
//         const dateMessage = new Date(messageTexte['en-tete'].estampille*1000)
//         // console.debug("Date message : %O", dateMessage)
//         const certificatVerifie = await chiffrage.validerCertificat(message.certificat_message, dateMessage)
//         if(certificatVerifie === true) {
//             // console.debug("Certificat verifie: %O", certificatVerifie)
//             const messageValide = await chiffrage.verifierMessage({_certificat: message.certificat_message, ...messageTexte})
//             if(messageValide === true) {
//                 // console.debug("Message valide : %O", messageValide)
//                 messagesDechiffres.push({...message, dechiffre: messageTexte})
//             } else {
//                 console.warn("Message invalide : %O", messageTexte)
//             }
//         } else {
//             console.warn("Certificat invalide pour message %O", messageTexte)
//         }
//     }

//     return messagesDechiffres
// }