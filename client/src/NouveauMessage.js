import { useState, useEffect, useCallback } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'

import { posterMessage } from './messageUtils'
import { chargerProfilUsager } from './profil'

function NouveauMessage(props) {

    const { workers, setAfficherNouveauMessage, certificatMaitreDesCles, usager, dnsMessagerie } = props

    const [to, setTo] = useState('')
    const [cc, setCc] = useState('')
    const [bcc, setBcc] = useState('')
    const [subject, setSubject] = useState('')
    const [content, setContent] = useState('')

    const envoyerCb = useCallback(()=>{
        envoyer(workers, certificatMaitreDesCles, to, subject, content, {cc, bcc})
    }, [workers, certificatMaitreDesCles, to, cc, bcc, subject, content])
    const annuler = useCallback(()=>{
        setAfficherNouveauMessage(false)
    }, [setAfficherNouveauMessage])

    const toChange = useCallback(event=>setTo(event.currentTarget.value), [setTo])
    const ccChange = useCallback(event=>setCc(event.currentTarget.value), [setCc])
    const bccChange = useCallback(event=>setBcc(event.currentTarget.value), [setBcc])
    const subjectChange = useCallback(event=>setSubject(event.currentTarget.value), [setSubject])
    const contentChange = useCallback(event=>setContent(event.currentTarget.value), [setContent])

    useEffect(()=>{
        chargerProfilUsager(workers, {usager, dnsMessagerie})
            .then( profil => {
                console.debug("Profil recu : %O", profil)
            })
            .catch(err=>console.error("Erreur chargement profil : %O", err))
    }, [workers])

    return (
        <>
            <p>Nouveau message</p>

            <Form.Label htmlFor="inputTo">To</Form.Label>
            <Form.Control
                type="text"
                id="inputTo"
                name="to"
                value={to}
                onChange={toChange}
            />

            <Form.Label htmlFor="inputCc">Cc</Form.Label>
            <Form.Control
                type="text"
                id="inputCc"
                name="cc"
                value={cc}
                onChange={ccChange}
            />

            <Form.Label htmlFor="inputBcc">Bcc</Form.Label>
            <Form.Control
                type="text"
                id="inputBcc"
                name="bcc"
                value={bcc}
                onChange={bccChange}
            />

            <Form.Label htmlFor="inputSubject">Sujet</Form.Label>
            <Form.Control
                type="text"
                id="inputSubject"
                name="subject"
                value={subject}
                onChange={subjectChange}
            />
            
            <Form.Group controlId="inputContent">
                <Form.Label htmlFor="inputContent">Message</Form.Label>
                <Form.Control 
                    as="textarea" 
                    name="content"
                    value={content}
                    onChange={contentChange}
                    rows={15} />
            </Form.Group>

            <Button onClick={envoyerCb}>Envoyer</Button>
            <Button variant="secondary" onClick={annuler}>Annuler</Button>
        </>
    )

}

export default NouveauMessage

async function envoyer(workers, certificatChiffragePem, to, subject, content, opts) {
    opts = opts || {}
    const resultat = await posterMessage(workers, certificatChiffragePem, to, subject, content, opts)
    console.debug("Resultat posterMessage : %O", resultat)
}
