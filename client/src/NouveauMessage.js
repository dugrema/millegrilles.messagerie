import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Form from 'react-bootstrap/Form'

import ReactQuill from 'react-quill'

import { ListeFichiers, FormatteurTaille, AlertTimeout, useDetecterSupport } from '@dugrema/millegrilles.reactjs'

import useWorkers, {useEtatConnexion, useUsager} from './WorkerContext'
import messagerieActions from './redux/messagerieSlice'
import { posterMessage, getClesFormattees } from './messageUtils'
import { uploaderFichiers } from './fonctionsFichiers'

import ModalContacts from './ModalContacts'
import ModalSelectionnerAttachement from './ModalSelectionnerAttachment'
import { MenuContextuelAttacher, MenuContextuelAttacherMultiselect, onContextMenu } from './MenuContextuel'
import { mapperRowAttachment } from './mapperFichier'

function NouveauMessage(props) {

    const { fermerNouveauMessage, showConfirmation, setMessageRepondre } = props

    const workers = useWorkers(),
          dispatch = useDispatch(),
          etatConnexion = useEtatConnexion(),
          usager = useUsager(),
          supportMedia = useDetecterSupport()

    const profil = useSelector(state=>state.contacts.profil),
          userId = useSelector(state=>state.contacts.userId),
          message_id_repondre = useSelector(state=>state.messagerie.message_id_repondre),
          message_id_transfert = useSelector(state=>state.messagerie.message_id_transfert),
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
    const [erreur, setErreur] = useState('')
    const [idDraft, setIdDraft] = useState('')
    const [optionVideo, setOptionVideo] = useState('faible')

    const attachmentsPrets = useMemo(()=>{
        return !attachmentsPending || attachmentsPending.length === 0
    }, [attachmentsPending])

    const erreurCb = useCallback((err, message)=>setErreur({err, message}), [setErreur])

    const fermer = useCallback( supprimerDraft => {
        fermerNouveauMessage()
    }, [fermerNouveauMessage, /* supprimerDraftCb, */ idDraft])

    const ajouterAttachmentsCb = useCallback(attachementsAjoutes => {
        setAttachments([...attachments, ...attachementsAjoutes])
    }, [attachments, setAttachments])

    const retirerAttachmentsCb = useCallback(fuuids => {
        const nouvelleListe = attachments.filter(item=>{
            const fuuid = item.fuuid || item.fileId || item.file
            const retirer = !! fuuids.includes(fuuid)
            return ! retirer
        })
        // console.debug("Retirer attachements %O, nouvelleListe : %O", fuuids, nouvelleListe)
        setAttachments(nouvelleListe)
    }, [attachments, setAttachments])

    const envoyerCb = useCallback(()=>{
        const opts = {reply_to: replyTo, uuid_thread: uuidThread, attachments, attachmentsCles, optionVideo}
        envoyer(workers, userId, certificatsMaitredescles, from, to, content, opts)
            .then(()=>{
                fermer(true)
            })
            .catch(err=>{
                console.error("Erreur envoi message : %O", err)
                erreurCb(err, 'Erreur envoi message')
            })
    }, [
        workers, userId, showConfirmation, certificatsMaitredescles, 
        from, to, replyTo, content, uuidThread, attachments, attachmentsCles, optionVideo,
        fermer, idDraft, erreurCb,
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

    useEffect(()=>{
        const { clesDao } = workers
        const certPromise = clesDao.getCertificatsMaitredescles()
        certPromise
            .then(certificats=>{
                // console.debug("Reponse certificats maitre des cles ", certificats)
                setCertificatsMaitredescles(certificats)
            })
            .catch(err=>erreurCb(err, "Erreur chargement du certificat de maitre des cles"))
    }, [workers, setCertificatsMaitredescles])

    // Preparer reponse ou transfert
    useEffect(()=>{
        if(listeMessages && (message_id_repondre || message_id_transfert)) {
            const message_id = message_id_repondre || message_id_transfert
            const messageTrouve = listeMessages.filter(item=>item.message_id===message_id).pop()
            if(messageTrouve) {
                let opts = {}
                if(message_id_transfert) {
                    // C'est un transfert
                    opts = {conserverAttachments: true, clearTo: true}
                }
                preparerReponse(workers, messageTrouve, setTo, setContent, setUuidThread, ajouterAttachmentsCb, setAttachmentsCles, opts)
                dispatch(messagerieActions.setUuidMessageActif(''))  // Clear message_id_repondre/message_id_transfert
            } else {
                console.error("NouveauMessage Erreur preparation repondre : Message %s introuvable ", message_id_repondre)
                dispatch(messagerieActions.setUuidMessageActif())    // Retour a la liste de messages
            }
        }
    }, [workers, dispatch, listeMessages, message_id_repondre, message_id_transfert, setTo, setContent, setUuidThread, setAttachments, setAttachmentsCles, setMessageRepondre])
    
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

    return (
        <>
            <AlertTimeout value={erreur} setValue={setErreur} titre="Erreur" variant="danger" />

            <Row>
                <Col xs={6} md={2} lg={2}>
                    <Form.Label htmlFor="inputTo">To</Form.Label>
                </Col>
                <Col xs={6} className="d-md-none buttonbar-right">
                    <Button variant="secondary" onClick={choisirContacts}><i className="fa fa-user-circle"/>{' '}Contacts</Button>
                </Col>
                <Col xs={12} md={7} lg={8}>
                    <Form.Control
                        type="text"
                        id="inputTo"
                        name="to"
                        value={to}
                        onChange={toChange}                        
                    />
                </Col>
                <Col md={3} lg={2} className="d-none d-md-block buttonbar-right">
                    <Button variant="secondary" onClick={choisirContacts}><i className="fa fa-user-circle"/>{' '}Contacts</Button>
                </Col>
            </Row>

            <Row>
                <Col xs={12} sm={2} lg={2}>
                    <Form.Label htmlFor="replyTo">Reply to</Form.Label>
                </Col>
                <Col xs={12} sm={10} lg={10}>
                    <Form.Control
                        type="text"
                        id="replyTo"
                        name="to"
                        value={replyTo}
                        onChange={replyToChange}
                    />
                </Col>
            </Row>

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
                // setAttachments={setAttachments} 
                ajouterAttachments={ajouterAttachmentsCb} 
                retirerAttachments={retirerAttachmentsCb}
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
                    <Button variant="secondary" onClick={()=>fermer(true)}>Annuler</Button>
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
        // console.debug("Attachments : ", opts.attachments)
        const {attachmentsMapping, fuuids} = mapperAttachments([...opts.attachments], opts)

        // Ajouter attachments et fuuids aux opts
        opts = {...opts, attachments: Object.values(attachmentsMapping), fuuids}
    }

    const resultat = await posterMessage(workers, certificatsChiffragePem, from, to, content, opts)
    // console.debug("Resultat poster message ", resultat)
    if(resultat.err) throw resultat.err
    if(resultat.ok === false) throw new Error("Erreur envoyer message")

    const mapDestinataires = resultat.commande.destinataires.reduce((acc, item)=>{
        acc[item] = null
        return acc
    }, {})

    // Sauvegarder dans la boite d'envoi
    const messageEnvoyer = {
        message_id: resultat.message_id,
        user_id: userId,
        message: {...resultat.commande.message /*, contenu: undefined*/},
        contenu: resultat.message,
        destinataires: mapDestinataires,
        date_envoi: resultat.commande.message.estampille,
        
        // Flags
        dechiffre: 'true',  // Flag en format string pour supporter index IDB
        lu: false,
        supprime: false,
    }

    // console.debug("envoyer Conserver message dans IDB : %O", userId, messageEnvoyer)

    const messageMaj = await messagerieDao.updateMessage(messageEnvoyer)
    // console.debug("envoyer Messages maj ", messageMaj)

    return messageMaj
}

function mapperAttachments(attachments, opts) {
    opts = opts || {}
    const optionVideo = opts.optionVideo || 'original'
    // Mapper data attachments
    let attachmentsMapping = {}
    let fuuids = []

    attachments.forEach( attachment => {
        // console.debug("mapperAttachments ", attachment)
        if(attachment.file && attachment.decryption) {
            // Deja mappe (e.g. Transfert de message)
            const fuuid = attachment.file
            // console.debug("mapperAttachement Deja fait, fuuid %s = %O", fuuid, attachment)
            attachmentsMapping[fuuid] = attachment
            fuuids.push(fuuid)
        } else {
            const { version_courante, metadata } = attachment
            const fuuid = attachment.fuuid_v_courante || attachment.fuuid
            fuuids.push(fuuid)

            const mapping = {
                metadata,
                ...version_courante,
                fuuid,
            }
            delete mapping.tuuid

            // console.debug("mapperAttachments Attachment %O", mapping)

            attachmentsMapping[fuuid] = mapping
        }
    })

    return { attachmentsMapping, fuuids }
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
        attachments, 
        // setAttachments, 
        ajouterAttachments, retirerAttachments,
        attachmentsPending, setAttachmentsPending,
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

    const listeAttachments = useMemo(()=>{
        const liste = []
        if(attachments) attachments.forEach(item=>{
            if(item.file && item.decryption) {
                // Item transfere (deja formatte). Convertir a format GrosFichiers
                const attachementConverti = mapperRowAttachment(item, workers)
                // console.debug("Attachement converti ", attachementConverti)
                liste.push({...attachementConverti, pret: true})
            } else {
                liste.push({...item, pret: true})
            }
        })
        if(attachmentsPending) attachmentsPending.forEach(item=>liste.push({...item, pret: false}))

        // console.debug("Maj liste Attachments combinee : %O (attachments : %O, attachmentsPending: %O)", liste, attachments, attachmentsPending)

        return liste
    }, [attachments, attachmentsPending])

    const selectionner = useCallback( (selection, opts) => {
        opts = opts || {}
        const upload = opts.upload

        if(upload) {
            // console.debug("Upload nouvel attachment : %O", selection)
            let attachmentsMaj = null
            if(attachmentsPending) {
                attachmentsMaj = [...attachmentsPending, ...selection]
            } else {
                attachmentsMaj = selection
            }
            // console.debug("Maj attachments pending pour selection : %O", attachmentsMaj)
            setAttachmentsPending([...attachmentsMaj])
        } else {
            // Fichier existant, provient d'une collection de l'usager
            if(attachments) {
                // Retirer fuuids deja selectionnes
                const attachmentsFuuids = attachments.map(item=>item.fuuid_v_courante)
                selection = selection.filter(item=>!attachmentsFuuids.includes(item.fuuid_v_courante))
            }
            // const attachmentsMaj = [...attachments, ...selection]
            // console.debug("Attachments maj : %O", attachmentsMaj)
            // console.debug("Ajouter attachements de selection ", selection)
            ajouterAttachments(selection)

            // Extraire la liste complete des fuuids de la selection
            const { fuuids /*, fuuidsCleSeulement*/ } = mapperAttachments(selection)
            // console.debug("AfficherAttachments Fuuids %O", fuuids)
            getClesFormattees(workers, fuuids, {delaiInitial: 500, tentatives: 2})
                .then(cles=>{
                    const clesMaj = {...attachmentsCles, ...cles}
                    setAttachmentsCles(clesMaj)
                })
                .catch(err=>{
                    console.error("Erreur chargement cles fuuids %s (tentative 1): %O", fuuids, err)
                })
        }

    }, [workers, attachments, attachmentsPending, attachmentsCles, /*setAttachments,*/ setAttachmentsPending, setAttachmentsCles])

    useEffect(()=>setColonnes(preparerColonnes), [setColonnes])

    const compteAttachments = attachments?attachments.length:0

    return (
        <div>
            <p></p>
            <div>Attachments</div>
            <Row className="liste-header">
                <Col xs={3}>
                    <BoutonsFormat modeView={modeView} setModeView={setModeView} />
                </Col>

                <Col xs={8} className="buttonbar-right">
                    <Button variant="secondary" onClick={choisirFichiersAttaches}>
                        <i className="fa fa-folder" />
                            {' '}Collections
                    </Button>
                </Col>
            </Row>

            {compteAttachments>0?
                <ListeFichiers 
                    modeView={modeView}
                    colonnes={colonnes}
                    rows={listeAttachments} 
                    onContextMenu={(event, value)=>onContextMenu(event, value, setContextuel)}
                    selection={selection}
                    onSelect={onSelectionLignes}
                />
                :''
            }

            <MenuContextuel
                workers={workers}
                contextuel={contextuel} 
                fermerContextuel={fermerContextuel}
                attachments={listeAttachments}
                //ajouterAttachments={ajouterAttachments}
                retirerAttachments={retirerAttachments}
                // setAttachments={setAttachments}
                selection={selection}
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
            //console.warn("Aucun match selection pour menu contextuel %s pas inclus dans %O", fichierTuuid, attachments)
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

// Prepare une reponse/transfert de messages
function preparerReponse(workers, message, setTo, setContent, setUuidThread, ajouterAttachments, setAttachmentsCles, opts) {
    opts = opts || {}
    const contenu = message.contenu

    const { conserverAttachments, clearTo } = opts
    const to = contenu.reply_to || contenu.from
    if(clearTo !== true) {
        setTo(to)
    }

    // const entete = message['en-tete'] || {}
    const dateMessageOriginalInt = message.message.estampille || message.date_reception
    const dateMessageOriginal = new Date(dateMessageOriginalInt * 1000)
    const messageOriginal = []
    messageOriginal.push('<br><br><p>-----</p>')
    messageOriginal.push('<p>On ' + dateMessageOriginal + ', ' + to + ' wrote:</p>')
    if(contenu.subject) {
        messageOriginal.push('<p>' + contenu.subject + '</p>')
    }
    messageOriginal.push(contenu.content)
    setContent(messageOriginal.join(''))

    const uuidThread = contenu.uuid_thread || message.message.id
    setUuidThread(uuidThread)

    const fichiers = contenu.files
    if(conserverAttachments && fichiers) {
        // console.debug("preparerReponse Conserver attachements : ", fichiers)
        ajouterAttachments(fichiers)
    }
}
