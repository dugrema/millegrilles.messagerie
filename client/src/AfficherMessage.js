import { useState, useEffect } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

import { pki } from '@dugrema/node-forge'
import { FormatterDate, forgecommon } from '@dugrema/millegrilles.reactjs'

import { dechiffrerMessage } from './cles'

const { extraireExtensionsMillegrille } = forgecommon

function AfficherMessage(props) {

    const { workers, message } = props
    const [messageDechiffre, setMessageDechiffre] = useState('')

    useEffect(()=>{
        dechiffrerMessage(workers, message)
            .then(messageDechiffre=>{
                setMessageDechiffre(messageDechiffre)
            })
            .catch(err=>console.error("Erreur dechiffrage message : %O", err))
    }, [workers, message, setMessageDechiffre])

    return (
        <>
            <p>Afficher message</p>
            <Button onClick={props.retour}>Retour</Button>

            <RenderMessage workers={workers} message={messageDechiffre} />
        </>
    )

}

export default AfficherMessage

function RenderMessage(props) {

    const { message } = props
    const { to, cc, from, reply_to, subject, content } = message

    if(!message) return ''

    return (
        <>
            <p>From: {from}</p>
            <p>To: {to.join('; ')}</p>
            <p>CC: {cc}</p>
            <p>Sujet: {subject}</p>
            <div>{content}</div>
        </>
    )
}