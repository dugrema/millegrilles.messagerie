import { useState, useEffect, useCallback, useMemo, version } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { proxy } from 'comlink'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Form from 'react-bootstrap/Form'
import Breadcrumb from 'react-bootstrap/Breadcrumb'
import Dropdown from 'react-bootstrap/Dropdown'

import ReactQuill from 'react-quill'
import { useDropzone } from 'react-dropzone'

import { ListeFichiers, FormatteurTaille, AlertTimeout, useDetecterSupport } from '@dugrema/millegrilles.reactjs'

import useWorkers, {useEtatConnexion, useUsager} from './WorkerContext'
import messagerieActions from './redux/messagerieSlice'
import { posterMessage, getClesFormattees } from './messageUtils'
import { uploaderFichiers } from './fonctionsFichiers'
// import { getClesAttachments } from './cles'

import ModalContacts from './ModalContacts'
import ModalSelectionnerAttachement from './ModalSelectionnerAttachment'
import { MenuContextuelAttacher, MenuContextuelAttacherMultiselect, onContextMenu } from './MenuContextuel'
import { mapper } from './mapperFichier'
// import * as MessageDao from './redux/messageDao'

function NouveauMessage(props) {

    const { fermerNouveauMessage, showConfirmation, setMessageRepondre } = props

    const workers = useWorkers(),
          dispatch = useDispatch(),
          etatConnexion = useEtatConnexion(),
          usager = useUsager(),
          supportMedia = useDetecterSupport()

    const profil = useSelector(state=>state.contacts.profil),
          userId = useSelector(state=>state.contacts.userId),
          uuidMessageRepondre = useSelector(state=>state.messagerie.uuidMessageRepondre),
          uuidMessageTransfert = useSelector(state=>state.messagerie.uuidMessageTransfert),
          listeMessages = useSelector(state=>state.messagerie.liste)

    const [certificatsMaitredescles, setCertificatsMaitredescles] = useState('')

    const [to, setTo] = useState('')
    const [content, setContent] = useState('')
    const [replyTo, setReplyTo] = useState('')
    const [from, setFrom] = useState('')
    const [uuidThread, setUuidThread] = useState('')
    const [showContacts, setShowContacts] = useState(false)
    const [attachments, setAttachments] = useState('')
    const [attachmentsPending, setAttachmentsPending] = useState('')
    const [attachmentsCles, setAttachmentsCles] = useState({})
    // const [attachmentsPrets, setAttachmentsPrets] = useState('')
    const [erreur, setErreur] = useState('')
    const [idDraft, setIdDraft] = useState('')
    const [drafts, setDrafts] = useState('')
    const [optionVideo, setOptionVideo] = useState('faible')

    const attachmentsPrets = useMemo(()=>{
        return !attachmentsPending || attachmentsPending.length === 0
    }, [attachmentsPending])

    const erreurCb = useCallback((err, message)=>setErreur({err, message}), [setErreur])

    const supprimerDraftCb = useCallback(idDraft=>{
        idDraft = idDraft.currentTarget?Number.parseInt(idDraft.currentTarget.value):idDraft
        console.error("supprimerDraftCb fix me - redux")
        // MessageDao.supprimerDraft(idDraft).catch(erreurCb)
        // const draftsMaj = drafts.filter(item=>item.idDraft!==idDraft)
        // setDrafts(draftsMaj)
    }, [drafts, setDrafts, erreurCb])

    const fermer = useCallback( supprimerDraft => {
        if(supprimerDraft === true) supprimerDraftCb(idDraft)
        fermerNouveauMessage()
    }, [fermerNouveauMessage, supprimerDraftCb, idDraft])

    const envoyerCb = useCallback(()=>{
        const opts = {reply_to: replyTo, uuid_thread: uuidThread, attachments, attachmentsCles, optionVideo}
        envoyer(workers, userId, certificatsMaitredescles, from, to, content, opts)
            .then(()=>{
                // showConfirmation("Message envoye")
                supprimerDraftCb(idDraft)
                fermer(true)
            })
            .catch(err=>{
                console.error("Erreur envoi message : %O", err)
                erreurCb(err, 'Erreur envoi message')
            })
    }, [
        workers, userId, showConfirmation, certificatsMaitredescles, 
        from, to, replyTo, content, uuidThread, attachments, attachmentsCles, optionVideo,
        fermer, supprimerDraftCb, idDraft, erreurCb,
    ])

    const toChange = useCallback(event=>setTo(event.currentTarget.value), [setTo])
    const replyToChange = useCallback(event=>setReplyTo(event.currentTarget.value), [setReplyTo])
    const fermerContacts = useCallback(event=>setShowContacts(false), [setShowContacts])
    const choisirContacts = useCallback(event=>setShowContacts(true), [setShowContacts])

    const ajouterTo = useCallback(adresses=>{
        if(!adresses) return
        let adressesStr = adresses.filter(item=>item&&item.adresses&&item.adresses.length>0).map(item=>item.adresses[0]).join('; ')
        if(to) adressesStr = to + '; ' + adressesStr
        setTo(adressesStr)
    }, [to, setTo])

    const chargerDraft = useCallback(idDraft=>{
        throw new Error("fix me - redux")
        // MessageDao.getDraft(idDraft)
        //     .then(draft=>{
        //         const {from, to, replyTo, content, attachments, attachmentsCles} = draft
        //         setIdDraft(draft.idDraft)
        //         setFrom(from)
        //         setTo(to)
        //         setReplyTo(replyTo)
        //         setContent(content)
        //         if(attachments) {
        //             const attachmentsMappes = Object.values(attachments).map(fichier=>{
        //                 const fuuid = fichier.fuuid
        //                 const row = preparerRowAttachment(workers, fichier)
        //                 const fichierMappe = {...row, ...fichier, fuuid}
        //                 return fichierMappe
        //             })
        //             setAttachments(attachmentsMappes)
        //             setAttachmentsCles(attachmentsCles)
        //         } else {
        //             setAttachments('')
        //             setAttachmentsCles({})
        //         }
        //     })
        //     .catch(erreurCb)
    }, [workers, setIdDraft, setFrom, setTo, setReplyTo, setContent, setAttachments, setAttachmentsCles, erreurCb])

    useEffect(()=>{
        const { clesDao } = workers
        const certPromise = clesDao.getCertificatsMaitredescles()
        certPromise
            .then(certificats=>{
                console.debug("Reponse certificats maitre des cles ", certificats)
                setCertificatsMaitredescles(certificats)
            })
            .catch(err=>erreurCb(err, "Erreur chargement du certificat de maitre des cles"))
    }, [workers, setCertificatsMaitredescles])

    useEffect(()=>{
        console.error("getListeDrafts() fix me")
        // MessageDao.getListeDrafts()
        //     .then(drafts=>{
        //         // console.debug("Drafts : %O", drafts)
        //         setDrafts(drafts)
        //     })
        //     .catch(erreurCb)
    }, [setDrafts, erreurCb])

    useEffect(()=>{
        if(listeMessages && uuidMessageRepondre) {
            const messageRepondre = listeMessages.filter(item=>item.uuid_transaction===uuidMessageRepondre).pop()
            if(messageRepondre) {
                preparerReponse(workers, messageRepondre, setTo, setContent, setUuidThread, setAttachments, setAttachmentsCles, {})
                dispatch(messagerieActions.setUuidMessageActif(''))  // Clear uuidMessageRepondre
            } else {
                console.error("NouveauMessage Erreur preparation repondre : Message %s introuvable ", uuidMessageRepondre)
                dispatch(messagerieActions.setUuidMessageActif())    // Retour a la liste de messages
            }
        }
    }, [workers, dispatch, listeMessages, uuidMessageRepondre, setTo, setContent, setUuidThread, setAttachments, setAttachmentsCles, setMessageRepondre])

    useEffect(()=>{
        if(!profil || !usager) return

        let replyTo = null, from = null
        if(profil.adresses && profil.adresses.length > 0) {
            replyTo = profil.adresses[0]
        } 
        if(replyTo) {
            from = replyTo
        } else {
            const hostname = window.location.hostname
            from = `@${usager.nomUsager}:${hostname}`
        }
        setFrom(from)
        setReplyTo(replyTo)
    }, [workers, profil, usager, setReplyTo])

    useEffect(()=>{
        if(!idDraft) {
            if(to || content || attachments) {  // Champs modifiables par l'usager
                // Creer un nouveau draft
                //throw new Error("fix me - redux")
                // MessageDao.ajouterDraft().then(setIdDraft).catch(erreurCb)
            }
        } else {
            // Conserver information draft
            let attachmentsMapping = null
            if(attachments) {
                const fieldsConserver = [
                    'fileId', 'fuuid', 
                    'duration', 'mimetype', 'width', 'height', 'anime', 'nom', 'taille', 
                    'pret', 'version_courante'
                ]
                attachmentsMapping = attachments.map(item=>{
                    const attach = {}
                    fieldsConserver.forEach(champ=>{ if(item[champ]) attach[champ] = item[champ] })
                    // console.debug("attach : %O", attach)
                    return attach
                })
            }
            throw new Error("fix me - redux")
            // MessageDao.sauvegarderDraft(idDraft, {from, to, replyTo, content, attachments: attachmentsMapping, attachmentsCles}).catch(erreurCb)
        }
    }, [idDraft, from, to, replyTo, content, attachments, attachmentsCles, setIdDraft, erreurCb])

    return (
        <>
            <BreadcrumbMessage retourMessages={fermer} />

            <AlertTimeout value={erreur} setValue={setErreur} titre="Erreur" variant="danger" />

            <AfficherDrafts 
                drafts={drafts} 
                setDrafts={setDrafts} 
                chargerDraft={chargerDraft} 
                supprimerCb={supprimerDraftCb}
                erreurCb={erreurCb} />

            <Form.Label htmlFor="inputTo">To</Form.Label>
            <Row>
                <Col xs={7} md={9} lg={10}>
                    <Form.Control
                        type="text"
                        id="inputTo"
                        name="to"
                        value={to}
                        onChange={toChange}                        
                    />
                </Col>
                <Col className="buttonbar-right">
                    <Button variant="secondary" onClick={choisirContacts}><i className="fa fa-user-circle"/>{' '}Contacts</Button>
                </Col>
            </Row>

            <Form.Label htmlFor="replyTo">Reply to</Form.Label>
            <Form.Control
                type="text"
                id="replyTo"
                name="to"
                value={replyTo}
                onChange={replyToChange}
            />

            <Form.Group>
                <Form.Label htmlFor="inputContent">Message</Form.Label>
                <br/>
                <Form.Text className="text-muted">
                    Pour creer un sujet, ecrire sur la premiere ligne et faire deux retours.
                </Form.Text>
                <Editeur content={content} setContent={setContent} />
            </Form.Group>

            <AfficherAttachments 
                workers={workers} 
                etatConnexion={etatConnexion} 
                attachments={attachments} 
                setAttachments={setAttachments} 
                attachmentsPending={attachmentsPending}
                setAttachmentsPending={setAttachmentsPending}
                attachmentsCles={attachmentsCles}
                setAttachmentsCles={setAttachmentsCles}
                supportMedia={supportMedia}
                optionVideo={optionVideo}
                setOptionVideo={setOptionVideo}
                erreurCb={erreurCb} />

            <br className="clear"/>

            <Row>
                <Col className="buttonbar">
                    <Button onClick={envoyerCb} disabled={!attachmentsPrets}><i className="fa fa-send-o"/>{' '}Envoyer</Button>
                    <Button variant="secondary" onClick={fermer}><i className="fa fa-save"/> Enregistrer</Button>
                    <Button variant="secondary" onClick={()=>fermer(true)}><i className="fa fa-trash"/> Supprimer</Button>
                </Col>
            </Row>

            <ModalContacts 
                show={showContacts} 
                workers={workers} 
                fermer={fermerContacts} 
                ajouterAdresses={ajouterTo} 
                userId={userId} />
            
        </>
    )

}

export default NouveauMessage

function BreadcrumbMessage(props) {

    const { retourMessages } = props

    return (
        <Breadcrumb>
            <Breadcrumb.Item onClick={retourMessages}>Messages</Breadcrumb.Item>
            <Breadcrumb.Item active>Nouveau</Breadcrumb.Item>
        </Breadcrumb>
    )
}

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

function AfficherDrafts(props) {
    const { drafts, chargerDraft, supprimerCb } = props
    const nbDrafts = drafts?drafts.length:0

    const chargerDraftCb = useCallback(event=>{
        const idDraft = Number.parseInt(event.currentTarget.value)
        chargerDraft(idDraft)
    }, [chargerDraft])

    if(nbDrafts === 0) return ''

    return (
        <div>
            <p>{nbDrafts} Drafts</p>
            {drafts.map(item=>{
                return (
                    <Row key={item.idDraft}>
                        <Col sm={2} md={1}># {item.idDraft}</Col>
                        <Col sm={4} md={3}>
                            <Button size="sm" variant="secondary" onClick={chargerDraftCb} value={item.idDraft}>Charger</Button>
                            <Button size="sm" variant="secondary" onClick={supprimerCb} value={item.idDraft}>Supprimer</Button>
                        </Col>
                        <Col sm={6} md={8}>{item.to}</Col>
                    </Row>
                )
            })}
        </div>
    )
}

async function envoyer(workers, userId, certificatsChiffragePem, from, to, content, opts) {
    opts = opts || {}
    const { messagerieDao } = workers

    if(opts.attachments) {
        // Mapper data attachments
        const {attachmentsMapping, fuuids, fuuidsCleSeulement} = mapperAttachments([...opts.attachments], opts)

        // Ajouter attachments et fuuids aux opts
        opts = {...opts, attachments: Object.values(attachmentsMapping), fuuids, fuuidsCleSeulement}
    }

    const resultat = await posterMessage(workers, certificatsChiffragePem, from, to, content, opts)
    console.debug("Resultat poster message ", resultat)
    if(resultat.err) throw resultat.err
    if(resultat.ok === false) throw new Error("Erreur envoyer message")

    // Sauvegarder dans la boite d'envoi
    const messageEnvoyer = {
        ...resultat.messageOriginal,
        user_id: userId,
        uuid_transaction: resultat.uuid_message,  // Message envoyer n'a pas de uuid_transaction
        uuid_message: resultat.uuid_message,
        date_envoi: resultat.message['en-tete'].estampille,
        dechiffre: 'true',
        lu: false,
        supprime: false,
    }

    console.debug("Envoyer userId %s resultat : %O", userId, messageEnvoyer)

    const messageMaj = await messagerieDao.updateMessage(messageEnvoyer)
    console.debug("envoyer Messages maj ", messageMaj)

    return messageMaj
}

function mapperAttachments(attachments, opts) {
    opts = opts || {}
    const optionVideo = opts.optionVideo || 'original'
    // Mapper data attachments
    let attachmentsMapping = {}
    let fuuids = []
    let fuuidsCleSeulement = []

    attachments.forEach( attachment => {
        const { version_courante } = attachment
        const fuuid = attachment.fuuid_v_courante || attachment.fuuid
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
        // console.debug("Mapping attachment : %O", mapping)

        if(version_courante) {
            if(version_courante.images) {
                const images = version_courante.images
                // mapping.images = {...images}
                Object.values(images).forEach(image=>{
                    if(image.data_chiffre || image.data) {
                        fuuidsCleSeulement.push(image.hachage)
                    } else if(image.hachage) {
                        // console.debug("Attacher image : %O", image)
                        fuuids.push(image.hachage)
                    }
                })
            }
            if(version_courante.video) {
                let videos = {...version_courante.video}
                let remplacant = null
                // Filtrer la liste de videos pour retirer les formats indesirables
                if(optionVideo === 'original') {
                    // Retirer tous les formats sauf le basse resolution
                    videos = Object.keys(videos).reduce((acc, videoKey)=>{
                        const video = videos[videoKey]
                        const resolution = calculerResolution(video),
                              codec = video.codec
                        if(codec === 'h264' && resolution === 270) acc[videoKey] = video
                        return acc
                    }, {})
                } else {
                    // Remplacer le video 'original' par le format selectionne
                    // Valeurs a remplacer : fuuid, taille, videoCodec, mimetype, height, width
                    if(optionVideo === 'faible') {
                        videos = Object.keys(videos).reduce((acc, videoKey)=>{
                            if(remplacant) return acc  // Rien a faire, deja trouve
                            const video = videos[videoKey]
                            const resolution = calculerResolution(video),
                                  codec = video.codec
                            if(codec === 'h264' && resolution < 360) {
                                acc[videoKey] = video
                                remplacant = video
                            }
                            return acc
                        }, {})
                    }
                }

                // Remplacer .video dans version_courante
                version_courante.video = videos

                if(remplacant) {
                    mapping.fuuid = remplacant.fuuid_video
                    mapping.height = remplacant.height
                    mapping.width = remplacant.width
                    mapping.mimetype = remplacant.mimetype
                    mapping.videoCodec = remplacant.codec
                    mapping.taille = remplacant.taille_fichier
                }

                Object.values(videos).forEach(video=>{
                    if(video.fuuid_video) fuuids.push(video.fuuid_video)
                })
            }
        }

        console.debug("mapperAttachments Attachment %O", mapping)

        attachmentsMapping[fuuid] = mapping
    })

    return {attachmentsMapping, fuuids, fuuidsCleSeulement}
}

function calculerResolution(video) {
    const height = video.height,
          width = video.width
    let resolution = video.resolution
    if(!resolution) {
        const resolutionCalculee = Math.min(width, height)
        if(resolutionCalculee)  resolution = resolutionCalculee
    }
    return resolution
}

async function preparerUploaderFichiers(workers, acceptedFiles) {
    // console.debug("Preparer upload fichiers : %O", acceptedFiles)
    const { connexion } = workers

    // Obtenir tuuid de la collection d'upload
    const infoCollectionUpload = await connexion.getCollectionUpload()
    // console.debug("Information collection upload : %O", infoCollectionUpload)
    const cuuid = infoCollectionUpload.tuuid  // Collection destination pour l'upload

    const infoUploads = await uploaderFichiers(workers, cuuid, acceptedFiles)
    // console.debug("Info uplodas : %O", infoUploads)

    return {infoCollectionUpload, cuuid, infoUploads}
}

function AfficherAttachments(props) {
    const { 
        workers, etatConnexion, erreurCb,
        attachments, setAttachments, attachmentsPending, setAttachmentsPending,
        attachmentsCles, setAttachmentsCles, 
        optionVideo, setOptionVideo,
    } = props

    const [colonnes, setColonnes] = useState('')
    const [modeView, setModeView] = useState('')
    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})
    const [selection, setSelection] = useState('')
    const [showAttacherFichiers, setShowAttacherFichiers] = useState(false)
    
    const fermerContextuel = useCallback(()=>setContextuel(false), [setContextuel])
    const onSelectionLignes = useCallback(selection=>{setSelection(selection)}, [setSelection])
    const choisirFichiersAttaches = useCallback(event=>setShowAttacherFichiers(true), [setShowAttacherFichiers])
    const fermerAttacherFichiers = useCallback(event=>setShowAttacherFichiers(false), [setShowAttacherFichiers])

    // const tuuidsAttachmentHandler = useCallback((attachmentsMaj, attachmentsPendingMaj)=>{
    //     console.debug("tuuidsAttachmentHandler attachments: %O, attachmentsPending : %O", attachmentsMaj, attachmentsPendingMaj)

    //     let tuuids = []
    //     attachmentsMaj = attachmentsMaj || attachments || []
    //     attachmentsPendingMaj = attachmentsPendingMaj || attachmentsPending || []

    //     const liste = [...attachmentsMaj, ...attachmentsPendingMaj]

    //     tuuids = liste.map(item=>(item.tuuid||item.fileId)).filter(item=>item)
    //     console.debug("Tuuids listener : %O", tuuids)

    // }, [attachments, attachmentsPending])

    const listeAttachments = useMemo(()=>{
        const liste = []
        if(attachments) attachments.forEach(item=>liste.push({...item, pret: true}))
        if(attachmentsPending) attachmentsPending.forEach(item=>liste.push({...item, pret: false}))

        console.debug("Maj liste Attachments combinee : %O (attachments : %O, attachmentsPending: %O)", liste, attachments, attachmentsPending)

        return liste
    }, [attachments, attachmentsPending])

    const selectionner = useCallback( (selection, opts) => {
        opts = opts || {}
        const upload = opts.upload

        if(upload) {
            console.debug("Upload nouvel attachment : %O", selection)
            let attachmentsMaj = null
            if(attachmentsPending) {
                attachmentsMaj = [...attachmentsPending, ...selection]
            } else {
                attachmentsMaj = selection
            }
            console.debug("Maj attachments pending pour selection : %O", attachmentsMaj)
            setAttachmentsPending([...attachmentsMaj])
            // tuuidsAttachmentHandler(null, attachmentsMaj)
        } else {
            // Fichier existant, provient d'une collection de l'usager
            if(attachments) {
                // Retirer fuuids deja selectionnes
                const attachmentsFuuids = attachments.map(item=>item.fuuid_v_courante)
                selection = selection.filter(item=>!attachmentsFuuids.includes(item.fuuid_v_courante))
            }
            const attachmentsMaj = [...attachments, ...selection]
            console.debug("Attachments maj : %O", attachmentsMaj)
            setAttachments(attachmentsMaj)
            // tuuidsAttachmentHandler(attachmentsMaj)

            // Extraire la liste complete des fuuids de la selection
            const { fuuids, fuuidsCleSeulement } = mapperAttachments(selection)
            const listeFuuidsCles = [...fuuids, ...fuuidsCleSeulement]
            getClesFormattees(workers, listeFuuidsCles, {delaiInitial: 500, tentatives: 2})
                .then(cles=>{
                    const clesMaj = {...attachmentsCles, ...cles}
                    setAttachmentsCles(clesMaj)
                })
                .catch(err=>{
                    console.error("Erreur chargement cles fuuids %s (tentative 1): %O", listeFuuidsCles, err)
                })
        }

    }, [workers, attachments, attachmentsPending, attachmentsCles, setAttachments, setAttachmentsPending, setAttachmentsCles])

    const onDrop = useCallback(acceptedFiles=>{
        preparerUploaderFichiers(workers, acceptedFiles)
            .then(info=>{
                console.debug("Preparer uploads info : %O", info)
                const { infoUploads } = info
                const listeSelection = infoUploads.map(item=>{
                    const { correlation, transaction } = item
                    return { fileId: correlation, correlation, ...transaction }
                })
                selectionner(listeSelection, {upload: true})
            })
            .catch(erreurCb)
    }, [workers, selectionner, erreurCb])
    const dzHook = useDropzone({onDrop})
    const {getRootProps, getInputProps} = dzHook

    useEffect(()=>setColonnes(preparerColonnes), [setColonnes])

    // // Capturer evenement upload
    // useEffect(()=>addEvenementUpload1(evenementUpload), [evenementUpload, addEvenementUpload1])
    // // Traiter evenement upload
    // useEffect(()=>{
    //     if(!evenementUpload1) return  // Rien a faire
    //     addEvenementUpload1('')  // Eviter cycle

    //     console.debug("!!! AfficherAttachements evenement upload : %O", evenementUpload1)
    //     if(attachmentsPending) {
    //         const routingKey = evenementUpload1.routingKey
    //         if(routingKey) {
    //             const message = evenementUpload1.message
    //             const { tuuid, version_courante } = message
    //             const mimetype = (version_courante?version_courante.mimetype:null) || ''
    //             const baseType = mimetype.split('/').shift()

    //             let complete = false
    //             if(version_courante) {
    //                 if(baseType === 'video') {
    //                     const videos = version_courante.video || {},
    //                           images = version_courante.images || {}
    //                     complete = images.thumb && Object.values(videos).filter(item=>item.codec === 'h264').pop()
    //                 } else if(baseType === 'image') {
    //                     const images = version_courante.images || {}
    //                     complete = images.thumb && Object.values(images).filter(item=>item.mimetype === 'image/webp').pop()
    //                 } else if(mimetype === 'application/pdf') {
    //                     const images = version_courante.images || {}
    //                     complete = images.thumb && Object.values(images).filter(item=>item.mimetype === 'image/webp').pop()
    //                 } else {
    //                     complete = true  // Version courante, aucune autre information requise
    //                 }
    //             }

    //             const attachmentsPendingMaj = attachmentsPending.reduce((acc, item)=>{
    //                 const fileId = item.fileId || item.tuuid
    //                 if(fileId === tuuid) { // Remplacer
    //                     const fichier = {fileId, ...evenementUpload1.message}
    //                     // Determiner si l'attachment est pret
    //                     if(!complete) {
    //                         const row = preparerRowAttachment(workers, fichier)
    //                         acc.push(row)
    //                     }
    //                 } else {
    //                     acc.push(item)  // Conserver
    //                 }

    //                 return acc
    //             }, [])

    //             setAttachmentsPending(attachmentsPendingMaj)
    //             if(complete) {
    //                 const rowAttachment = preparerRowAttachment(workers, message)
    //                 selectionner([rowAttachment])
    //             }
    //         } else {
    //             const { complete, transaction } = evenementUpload1
    //             // TODO Fix race condition sur setAttachmentsPending / liste pending
    //             if(!complete) return  // Rien a faire, evite race condition sur selection

    //             // const nouvelUpload = { correlation: complete, ...transaction }
    //             let majListeners = false
    //             const attachmentsPendingMaj = attachmentsPending.reduce((acc, item)=>{
    //                 if(transaction) {
    //                     majListeners = true
    //                     if(item.correlation === complete) {
    //                         // Conserver identificateur tuuid (override correlation)
    //                         const entete = transaction['en-tete']
    //                         const tuuid = entete.uuid_transaction
    //                         const attachmentMaj = {fileId: tuuid, tuuid, ...transaction}
    //                         acc.push(attachmentMaj)
    //                     } else {
    //                         acc.push(item)  // Toujours actif
    //                     }
    //                 } else {
    //                     acc.push(item)  // Toujours actif
    //                 }
                    
    //                 return acc
    //             }, [])
    //             setAttachmentsPending(attachmentsPendingMaj)
    //             if(majListeners) tuuidsAttachmentHandler(null, attachmentsPendingMaj)
    //         }
    //     }
    // }, [workers, evenementUpload1, selectionner, attachmentsPending, setAttachmentsPending, addEvenementUpload1])

    // // Enregistrer evenements ecoute maj fichiers (attachments)
    // useEffect(()=>{
    //     const { connexion } = workers
    //     if(tuuidsAttachments && tuuidsAttachments.length > 0) {
    //         const params = {tuuids: tuuidsAttachments}
    //         console.debug("Ajouter listener fichiers %O", params)
    //         connexion.enregistrerCallbackMajFichier(params, addEvenementUpload1Proxy).catch(erreurCb)
    //         return () => {
    //             console.debug("Retirer listener fichiers %O", params)
    //             connexion.retirerCallbackMajFichier(params, addEvenementUpload1Proxy).catch(erreurCb)
    //         }
    //     }
    // }, [workers, tuuidsAttachments, addEvenementUpload1Proxy, erreurCb])

    // useEffect(()=>{
    //     if(attachments) {
    //         const pret = attachments.reduce((acc, item)=>acc&&item.pret, true)
    //         setAttachmentsPrets(pret)
    //     } else {
    //         setAttachmentsPrets(true)
    //     }
    // }, [attachments, setAttachmentsPrets])

    // if(!attachments || attachments.length === 0) return ''

    return (
        <div>
            <Row>
                <Col xs={6} md={4} lg={3}>Attachments</Col>
                <Col className="buttonbar-right">
                    <span {...getRootProps()}>
                        <input {...getInputProps()}/>
                        <Button variant="secondary">
                            <i className="fa fa-plus" />
                            {' '}Upload
                        </Button>
                    </span>
                    <Button variant="secondary" onClick={choisirFichiersAttaches}>
                        <i className="fa fa-folder" />
                            {' '}Collections
                    </Button>
                    <Dropdown onSelect={event=>setOptionVideo(event)}>
                        <Dropdown.Toggle variant="secondary" id="dropdown-option-video">
                            {optionVideo}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item eventKey="faible">Video basse resolution</Dropdown.Item>
                            <Dropdown.Item eventKey="original">Video original</Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </Col>
            </Row>

            <Row>
                <Col>
                    <BoutonsFormat modeView={modeView} setModeView={setModeView} />
                </Col>
            </Row>

            <ListeFichiers 
                modeView={modeView}
                colonnes={colonnes}
                rows={listeAttachments} 
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
                attachments={listeAttachments}
                setAttachments={setAttachments}
                selection={selection}
                // showPreview={showPreviewAction}
                // showInfoModalOuvrir={showInfoModalOuvrir}
                // downloadAction={downloadAction}
                etatConnexion={etatConnexion}
            />

            <ModalSelectionnerAttachement 
                show={showAttacherFichiers} 
                titre="Selectionner des fichiers"
                etatConnexion={etatConnexion}
                workers={workers} 
                fermer={fermerAttacherFichiers} 
                onSelect={selectionner} 
                erreurCb={erreurCb} />

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
    // console.debug("MenuContextuel propppies : %O", props)
    const { contextuel, attachments, selection } = props

    if(!contextuel.show) return ''

    if( selection && selection.length > 1 ) {
        return <MenuContextuelAttacherMultiselect {...props} />
    } else if(selection && selection.length>0) {
        const fichierTuuid = selection[0]
        const attachment = attachments.filter(item=>item.fileId===fichierTuuid).pop()
        if(attachment) {
            return <MenuContextuelAttacher attachment={attachment} {...props} />
        } else {
            console.warn("Aucun match selection pour menu contextuel %s pas inclus dans %O", fichierTuuid, attachments)
        }
    } else {
        console.warn("Aucune selection pour menu contextuel")
    }

    return ''
}

function preparerColonnes() {
    const params = {
        ordreColonnes: ['nom', 'taille', 'mimetype', 'pret', 'boutonDetail'],
        paramsColonnes: {
            'nom': {'label': 'Nom', showThumbnail: true, xs: 11, lg: 6},
            'taille': {'label': 'Taille', className: 'details', formatteur: FormatteurTaille, xs: 3, lg: 2},
            'mimetype': {'label': 'Type', className: 'details', xs: 6, lg: 2},
            'pret': {'label': 'Etat', formatteur: PretFormatteur, className: 'details', xs: 2, lg: 1},
            'boutonDetail': {label: ' ', className: 'details', showBoutonContexte: true, xs: 1, lg: 1},
        },
        // tri: {colonne: 'nom', ordre: 1},
    }
    return params
}

function PretFormatteur(props) {
    const data = props.data || {},
          pret = !!data.pret
    if(pret) {
        return <i className="fa fa-check" />
    } else {
        return <i className="fa fa-spinner fa-spin" />
    }
}

function preparerReponse(workers, message, setTo, setContent, setUuidThread, setAttachments, setAttachmentsCles, opts) {
    opts = opts || {}
    // const { message, conserverAttachments, clearTo } = messageRepondre
    const { conserverAttachments, clearTo } = opts
    const to = message.replyTo || message.from
    if(clearTo !== true) {
        setTo(to)
    }

    const dateMessageOriginalInt = message['en-tete'].estampille || message.date_reception
    const dateMessageOriginal = new Date(dateMessageOriginalInt * 1000)
    const messageOriginal = []
    messageOriginal.push('<br><br><p>-----</p>')
    messageOriginal.push('<p>On ' + dateMessageOriginal + ', ' + to + ' wrote:</p>')
    if(message.subject) {
        messageOriginal.push('<p>' + message.subject + '</p>')
    }
    messageOriginal.push(message.content)
    setContent(messageOriginal.join(''))

    const uuidThread = message.uuid_thread || message.uuid_transaction
    setUuidThread(uuidThread)

    if(conserverAttachments && message.attachments) {
        const { cles, fichiers } = message.attachments
        setAttachmentsCles(cles)

        const rowsAttachments = fichiers.map(item=>{
            const fuuid = item.fuuid,
                  fileId = fuuid
            const itemMappe = {fileId, ...item, version_courante: item}  // Simuler mapping avec version_courante
            let rowAttachment = preparerRowAttachment(workers, itemMappe)
            rowAttachment = {...rowAttachment, fuuid}
            return rowAttachment
        })
        setAttachments(rowsAttachments)
    }
}

function preparerRowAttachment(workers, fichier) {
    const tuuid = fichier.tuuid || fichier.fileId
    const mimetype = fichier.mimetype
    let pret = true
    if(mimetype) {
        const version_courante = fichier.version_courante || {}
        const { images, video } = version_courante
        const baseType = mimetype.toLowerCase().split('/').shift()
        if(mimetype === 'application/pdf') {
            pret = false
            if(images) pret = !! (images && images.thumb)
        } else if (baseType === 'image') {
            pret = false
            if(images) pret = !! (images && images.thumb)
        } else if (baseType === 'video') {
            pret = false
            if(images && video) {
                pret = images && images.thumb
                const mp4 = Object.keys(video).filter(item=>item.startsWith('video/mp4')).pop()
                pret = !! (images && images.thumb && mp4)
            }
        }
    }

    const fichierRebuild = {...fichier, tuuid}
    const fichierMappe = mapper(fichierRebuild, workers)

    return {...fichierMappe, tuuid, pret}
}
