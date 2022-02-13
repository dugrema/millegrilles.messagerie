import { useState, useEffect, useCallback } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'

import { posterMessage } from './messageUtils'
import { chargerProfilUsager } from './profil'

import ModalContacts from './ModalContacts'

function NouveauMessage(props) {

    const { workers, setAfficherNouveauMessage, certificatMaitreDesCles, usager, dnsMessagerie } = props

    const [to, setTo] = useState('')
    const [cc, setCc] = useState('')
    const [bcc, setBcc] = useState('')
    const [subject, setSubject] = useState('')
    const [content, setContent] = useState('')
    const [profil, setProfil] = useState('')
    const [replyTo, setReplyTo] = useState('')
    const [from, setFrom] = useState('')
    const [showContacts, setShowContacts] = useState(false)

    const envoyerCb = useCallback(()=>{
        envoyer(workers, certificatMaitreDesCles, from, to, subject, content, {cc, bcc, reply_to: replyTo})
    }, [workers, certificatMaitreDesCles, from, to, cc, bcc, replyTo, subject, content])
    const annuler = useCallback(()=>{
        setAfficherNouveauMessage(false)
    }, [setAfficherNouveauMessage])

    const toChange = useCallback(event=>setTo(event.currentTarget.value), [setTo])
    const ccChange = useCallback(event=>setCc(event.currentTarget.value), [setCc])
    const bccChange = useCallback(event=>setBcc(event.currentTarget.value), [setBcc])
    const subjectChange = useCallback(event=>setSubject(event.currentTarget.value), [setSubject])
    const contentChange = useCallback(event=>setContent(event.currentTarget.value), [setContent])
    const replyToChange = useCallback(event=>setReplyTo(event.currentTarget.value), [setReplyTo])
    const fermerContacts = useCallback(event=>setShowContacts(false), [setShowContacts])
    const choisirContacts = useCallback(event=>setShowContacts(true), [setShowContacts])

    const ajouterTo = useCallback(adresses=>{
        if(!adresses) return
        let adressesStr = adresses.map(item=>item.adresses[0]).join('; ')
        if(to) adressesStr = to + '; ' + adressesStr
        setTo(adressesStr)
    }, [to, setTo])

    useEffect(()=>{
        const from = `@${usager.nomUsager}/${dnsMessagerie}`
        setFrom(from)

        chargerProfilUsager(workers, {usager, dnsMessagerie})
            .then( profil => {
                console.debug("Profil recu : %O", profil)
                setProfil(profil)
                const replyTo = profil.adresses?profil.adresses[0]:''
                setReplyTo(replyTo)
            })
            .catch(err=>console.error("Erreur chargement profil : %O", err))
    }, [workers, usager, dnsMessagerie, setProfil, setReplyTo])

    return (
        <>
            <p>Nouveau message</p>

            <Form.Label htmlFor="replyTo">Reply to</Form.Label>
            <Form.Control
                type="text"
                id="replyTo"
                name="to"
                value={replyTo}
                onChange={replyToChange}
            />

            <Form.Label htmlFor="inputTo">To</Form.Label>
            <Form.Control
                type="text"
                id="inputTo"
                name="to"
                value={to}
                onChange={toChange}
            />
            <Button onClick={choisirContacts}>Contacts</Button>
            <p></p>

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
            
            <Form.Group>
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

            <ModalContacts show={showContacts} workers={workers} fermer={fermerContacts} ajouterAdresses={ajouterTo} />
        </>
    )

}

export default NouveauMessage

async function envoyer(workers, certificatChiffragePem, from, to, subject, content, opts) {
    opts = opts || {}
    const resultat = await posterMessage(workers, certificatChiffragePem, from, to, subject, content, opts)
    console.debug("Resultat posterMessage : %O", resultat)
}
