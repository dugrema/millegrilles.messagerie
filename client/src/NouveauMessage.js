import { useState, useEffect, useCallback, useMemo } from 'react'
import { proxy } from 'comlink'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Form from 'react-bootstrap/Form'
import Breadcrumb from 'react-bootstrap/Breadcrumb'

import ReactQuill from 'react-quill'
import { useDropzone } from 'react-dropzone'

import { ListeFichiers, FormatteurTaille, AlertTimeout } from '@dugrema/millegrilles.reactjs'

import { posterMessage } from './messageUtils'
import { chargerProfilUsager } from './profil'
import { uploaderFichiers } from './fonctionsFichiers'

import ModalContacts from './ModalContacts'
import ModalSelectionnerAttachement from './ModalSelectionnerAttachment'
import { MenuContextuelAttacher, MenuContextuelAttacherMultiselect, onContextMenu } from './MenuContextuel'
import { mapper } from './mapperFichier'
import * as MessageDao from './messageDao'

function NouveauMessage(props) {

    const { 
        workers, etatConnexion, setAfficherNouveauMessage, certificatMaitreDesCles, usager, userId, dnsMessagerie, 
        showConfirmation, messageRepondre, setMessageRepondre,
        evenementUpload, supportMedia,
    } = props

    const [to, setTo] = useState('')
    // const [cc, setCc] = useState('')
    // const [bcc, setBcc] = useState('')
    // const [subject, setSubject] = useState('')
    const [content, setContent] = useState('')
    // const [profil, setProfil] = useState('')
    const [replyTo, setReplyTo] = useState('')
    const [from, setFrom] = useState('')
    const [uuidThread, setUuidThread] = useState('')
    const [showContacts, setShowContacts] = useState(false)
    const [attachments, setAttachments] = useState('')
    const [attachmentsPrets, setAttachmentsPrets] = useState('')
    const [erreur, setErreur] = useState('')
    const [idDraft, setIdDraft] = useState('')
    const [drafts, setDrafts] = useState('')

    const erreurCb = useCallback((err, message)=>setErreur({err, message}), [setErreur])

    const supprimerDraftCb = useCallback(idDraft=>{
        idDraft = idDraft.currentTarget?Number.parseInt(idDraft.currentTarget.value):idDraft
        MessageDao.supprimerDraft(idDraft).catch(erreurCb)
        const draftsMaj = drafts.filter(item=>item.idDraft!==idDraft)
        setDrafts(draftsMaj)
    }, [drafts, setDrafts, erreurCb])

    const fermer = useCallback( supprimerDraft => {
        if(supprimerDraft === true) supprimerDraftCb(idDraft)
        setAfficherNouveauMessage(false)
    }, [setAfficherNouveauMessage, supprimerDraftCb, idDraft])

    const envoyerCb = useCallback(()=>{
        // const opts = {cc, bcc, reply_to: replyTo, uuid_thread: uuidThread, attachments}
        const opts = {reply_to: replyTo, uuid_thread: uuidThread, attachments}
        envoyer(workers, certificatMaitreDesCles, from, to, content, opts)
            .then(()=>{
                showConfirmation("Message envoye")
                supprimerDraftCb(idDraft)
                fermer(true)
            })
            .catch(err=>{
                console.error("Erreur envoi message : %O", err)
                // setErreur("Erreur envoi message\n%s", ''+err)
                erreurCb(err, 'Erreur envoi message')
            })
    }, [
        workers, showConfirmation, certificatMaitreDesCles, 
        from, to, replyTo, content, uuidThread, attachments, 
        fermer, supprimerDraftCb, idDraft, erreurCb,
    ])

    const toChange = useCallback(event=>setTo(event.currentTarget.value), [setTo])
    // const ccChange = useCallback(event=>setCc(event.currentTarget.value), [setCc])
    // const bccChange = useCallback(event=>setBcc(event.currentTarget.value), [setBcc])
    // const subjectChange = useCallback(event=>setSubject(event.currentTarget.value), [setSubject])
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
        MessageDao.getDraft(idDraft)
            .then(draft=>{
                // console.debug("Recharger draft : %O", draft)
                const {from, to, replyTo, content, attachments} = draft
                setIdDraft(draft.idDraft)
                setFrom(from)
                setTo(to)
                setReplyTo(replyTo)
                setContent(content)
                if(attachments) {
                    const attachmentsMappes = Object.values(attachments).map(fichier=>{
                        const fuuid = fichier.fileId
                        const row = preparerRowAttachment(workers, fichier)
                        const fichierMappe = {...row, ...fichier, fuuid}
                        return fichierMappe
                    })
                    // console.debug("Attachments : %O, attachments mappes : %O", attachments, attachmentsMappes)
                    setAttachments(attachmentsMappes)
                } else {
                    setAttachments('')
                }
            })
            .catch(erreurCb)
    }, [workers, setIdDraft, setFrom, setTo, setReplyTo, setContent, setAttachments, erreurCb])

    useEffect(()=>{
        MessageDao.getListeDrafts()
            .then(drafts=>{
                // console.debug("Drafts : %O", drafts)
                setDrafts(drafts)
            })
            .catch(erreurCb)
    }, [setDrafts, erreurCb])

    useEffect(()=>{
        if(messageRepondre) {
            preparerReponse(messageRepondre, setTo, setContent, setUuidThread)
            setMessageRepondre('')  // Reset message repondre
        }
    }, [messageRepondre, setTo, setContent, setUuidThread, setMessageRepondre])

    useEffect(()=>{
        const from = `@${usager.nomUsager}/${dnsMessagerie}`
        setFrom(from)

        chargerProfilUsager(workers, {usager, dnsMessagerie})
            .then( profil => {
                // console.debug("Profil recu : %O", profil)
                // setProfil(profil)
                const replyTo = profil.adresses?profil.adresses[0]:''
                setReplyTo(replyTo)
            })
            .catch(err=>console.error("Erreur chargement profil : %O", err))
    //}, [workers, usager, dnsMessagerie, setProfil, setReplyTo])
    }, [workers, usager, dnsMessagerie, setReplyTo])

    useEffect(()=>{
        if(!idDraft) {
            if(to || content || attachments) {  // Champs modifiables par l'usager
                // Creer un nouveau draft
                // console.debug("Creer nouveau id draft")
                MessageDao.ajouterDraft().then(idDraft=>{
                    // console.debug("Creer draft, nouveau id : %O", idDraft)
                    setIdDraft(idDraft)
                }).catch(erreurCb)
            }
        } else {
            // Conserver information draft
            // console.debug("Sauvegarder draft %s (attachments: %O)", idDraft, attachments)
            // const {attachmentsMapping, fuuids, fuuidsCleSeulement} = mapperAttachments([...attachments])
            let attachmentsMapping = null
            if(attachments) {
                const fieldsConserver = ['duree', 'fileId', 'fuuid', 'mimetype', 'nom', 'pret', 'taille', 'version_courante']
                attachmentsMapping = attachments.map(item=>{
                    const attach = {}
                    fieldsConserver.forEach(champ=>{ if(item[champ]) attach[champ] = item[champ] })
                    // console.debug("attach : %O", attach)
                    return attach
                })
            }
            MessageDao.sauvegarderDraft(idDraft, {from, to, replyTo, content, attachments: attachmentsMapping}).catch(erreurCb)
        }
    }, [idDraft, from, to, replyTo, content, attachments, setIdDraft, erreurCb])

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
                evenementUpload={evenementUpload} 
                setAttachmentsPrets={setAttachmentsPrets}
                supportMedia={supportMedia}
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

async function envoyer(workers, certificatChiffragePem, from, to, content, opts) {
    opts = opts || {}

    if(opts.attachments) {
        // Mapper data attachments
        const {attachmentsMapping, fuuids, fuuidsCleSeulement} = mapperAttachments([...opts.attachments])

        // Ajouter attachments et fuuids aux opts
        opts = {...opts, attachments: Object.values(attachmentsMapping), fuuids, fuuidsCleSeulement}
    }

    const resultat = await posterMessage(workers, certificatChiffragePem, from, to, content, opts)
    if(resultat.err) throw resultat.err
}

function mapperAttachments(attachments) {
    // Mapper data attachments
    let attachmentsMapping = {}
    let fuuids = []
    let fuuidsCleSeulement = []

    attachments.forEach( attachment => {
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
                const videos = version_courante.video
                // mapping.video = {...videos}
                Object.values(videos).forEach(video=>{
                    // console.debug("Attache video : %O", video)
                    if(video.fuuid_video) {
                        fuuids.push(video.fuuid_video)
                    }
                })
            }
        }

        attachmentsMapping[fuuid] = mapping
    })

    return {attachmentsMapping, fuuids, fuuidsCleSeulement}
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
    const { workers, attachments, setAttachments, setAttachmentsPrets, etatConnexion, evenementUpload, erreurCb } = props

    const [colonnes, setColonnes] = useState('')
    const [modeView, setModeView] = useState('')
    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})
    const [selection, setSelection] = useState('')
    const [showAttacherFichiers, setShowAttacherFichiers] = useState(false)
    const [evenementUpload1, addEvenementUpload1] = useState('')
    
    const fermerContextuel = useCallback(()=>setContextuel(false), [setContextuel])
    const onSelectionLignes = useCallback(selection=>{setSelection(selection)}, [setSelection])
    const choisirFichiersAttaches = useCallback(event=>setShowAttacherFichiers(true), [setShowAttacherFichiers])
    const fermerAttacherFichiers = useCallback(event=>setShowAttacherFichiers(false), [setShowAttacherFichiers])

    const addEvenementUpload1Proxy = useMemo(()=>proxy(addEvenementUpload1), [addEvenementUpload1])
    const tuuidsAttachments = useMemo(()=>{
        if(attachments) {
            return attachments.filter(item=>(item.tuuid||item.fileId)).map(item=>(item.tuuid||item.fileId))
        }
        return []
    }, [attachments])

    const selectionner = useCallback( selection => {
        // console.debug("Selection : %O", selection)
        if(attachments) {
            // Retirer fuuids deja selectionnes
            const attachmentsFuuids = attachments.map(item=>item.fuuid)
            selection = selection.filter(item=>!attachmentsFuuids.includes(item.fuuid))
        }
        const fuuidsMaj = [...attachments, ...selection]
        setAttachments(fuuidsMaj)
    }, [attachments, setAttachments])

    const onDrop = useCallback(acceptedFiles=>{
        preparerUploaderFichiers(workers, acceptedFiles)
            .then(info=>{
                // console.debug("Preparer uploads info : %O", info)
                const { infoUploads } = info
                const listeSelection = infoUploads.map(item=>{
                    const { correlation, transaction } = item
                    return { fileId: correlation, correlation, ...transaction }
                })
                selectionner(listeSelection)
            })
            .catch(erreurCb)
    }, [workers, selectionner, erreurCb])
    const dzHook = useDropzone({onDrop})
    const {getRootProps, getInputProps} = dzHook

    useEffect(()=>setColonnes(preparerColonnes), [setColonnes])

    // Capturer evenement upload
    useEffect(()=>addEvenementUpload1(evenementUpload), [evenementUpload, addEvenementUpload1])
    // Traiter evenement upload
    useEffect(()=>{
        if(evenementUpload1 && attachments) {
            addEvenementUpload1('')  // Eviter cycle
            // console.debug("!!! AfficherAttachements evenement upload : %O", evenementUpload1)
            if(evenementUpload1.routingKey) {
                const { tuuid } = evenementUpload1.message
                const attachmentsMaj = attachments.map(item=>{
                    const fileId = item.fileId || item.tuuid
                    if(fileId === tuuid) { // Remplacer
                        const fichier = {fileId, ...evenementUpload1.message}
                        // Determiner si l'attachment est pret
                        return preparerRowAttachment(workers, fichier)
                    }
                    return item
                })
                setAttachments(attachmentsMaj)
            } else {
                const { complete, transaction } = evenementUpload1
                // const nouvelUpload = { correlation: complete, ...transaction }
                const attachmentsMaj = attachments.map(item=>{
                    if(transaction && item.correlation === complete) { // Remplacer
                        const entete = transaction['en-tete']
                        const tuuid = entete.uuid_transaction
                        return {fileId: tuuid, tuuid, ...transaction, pret: false}
                    }
                    return item
                })
                setAttachments(attachmentsMaj)
            }
        }
    }, [workers, evenementUpload1, attachments, setAttachments, addEvenementUpload1])

    // Enregistrer evenements ecoute maj fichiers (attachments)
    useEffect(()=>{
        const { connexion } = workers
        if(tuuidsAttachments && tuuidsAttachments.length > 0) {
            const params = {tuuids: tuuidsAttachments}
            // console.debug("Ajouter listener fichiers %O", params)
            connexion.enregistrerCallbackMajFichier(params, addEvenementUpload1Proxy).catch(erreurCb)
            return () => {
                // console.debug("Retirer listener fichiers %O", params)
                connexion.retirerCallbackMajFichier(params, addEvenementUpload1Proxy).catch(erreurCb)
            }
        }
    }, [workers, tuuidsAttachments, addEvenementUpload1Proxy, erreurCb])

    useEffect(()=>{
        if(attachments) {
            const pret = attachments.reduce((acc, item)=>acc&&item.pret, true)
            setAttachmentsPrets(pret)
        } else {
            setAttachmentsPrets(true)
        }
    }, [attachments, setAttachmentsPrets])

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

            <ModalSelectionnerAttachement 
                show={showAttacherFichiers} 
                etatConnexion={etatConnexion}
                workers={workers} 
                fermer={fermerAttacherFichiers} 
                selectionner={selectionner} />

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
            'nom': {'label': 'Nom', showThumbnail: true, xs: 11, lg: 7},
            'taille': {'label': 'Taille', className: 'details', formatteur: FormatteurTaille, xs: 3, lg: 1},
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

function preparerReponse(messageRepondre, setTo, setContent, setUuidThread) {
    console.debug("Initialiser valeurs de la reponse a partir de : %O", messageRepondre)
    const { message, conserverAttachments, clearTo } = messageRepondre
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
            if(images) {
                pret = !! (images && images.thumb)
            }
        } else if (baseType === 'image') {
            pret = false
            if(images) {
                // Attendre webp et jpg
                const webp = Object.keys(images).filter(item=>item.startsWith('image/webp')).pop()
                const jpg = Object.keys(images).filter(item=>item.startsWith('image/jpeg')).pop()
                // console.debug("Webp: %O, jpg: %O", webp, jpg)
                pret = !! (webp && jpg)
            }
        } else if (baseType === 'video') {
            pret = false
            if(images && video) {
                pret = images && images.thumb
                const mp4 = Object.keys(video).filter(item=>item.startsWith('video/mp4')).pop()
                const webm = Object.keys(video).filter(item=>item.startsWith('video/webm')).pop()
                pret = !! (images && images.thumb && mp4 && webm)
            }
        }
    }

    const fichierRebuild = {...fichier, tuuid}
    const fichierMappe = mapper(fichierRebuild, workers)

    return {...fichierMappe, tuuid, pret}
}
