import { useState, useEffect, useCallback } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import ReactQuill from 'react-quill'

import { ListeFichiers, FormatteurTaille, FormatterDate, forgecommon } from '@dugrema/millegrilles.reactjs'

import { MenuContextuelAfficherAttachments, onContextMenu } from './MenuContextuel'
import ModalSelectionnerCollection from './ModalSelectionnerCollection'

import { dechiffrerMessage } from './cles'
import { mapper } from './mapperFichier'

const { extraireExtensionsMillegrille } = forgecommon

function AfficherMessage(props) {
    // console.debug("AfficherMessage proppys: %O", props)

    const { workers, etatConnexion, downloadAction, uuidSelectionne, setUuidSelectionne, certificatMaitreDesCles } = props
    const [message, setMessage] = useState('')
    const [messageDechiffre, setMessageDechiffre] = useState('')
    const [showChoisirCollection, setChoisirCollection] = useState(false)
    const [attachmentACopier, setAttachmentACopier] = useState('')

    const retour = useCallback(()=>{setUuidSelectionne('')}, [setUuidSelectionne])
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
        copierAttachmentVersCollection(workers, attachment, cuuid, certificatMaitreDesCles)
            .catch(err=>console.error("Erreur copie attachment vers collection : %O", err))
    }, [workers, attachmentACopier, setAttachmentACopier, certificatMaitreDesCles])

    useEffect( () => { 
        if(!etatConnexion) return
        workers.connexion.getMessages({uuid_messages: [uuidSelectionne]}).then(messages=>{
            console.debug("Messages recus : %O", messages)
            setMessage(messages.messages.shift())
        })
    }, [workers, etatConnexion, setMessage])

    // Charger et dechiffrer message
    useEffect(()=>{
        if(!etatConnexion) return
        workers.connexion.getMessages({uuid_messages: [uuidSelectionne]})
            .then(messages=>{
                console.debug("Messages recus : %O", messages)
                const message = messages.messages.shift()
                setMessage(message)
                return dechiffrerMessage(workers, message)
            })
            .then(messageDechiffre=>setMessageDechiffre(messageDechiffre))
            .catch(err=>console.error("Erreur chargement message : %O", err))
    }, [workers, uuidSelectionne, setMessage, setMessageDechiffre])

    useEffect(()=>{
        if(messageDechiffre && !message.lu) {
            console.debug("Marquer message %s comme lu", message.uuid_transaction)
            marquerMessageLu(workers, message.uuid_transaction)
        }
    }, [workers, message, messageDechiffre])

    return (
        <>
            <p>Afficher message</p>
            <Button onClick={retour}>Retour</Button>

            <RenderMessage 
                workers={workers} 
                etatConnexion={etatConnexion}
                downloadAction={downloadAction}
                message={messageDechiffre} 
                infoMessage={message} 
                choisirCollectionCb={choisirCollectionCb} />

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

function RenderMessage(props) {
    // console.debug("RenderMessage proppys : %O", props)

    const { workers, message, infoMessage, etatConnexion, downloadAction, choisirCollectionCb } = props
    const { to, cc, from, reply_to, subject, content, attachments, attachments_inline } = message
    const { date_reception, lu } = infoMessage

    if(!message) return ''

    console.debug("Message : %O", message)

    return (
        <>
            <Header>
                <AfficherAdresses from={from} reply_to={reply_to} to={to} cc={cc} />
                <AfficherDateSujet date_reception={date_reception} subject={subject} />
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

    const { date_reception, subject } = props

    return (
        <>
            <Row>
                <Col xs={12} md={2}>Recu:</Col>
                <Col><FormatterDate value={date_reception}/></Col>
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
    const [fichiersCharges, setFichierCharges] = useState('')
    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})
    const [selection, setSelection] = useState('')

    const fermerContextuel = useCallback(()=>setContextuel(false), [setContextuel])
    const onSelectionLignes = useCallback(selection=>{setSelection(selection)}, [setSelection])

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
        // if(fichiersCharges) {
        //     console.debug("Combiner fichiers charges: %O", fichiersCharges)
        //     fichiersCharges.forEach(item=>{
        //         // Insertion information fichier
        //         const fuuid = item.fuuid_v_courante
        //         dictAttachments[fuuid] = {...dictAttachments[fuuid], ...item}

        //         // Retirer tuuid, force l'utilisation du fuuid comme selecteur
        //         dictAttachments[fuuid]._tuuid = dictAttachments[fuuid].tuuid
        //         delete dictAttachments[fuuid].tuuid
        //     })
        //     console.debug("Fichiers combines avec reponse GrosFichiers : %O", dictAttachments)
        // }

        // Remettre thumbnails dechiffres en place si applicable
        // attachments.filter(attachment=>attachment.thumb).forEach( attachment => {
        //     const { fuuid, thumb } = attachment
        //     // delete attachment.thumb

        //     const attachmentMappe = dictAttachments[fuuid]
        //     delete attachmentMappe.thumb
        //     let { version_courante } = attachmentMappe
        //     let images = version_courante.images || {}
        //     version_courante.images = images
        //     let thumbCopie = images.thumb || {}
        //     thumbCopie = {...thumbCopie, ...thumb}
        //     images.thumb = thumbCopie
        //     delete thumbCopie.data_chiffre
        // })

        // attachments_inline.forEach(a=>{
        //     let attachmentInline = {...dictAttachments[a.fuuid], ...a}
        //     if(attachmentInline.thumb) {
        //         // Override images.thumb.data_chiffre par .data
        //         let { version_courante } = attachmentInline
        //         version_courante = {...version_courante, ...a}
        //         attachmentInline.version_courante = version_courante
        //         delete version_courante.data
        //         delete version_courante.thumb
        //         let images = version_courante.images || {}
        //         version_courante.images = images
        //         let thumb = images.thumb || {}
        //         thumb = {...thumb, ...a.thumb}
        //         images.thumb = thumb
        //         delete thumb.data_chiffre
        //         delete attachmentInline.thumb
        //     }

        //     dictAttachments[a.fuuid] = attachmentInline
        // })

        console.debug("Dict attachments combines : %O", dictAttachments)

        const liste = attachments.fichiers.map(attachment=>dictAttachments[attachment.fuuid])
        const listeMappee = liste.map(item=>mapper(item, workers, {cles}))
        console.debug("Liste mappee : %O", listeMappee)

        setAttachmentsList(listeMappee)

    }, [workers, attachments, fichiersCharges, setAttachmentsList])

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
                // onDoubleClick={...pas utilise...}
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
                selection={selection}
                // showPreview={showPreviewAction}
                // showInfoModalOuvrir={showInfoModalOuvrir}
                downloadAction={downloadAction}
                etatConnexion={etatConnexion}
                choisirCollectionCb={choisirCollectionCb}
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

    const { contextuel, attachments, selection } = props

    if(!contextuel.show) return ''

    console.debug("!!! Selection : %s, FICHIERS : %O", selection, attachments)

    if( selection && selection.length > 1 ) {
        console.warn("!!! Multiselect TODO !!!")
        return ''
        // return <MenuContextuelAttacherMultiselect {...props} />
    } else if(selection.length>0) {
        const fuuid = selection[0]
        const attachment = attachments.fichiers.filter(item=>item.fuuid===fuuid).pop()
        if(attachment) {
            return <MenuContextuelAfficherAttachments attachment={attachment} cles={attachments.cles} {...props} />
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

async function copierAttachmentVersCollection(workers, attachment, cuuid, certificatMaitreDesCles) {
    console.debug("Copier vers collection %O\nAttachment%O\nCert maitredescles: %O", cuuid, attachment, certificatMaitreDesCles)
    const {connexion} = workers
    const {cleSecrete, fuuid} = attachment
    // Chiffrer la cle secrete pour le certificat de maitre des cles
    // Va servir de preuve d'acces au fichier
    const chiffrage = workers.chiffrage
    const cleChiffree = await chiffrage.chiffrerSecret([cleSecrete], certificatMaitreDesCles, {DEBUG: true})
    const preuveAcces = {preuve: [{hachage_bytes: fuuid, cle: cleChiffree[0]}]}
    const preuveAccesSignee = await connexion.formatterMessage(preuveAcces, 'preuve')
    delete preuveAccesSignee['_certificat']
    console.debug("Preuve acces : %O", preuveAccesSignee)

    // Transaction associerFuuids pour GrosFichiers
    const transaction = {
        
    }

}