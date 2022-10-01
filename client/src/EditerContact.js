import { useState, useCallback, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import InputGroup from 'react-bootstrap/InputGroup'

import useWorkers, {useEtatConnexion, useUsager} from './WorkerContext'

const VALIDATEUR_ADRESSE = /^(@[a-zA-Z][0-9a-zA-z_.-]*[a-zA-Z-0-9]?):(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/
//const VALIDATEUR_ADRESSE = /^(@[a-zA-Z][0-9a-zA-z_.-]*[a-zA-Z-0-9]?)\/((?:(?!\d+\.|-)[a-zA-Z0-9_-]{1,63}(?<!-)\.?)+(?:[a-zA-Z]{2,}))$/
//const VALIDATEUR_ADRESSE = new RegExp("^(@[a-zA-Z][0-9a-zA-z_.-]*[a-zA-Z-0-9]?)/((?:(?!d+.|-)[a-zA-Z0-9_-]{1,63}(?<!-).?)+(?:[a-zA-Z]{2,}))$")

console.debug("VALIDATEUR_ADRESSE : %O", VALIDATEUR_ADRESSE)

function EditerContact(props) {

    const { show, retour, supprimerContacts } = props
    // const uuid_contact = contact?contact.uuid_contact:''

    const workers = useWorkers()

    const contacts = useSelector(state=>state.contacts.liste),
          uuid_contact = useSelector(state=>state.contacts.uuidContactActif),
          contact = contacts.filter(item=>item.uuid_transaction===uuid_contact).pop(),
          profil = useSelector(state=>state.contacts.profil)

    // console.debug("EditerContact selectors contacts : %O, uuid_contact: %O, contact: %O", contacts, uuid_contact, contact)

    // Champs data
    const [nom, setNom] = useState('')
    const [adresseEdit, setAdresseEdit] = useState('')
    const [adresseEditIdx, setAdresseEditIdx] = useState('')
    const [adresses, setAdresses] = useState([])
    const [blocked, setBlocked] = useState(false)
    const [trusted, setTrusted] = useState(false)
    const [validated, setValidated] = useState(false)
    const [note, setNote] = useState('')

    const data = useMemo(()=>{
        return {nom, adresses, blocked, trusted, note}
    }, [nom, adresses, blocked, trusted])

    const nomChange = useCallback(event=>setNom(event.currentTarget.value), [setNom])
    const noteHandler = useCallback(event=>setNote(event.currentTarget.value), [setNote])

    const adresseEditChange = useCallback(event=>{
        setAdresseEdit(event.currentTarget.value)
        setValidated(false)
    }, [setAdresseEdit])
    
    const adresseEditCb = useCallback(event=>{
        const idxEdit = Number.parseInt(event.currentTarget.value)
        setAdresseEdit(adresses[idxEdit])
        setAdresseEditIdx(idxEdit)
        setValidated(false)
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
    
    const sauvegarderCb = useCallback(event=>{
        event.preventDefault()
        event.stopPropagation()

        setValidated(true)

        const form = event.currentTarget;
        if (form.checkValidity() === true) {
            const opts = {adresseEdit, adresseEditIdx}
            sauvegarder(workers, profil, uuid_contact, data, retour, opts)
        }

        setValidated(true)
    }, [workers, profil, uuid_contact, data, retour, adresseEdit, adresseEditIdx])

    const supprimerContactCb = useCallback(() => {
        supprimerContacts([uuid_contact])
        retour()
    }, [uuid_contact, supprimerContacts, retour])

    useEffect(()=>{
        setValidated(false)
        if(contact) {
            setNom(contact.nom || '')
            setNote(contact.note || '')
            setAdresseEdit('')
            setAdresseEditIdx('')
            setAdresses(contact.adresses || [])
            setBlocked(contact.blocked===true?true:false)
            setTrusted(contact.trusted===true?true:false)
        } else {
            // Reset (nouveau contact)
            setNom('')
            setNote('')
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

            <Form.Group controlId="note">
                <Form.Label>Note</Form.Label>
                <Form.Control
                    as="textarea"
                    name="note"
                    rows="5"
                    value={note}
                    onChange={noteHandler}
                    required
                />
            </Form.Group>

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

async function sauvegarder(workers, profil, uuid_contact, data, retour, opts) {
    opts = opts || {}
    console.debug("Sauvegarder contact Profil %O, sauvegarder %O, opts : %O", profil, data, opts)
    const { connexion, chiffrage, clesDao } = workers
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

        // Recuperer cle de chiffrage
        const ref_hachage_bytes = profil.cle_ref_hachage_bytes
        const cle = await clesDao.getCleLocale(ref_hachage_bytes)
        console.debug("Cle chiffrage : ", cle)
        const cleSecrete = cle.cleSecrete

        const champsChiffres = await chiffrage.chiffrage.updateChampsChiffres(data, cleSecrete)
        const transaction = { uuid_contact, ref_hachage_bytes, ...champsChiffres}
        if(uuid_contact) transaction.uuid_contact = uuid_contact

        console.debug("sauvegarder Transaction chiffree ", transaction)

        const reponse = await workers.connexion.majContact(transaction)
        console.debug("sauvegarder Reponse sauvegarder contact : %O", reponse)
        retour()
    } catch(err) {
        console.error("Erreur maj contact : %O", err)
    }
}
