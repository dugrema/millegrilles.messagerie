import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { base64 } from 'multiformats/bases/base64'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Breadcrumb from 'react-bootstrap/Breadcrumb'
import ReactQuill from 'react-quill'
import multibase from 'multibase'

import { usagerDao, ListeFichiers, FormatteurTaille, FormatterDate, useDetecterSupport, hachage } from '@dugrema/millegrilles.reactjs'

import useWorkers, {useEtatConnexion, useEtatAuthentifie, WorkerProvider, useUsager} from './WorkerContext'
import messagerieActions, { thunks as messagerieThunks } from './redux/messagerieSlice'

import { MenuContextuelAfficherAttachments, MenuContextuelAfficherAttachementsMultiselect, onContextMenu } from './MenuContextuel'
import { mapper, mapperRowAttachment } from './mapperFichier'
// import { detecterSupport } from './fonctionsFichiers'

import ModalSelectionnerCollection from './ModalSelectionnerCollection'
import PreviewFichiers from './FilePlayer'
import AfficherVideo from './AfficherVideo'

const CONST_INTERVALLE_VERIFICATION_ATTACHMENTS = 20_000

function AfficherMessage(props) {
    // console.debug("AfficherMessage proppys: %O", props)

    const { downloadAction } = props

    const workers = useWorkers(),
          dispatch = useDispatch(),
          supportMedia = useDetecterSupport(),
          etatConnexion = useEtatConnexion(),
          etatAuthentifie = useEtatAuthentifie(),
          usager = useUsager()

    const listeMessages = useSelector(state=>state.messagerie.liste),
          uuidMessageActif = useSelector(state=>state.messagerie.uuidMessageActif)

    // console.debug("uuid message actif : %O, liste messages %O", uuidMessageActif, listeMessages)

    const message = useMemo(()=>{
        return listeMessages.filter(item=>item.uuid_transaction===uuidMessageActif).pop()
    }, [uuidMessageActif, listeMessages])

    const [showChoisirCollection, setChoisirCollection] = useState(false)
    const [afficherVideo, setAfficherVideo] = useState(false)
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
            marquerMessageLu(workers, message.uuid_transaction)
        }
    }, [workers, etatConnexion, etatAuthentifie, message])  // , messageDechiffre])

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
    // console.debug("RenderMessage : %O", props)
    const { 
        downloadAction, choisirCollectionCb, 
        // setUuidMessage, 
        repondreCb, transfererCb, retourMessages,
        afficherVideo, supportMedia, setAfficherVideo, certificatMaitreDesCles, 
        setSelectionAttachments,
    } = props

    const workers = useWorkers()

    const message = props.message || {}
    const infoMessage = props.infoMessage || {}
    const { to, cc, from, reply_to, subject, content, attachments, attachments_inline } = message
    const entete = message['en-tete'] || {},
          estampille = entete.estampille
    const { uuid_transaction, date_reception } = infoMessage
    const attachments_status = message.attachments_status || {}
    const attachments_traites = message.attachments_traites || false

    const dateEstampille = new Date(estampille)

    const erreurCb = useCallback((err, message)=>{
        console.error("Erreur : %O, message : %s", err, message)
    }, [])

    const supprimerCb = useCallback(()=>{
        // console.debug("Supprimer message %s", uuid_transaction)
        workers.connexion.supprimerMessages(uuid_transaction)
            .then(reponse=>{
                // console.debug("Message supprime : %O", reponse)
                retourMessages()  // Retour
            })
            .catch(erreurCb)
    }, [workers, retourMessages, uuid_transaction, erreurCb])

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
                uuid_transaction={uuid_transaction}
                attachments={attachments} 
                attachments_inline={attachments_inline} 
                choisirCollectionCb={choisirCollectionCb} 
                supportMedia={supportMedia} 
                afficherVideo={afficherVideo}
                setAfficherVideo={setAfficherVideo} 
                certificatMaitreDesCles={certificatMaitreDesCles} 
                setSelectionAttachments={setSelectionAttachments} 
                attachments_status={attachments_status}
                attachments_traites={attachments_traites} />

        </>
    )
}

function ContenuMessage(props) {
    const { 
        downloadAction, content, afficherVideo, 
        attachments, attachments_inline, choisirCollectionCb, supportMedia, 
        setAfficherVideo, certificatMaitreDesCles,
        setSelectionAttachments,
        uuid_transaction,
        attachments_status, attachments_traites,
    } = props

    const workers = useWorkers(),
          etatConnexion = useEtatConnexion(),
          usager = useUsager()

    const fichiers = attachments?attachments.fichiers:null

    const fermerAfficherVideo = useCallback(()=>setAfficherVideo(false))

    const attachmentMappe = useMemo(()=>{
        if(!fichiers) return

        const fileItem = fichiers.filter(item=>item.fuuid===afficherVideo).pop()

        let attachmentMappe = null
        if(fileItem) {
            
            const fuuidFichier = fileItem.fuuid

            const creerToken = async fuuidVideo => {
                if(Array.isArray(fuuidVideo)) fuuidVideo = fuuidVideo.pop()
                console.debug("!!! usager : ", usager)
                // console.debug("Creer token video fuuid : %O (fileItem: %O, cles: %O)", fuuid, fileItem, attachments.cles)

                const cleFuuid = attachments.cles[fuuidFichier]

                const jwts = await creerTokensStreaming(workers, fuuidFichier, cleFuuid, fuuidVideo, usager)
                console.debug("ContenuMessage.creerToken JWTS tokens : %O", jwts)
                return jwts
                // return jwts[fuuid]

                // const {chiffrage, connexion} = workers
                // const cleDechiffree = attachments.cles[fuuid]
                // // const cleDechiffree = await usagerDao.getCleDechiffree(fuuid)
                // const dictCle = {[fuuid]: multibase.decode(cleDechiffree.cleSecrete)}
                // const clesChiffrees = await chiffrage.chiffrerSecret(dictCle, certificatMaitreDesCles, {DEBUG: false})
                // const cleChiffree = {...cleDechiffree}
                // delete cleChiffree.cleSecrete
                // const listeCles = [
                //     {
                //         // Default
                //         identificateurs_document: {fuuid}, 
                //         // Valeurs recues
                //         ...cleChiffree,
                //         // Overrides
                //         domaine: 'GrosFichiers', 
                //         cle: clesChiffrees.cles[fuuid]
                //     }
                // ]
                // const preuveAcces = { 
                //     fuuid, 
                //     // cles: clesChiffrees.cles, 
                //     cles: listeCles,
                //     partition: clesChiffrees.partition, 
                //     // domaine: 'GrosFichiers' 
                // }
                // // console.debug("Preuve acces : %O", preuveAcces)
            
                // const reponse = await connexion.creerTokenStream(preuveAcces)
                // // console.debug("Reponse preuve acces : %O", reponse)
                // return reponse.token
            }

            attachmentMappe = mapperRowAttachment(fileItem, workers, {genererToken: true, creerToken})
        }

        return attachmentMappe
    }, [workers, afficherVideo, certificatMaitreDesCles, fichiers, usager])

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
    }

    return (
        <>
            <AfficherMessageQuill content={content} />

            <AfficherAttachments 
                workers={workers} 
                etatConnexion={etatConnexion}
                downloadAction={downloadAction}
                uuid_transaction={uuid_transaction}
                attachments={attachments} 
                attachments_inline={attachments_inline} 
                choisirCollectionCb={choisirCollectionCb} 
                supportMedia={supportMedia} 
                setAfficherVideo={setAfficherVideo} 
                setSelectionAttachments={setSelectionAttachments}
                attachments_status={attachments_status}
                attachments_traites={attachments_traites} />        
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

async function marquerMessageLu(workers, uuid_transaction) {
    try {
        await workers.connexion.marquerLu(uuid_transaction, true)
        // console.debug("Reponse marquer message %s lu : %O", uuid_transaction, reponse)
    } catch(err) {
        console.error("Erreur marquer message %s lu : %O", uuid_transaction, err)
    }
}

function AfficherAttachments(props) {
    // console.debug("AfficherAttachments proppys : %O", props)
    const { 
        workers, attachments, etatConnexion, downloadAction, 
        supportMedia, setAfficherVideo, setSelectionAttachments, choisirCollectionCb, 
        attachments_status, attachments_traites,
        uuid_transaction,
    } = props

    const dispatch = useDispatch()
    const userId = useSelector(state=>state.messagerie.userId)

    const [colonnes, setColonnes] = useState('')
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
    }, [setSelection])
    const showPreviewCb = useCallback( fuuid => {
        // console.debug("Show preview cb : %O", fuuid)
        setFuuidSelectionne(fuuid)
        setShowPreview(true)
    }, [setShowPreview, setFuuidSelectionne])
    const showPreviewSelection = useCallback( () => {
        if(selection && selection.length > 0) {
            let fuuid = [...selection].pop()
            // console.debug("Show preview cb : %O", fuuid)
            setFuuidSelectionne(fuuid)
            // setShowPreview(true)

            const fileItem = attachmentsList.filter(item=>item.fuuid===fuuid).pop()
            const mimetype = fileItem.mimetype || ''
            console.debug("Afficher fuuid %s (mimetype: %s), fileItem %O", fuuid, mimetype, fileItem)
            if(mimetype.startsWith('video/')) {
                // Page Video
                setAfficherVideo(fuuid)
            } else {
                // Preview/carousel
                setShowPreview(true)
            }

        }
    }, [selection, setShowPreview, setFuuidSelectionne, setAfficherVideo])

    // useEffect(()=>detecterSupport(setSupport), [setSupport])
    useEffect(()=>setColonnes(preparerColonnes), [setColonnes])

    // useEffect(()=>chargerFichiers(workers, attachments, setFichierCharges), [workers, attachments, setFichierCharges])

    useEffect(()=>{
        if(!attachments) { setAttachmentsList(''); return }  // Rien a faire

        if(Array.isArray(attachments)) {
            // Message envoye, pas d'info
            console.debug("Liste attachments message envoye : %O", attachments)
        } else {
            // Message recu
            const { cles, fichiers } = attachments

            const dictAttachments = {}
            fichiers.forEach( attachmentObj => {
                let attachment = {...attachmentObj}
                const fuuid = attachment.fuuid
                const version_courante = {
                    mimetype: attachment.mimetype || 'application/bytes',
                    taille: attachment.taille,
                }

                const traite = attachments_traites || attachments_status[fuuid] || false

                if(attachment.images) {
                    version_courante.images = {...attachment.images}
                    delete attachment.images
                }
                if(attachment.video) {
                    version_courante.video = {...attachment.video}
                    delete attachment.video
                }
                if(attachment.metadata && attachment.metadata.data) {
                    // Extract metadata (normalement chiffre)
                    const fichierData = attachment.metadata.data
                    attachment = {...attachment, ...fichierData}
                }
                dictAttachments[fuuid] = {
                    ...attachment, 
                    fileId: fuuid, fuuid_v_courante: fuuid, 
                    version_courante,
                    traite,
                    disabled: !traite,
                }
            })

            // console.debug("Dict attachments combines : %O", dictAttachments)

            const liste = attachments.fichiers.map(attachment=>dictAttachments[attachment.fuuid])
            const listeMappee = liste.map(item=>{
                return mapper(item, workers, {ref_hachage_bytes: item.fuuid, cles, supportMedia})
            })

            // console.debug("Liste mappee ", listeMappee)

            setAttachmentsList(listeMappee)
        }
    }, [workers, attachments, supportMedia, setAttachmentsList])

    let verifierAttachments = (attachments && !attachments_traites)
    if(!attachments_traites && attachments_status && Object.keys(attachments_status).length > 0) {
        // S'assurer qu'on a au moins 1 attachement manquant
        verifierAttachments = Object.values(attachments_status).reduce((acc, item)=>{
            acc = acc || !item
            return acc
        }, false)
    }
    // console.debug("Verifier attachments %O, status %O", verifierAttachments, attachments_status)

    // Recharger le message si les attachements ne sont pas tous traites
    useEffect(()=>{
        if(!verifierAttachments) return     // Rien a faire
        reloadMessage(workers, dispatch, uuid_transaction, userId)
            .catch(err=>console.error("Erreur maj message pour attachements incomplets : ", err))
        
        // Reload message
        const interval = setInterval(()=>{
            reloadMessage(workers, dispatch, uuid_transaction, userId)
                .catch(err=>console.error("Erreur maj message pour attachements incomplets : ", err))
        }, CONST_INTERVALLE_VERIFICATION_ATTACHMENTS)
        
        return () => clearInterval(interval)  // Cleanup interval
    }, [workers, dispatch, userId, uuid_transaction, verifierAttachments])

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
                // onClick={...pas utilise...} 
                onDoubleClick={showPreviewSelection}
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

    const { contextuel, attachments, attachmentsList, selection } = props

    if(!contextuel.show) return ''

    // console.debug("!!! Selection : %s, FICHIERS : %O, mappes : %O", selection, attachments, attachmentsList)

    if( selection && selection.length > 1 ) {
        return <MenuContextuelAfficherAttachementsMultiselect selection={selection} {...props} />
    } else if(selection.length>0 && attachments.fichiers) {
        const fuuid = selection[0]
        const attachment = attachments.fichiers.filter(item=>item.fuuid===fuuid).pop()
        const attachmentListDetail = attachmentsList.filter(item=>item.fuuid===fuuid).pop()
        const attachmentDetail = {...attachmentListDetail, ...attachment}
        if(attachment) {
            return <MenuContextuelAfficherAttachments attachment={attachmentDetail} cles={attachments.cles} {...props} />
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
    const fingerprintBuffer = multibase.decode(fingerprint)

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
    // const reponseMessages = await connexion.getMessages({uuid_transactions: [uuid_transaction]})
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
 //(workers, cles, usager)
async function creerTokensStreaming(workers, fuuidFichier, cleFuuid, fuuidVideo, usager) {
    console.debug("fournirPreuveClesVideos Conserver cle video %O", cleFuuid)
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
    const cleSecrete = cleFuuid.cleSecrete
    const {preuve, date} = await hacherPreuveCle(fingerprint, cleSecrete)
    dictClesSecretes[fuuidFichier] = cleSecrete
    dictPreuves[fuuidFichier] = {preuve, date}
    // console.debug("copierAttachmentVersCollection Cles secretes %O, preuves : %O, rechiffrer avec cles maitre des cles %O", 
    //     dictClesSecretes, dictPreuves, listeCertificatMaitreDesCles)

    const fichiersCles = {}
    for await (const certMaitredescles of listeCertificatMaitreDesCles) {
        // Chiffrer la cle secrete pour le certificat de maitre des cles
        // Va servir de preuve d'acces au fichier
        const clesChiffrees = await chiffrage.chiffrerSecret(dictClesSecretes, certMaitredescles, {DEBUG: false})
        // console.debug("copierAttachmentVersCollection Cles chiffrees ", clesChiffrees)

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
                const { cleSecrete } = cleFuuid
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
    // const fichiersCopies = await Promise.all(fichiers.map(attachment=>convertirAttachementFichier(workers, attachment, dictClesSecretes)))

    // console.debug("copierAttachmentVersCollection Fichiers prepares ", fichiersCopies)

    const commandeVerifierCles = { 
        fingerprint,
        cles: fichiersCles, 
        preuves: dictPreuves,
        // fichiers: fichiersCopies,
        fuuidVideo,
    }
    console.debug("fournirPreuveClesVideos Commande verifier preuve cles ", commandeVerifierCles)
    const reponseVerifierPreuve = await connexion.creerTokensStreaming(commandeVerifierCles)
    console.debug("fournirPreuveClesVideos Reponse ", reponseVerifierPreuve)

    return reponseVerifierPreuve.jwts || {}
}