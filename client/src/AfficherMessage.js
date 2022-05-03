import { useState, useEffect, useCallback } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Breadcrumb from 'react-bootstrap/Breadcrumb'
import ReactQuill from 'react-quill'

import { ListeFichiers, FormatteurTaille, FormatterDate } from '@dugrema/millegrilles.reactjs'

import { MenuContextuelAfficherAttachments, onContextMenu } from './MenuContextuel'
import { dechiffrerMessage } from './cles'
import { mapper } from './mapperFichier'
import { detecterSupport } from './fonctionsFichiers'

import ModalSelectionnerCollection from './ModalSelectionnerCollection'
import PreviewFichiers from './FilePlayer'

function AfficherMessage(props) {
    // console.debug("AfficherMessage proppys: %O", props)

    const { 
        workers, etatConnexion, downloadAction, 
        uuidMessage, setUuidMessage, certificatMaitreDesCles, repondreMessageCb 
    } = props
    const [message, setMessage] = useState('')
    const [messageDechiffre, setMessageDechiffre] = useState('')
    const [showChoisirCollection, setChoisirCollection] = useState(false)
    const [attachmentACopier, setAttachmentACopier] = useState('')

    const retour = useCallback(()=>{setUuidMessage('')}, [setUuidMessage])
    const fermerChoisirCollectionCb = useCallback(event=>setChoisirCollection(false), [setChoisirCollection])
    const choisirCollectionCb = useCallback(
        attachment => {
            setAttachmentACopier(attachment)
            setChoisirCollection(true)
        },
        [setChoisirCollection, setAttachmentACopier]
    )

    const copierVersCollection = useCallback( cuuid => {
        const attachment = attachmentACopier
        setAttachmentACopier('')  // Reset attachment

        console.debug("Copier attachment pour message : %O", messageDechiffre)
        const cles = messageDechiffre.attachments.cles

        copierAttachmentVersCollection(workers, attachment, cles, cuuid, certificatMaitreDesCles)
            .catch(err=>console.error("Erreur copie attachment vers collection : %O", err))
    }, [workers, attachmentACopier, setAttachmentACopier, certificatMaitreDesCles, messageDechiffre])

    const repondreCb = useCallback(()=>{
        // console.debug("Repondre a message %O", message)
        repondreMessageCb({...message, ...messageDechiffre})
    }, [workers, message, messageDechiffre, repondreMessageCb])

    useEffect( () => { 
        if(!etatConnexion) return
        workers.connexion.getMessages({uuid_messages: [uuidMessage]}).then(messages=>{
            // console.debug("Messages recus : %O", messages)
            setMessage(messages.messages.shift())
        })
    }, [workers, etatConnexion, setMessage])

    // Charger et dechiffrer message
    useEffect(()=>{
        if(!etatConnexion) return
        workers.connexion.getMessages({uuid_messages: [uuidMessage]})
            .then(messages=>{
                // console.debug("Messages recus : %O", messages)
                const message = messages.messages.shift()
                setMessage(message)
                return dechiffrerMessage(workers, message)
            })
            .then(messageDechiffre=>setMessageDechiffre(messageDechiffre))
            .catch(err=>console.error("Erreur chargement message : %O", err))
    }, [workers, uuidMessage, setMessage, setMessageDechiffre])

    useEffect(()=>{
        // console.debug("Message dechiffre : %O", messageDechiffre)
        if(messageDechiffre && !message.lu) {
            // console.debug("Marquer message %s comme lu", message.uuid_transaction)
            marquerMessageLu(workers, message.uuid_transaction)
        }
    }, [workers, message, messageDechiffre])

    return (
        <>
            <BreadcrumbMessage retourMessages={retour} />

            <RenderMessage 
                workers={workers} 
                etatConnexion={etatConnexion}
                downloadAction={downloadAction}
                message={messageDechiffre} 
                infoMessage={message} 
                setUuidMessage={setUuidMessage}
                choisirCollectionCb={choisirCollectionCb} 
                repondreCb={repondreCb} />

            <ModalSelectionnerCollection 
                show={showChoisirCollection} 
                etatConnexion={etatConnexion}
                workers={workers} 
                fermer={fermerChoisirCollectionCb} 
                selectionner={copierVersCollection} />
        </>
    )

}

export default AfficherMessage

function BreadcrumbMessage(props) {

    const { retourMessages } = props

    return (
        <Breadcrumb>
            <Breadcrumb.Item onClick={retourMessages}>Messages</Breadcrumb.Item>
            <Breadcrumb.Item active>Afficher</Breadcrumb.Item>
        </Breadcrumb>
    )
}

function RenderMessage(props) {
    // console.debug("RenderMessage : %O", props)
    const { workers, message, infoMessage, etatConnexion, downloadAction, choisirCollectionCb, setUuidMessage, repondreCb } = props
    const { to, cc, from, reply_to, subject, content, attachments, attachments_inline } = message
    const entete = message['en-tete'] || {},
          estampille = entete.estampille
    const { uuid_transaction, date_reception, lu } = infoMessage

    const dateEstampille = new Date(estampille)

    const erreurCb = useCallback((err, message)=>{
        console.error("Erreur : %O, message : %s", err, message)
    }, [])

    const supprimerCb = useCallback(()=>{
        // console.debug("Supprimer message %s", uuid_transaction)
        workers.connexion.supprimerMessages(uuid_transaction)
            .then(reponse=>{
                // console.debug("Message supprime : %O", reponse)
                setUuidMessage('')  // Retour
            })
            .catch(erreurCb)
    }, [workers, uuid_transaction, erreurCb])

    if(!message) return ''

    return (
        <>
            <Header>
                <Row>
                    <Col xs={12} md={8}>
                        <AfficherAdresses from={from} reply_to={reply_to} to={to} cc={cc} />
                        <AfficherDateSujet date_reception={date_reception} date_estampille={dateEstampille} subject={subject} />
                    </Col>
                    <Col>
                        <div className="buttonbar-right">
                            <Button onClick={repondreCb}><i className="fa fa-reply"/>{' '}Repondre</Button>
                            <Button variant="secondary" onClick={supprimerCb}><i className="fa fa-trash"/>{' '}Supprimer</Button>
                        </div>
                    </Col>
                </Row>
            </Header>

            <AfficherMessageQuill content={content} />

            <AfficherAttachments 
                workers={workers} 
                etatConnexion={etatConnexion}
                downloadAction={downloadAction}
                attachments={attachments} 
                attachments_inline={attachments_inline} 
                choisirCollectionCb={choisirCollectionCb} />
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
        const reponse = await workers.connexion.marquerLu(uuid_transaction, true)
        console.debug("Reponse marquer message %s lu : %O", uuid_transaction, reponse)
    } catch(err) {
        console.error("Erreur marquer message %s lu : %O", uuid_transaction, err)
    }
}

function AfficherAttachments(props) {
    // console.debug("AfficherAttachments proppys : %O", props)
    const { workers, attachments, etatConnexion, downloadAction, choisirCollectionCb } = props

    const [colonnes, setColonnes] = useState('')
    const [modeView, setModeView] = useState('')
    const [attachmentsList, setAttachmentsList] = useState('')
    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})
    const [selection, setSelection] = useState('')
    const [showPreview, setShowPreview] = useState(false)
    const [support, setSupport] = useState({})
    const [fuuidSelectionne, setFuuidSelectionne] = useState('')

    const fermerContextuel = useCallback(()=>setContextuel(false), [setContextuel])
    const onSelectionLignes = useCallback(selection=>{
        // console.debug("!!! setSelectioN: %O", selection)
        setSelection(selection)
    }, [setSelection])
    const showPreviewCb = useCallback( async fuuid => {
        console.debug("Show preview cb : %O", fuuid)
        await setFuuidSelectionne(fuuid)
        setShowPreview(true)
    }, [setShowPreview, setFuuidSelectionne])
    const showPreviewSelection = useCallback( async () => {
        if(selection && selection.length > 0) {
            let fuuid = [...selection].pop()
            console.debug("Show preview cb : %O", fuuid)
            await setFuuidSelectionne(fuuid)
            setShowPreview(true)
        }
    }, [selection, setShowPreview, setFuuidSelectionne])

    useEffect(()=>detecterSupport(setSupport), [setSupport])
    useEffect(()=>setColonnes(preparerColonnes), [setColonnes])

    // useEffect(()=>chargerFichiers(workers, attachments, setFichierCharges), [workers, attachments, setFichierCharges])

    useEffect(()=>{
        if(!attachments) { setAttachmentsList(''); return }  // Rien a faire

        const { cles, fichiers } = attachments

        const dictAttachments = {}
        fichiers.forEach( attachment => {
            const fuuid = attachment.fuuid
            const version_courante = {
                mimetype: attachment.mimetype || 'application/bytes',
            }
            if(attachment.images) {
                 version_courante.images = attachment.images
                 delete attachment.images
            }
            if(attachment.video) {
                version_courante.video = attachment.video
                delete attachment.video
            }
            dictAttachments[fuuid] = {
                ...attachment, 
                fileId: fuuid, fuuid_v_courante: fuuid, 
                version_courante,
            }
        })
 
        console.debug("Dict attachments combines : %O", dictAttachments)

        const liste = attachments.fichiers.map(attachment=>dictAttachments[attachment.fuuid])
        const listeMappee = liste.map(item=>mapper(item, workers, {cles}))
        console.debug("Liste mappee : %O", listeMappee)

        setAttachmentsList(listeMappee)

    }, [workers, attachments, setAttachmentsList])

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
                support={support}
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

    console.debug("!!! Selection : %s, FICHIERS : %O, mappes : %O", selection, attachments, attachmentsList)

    if( selection && selection.length > 1 ) {
        console.warn("!!! Multiselect TODO !!!")
        return ''
        // return <MenuContextuelAttacherMultiselect {...props} />
    } else if(selection.length>0) {
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

// async function chargerFichiers(workers, attachments, setFichiersCharges) {
//     if(!attachments || attachments.length === 0) return  // Rien a faire

//     const fuuids = attachments.map(item=>item.fuuid)
//     console.debug("Charges fichiers avec fuuids : %O", fuuids)
//     if(!fuuids || fuuids.length === 0) return  // Rien a faire
//     try {
//         const reponse = await workers.connexion.getDocumentsParFuuid(fuuids)
//         console.debug("Reponse chargerFichiers : %O", reponse)
//         if(reponse.fichiers) setFichiersCharges(reponse.fichiers)
//         else console.warn("Erreur chargement fichiers par fuuid : %O", reponse)
//     } catch(err) {
//         console.error("Erreur chargement fichiers par fuuid : %O", err)
//     }
// }

async function copierAttachmentVersCollection(workers, attachment, cles, cuuid, certificatMaitreDesCles) {
    console.debug("Copier vers collection %O\nAttachment%O\nCert maitredescles: %O", cuuid, attachment, certificatMaitreDesCles)
    const {connexion, chiffrage} = workers
    const {fuuid, version_courante} = attachment

    const dictClesSecretes = Object.keys(cles).reduce((acc, fuuid)=>{
        acc[fuuid] = cles[fuuid].cleSecrete
        return acc
    }, {})
    console.debug("Cles secretes : %O", dictClesSecretes)

    // Chiffrer la cle secrete pour le certificat de maitre des cles
    // Va servir de preuve d'acces au fichier
    const clesChiffrees = await chiffrage.chiffrerSecret(dictClesSecretes, certificatMaitreDesCles, {DEBUG: true})
    console.debug("Cles chiffrees : %O", clesChiffrees)
    // const clesRechiffrees = clesChiffrees.reduce((acc, cle, idx)=>{
    //     const fuuid = listeClesSecrete[idx].fuuid
    //     acc[fuuid] = cle
    //     return acc
    // }, {})

    const preuveAcces = { cles: clesChiffrees.cles, partition: clesChiffrees.partition }
    const preuveAccesSignee = await connexion.formatterMessage(preuveAcces, 'preuve')
    delete preuveAccesSignee['_certificat']
    console.debug("Preuve acces : %O", preuveAccesSignee)

    // Transaction associerFuuids pour GrosFichiers
    const fichier = {
        fuuid, cuuid,
        mimetype: attachment.mimetype,
        nom: attachment.nom,
        taille: attachment.taille,
        dateFichier: attachment.dateFichier,
        ...version_courante,
    }
    const champsOptionnels = ['width', 'height']
    for(let champ in champsOptionnels) {
        if(attachment[champ]) fichier[champ] = attachment[champ]
    }
    const transactionCopierVersTiersSignee = await connexion.formatterMessage(fichier, 'GrosFichiers', {action: 'copierFichierTiers'})
    delete transactionCopierVersTiersSignee['_certificat']

    const commandeCopierVersTiers = { preuve: preuveAccesSignee, transaction: transactionCopierVersTiersSignee }
    console.debug("Commande copier vers tiers : %O", commandeCopierVersTiers)
    const reponse = await connexion.copierFichierTiers(commandeCopierVersTiers)
    console.debug("Reponse commande copier vers tiers : %O", reponse)
}
