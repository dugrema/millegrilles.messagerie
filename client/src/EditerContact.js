import { useState, useCallback, useEffect } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

function EditerContact(props) {

    const { workers, show, setUuidContactSelectionne, contact } = props
    const uuid_contact = contact?contact.uuid_contact:''

    // Champs data
    const [nom, setNom] = useState('')
    const [adresseEdit, setAdresseEdit] = useState('')
    const [adresseEditIdx, setAdresseEditIdx] = useState('')
    const [adresses, setAdresses] = useState([])
    const [blocked, setBlocked] = useState(false)
    const [trusted, setTrusted] = useState(false)
    const data = {uuid_contact, nom, adresses, blocked, trusted}

    const nomChange = useCallback(event=>setNom(event.currentTarget.value), [setNom])
    const adresseEditChange = useCallback(event=>setAdresseEdit(event.currentTarget.value), [setAdresseEdit])
    const adresseEditCb = useCallback(event=>{
        const idxEdit = Number.parseInt(event.currentTarget.value)
        setAdresseEdit(adresses[idxEdit])
        setAdresseEditIdx(idxEdit)
    }, [adresses, setAdresseEdit, setAdresseEditIdx])
    const adresseSave = useCallback(event=>{
        console.debug("Save adresse (idx: %O)", adresseEditIdx)
        const adressesLocal = [...adresses]
        if(adresseEditIdx==='') adressesLocal.push(adresseEdit)
        else adressesLocal[adresseEditIdx] = adresseEdit

        console.debug("Adresses maj : %O", adressesLocal)
        setAdresses(adressesLocal)
        setAdresseEditIdx('')
        setAdresseEdit('')
    }, [adresses, setAdresses, adresseEditIdx, setAdresseEditIdx, adresseEdit, setAdresseEdit])
    const adresseSupprimer = useCallback(event=>{
        const idxSupprimer = Number.parseInt(event.currentTarget.value)
        const adressesMaj = [...adresses].filter((item,idx)=>idx!==idxSupprimer)
        setAdresses(adressesMaj)
    }, [adresses, setAdresses])

    const blockedChange = useCallback(event=>{
        const valeur = event.currentTarget.checked
        console.debug("BlockedChange valeur : %O", valeur)
        setBlocked(valeur)
        if(valeur) setTrusted(false)
    }, [setBlocked, setTrusted])

    const trustedChange = useCallback(event=>{
        const valeur = event.currentTarget.checked
        console.debug("TrustedChange valeur : %O", valeur)
        setTrusted(valeur)
    }, [setTrusted])

    const retour = useCallback(()=>setUuidContactSelectionne(''), [setUuidContactSelectionne])
    const sauvegarderCb = useCallback(()=>sauvegarder(workers, data, retour), [workers, data, retour])

    useEffect(()=>{
        if(contact) {
            setNom(contact.nom || '')
            setAdresseEdit('')
            setAdresseEditIdx('')
            setAdresses(contact.adresses || [])
            setBlocked(contact.blocked===true?true:false)
            setTrusted(contact.trusted===true?true:false)
        } else {
            // Reset (nouveau contact)
            setNom('')
            setAdresseEdit('')
            setAdresseEditIdx('')
            setAdresses([])
            setBlocked(false)
            setTrusted(false)
        }
    }, [contact])

    if(!show) return ''

    return (
        <>
            <p>Editer contact</p>

            <Form.Label htmlFor="nomContact">Nom</Form.Label>
            <Form.Control
                type="text"
                id="nomContact"
                name="nom"
                value={nom}
                onChange={nomChange}
            />

            <Form.Label htmlFor="adresseEdit">Adresses</Form.Label>
            <Form.Control
                type="text"
                id="adresseEdit"
                name="adresseEdit"
                value={adresseEdit}
                onChange={adresseEditChange}
            />
            <Button onClick={adresseSave} disabled={!adresseEdit}>{adresseEditIdx!==''?'Modifier':'Ajouter'}</Button>
            {adresses.map((item, idx)=>{
                return (
                    <Row key={idx}>
                        <Col>
                            {item}
                        </Col>
                        <Col>
                            <Button onClick={adresseEditCb} value={idx}>Edit</Button>
                            <Button onClick={adresseSupprimer} value={idx}>Supprimer</Button>
                        </Col>
                    </Row>
                )
            })}

            <Row>
                <Col>Bloquer ce contact</Col>
                <Col>
                    <Form.Check 
                        type="switch"
                        id="blocked-switch"
                        label="Blocked"
                        variant="danger"
                        checked={blocked}
                        onChange={blockedChange}
                    />
                </Col>
            </Row>

            <Row>
                <Col>Marquer comme contact trusted</Col>
                <Col>
                    <Form.Check 
                        type="switch"
                        id="trusted-switch"
                        label="Trusted"
                        disabled={blocked}
                        checked={trusted}
                        onChange={trustedChange}
                    />
                </Col>
            </Row>

            <Row>
                <Col>
                    <Button onClick={sauvegarderCb}>Sauvegarder</Button>
                    <Button variant="secondary" onClick={retour}>Annuler</Button>
                </Col>
            </Row>
            
        </>
    )
}

export default EditerContact

async function sauvegarder(workers, data, retour) {
    console.debug("Sauvegarder %O", data)
    try {
        const reponse = await workers.connexion.majContact(data)
        console.debug("Reponse sauvegarder contact : %O", reponse)
        retour()
    } catch(err) {
        console.error("Erreur maj contact : %O", err)
    }
}
