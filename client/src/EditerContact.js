import { useState, useCallback, useEffect, useMemo } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import InputGroup from 'react-bootstrap/InputGroup'

const VALIDATEUR_ADRESSE = /^(@[a-zA-Z][0-9a-zA-z_.-]*[a-zA-Z-0-9]?)\/((?:(?!\d+\.|-)[a-zA-Z0-9_-]{1,63}(?<!-)\.?)+(?:[a-zA-Z]{2,}))$/

console.debug("VALIDATEUR_ADRESSE : %O", VALIDATEUR_ADRESSE)

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
    const [validated, setValidated] = useState(false)

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

        // Verifier validite adresse
        const resultat = VALIDATEUR_ADRESSE.exec(adresseEdit)
        if(!resultat) {
            setValidated(true)
            return
        }
        setValidated(false)

        const adressesLocal = [...adresses]
        if(adresseEditIdx==='') adressesLocal.push(adresseEdit)
        else adressesLocal[adresseEditIdx] = adresseEdit

        console.debug("Adresses maj : %O", adressesLocal)
        setAdresses(adressesLocal)
        setAdresseEditIdx('')
        setAdresseEdit('')
    }, [adresses, setAdresses, adresseEditIdx, setAdresseEditIdx, adresseEdit, setAdresseEdit, setValidated])
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
    
    const sauvegarderCb = useCallback(event=>{
        event.preventDefault()
        event.stopPropagation()

        setValidated(true)

        const form = event.currentTarget;
        if (form.checkValidity() === true) {
            const opts = {adresseEdit, adresseEditIdx}
            sauvegarder(workers, data, retour, opts)
        }

        setValidated(true)
    }, [workers, data, retour, adresseEdit, adresseEditIdx])

    const supprimerContactCb = useCallback(() => {
        supprimerContacts([uuid_contact])
        retour()
    }, [uuid_contact, supprimerContacts, retour])

    useEffect(()=>{
        setValidated(false)
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
    }, [contact, setValidated])

    if(!show) return ''

    return (
        <Form noValidate validated={validated} onSubmit={sauvegarderCb}>
            <h3>Editer contact</h3>

            <Form.Group controlId="nomContact">
                <Form.Label>Nom</Form.Label>
                <Form.Control
                    type="text"
                    name="nom"
                    value={nom}
                    onChange={nomChange}
                    required
                />
                <Form.Control.Feedback type="invalid">
                    Nom usager requis.
                </Form.Control.Feedback>
            </Form.Group>

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
            <Form.Group controlId="adresseEdit">
                <Form.Text className="text-muted">
                    Utiliser pour ajouter une adresse messagerie MilleGrilles. Format: @usager/domaine.com
                </Form.Text>
                <InputGroup className="mb-3" hasValidation>
                    <Form.Control
                        type="text"
                        name="adresseEdit"
                        value={adresseEdit}
                        onChange={adresseEditChange}
                        pattern={VALIDATEUR_ADRESSE.source}
                    />
                    <Button onClick={adresseSave} disabled={!adresseEdit} variant="secondary">
                        {adresseEditIdx!==''?
                            'Modifier'
                            :
                            'Ajouter'}
                    </Button>
                    <Form.Control.Feedback type="invalid">
                        Adresse invalide.
                    </Form.Control.Feedback>
                </InputGroup>
            </Form.Group>

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
                    <Button type="submit">Sauvegarder</Button>
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
        </Form>
    )
}

export default EditerContact

async function sauvegarder(workers, data, retour, opts) {
    opts = opts || {}
    console.debug("Sauvegarder %O, opts : %O", data, opts)
    try {
        const { adresseEdit, adresseEditIdx } = opts
        const { adresses } = data
        if(adresseEdit && adresseEditIdx==='') {
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
