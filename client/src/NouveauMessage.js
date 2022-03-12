import { useState, useEffect, useCallback } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Form from 'react-bootstrap/Form'
import { base64 } from 'multiformats/bases/base64'
import ReactQuill from 'react-quill'
import { useDropzone } from 'react-dropzone'

import { ListeFichiers, FormatteurTaille } from '@dugrema/millegrilles.reactjs'

import { posterMessage } from './messageUtils'
import { chargerProfilUsager } from './profil'
import { uploaderFichiers } from './fonctionsFichiers'

import ModalContacts from './ModalContacts'
import ModalSelectionnerAttachement from './ModalSelectionnerAttachment'
import { MenuContextuelAttacher, MenuContextuelAttacherMultiselect, onContextMenu } from './MenuContextuel'
import { Alert } from 'react-bootstrap'

function NouveauMessage(props) {

    const { 
        workers, etatConnexion, setAfficherNouveauMessage, certificatMaitreDesCles, usager, dnsMessagerie, 
        showConfirmation
    } = props

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
    const [erreur, setErreur] = useState('')

    const envoyerCb = useCallback(()=>{
        envoyer(workers, certificatMaitreDesCles, from, to, subject, content, {cc, bcc, reply_to: replyTo, attachments})
            .then(()=>{showConfirmation("Message envoye"); fermer();})
            .catch(err=>{
                console.error("Erreur envoi message : %O", err)
                setErreur("Erreur envoi message\n%s", ''+err)
            })
    }, [workers, showConfirmation, setErreur, certificatMaitreDesCles, from, to, cc, bcc, replyTo, subject, content, attachments])

    const fermer = useCallback(()=>setAfficherNouveauMessage(false), [setAfficherNouveauMessage])
    const toChange = useCallback(event=>setTo(event.currentTarget.value), [setTo])
    const ccChange = useCallback(event=>setCc(event.currentTarget.value), [setCc])
    const bccChange = useCallback(event=>setBcc(event.currentTarget.value), [setBcc])
    const subjectChange = useCallback(event=>setSubject(event.currentTarget.value), [setSubject])
    // const contentChange = useCallback(event=>setContent(event.currentTarget.value), [setContent])
    const replyToChange = useCallback(event=>setReplyTo(event.currentTarget.value), [setReplyTo])
    const fermerContacts = useCallback(event=>setShowContacts(false), [setShowContacts])
    const choisirContacts = useCallback(event=>setShowContacts(true), [setShowContacts])
    const fermerAttacherFichiers = useCallback(event=>setShowAttacherFichiers(false), [setShowAttacherFichiers])
    const choisirFichiersAttaches = useCallback(event=>setShowAttacherFichiers(true), [setShowAttacherFichiers])
    const fermerErreur = useCallback(()=>setErreur(''), [setErreur])

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

    const onDrop = useCallback(acceptedFiles=>preparerUploaderFichiers(workers, acceptedFiles), [workers])
    const dzHook = useDropzone({onDrop})
    const {getRootProps, getInputProps} = dzHook

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
            <h2>Nouveau message</h2>

            <Alert show={erreur?true:false} variant="danger" onClose={fermerErreur} dismissible>
                <Alert.Heading>Erreur</Alert.Heading>
                <pre>{erreur}</pre>
            </Alert>

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
            <Button variant="secondary" onClick={choisirContacts}>Contacts</Button>
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
                <Editeur content={content} setContent={setContent} />
            </Form.Group>

            <h2>Attachements</h2>
            <Row>
                <Col>
                    <div {...getRootProps()}>
                        <input {...getInputProps()}/>
                        <Button>Upload</Button>
                    </div>
                    <Button variant="secondary" onClick={choisirFichiersAttaches}>Collections</Button>
                </Col>
            </Row>

            <AfficherAttachments 
                workers={workers} 
                etatConnexion={etatConnexion} 
                attachments={attachments} 
                setAttachments={setAttachments} />

            <br className="clear"/>

            <Row>
                <Col>
                    <Button onClick={envoyerCb}>Envoyer</Button>
                    <Button variant="secondary" onClick={fermer}>Annuler</Button>
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

function Editeur(props) {
    const { content, setContent } = props
    const handleChange = useCallback(value=>setContent(value), [setContent])
    return (
        <>
            <br className="clear"/>
            <ReactQuill className="editeur-body" value={content} onChange={handleChange} />
            <br className="clear"/>
        </>
    )
}

async function envoyer(workers, certificatChiffragePem, from, to, subject, content, opts) {
    opts = opts || {}

    if(opts.attachments) {
        let attachmentsMapping = {}
        let fuuids = []
        let fuuidsCleSeulement = []

        console.debug("Traiter attachments : %O", opts.attachments)

        // Mapper data attachments
        opts.attachments.forEach( attachment => {
            const { fuuid, version_courante } = attachment
            fuuids.push(fuuid)

            const mapping = {
                ...version_courante,
                fuuid,
                // nom: attachment.nom,
                // mimetype: version_courante.mimetype,
                // taille: version_courante.taille,
                // dateFichier: dateAjout,
            }
            delete mapping.tuuid
            console.debug("Mapping attachment : %O", mapping)

            if(version_courante.images) {
                const images = version_courante.images
                // mapping.images = {...images}
                Object.values(images)
                    .map(image=>{
                        if(image.data_chiffre || image.data) {
                            fuuidsCleSeulement.push(image.hachage)
                        } else {
                            // console.debug("Attacher image : %O", image)
                            fuuids.push(image.hachage)
                        }
                    })
            }
            if(version_courante.video) {
                const videos = version_courante.video
                // mapping.video = {...videos}
                Object.values(videos).map(video=>{
                    // console.debug("Attache video : %O", video)
                    fuuids.push(video.hachage)
                })
            }

            attachmentsMapping[fuuid] = mapping
        })

        // Ajouter attachments et fuuids aux opts
        opts = {...opts, attachments: Object.values(attachmentsMapping), fuuids, fuuidsCleSeulement}
    }

    const resultat = await posterMessage(workers, certificatChiffragePem, from, to, subject, content, opts)
    console.debug("Resultat posterMessage : %O", resultat)
}

async function preparerUploaderFichiers(workers, acceptedFiles) {
    console.debug("Preparer upload fichiers")
    const { connexion } = workers

    // Obtenir tuuid de la collection d'upload
    const infoCollectionUpload = await connexion.getCollectionUpload()
    console.debug("Information collection upload : %O", infoCollectionUpload)
    const cuuid = infoCollectionUpload.tuuid  // Collection destination pour l'upload

    const reponseUpload = await uploaderFichiers(workers, cuuid, acceptedFiles)
    console.debug("Reponse upload : %O", reponseUpload)
}

function AfficherAttachments(props) {
    const { workers, attachments, setAttachments, etatConnexion } = props

    const [colonnes, setColonnes] = useState('')
    const [modeView, setModeView] = useState('')
    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})
    const [selection, setSelection] = useState('')

    const fermerContextuel = useCallback(()=>setContextuel(false), [setContextuel])
    const onSelectionLignes = useCallback(selection=>{setSelection(selection)}, [setSelection])

    useEffect(()=>setColonnes(preparerColonnes), [setColonnes])

    if(!attachments || attachments.length === 0) return ''

    return (
        <div>
            <Row>
                <Col>
                    <BoutonsFormat modeView={modeView} setModeView={setModeView} />
                </Col>
            </Row>

            <ListeFichiers 
                modeView={modeView}
                colonnes={colonnes}
                rows={attachments} 
                // onClick={...pas utilise...} 
                // onDoubleClick={... pas utilise...}
                onContextMenu={(event, value)=>onContextMenu(event, value, setContextuel)}
                onSelection={onSelectionLignes}
                onClickEntete={colonne=>{
                    // console.debug("Entete click : %s", colonne)
                }}
            />

            <MenuContextuel
                workers={workers}
                contextuel={contextuel} 
                fermerContextuel={fermerContextuel}
                attachments={attachments}
                setAttachments={setAttachments}
                selection={selection}
                // showPreview={showPreviewAction}
                // showInfoModalOuvrir={showInfoModalOuvrir}
                // downloadAction={downloadAction}
                etatConnexion={etatConnexion}
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

function MenuContextuel(props) {

    const { contextuel, attachments, selection } = props

    if(!contextuel.show) return ''

    console.debug("!!! Selection : %s, FICHIERS : %O", selection, attachments)

    if( selection && selection.length > 1 ) {
        return <MenuContextuelAttacherMultiselect {...props} />
    } else if(selection.length>0) {
        const fichierTuuid = selection[0]
        const attachment = attachments.filter(item=>item.fuuid===fichierTuuid).pop()
        if(attachment) {
            return <MenuContextuelAttacher attachment={attachment} {...props} />
        }
    }

    return ''
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
