import { useState, useEffect, useCallback } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

import { pki } from '@dugrema/node-forge'
import { FormatterDate, forgecommon } from '@dugrema/millegrilles.reactjs'

import { dechiffrerMessage } from './cles'

const { extraireExtensionsMillegrille } = forgecommon

function AfficherMessage(props) {

    const { workers, etatConnexion, uuidSelectionne, setUuidSelectionne } = props
    const [message, setMessage] = useState('')
    const [messageDechiffre, setMessageDechiffre] = useState('')

    const retour = useCallback(()=>{setUuidSelectionne('')}, [setUuidSelectionne])

    useEffect( () => { 
        if(!etatConnexion) return
        workers.connexion.getMessages({uuid_messages: [uuidSelectionne]}).then(messages=>{
            console.debug("Messages recus : %O", messages)
            setMessage(messages.messages.shift())
        })
    }, [workers, etatConnexion, setMessage])

    // Charger et dechiffrer message
    useEffect(()=>{
        if(!etatConnexion) return
        workers.connexion.getMessages({uuid_messages: [uuidSelectionne]})
            .then(messages=>{
                console.debug("Messages recus : %O", messages)
                const message = messages.messages.shift()
                setMessage(message)
                return dechiffrerMessage(workers, message)
            })
            .then(messageDechiffre=>setMessageDechiffre(messageDechiffre))
            .catch(err=>console.error("Erreur chargement message : %O", err))
    }, [workers, uuidSelectionne, setMessage, setMessageDechiffre])

    useEffect(()=>{
        if(messageDechiffre && !message.lu) {
            console.debug("Marquer message %s comme lu", message.uuid_transaction)
            marquerMessageLu(workers, message.uuid_transaction)
        }
    }, [workers, message, messageDechiffre])

    return (
        <>
            <p>Afficher message</p>
            <Button onClick={retour}>Retour</Button>

            <RenderMessage workers={workers} message={messageDechiffre} infoMessage={message} />
        </>
    )

}

export default AfficherMessage

function RenderMessage(props) {

    const { message, infoMessage } = props
    const { to, cc, from, reply_to, subject, content } = message
    const { date_reception, lu } = infoMessage

    if(!message) return ''

    console.debug("Message : %O", message)

    return (
        <>
            <p>From: {from}</p>
            <p>Reply To: {reply_to}</p>
            <p>To: {to.join('; ')}</p>
            <p>CC: {cc}</p>
            <p>Date reception : <FormatterDate value={date_reception}/></p>
            <p>Sujet: {subject}</p>
            <div>{content}</div>
        </>
    )
}

async function marquerMessageLu(workers, uuid_transaction) {
    try {
        const reponse = await workers.connexion.marquerLu(uuid_transaction, true)
        console.debug("Reponse marquer message %s lu : %O", uuid_transaction, reponse)
    } catch(err) {
        console.error("Erreur marquer message %s lu : %O", uuid_transaction, err)
    }
}