import { useState, useEffect, useCallback } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Form from 'react-bootstrap/Form'
import { base64 } from 'multiformats/bases/base64'

import { ListeFichiers, FormatteurTaille, FormatterDate, getCleDechiffree, saveCleDechiffree } from '@dugrema/millegrilles.reactjs'

import { posterMessage } from './messageUtils'
import { chargerProfilUsager } from './profil'

import ModalContacts from './ModalContacts'
import ModalSelectionnerAttachement from './ModalSelectionnerAttachment'

import { loadThumbnailChiffre } from './mapperFichier'

function NouveauMessage(props) {

    const { workers, etatConnexion, setAfficherNouveauMessage, certificatMaitreDesCles, usager, dnsMessagerie } = props

    const [to, setTo] = useState('')
    const [cc, setCc] = useState('')
    const [bcc, setBcc] = useState('')
    const [subject, setSubject] = useState('')
    const [content, setContent] = useState('')
    const [profil, setProfil] = useState('')
    const [replyTo, setReplyTo] = useState('')
    const [from, setFrom] = useState('')
    const [showContacts, setShowContacts] = useState(false)
    const [showAttacherFichiers, setShowAttacherFichiers] = useState(false)
    const [attachments, setAttachments] = useState('')

    const envoyerCb = useCallback(()=>{
        envoyer(workers, certificatMaitreDesCles, from, to, subject, content, {cc, bcc, reply_to: replyTo, attachments})
    }, [workers, certificatMaitreDesCles, from, to, cc, bcc, replyTo, subject, content, attachments])
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
    const fermerAttacherFichiers = useCallback(event=>setShowAttacherFichiers(false), [setShowAttacherFichiers])
    const choisirFichiersAttaches = useCallback(event=>setShowAttacherFichiers(true), [setShowAttacherFichiers])

    const ajouterTo = useCallback(adresses=>{
        if(!adresses) return
        let adressesStr = adresses.map(item=>item.adresses[0]).join('; ')
        if(to) adressesStr = to + '; ' + adressesStr
        setTo(adressesStr)
    }, [to, setTo])

    const selectionner = useCallback( selection => {
        console.debug("Selection : %O", selection)
        if(attachments) {
            // Retirer fuuids deja selectionnes
            const attachmentsFuuids = attachments.map(item=>item.fuuid)
            selection = selection.filter(item=>!attachmentsFuuids.includes(item.fuuid))
        }
        const fuuidsMaj = [...attachments, ...selection]
        setAttachments(fuuidsMaj)
    }, [attachments, setAttachments])

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

            <Row>
                <Col>
                    <Button onClick={choisirFichiersAttaches}>Attacher</Button>
                </Col>
            </Row>

            <AfficherAttachments attachments={attachments} />

            <br className="clear"/>

            <Row>
                <Col>
                    <Button onClick={envoyerCb}>Envoyer</Button>
                    <Button variant="secondary" onClick={annuler}>Annuler</Button>
                </Col>
            </Row>

            <ModalContacts show={showContacts} workers={workers} fermer={fermerContacts} ajouterAdresses={ajouterTo} />
            <ModalSelectionnerAttachement 
                show={showAttacherFichiers} 
                etatConnexion={etatConnexion}
                workers={workers} 
                fermer={fermerAttacherFichiers} 
                selectionner={selectionner} />
        </>
    )

}

export default NouveauMessage

async function envoyer(workers, certificatChiffragePem, from, to, subject, content, opts) {
    opts = opts || {}

    let attachments_inline = opts.attachments_inline

    if(opts.attachments) {
        console.debug("Traiter attachments : %O", opts.attachments)
        // Inline all thumbnails
        const mediaAttachments = opts.attachments.filter(
            item => item.version_courante && item.version_courante.images && item.version_courante.images.thumb)
        for(let idx=0; idx<mediaAttachments.length; idx++) {
            const attachment = mediaAttachments[idx]
            const thumbnail = attachment.version_courante.images.thumb
            // const miniLoader = loadThumbnailChiffre(thumbnail.hachage, workers, {dataChiffre: thumbnail.data_chiffre})
            const blobThumbnail = await workers.traitementFichiers.getThumbnail(thumbnail.hachage, {dataChiffre: thumbnail.data_chiffre})

            console.debug("Blob thumbnail : %O", blobThumbnail)

            const thumbnailData = await blobThumbnail.arrayBuffer()
            console.debug("Bytes thumbnail : %O", thumbnailData)

            // Encoder en multibase
            const thumbnailBase64 = base64.encode(new Uint8Array(thumbnailData))
            console.debug("Thumbnail inline : %O", thumbnailBase64)
            const thumbnailInfo = {...thumbnail, data: thumbnailBase64}
            delete thumbnailInfo.data_chiffre

            if(!attachments_inline) {
                attachments_inline = []
                // opts.attachments_inline = attachments_inline
            }

            attachments_inline.push({
                fuuid: attachment.fuuid, nom: attachment.nom, taille: attachment.taille, mimetype: attachment.mimetype,
                thumb: thumbnailInfo, 
            })
        }

        // Mapper le fuuid seulement
        const attachments = opts.attachments.map(item=>item.fuuid)
        opts = {...opts, attachments, attachments_inline}

    }

    const resultat = await posterMessage(workers, certificatChiffragePem, from, to, subject, content, opts)
    console.debug("Resultat posterMessage : %O", resultat)
}

function AfficherAttachments(props) {
    const { attachments } = props

    const [colonnes, setColonnes] = useState('')
    const [modeView, setModeView] = useState('')

    useEffect(()=>setColonnes(preparerColonnes), [setColonnes])

    if(!attachments) return ''

    return (
        <div>
            <Row>
                <Col>Attachment</Col>
            </Row>

            <Row>
                <Col>
                    <BoutonsFormat modeView={modeView} setModeView={setModeView} />
                </Col>
            </Row>

            <ListeFichiers 
                modeView={modeView}
                colonnes={colonnes}
                rows={attachments} 
                // onClick={onClick} 
                // onDoubleClick={onDoubleClick}
                // onContextMenu={(event, value)=>onContextMenu(event, value, setContextuel)}
                // onSelection={onSelectionLignes}
                onClickEntete={colonne=>{
                    // console.debug("Entete click : %s", colonne)
                }}
            />
        </div>
    )
}

function BoutonsFormat(props) {

    const { modeView, setModeView } = props

    const setModeListe = useCallback(()=>{ setModeView('liste') }, [setModeView])
    const setModeThumbnails = useCallback(()=>{ setModeView('thumbnails') }, [setModeView])

    let variantListe = 'secondary', variantThumbnail = 'outline-secondary'
    if( modeView === 'thumbnails' ) {
        variantListe = 'outline-secondary'
        variantThumbnail = 'secondary'
    }

    return (
        <ButtonGroup>
            <Button variant={variantListe} onClick={setModeListe}><i className="fa fa-list" /></Button>
            <Button variant={variantThumbnail} onClick={setModeThumbnails}><i className="fa fa-th-large" /></Button>
        </ButtonGroup>
    )
}

function preparerColonnes() {
    const params = {
        ordreColonnes: ['nom', 'taille', 'mimetype', 'boutonDetail'],
        paramsColonnes: {
            'nom': {'label': 'Nom', showThumbnail: true, xs: 11, lg: 7},
            'taille': {'label': 'Taille', className: 'details', formatteur: FormatteurTaille, xs: 3, lg: 1},
            'mimetype': {'label': 'Type', className: 'details', xs: 8, lg: 2},
            'boutonDetail': {label: ' ', className: 'details', showBoutonContexte: true, xs: 1, lg: 1},
        },
        // tri: {colonne: 'nom', ordre: 1},
    }
    return params
}
