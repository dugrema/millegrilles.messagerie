import { useState, useCallback, useEffect, useMemo } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import InputGroup from 'react-bootstrap/InputGroup'

function EditerContact(props) {

    const { workers, show, setUuidContactSelectionne, contact, supprimerContacts } = props
    const uuid_contact = contact?contact.uuid_contact:''

    // Champs data
    const [nom, setNom] = useState('')
    const [adresseEdit, setAdresseEdit] = useState('')
    const [adresseEditIdx, setAdresseEditIdx] = useState('')
    const [adresses, setAdresses] = useState([])
    const [blocked, setBlocked] = useState(false)
    const [trusted, setTrusted] = useState(false)
    const data = useMemo(()=>{
        return {uuid_contact, nom, adresses, blocked, trusted}
    }, [uuid_contact, nom, adresses, blocked, trusted])

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
    const sauvegarderCb = useCallback(()=>{
        const opts = {adresseEdit, adresseEditIdx}
        sauvegarder(workers, data, retour, opts)
    }, [workers, data, retour, adresseEdit, adresseEditIdx])

    const supprimerContactCb = useCallback(() => {
        supprimerContacts([uuid_contact])
        retour()
    }, [uuid_contact, supprimerContacts, retour])

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
            <h3>Editer contact</h3>

            <Form.Label htmlFor="nomContact">Nom</Form.Label>
            <Form.Control
                type="text"
                id="nomContact"
                name="nom"
                value={nom}
                onChange={nomChange}
            />

            <Form.Label htmlFor="adresseEdit">Adresses</Form.Label>
            {adresses.map((item, idx)=>{
                return (
                    <Row key={idx}>
                        <Col xs={4} md={3} lg={2}>
                            <Button onClick={adresseEditCb} value={idx} size="sm" variant="secondary" disabled={adresseEditIdx!==''?true:false}>Edit</Button>
                            <Button onClick={adresseSupprimer} value={idx} size="sm" variant="secondary">Supprimer</Button>
                        </Col>
                        <Col>
                            {item}
                        </Col>
                    </Row>
                )
            })}
            <br/>
            <Form.Text className="text-muted">
                Utiliser pour ajouter une adresse messagerie MilleGrilles. Format: @usager/domaine.com
            </Form.Text>
            <InputGroup className="mb-3">
                <Form.Control
                    type="text"
                    id="adresseEdit"
                    name="adresseEdit"
                    value={adresseEdit}
                    onChange={adresseEditChange}
                />
                <Button onClick={adresseSave} disabled={!adresseEdit} variant="secondary">
                    {adresseEditIdx!==''?
                        'Modifier'
                        :
                        'Ajouter'}
                </Button>
            </InputGroup>

            <br/>

            <Row>
                <Col>
                    <Form.Check 
                        type="switch"
                        id="trusted-switch"
                        label="Marquer comme contact de confiance"
                        disabled={blocked}
                        checked={trusted}
                        onChange={trustedChange}
                    />
                </Col>
            </Row>
            <Row>
                <Col>
                    <Form.Check 
                        type="switch"
                        id="blocked-switch"
                        label="Bloquer ce contact"
                        variant="danger"
                        checked={blocked}
                        onChange={blockedChange}
                    />
                </Col>
            </Row>

            <br/>

            <Row className="buttonbar">
                <Col>
                    <Button onClick={sauvegarderCb}>Sauvegarder</Button>
                    <Button variant="secondary" onClick={retour}>Annuler</Button>
                </Col>
            </Row>
            
            <br />

            <hr />

            <p>Actions sur le contact.</p>

            <Row>
                <Col>
                    <Button onClick={supprimerContactCb} variant="danger">Supprimer</Button>
                </Col>
            </Row>
        </>
    )
}

export default EditerContact

async function sauvegarder(workers, data, retour, opts) {
    opts = opts || {}
    console.debug("Sauvegarder %O, opts : %O", data, opts)
    try {
        const { adresseEdit, adresseEditIdx } = opts
        const { adresses } = data
        if(adresseEdit && adresseEditIdx===undefined) {
            // // Pousser l'adresse editee dans la liste des adresses
            // if(adresseEditIdx!==undefined) {
            //     adresses[adresseEditIdx] = adresseEdit
            // } else {
                adresses.push(adresseEdit)
            // }
        }

        const reponse = await workers.connexion.majContact(data)
        console.debug("Reponse sauvegarder contact : %O", reponse)
        retour()
    } catch(err) {
        console.error("Erreur maj contact : %O", err)
    }
}
