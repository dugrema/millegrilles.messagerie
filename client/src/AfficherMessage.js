import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { base64 } from 'multiformats/bases/base64'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import ReactQuill from 'react-quill'
import multibase from 'multibase'

import { ListeFichiers, FormatteurTaille, FormatterDate, useDetecterSupport, hachage } from '@dugrema/millegrilles.reactjs'

import useWorkers, {useEtatConnexion, useEtatAuthentifie, useUsager} from './WorkerContext'
import messagerieActions, { thunks as messagerieThunks } from './redux/messagerieSlice'

import { MenuContextuelAfficherAttachments, MenuContextuelAfficherAttachementsMultiselect, onContextMenu } from './MenuContextuel'
import { mapDocumentComplet, mapperRowAttachment, mapperFichiers } from './mapperFichier'
// import { detecterSupport } from './fonctionsFichiers'

import ModalSelectionnerCollection from './ModalSelectionnerCollection'
import PreviewFichiers from './FilePlayer'
import AfficherVideo from './AfficherVideo'
import AfficherAudio from './AfficherAudio'

const CONST_INTERVALLE_VERIFICATION_ATTACHMENTS = 20_000
const CONST_CHAMPS_CHIFFRAGE = ['format', 'header', 'iv', 'tag']

function AfficherMessage(props) {
    const { downloadAction } = props

    const workers = useWorkers(),
          dispatch = useDispatch(),
          supportMedia = useDetecterSupport(),
          etatConnexion = useEtatConnexion(),
          etatAuthentifie = useEtatAuthentifie(),
          usager = useUsager()

    const listeMessages = useSelector(state=>state.messagerie.liste),
          message_id = useSelector(state=>state.messagerie.message_id)

    const message = useMemo(()=>{
        console.debug("AfficherMessage id %s, liste %O", message_id, listeMessages)
        const message = listeMessages.filter(item=>item.message_id===message_id).pop()
        console.debug("AfficheMessage ", message)
        return message
    }, [message_id, listeMessages])

    const [showChoisirCollection, setChoisirCollection] = useState(false)
    const [afficherVideo, setAfficherVideo] = useState(false)
    const [afficherAudio, setAfficherAudio] = useState(false)
    const [selectionAttachments, setSelectionAttachments] = useState('')

    const retour = useCallback(()=>dispatch(messagerieActions.setUuidMessageActif(null)), [dispatch])

    const fermerChoisirCollectionCb = useCallback(event=>setChoisirCollection(false), [setChoisirCollection])

    const choisirCollectionCb = useCallback(()=>setChoisirCollection(true), [setChoisirCollection])

    const copierVersCollection = useCallback( cuuid => {
        const attachments = message.attachments

        console.debug("copierVersCollection cuuid %s selection %O (ref attachments %O)", cuuid, selectionAttachments, attachments)
        const fuuids = selectionAttachments
        const fichiersSelectionnes = attachments.fichiers.filter(item=>fuuids.includes(item.fuuid))
        const cles = fuuids.reduce((acc, fuuid)=>{
            acc[fuuid] = attachments.cles[fuuid]
            return acc
        }, {})
        console.debug("copierVersCollection cuuid %s cles %O fichiers %O", cuuid, cles, fichiersSelectionnes)

        copierAttachmentVersCollection(workers, fichiersSelectionnes, cles, cuuid, usager)
            .catch(err=>console.error("Erreur copie attachment vers collection : %O", err))
    }, [workers, selectionAttachments, message, usager])

    const repondreCb = useCallback(()=>dispatch(messagerieActions.preparerRepondreMessage()), [dispatch])
    const transfererCb = useCallback(()=>dispatch(messagerieActions.preparerTransfererMessage()), [dispatch])

    useEffect(()=>{
        if(etatConnexion && etatAuthentifie && message && !message.lu && !message.date_envoi) {
            marquerMessageLu(workers, message_id)
        }
    }, [workers, etatConnexion, etatAuthentifie, message])

    return (
        <>
            <RenderMessage 
                downloadAction={downloadAction}
                message={message} 
                infoMessage={message} 
                choisirCollectionCb={choisirCollectionCb} 
                repondreCb={repondreCb} 
                transfererCb={transfererCb}
                supportMedia={supportMedia} 
                afficherVideo={afficherVideo}
                setAfficherVideo={setAfficherVideo} 
                afficherAudio={afficherAudio}
                setAfficherAudio={setAfficherAudio} 
                setSelectionAttachments={setSelectionAttachments} 
                retourMessages={retour} />

            <ModalSelectionnerCollection 
                show={showChoisirCollection} 
                etatConnexion={etatConnexion}
                workers={workers} 
                fermer={fermerChoisirCollectionCb} 
                onSelect={copierVersCollection} />
        </>
    )

}

export default AfficherMessage

function RenderMessage(props) {

    const { 
        downloadAction, choisirCollectionCb, 
        repondreCb, transfererCb, retourMessages,
        afficherVideo, setAfficherVideo, 
        afficherAudio, setAfficherAudio, 
        supportMedia, certificatMaitreDesCles, 
        setSelectionAttachments,
    } = props

    const workers = useWorkers()

    const message = props.message || {}
    const message_id = message.message_id
    const infoMessage = props.infoMessage || {}
    const contenu = message.contenu || {}
    const { to, cc, from, reply_to, subject, content, files } = contenu
    const estampille = message.message.estampille
    const { date_reception } = infoMessage
    const fichiers = message.fichiers || {}
    const fichiers_completes = message.fichiers_completes || false

    const dateEstampille = new Date(estampille)

    const erreurCb = useCallback((err, message)=>{
        console.error("Erreur : %O, message : %s", err, message)
    }, [])

    const supprimerCb = useCallback(()=>{
        workers.connexion.supprimerMessages(message_id)
            .then( retourMessages )
            .catch(erreurCb)
    }, [workers, retourMessages, message_id, erreurCb])

    if(!props.message) return ''

    return (
        <>
            <Header>
                <Row>
                    <Col xs={12} md={8}>
                        <AfficherAdresses from={from} reply_to={reply_to} to={to} cc={cc} />
                        <AfficherDateSujet date_reception={date_reception} date_estampille={dateEstampille} subject={subject} />
                    </Col>
                    <Col>
                        <div className="buttonbar-right mail">
                            <Button onClick={repondreCb}><i className="fa fa-reply"/>{' '}Repondre</Button>
                            <Button variant="secondary" onClick={transfererCb}><i className="fa fa-mail-forward"/>{' '}Transferer</Button>
                            <Button variant="secondary" onClick={supprimerCb}><i className="fa fa-trash"/>{' '}Supprimer</Button>
                        </div>
                    </Col>
                </Row>
            </Header>

            <ContenuMessage 
                content={content}
                downloadAction={downloadAction}
                message_id={message_id}
                choisirCollectionCb={choisirCollectionCb} 
                supportMedia={supportMedia} 
                afficherVideo={afficherVideo}
                setAfficherVideo={setAfficherVideo} 
                afficherAudio={afficherAudio}
                setAfficherAudio={setAfficherAudio} 
                certificatMaitreDesCles={certificatMaitreDesCles} 
                setSelectionAttachments={setSelectionAttachments} 
                fichiers={files} 
                fichiers_status={fichiers}
                fichiers_completes={fichiers_completes} />

        </>
    )
}

function ContenuMessage(props) {
    const { 
        downloadAction, content, certificatMaitreDesCles,
        fichiers, choisirCollectionCb, supportMedia, 
        afficherVideo, setAfficherVideo, 
        afficherAudio, setAfficherAudio, 
        setSelectionAttachments,
        message_id,
        fichiers_status, fichiers_completes,
    } = props

    const workers = useWorkers(),
          etatConnexion = useEtatConnexion(),
          usager = useUsager()

    const fermerAfficherVideo = useCallback(()=>setAfficherVideo(false))
    const fermerAfficherAudio = useCallback(()=>setAfficherAudio(false))

    const attachmentMappe = useMemo(()=>{
        if(!fichiers) return

        console.debug("ContenuMessage mapper (afficher video %O) %O", afficherVideo, fichiers)

        const videoItem = fichiers.filter(item=>item.file===afficherVideo).pop()
        const audioItem = fichiers.filter(item=>item.file===afficherAudio).pop()

        let attachmentMappe = null
        if(videoItem) {
            console.debug("ContenuMessage afficher videoItem ", videoItem)
            const fuuidFichier = videoItem.file
            const fichierVideoMappe = mapperFichiers([videoItem], true).pop()
            console.debug("ContenuMessage afficher video (mappe) ", fichierVideoMappe)

            const creerToken = async fuuidVideo => {
                if(Array.isArray(fuuidVideo)) fuuidVideo = fuuidVideo.pop()

                console.debug("creerToken fuuidVideo %O, videoItem %O", fuuidVideo, videoItem)
                const videoDict = videoItem.media.videos
                let infoVideo = null,
                    paramsDecryption = null
                if(fuuidVideo === videoItem.file) {
                    // Original
                    //infoVideo = videoItem
                    infoVideo = fichierVideoMappe.version_courante
                    paramsDecryption = videoItem.decryption
                } else {
                    //infoVideo = Object.values(videoItem.media.videos).filter(item=>item.file===fuuidVideo).pop()
                    infoVideo = Object.values(videoDict).filter(item=>item.file===fuuidVideo).pop()
                    paramsDecryption = infoVideo.decryption
                }
                console.debug("creerToken Afficher infoVideo %O, params decryption %O", infoVideo, paramsDecryption)
                const paramsChiffrage = {}
                for (const champ of CONST_CHAMPS_CHIFFRAGE) {
                    if(paramsDecryption[champ]) paramsChiffrage[champ] = paramsDecryption[champ]
                }
                console.debug("creerToken Params chiffrages ", paramsChiffrage)

                const mimetype = infoVideo.mimetype

                // const cleFuuid = fichiers.cles[fuuidFichier]
                const cleFuuid = {...videoItem.decryption, cleSecrete: base64.decode(videoItem.decryption.key)}
                console.debug("ContenuMessage.creerToken creerTokensStreaming avec cleFuuid %O pour videoItem %O", cleFuuid, videoItem)

                const jwts = await creerTokensStreaming(workers, fuuidFichier, cleFuuid, fuuidVideo, usager, {...paramsChiffrage}, {mimetype})
                console.debug("ContenuMessage.creerToken JWTS tokens : %O", jwts)
                return {jwts}
            }

            attachmentMappe = mapperRowAttachment(videoItem, workers, {genererToken: true, creerToken})
        } else if(audioItem) {
            const fuuidFichier = audioItem.digest
            const mimetype = audioItem.mimetype

            const creerToken = async fuuidAudio => {
                if(Array.isArray(fuuidAudio)) fuuidAudio = fuuidAudio.pop()
                console.debug("!!! usager : %O\nfuuidAudio : %O", usager, fuuidAudio)
                // console.debug("Creer token video fuuid : %O (fuuidAudio: %O, cles: %O)", fuuid, fuuidAudio, attachments.cles)

                const cleFuuid = fichiers.cles[fuuidFichier]

                const jwts = await creerTokensStreaming(workers, fuuidFichier, cleFuuid, fuuidFichier, usager, {mimetype})
                console.debug("ContenuMessage.creerToken JWTS tokens : %O", jwts)
                return jwts
            }

            attachmentMappe = mapperRowAttachment(audioItem, workers, {genererToken: true, creerToken})
        }

        console.debug("ContenuMessage Attachement mappe : ", attachmentMappe)

        return attachmentMappe
    }, [workers, afficherVideo, afficherAudio, certificatMaitreDesCles, fichiers, usager])

    if(afficherVideo && attachmentMappe) {
        // console.debug("ContenuMessage PROPPIES : %O", props)
        return (
            <AfficherVideo
                workers={workers}
                support={supportMedia}
                fichier={attachmentMappe}
                certificatMaitreDesCles={certificatMaitreDesCles}
                fermer={fermerAfficherVideo} />
        )
    } else if(afficherAudio && attachmentMappe) {
        // console.debug("ContenuMessage PROPPIES : %O", props)
        return (
            <AfficherAudio
                workers={workers}
                support={supportMedia}
                fichier={attachmentMappe}
                certificatMaitreDesCles={certificatMaitreDesCles}
                fermer={fermerAfficherAudio} />
        )
    }

    return (
        <>
            <AfficherMessageQuill content={content} />

            <AfficherAttachments 
                workers={workers} 
                etatConnexion={etatConnexion}
                downloadAction={downloadAction}
                message_id={message_id}
                fichiers={fichiers} 
                choisirCollectionCb={choisirCollectionCb} 
                supportMedia={supportMedia} 
                setAfficherVideo={setAfficherVideo} 
                setAfficherAudio={setAfficherAudio} 
                setSelectionAttachments={setSelectionAttachments}
                fichiers_status={fichiers_status}
                fichiers_completes={fichiers_completes} />        
        </>
    )
}

function Header(props) {
    return (
        <>
            {props.children}
            <hr/>
        </>
    )
}

function AfficherDateSujet(props) {

    const { date_reception, date_estampille, subject } = props

    return (
        <>
            <Row>
                <Col xs={3} md={2} lg={2}>Date :</Col>
                <Col xs={9} md={10} lg={4}><FormatterDate value={date_estampille}/></Col>
                <Col xs={3} md={2} lg={2}>Recu :</Col>
                <Col xs={9} md={10} lg={4}><FormatterDate value={date_reception}/></Col>
            </Row>
            <Row className="sujet">
                <Col><strong>{subject}</strong></Col>
            </Row>
        </>
    )
}

function AfficherAdresses(props) {
    const { from, reply_to, to, cc } = props
    let afficherReplyTo = reply_to && reply_to !== from

    const [toFormatte, setToFormatte] = useState('')
    const [ccFormatte, setCcFormatte] = useState('')

    useEffect(()=>{
        if(to) {
            const toFormatte = to.join('; ')
            setToFormatte(toFormatte)
        } else {
            setToFormatte('')
        }
    }, [to, setToFormatte])

    useEffect(()=>{
        if(cc) {
            const ccFormatte = cc.join('; ')
            setCcFormatte(ccFormatte)
        } else {
            setCcFormatte('')
        }
    }, [cc, setCcFormatte])

    return (
        <>
            <Row>
                <Col xs={12} md={2}>From:</Col>
                <Col>{from}</Col>
            </Row>
            
            {afficherReplyTo?
            <Row>
                <Col xs={12} md={2}>Reply to:</Col>
                <Col>{reply_to}</Col>
            </Row>
            :''
            }

            <Row>
                <Col xs={12} md={2}>To:</Col>
                <Col>{toFormatte}</Col>
            </Row>

            {ccFormatte?
                <Row>
                    <Col xs={12} md={2}>To:</Col>
                    <Col>{ccFormatte}</Col>
                </Row>
                :''
            }
        </>
    )
}

function AfficherMessageQuill(props) {
    const { content } = props
    return (
        <>
            <ReactQuill className="afficher" value={content} readOnly={true} theme=''/>
            <br className="clear"/>
        </>
    )
}

async function marquerMessageLu(workers, message_id) {
    try {
        await workers.connexion.marquerLu(message_id, true)
        // console.debug("Reponse marquer message %s lu : %O", message_id, reponse)
    } catch(err) {
        console.error("Erreur marquer message %s lu : %O", message_id, err)
    }
}

function AfficherAttachments(props) {
    // console.debug("AfficherAttachments proppys : %O", props)
    const { 
        workers, fichiers, etatConnexion, downloadAction, 
        supportMedia, setSelectionAttachments, choisirCollectionCb, 
        setAfficherVideo, setAfficherAudio,
        fichiers_status, fichiers_completes,
        message_id,
    } = props

    const dispatch = useDispatch()
    const userId = useSelector(state=>state.messagerie.userId)

    const colonnes = useMemo(preparerColonnes, [])

    // const [colonnes, setColonnes] = useState('')
    const [modeView, setModeView] = useState('')
    const [attachmentsList, setAttachmentsList] = useState('')
    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})
    const [selection, setSelection] = useState('')
    const [showPreview, setShowPreview] = useState(false)
    // const [support, setSupport] = useState({})
    const [fuuidSelectionne, setFuuidSelectionne] = useState('')

    const fermerContextuel = useCallback(()=>setContextuel(false), [setContextuel])
    const onSelectionLignes = useCallback(selection=>{
        // console.debug("!!! setSelectioN: %O", selection)
        setSelection(selection)
        setSelectionAttachments(selection)
    }, [setSelection, setSelectionAttachments])
    const showPreviewCb = useCallback( fuuid => {
        // console.debug("Show preview cb : %O", fuuid)
        setFuuidSelectionne(fuuid)
        setShowPreview(true)
    }, [setShowPreview, setFuuidSelectionne])
    const showPreviewSelection = useCallback( item => {
        console.debug("showPreviewSelection ", item)
        const fuuid = item.fuuid
        if(!fuuid) return

        setFuuidSelectionne(fuuid)
        const fileItem = attachmentsList.filter(item=>item.fuuid===fuuid).pop()
        const mimetype = fileItem.mimetype || ''
        console.debug("Afficher fuuid %s (mimetype: %s), fileItem %O", fuuid, mimetype, fileItem)
        if(mimetype.startsWith('video/')) {
            // Page Video
            setAfficherVideo(fuuid)
        } else if(mimetype.startsWith('audio/')) {
            // Page Video
            setAfficherAudio(fuuid)
        } else {
            // Preview/carousel
            setShowPreview(true)
        }

    }, [selection, setShowPreview, setFuuidSelectionne, setAfficherVideo, setAfficherAudio, attachmentsList])

    useEffect(()=>{
        console.debug("Fichiers : %O, fichiers_status : %O, fichiers_completes : %O", fichiers, fichiers_status, fichiers_completes)
        if(!fichiers) { setAttachmentsList(''); return }  // Rien a faire

        // if(Array.isArray(fichiers)) {
        //     // Message envoye, pas d'info
        //     console.debug("Liste attachments message envoye : %O", fichiers)
        // } else {
            // Message recu
            // const { cles, fichiers } = attachments

            // Premier mapping d'attachements vers format GrosFichiers (pour le 'mapper')
            const listeFichiers = mapperFichiers(fichiers, fichiers_completes, fichiers_status)
            console.debug("Liste attachments combines : %O", listeFichiers)
            const listeMappee = listeFichiers.map(item=>{
                const cles = {[item.fuuid_v_courante]: {
                    ...item.decryption,
                    cleSecrete: base64.decode(item.decryption.key),
                }}
                console.debug("Liste mappee cles ", cles)
                return mapDocumentComplet(workers, item, {ref_hachage_bytes: item.fuuid_v_courante, cles, supportMedia})
            })

            console.debug("Liste mappee ", listeMappee)

            setAttachmentsList(listeMappee)
        // }
    }, [workers, fichiers, fichiers_status, fichiers_completes, supportMedia, setAttachmentsList])

    let verifierAttachments = (fichiers && !fichiers_completes)
    if(!fichiers_completes && fichiers_status && Object.keys(fichiers_status).length > 0) {
        // S'assurer qu'on a au moins 1 attachement manquant
        verifierAttachments = Object.values(fichiers_status).reduce((acc, item)=>{
            acc = acc || !item
            return acc
        }, false)
    }
    // console.debug("Verifier attachments %O, status %O", verifierAttachments, attachments_status)

    // Recharger le message si les attachements ne sont pas tous traites
    useEffect(()=>{
        if(!verifierAttachments) return     // Rien a faire
        reloadMessage(workers, dispatch, message_id, userId)
            .catch(err=>console.error("Erreur maj message pour attachements incomplets : ", err))
        
        // Reload message
        const interval = setInterval(()=>{
            reloadMessage(workers, dispatch, message_id, userId)
                .catch(err=>console.error("Erreur maj message pour attachements incomplets : ", err))
        }, CONST_INTERVALLE_VERIFICATION_ATTACHMENTS)
        
        return () => clearInterval(interval)  // Cleanup interval
    }, [workers, dispatch, userId, message_id, verifierAttachments])

    if(!attachmentsList) return ''

    return (
        <>
            <h2>Attachements</h2>

            <Row>
                <Col>
                    <BoutonsFormat modeView={modeView} setModeView={setModeView} />
                </Col>
            </Row>

            <ListeFichiers 
                modeView={modeView}
                colonnes={colonnes}
                rows={attachmentsList} 
                selection={selection}
                onOpen={showPreviewSelection}
                onContextMenu={(event, value)=>onContextMenu(event, value, setContextuel)}
                onSelect={onSelectionLignes}
            />
            
            <MenuContextuel
                workers={workers}
                contextuel={contextuel} 
                fermerContextuel={fermerContextuel}
                fichiers={fichiers}
                attachmentsList={attachmentsList}
                selection={selection}
                showPreview={showPreviewCb}
                // showInfoModalOuvrir={showInfoModalOuvrir}
                downloadAction={downloadAction}
                etatConnexion={etatConnexion}
                choisirCollectionCb={choisirCollectionCb}
            />            

            <PreviewFichiers 
                workers={workers}
                showPreview={showPreview} 
                setShowPreview={setShowPreview}
                fuuid={fuuidSelectionne}
                fichiers={attachmentsList}
                supportMedia={supportMedia}
            />

        </>
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
    // console.debug("MenuContextuel proppys : %O", props)

    const { contextuel, fichiers, attachmentsList, selection } = props

    if(!contextuel.show) return ''

    // console.debug("!!! Selection : %s, FICHIERS : %O, mappes : %O", selection, attachments, attachmentsList)

    if( selection && selection.length > 1 ) {
        return <MenuContextuelAfficherAttachementsMultiselect selection={selection} {...props} />
    } else if(selection.length>0 && fichiers) {
        const fuuid = selection[0]
        console.debug("Selection fichiers ", fichiers)
        const attachment = fichiers.filter(item=>item.file===fuuid).pop()
        const attachmentListDetail = attachmentsList.filter(item=>item.fuuid===fuuid).pop()
        console.debug("Attachement %O, Details %O", attachment, attachmentListDetail)
        const attachmentDetail = {...attachmentListDetail, ...attachment}
        if(attachment) {
            console.debug("Download attachement : ", attachment)
            const cles = {[attachment.fuuid]: attachment.decryption.cleSecrete}
            return <MenuContextuelAfficherAttachments attachment={attachmentDetail} cles={cles} {...props} />
        }
    }

    return ''
}

async function copierAttachmentVersCollection(workers, fichiers, cles, cuuid, usager) {
    // console.debug("copierAttachmentVersCollection Copier vers collection %O\nAttachment%O", cuuid, fichiers)
    const {connexion, chiffrage, clesDao} = workers
    const listeCertificatMaitreDesCles = await clesDao.getCertificatsMaitredescles()
    const caPem = usager.ca
    listeCertificatMaitreDesCles.push(caPem)

    // console.debug("copierAttachmentVersCollection Certificats chiffrage")

    // const {fuuid, version_courante} = attachment

    // Creer hachage de preuve
    const {fingerprint} = await connexion.getCertificatFormatteur()
    // console.debug("Certificat signature : ", fingerprint)
    const dictPreuves = {}, dictClesSecretes = {}
    for await (const fuuid of Object.keys(cles)) {
        const cleSecrete = cles[fuuid].cleSecrete
        const {preuve, date} = await hacherPreuveCle(fingerprint, cleSecrete)
        dictClesSecretes[fuuid] = cleSecrete
        dictPreuves[fuuid] = {preuve, date}
    }
    // console.debug("copierAttachmentVersCollection Cles secretes %O, preuves : %O, rechiffrer avec cles maitre des cles %O", 
    //     dictClesSecretes, dictPreuves, listeCertificatMaitreDesCles)

    const fichiersCles = {}
    for await (const certMaitredescles of listeCertificatMaitreDesCles) {
        // Chiffrer la cle secrete pour le certificat de maitre des cles
        // Va servir de preuve d'acces au fichier
        const clesChiffrees = await chiffrage.chiffrerSecret(dictClesSecretes, certMaitredescles, {DEBUG: false})
        // console.debug("copierAttachmentVersCollection Cles chiffrees ", clesChiffrees)

        for await (const fuuid of Object.keys(clesChiffrees.cles)) {
        //Object.keys(clesChiffrees.cles).forEach(fuuid=>{
            const cleRechiffree = clesChiffrees.cles[fuuid]

            const domaine = 'GrosFichiers'
            const identificateurs_document = {fuuid}

            const infoCle = {
                // Valeurs recues
                ...cles[fuuid], 
            }
            // delete infoCle.cle
            delete infoCle.cleSecrete
            
            let fuuidInfo = fichiersCles[fuuid]
            if(!fuuidInfo) {
                const { cleSecrete } = cles[fuuid]
                const cleSecreteBytes = multibase.decode(cleSecrete)
                // console.debug("Signer identite : cle %O, domaine %s, iddoc %O, fuuid %s", cleSecrete, domaine, identificateurs_document, fuuid)
                const signature_identite = await chiffrage.chiffrage.signerIdentiteCle(
                    cleSecreteBytes, domaine, identificateurs_document, fuuid)
                fuuidInfo = {...infoCle, domaine, identificateurs_document, hachage_bytes: fuuid, signature_identite, cles: {}}
                fichiersCles[fuuid] = fuuidInfo
            }
            fuuidInfo.cles[clesChiffrees.partition] = cleRechiffree
        }
    }
    // console.debug("Fichiers cles ", fichiersCles)

    // Rechiffrer metadata
    const fichiersCopies = await Promise.all(fichiers.map(attachment=>convertirAttachementFichier(workers, attachment, dictClesSecretes)))

    // Inserer cuuid dans chaque fichier
    fichiersCopies.forEach(item=>{ item.cuuid = cuuid })

    // console.debug("copierAttachmentVersCollection Fichiers prepares ", fichiersCopies)

    const commande = { 
        cles: fichiersCles, 
        preuves: dictPreuves,
        fichiers: fichiersCopies,
    }
    // console.debug("copierAttachmentVersCollection Commande ", commande)

    const reponse = await connexion.copierFichierTiers(commande)
    // console.debug("copierFichierTiers Reponse ", reponse)
}

async function hacherPreuveCle(fingerprint, cleSecrete) {
    const dateNow = Math.floor(new Date().getTime()/1000)
    const dateBytes = longToByteArray(dateNow)
    // const fingerprintBuffer = multibase.decode(fingerprint)
    const fingerprintBuffer = Buffer.from(fingerprint, 'hex')

    if(typeof(cleSecrete) === 'string') cleSecrete = multibase.decode(cleSecrete)

    const bufferHachage = new Uint8Array(72)
    bufferHachage.set(dateBytes, 0)             // Bytes 0-7   Date 64bit
    bufferHachage.set(fingerprintBuffer, 8)     // Bytes 8-39  Fingerprint certificat
    bufferHachage.set(cleSecrete, 40)           // Bytes 40-71 Cle secrete

    const preuveHachee = await hachage.hacher(bufferHachage, {hashingCode: 'blake2s-256', encoding: 'base64'})
    // console.debug("hacherPreuveCle buffer %OpreuveHachee %O", bufferHachage, preuveHachee)

    return { preuve: preuveHachee, date: dateNow }
}

// Converti un attachement en fichier (transaction)
async function convertirAttachementFichier(workers, attachment, dictClesSecretes) {
    const { clesDao, chiffrage } = workers
    const certificatMaitreDesCles = await clesDao.getCertificatsMaitredescles()

    const copie = {...attachment}
    if(copie.images) copie.images = {...copie.images}
    delete copie.metadata

    const dataNominative = attachment.metadata.data,
          ref_hachage_bytes = attachment.fuuid

    let cleSecrete = dictClesSecretes[ref_hachage_bytes]
    // console.debug("copierAttachmentVersCollection Fichier rechiffrer fuuid %s metadata %O avec cle %O", ref_hachage_bytes, dataNominative, cleSecrete)

    // Chiffrer metadata
    const opts = {key: cleSecrete}
    const identificateurs_document = {}
    const data_chiffre = await chiffrage.chiffrage.chiffrerDocument(
        dataNominative, 
        'GrosFichiers', certificatMaitreDesCles, identificateurs_document, 
        opts
    )

    // Chiffrer thumbnail
    if(copie.images && copie.images.thumb) {
        const thumb = {...copie.images.thumb}
        copie.images.thumb = thumb
        // console.debug("Chiffrer thumbnail ", thumb)
        const data_chiffre_thumb = await chiffrage.chiffrage.chiffrer(multibase.decode(thumb.data), opts)
        // console.debug("thumb data rechiffre : ", data_chiffre_thumb)
        thumb.data_chiffre = base64.encode(data_chiffre_thumb.ciphertext)
        thumb.header = data_chiffre_thumb.header
        thumb.hachage = data_chiffre_thumb.hachage
        delete thumb.data
    }
    
    // console.debug("Metadata rechiffre ", data_chiffre)
    const metadata = { ...data_chiffre.doc }
    delete metadata.ref_hachage_bytes
    copie.metadata = metadata

    return copie
}

// https://codetagteam.com/questions/converting-javascript-integer-to-byte-array-and-back
function longToByteArray( /*long*/ long) {
    // we want to represent the input as a 8-bytes array
    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
 
    for (var index = 0; index < byteArray.length; index++) {
       var byte = long & 0xff;
       byteArray[index] = byte;
       long = (long - byte) / 256;
    }
 
    return byteArray;
 }

 async function reloadMessage(workers, dispatch, uuid_transaction, userId) {
    const { connexion, messagerieDao } = workers

    // console.debug("Reload message - voir si attachements ont ete recus ")
    const reponseMessages = await connexion.getMessagesAttachments({uuid_transactions: [uuid_transaction]})
    const message = reponseMessages.messages.pop()

    // console.debug("Message recu ", message)
    const { attachments, attachments_traites } = message
    const messageMaj = {uuid_transaction, attachments_status: attachments, attachments_traites}

    // console.debug("Message maj ", messageMaj)
    await messagerieDao.updateMessage(messageMaj, {userId})

    const syncIds = [{uuid_transaction}]
    await dispatch(messagerieThunks.chargerMessagesParSyncid(workers, syncIds))

    // console.debug("Message reloade pour attachments")
    dispatch(messagerieActions.clearSyncEnCours())
 }
 
 // Conserver les cles pour les videos
async function creerTokensStreaming(workers, fuuidFichier, cleFuuid, fuuidVideo, usager, dechiffrageVideo, opts) {
    opts = opts || {}

    const mimetype = opts.mimetype

    console.debug("fournirPreuveClesVideos Fichier %s (video %s) Conserver cle video %O, dechiffrageVideo :%O, (opts: %O)", 
        fuuidFichier, fuuidVideo, cleFuuid, dechiffrageVideo, opts)
    
    const {connexion, chiffrage, clesDao} = workers
    const listeCertificatMaitreDesCles = await clesDao.getCertificatsMaitredescles()
    const caPem = usager.ca
    listeCertificatMaitreDesCles.push(caPem)

    // Creer hachage de preuve
    const {fingerprint} = await connexion.getCertificatFormatteur()
    // console.debug("Certificat signature : ", fingerprint)

    const dictPreuves = {}, dictClesSecretes = {}
    const cleSecrete = cleFuuid.cleSecrete
    const {preuve, date} = await hacherPreuveCle(fingerprint, cleSecrete)
    dictClesSecretes[fuuidFichier] = cleSecrete
    dictPreuves[fuuidFichier] = {preuve, date}

    const fichiersCles = {}
    for await (const certMaitredescles of listeCertificatMaitreDesCles) {
        // Chiffrer la cle secrete pour le certificat de maitre des cles
        // Va servir de preuve d'acces au fichier
        const clesChiffrees = await chiffrage.chiffrerSecret(dictClesSecretes, certMaitredescles, {DEBUG: false})
        console.debug("copierAttachmentVersCollection Cles chiffrees ", clesChiffrees)

        for await (const fuuid of Object.keys(clesChiffrees.cles)) {
            const cleRechiffree = clesChiffrees.cles[fuuid]

            const domaine = 'Messagerie'
            const identificateurs_document = {type: 'attachment', fuuid}

            const infoCle = {
                // Valeurs recues
                ...cleFuuid, 
            }
            // delete infoCle.cle
            delete infoCle.cleSecrete
            
            let fuuidInfo = fichiersCles[fuuid]
            if(!fuuidInfo) {
                let { cleSecrete } = cleFuuid
                if(typeof(cleSecrete) === 'string') cleSecrete = multibase.decode(cleSecrete)
                else if ( ! Buffer.isBuffer(cleSecrete) && ! ArrayBuffer.isView(cleSecrete) ) {
                    console.warn("Cle secrete : ", cleFuuid)
                    throw new Error("mauvais type cleSecrete")
                }
                // console.debug("Signer identite : cle %O, domaine %s, iddoc %O, fuuid %s", cleSecrete, domaine, identificateurs_document, fuuid)
                const signature_identite = await chiffrage.chiffrage.signerIdentiteCle(
                    cleSecrete, domaine, identificateurs_document, fuuid)
                fuuidInfo = {...infoCle, domaine, identificateurs_document, hachage_bytes: fuuid, signature_identite, cles: {}}
                fichiersCles[fuuid] = fuuidInfo
            }
            fuuidInfo.cles[clesChiffrees.partition] = cleRechiffree
        }
    }

    // console.debug("Fichiers cles ", fichiersCles)

    let commandeVerifierCles = null
    if(fuuidFichier === fuuidVideo) {
        commandeVerifierCles = { 
            fingerprint,
            cles: fichiersCles, 
            preuves: dictPreuves,
            // fuuidVideo,
            // dechiffrageVideo,
        }
    } else {
        commandeVerifierCles = { 
            fingerprint,
            cles: fichiersCles, 
            preuves: dictPreuves,
            fuuidVideo,
            dechiffrageVideo,
        }
    }

    if(mimetype) commandeVerifierCles.mimetype = mimetype

    console.debug("fournirPreuveClesVideos Commande verifier preuve cles ", commandeVerifierCles)
    const reponseVerifierPreuve = await connexion.creerTokensStreaming(commandeVerifierCles)
    console.debug("fournirPreuveClesVideos Reponse ", reponseVerifierPreuve)

    return reponseVerifierPreuve.jwts || {}
}

// function mapperFichiers(fichiers, fichiers_traites, fichiers_status) {

//     const listeFichiers = []

//     for (const fichier of fichiers) {
//         const fuuid = fichier.file
//         const mimetype = fichier.mimetype || 'application/bytes'
//         const traite = fichiers_traites || fichiers_status[fuuid] || false

//         const version_courante = {
//             nom: fichier.name,
//             date_fichier: fichier.date,
//             hachage_original: fichier.digest,
//             mimetype,
//             taille: fichier.encrypted_size || fichier.size,
//         }

//         const fichierMappe = {
//             nom: fichier.name,
//             dateFichier: fichier.date,
//             mimetype,
//             version_courante,

//             // Indicateurs de chargement
//             traite, 
//             disabled: !traite,

//             decryption: fichier.decryption,

//             // Ids pour utilitaires reutilises de collections
//             fileId: fuuid, fuuid_v_courante: fuuid, fuuid,
//         }

//         const media = mapperMedia(fichier.media)
//         if(media) Object.assign(version_courante, media)

//         // dictFichiers[fuuid] = {
//         //     ...fichierMappe, 
//         //     fileId: fuuid, fuuid_v_courante: fuuid, 
//         //     version_courante,
//         //     traite,
//         //     disabled: !traite,
//         // }

//         listeFichiers.push(fichierMappe)
//     }

//     return listeFichiers
// }

// const CHAMPS_MEDIA = ['duration', 'width', 'height']

// function mapperMedia(media, fuuid) {
//     console.debug("Mapper media ", media)
//     const mediaMappe = {}
//     for(const champ of CHAMPS_MEDIA) {
//         if(media[champ]) mediaMappe[champ] = media[champ]
//     }
    
//     if(media.images) {
//         const images = {}
//         mediaMappe.images = images
//         for(const image of media.images) {
//             const resolution = Math.min(image.width, image.height)
//             let key = `${image.mimetype};${resolution}`
//             if(resolution <= 128 && image.data) key = 'thumb'
//             else if(resolution > 128 && resolution < 360) key = 'small'

//             const imageMappee = {
//                 width: image.width,
//                 height: image.height,
//                 resolution,
//                 mimetype: image.mimetype,
//             }
//             if(image.data) {
//                 imageMappee.data = image.data
//             } else {
//                 imageMappee.hachage = image.file
//                 imageMappee.taille = image.size
//                 Object.assign(imageMappee, image.decryption)
//             }
            
//             images[key] = imageMappee
//         }
//     }

//     if(media.videos) {
//         // console.warn("!!! TODO mapper videos ", media.videos)
//         const videos = {}
//         mediaMappe.video = videos
//         for (const video of media.videos) {
//             const resolution = Math.min(video.width, video.height)
//             const key = `${video.mimetype};${video.codec};${resolution}p;${video.quality}`
//             const decryption = video.decryption
//             const videoMappe = {
//                 width: video.width,
//                 height: video.height,
//                 quality: video.quality,
//                 fuuid,
//                 fuuid_video: video.file,
//                 hachage: video.file,
//                 mimetype: video.mimetype,
//                 taille_fichier: video.size,
//                 bitrate: video.bitrate,
//                 codec: video.codec,
//                 ...decryption,
//             }
//             videos[key] = videoMappe
//         }
//     }

//     return mediaMappe
// }