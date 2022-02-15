import { useState, useEffect, useCallback } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'

import { ListeFichiers, FormatteurTaille, FormatterDate, forgecommon } from '@dugrema/millegrilles.reactjs'

import { dechiffrerMessage } from './cles'
import { mapper, onContextMenu } from './mapperFichier'

const { extraireExtensionsMillegrille } = forgecommon

function AfficherMessage(props) {

    const { workers, etatConnexion, uuidSelectionne, setUuidSelectionne } = props
    const [message, setMessage] = useState('')
    const [messageDechiffre, setMessageDechiffre] = useState('')

    const retour = useCallback(()=>{setUuidSelectionne('')}, [setUuidSelectionne])

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

            <RenderMessage workers={workers} message={messageDechiffre} infoMessage={message} />
        </>
    )

}

export default AfficherMessage

function RenderMessage(props) {

    const { workers, message, infoMessage } = props
    const { to, cc, from, reply_to, subject, content, attachments, attachments_inline } = message
    const { date_reception, lu } = infoMessage

    if(!message) return ''

    console.debug("Message : %O", message)

    return (
        <>
            <p>From: {from}</p>
            <p>Reply To: {reply_to}</p>
            <p>To: {to.join('; ')}</p>
            <p>CC: {cc}</p>
            <p>Date reception : <FormatterDate value={date_reception}/></p>
            <p>Sujet: {subject}</p>
            <div>{content}</div>

            <AfficherAttachments workers={workers} attachments={attachments} attachments_inline={attachments_inline} />
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
    console.debug("AfficherAttachments proppys : %O", props)
    const { workers, attachments } = props

    const [colonnes, setColonnes] = useState('')
    const [modeView, setModeView] = useState('')
    const [attachmentsList, setAttachmentsList] = useState('')
    const [fichiersCharges, setFichierCharges] = useState('')

    useEffect(()=>setColonnes(preparerColonnes), [setColonnes])

    useEffect(()=>chargerFichiers(workers, attachments, setFichierCharges), [workers, attachments, setFichierCharges])

    useEffect(()=>{
        if(!attachments) { setAttachmentsList(''); return }  // Rien a faire

        const dictAttachments = {}
        attachments.forEach( attachment => {
            const fuuid = attachment.fuuid
            dictAttachments[fuuid] = {
                ...attachment, 
                fileId: fuuid, fuuid_v_courante: fuuid, 
                version_courante: {mimetype: 'application/bytes'}
        }})
        if(fichiersCharges) {
            console.debug("Combiner fichiers charges: %O", fichiersCharges)
            fichiersCharges.forEach(item=>{
                // Insertion information fichier
                const fuuid = item.fuuid_v_courante
                dictAttachments[fuuid] = {...dictAttachments[fuuid], ...item}
            })
            console.debug("Fichiers combines avec reponse GrosFichiers : %O", dictAttachments)
        }

        // Remettre thumbnails dechiffres en place si applicable
        attachments.filter(attachment=>attachment.thumb).forEach( attachment => {
            const { fuuid, thumb } = attachment
            // delete attachment.thumb

            const attachmentMappe = dictAttachments[fuuid]
            delete attachmentMappe.thumb
            let { version_courante } = attachmentMappe
            let images = version_courante.images || {}
            version_courante.images = images
            let thumbCopie = images.thumb || {}
            thumbCopie = {...thumbCopie, ...thumb}
            images.thumb = thumbCopie
            delete thumbCopie.data_chiffre
        })

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

        const liste = attachments.map(attachment=>dictAttachments[attachment.fuuid])
        const listeMappee = liste.map(item=>mapper(item, workers))
        console.debug("Liste mappee : %O", listeMappee)

        setAttachmentsList(listeMappee)

    }, [workers, attachments, fichiersCharges, setAttachmentsList])

    if(!attachmentsList) return ''

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
                rows={attachmentsList} 
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

async function chargerFichiers(workers, attachments, setFichiersCharges) {
    const fuuids = attachments.map(item=>item.fuuid)
    console.debug("Charges fichiers avec fuuids : %O", fuuids)
    if(!fuuids || fuuids.length === 0) return  // Rien a faire
    try {
        const reponse = await workers.connexion.getDocumentsParFuuid(fuuids)
        console.debug("Reponse chargerFichiers : %O", reponse)
        if(reponse.fichiers) setFichiersCharges(reponse.fichiers)
        else console.warn("Erreur chargement fichiers par fuuid : %O", reponse)
    } catch(err) {
        console.error("Erreur chargement fichiers par fuuid : %O", err)
    }
}
