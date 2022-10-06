import { useCallback} from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

import { MenuContextuel } from '@dugrema/millegrilles.reactjs'

export function MenuContextuelAttacher(props) {
    console.debug("MenuContextuelAttacher proppys : %O", props)
    const { 
        attachment, attachments, setAttachments, contextuel, fermerContextuel, 
    } = props

    const retirerAction = useCallback( () => retirerAttacher([attachment.fileId], attachments, setAttachments), [attachment, attachments, setAttachments] )

    return (
        <MenuContextuel show={contextuel.show} posX={contextuel.x} posY={contextuel.y} fermer={fermerContextuel}>
            <Row><Col><Button variant="link" onClick={retirerAction}><i className="fa fa-remove"/> Retirer</Button></Col></Row>
        </MenuContextuel>
    )
}

export function MenuContextuelAttacherMultiselect(props) {

    const { attachments, setAttachments, selection, contextuel, fermerContextuel } = props

    const retirerAction = useCallback( () => retirerAttacher(selection, attachments, setAttachments), [selection, attachments, setAttachments])

    return (
        <MenuContextuel show={contextuel.show} posX={contextuel.x} posY={contextuel.y} fermer={fermerContextuel}>
            <Row><Col><Button variant="link" disabled={true}><i className="fa fa-search"/> Preview</Button></Col></Row>
            <Row><Col><Button variant="link" disabled={true}><i className="fa fa-download"/> Download</Button></Col></Row>
            <Row><Col><Button variant="link" disabled={true}><i className="fa fa-info-circle"/> Info</Button></Col></Row>
            <hr/>
            <Row><Col><Button variant="link" onClick={retirerAction}><i className="fa fa-remove"/> Retirer</Button></Col></Row>
        </MenuContextuel>
    )
}

export function MenuContextuelAfficherAttachementsMultiselect(props) {

    const { selection, contextuel, fermerContextuel, choisirCollectionCb } = props

    const copierCb = useCallback( () => choisirCollectionCb(selection), [selection, choisirCollectionCb] )

    return (
        <MenuContextuel show={contextuel.show} posX={contextuel.x} posY={contextuel.y} fermer={fermerContextuel}>
            <Row><Col><Button variant="link" onClick={copierCb}><i className="fa fa-copy"/> Copier</Button></Col></Row>
        </MenuContextuel>
    )
}

export function MenuContextuelAfficherAttachments(props) {
    console.debug("MenuContextuelAfficherAttachments proppys : %O", props)
    const { 
        attachment, cles, contextuel, 
        fermerContextuel, downloadAction,
        choisirCollectionCb,
        showPreview,
    } = props

    // Determiner si preview est disponible
    let previewDisponible = false
    if(attachment) {
        const mimetype = attachment.mimetype || '',
              mimetypeBase = mimetype.split('/').shift()
        if(mimetype === 'application/pdf') {
            previewDisponible = true
        } else {
            const versionCourante = attachment.version_courante || {}
            if(mimetypeBase === 'image' && versionCourante.images) {
                previewDisponible = true
            } else if(mimetypeBase === 'video' && versionCourante.video) {
                previewDisponible = true
            }
        }
    }

    const showPreviewAction = useCallback( event => {
        console.debug("Show preview : %O", attachment.fuuid)
        if(previewDisponible) showPreview(attachment.fuuid)
        fermerContextuel()
    }, [attachment, previewDisponible, fermerContextuel, showPreview])

    const downloadEvent = useCallback( 
        event => { 
            console.debug("Downloader attachment : %O", attachment)
            const fuuid = attachment.fuuid
            const cle = cles[fuuid]
            const attachmentInfo = {...attachment, cle}
            downloadAction(attachmentInfo)
        }, 
        [cles, attachment, downloadAction]
    )

    const copierCb = useCallback( () => choisirCollectionCb(attachment), [attachment, choisirCollectionCb] )

    // const infoAction = useCallback( () => infoModal(fermerContextuel, showInfoModalOuvrir), [fermerContextuel, showInfoModalOuvrir] )

    return (
        <MenuContextuel show={contextuel.show} posX={contextuel.x} posY={contextuel.y} fermer={fermerContextuel}>
            <Row><Col><Button variant="link" onClick={showPreviewAction} disabled={!previewDisponible}><i className="fa fa-search"/> Preview</Button></Col></Row>
            <Row><Col><Button variant="link" onClick={downloadEvent}><i className="fa fa-download"/> Download</Button></Col></Row>
            <Row><Col><Button variant="link" onClick={copierCb}><i className="fa fa-copy"/> Copier</Button></Col></Row>
            {/* <Row><Col><Button variant="link" onClick={infoAction}><i className="fa fa-info-circle"/> Info</Button></Col></Row> */}
        </MenuContextuel>
    )
}

export function MenuContextuelAfficherMessages(props) {
    console.debug("MenuContextuelAfficherMessages proppys : %O", props)
    const { 
        contextuel, fermerContextuel, supprimerMessagesCb,
    } = props

    return (
        <MenuContextuel show={contextuel.show} posX={contextuel.x} posY={contextuel.y} fermer={fermerContextuel}>
            <Row><Button variant="link" onClick={supprimerMessagesCb}><i className="fa fa-trash"/> Supprimer</Button></Row>
        </MenuContextuel>
    )
}

export function MenuContextuelListeContacts(props) {
    const { contextuel, fermerContextuel, supprimerContacts } = props
    return (
        <MenuContextuel show={contextuel.show} posX={contextuel.x} posY={contextuel.y} fermer={fermerContextuel}>
            <Row><Button variant="link" onClick={supprimerContacts}><i className="fa fa-trash"/> Supprimer</Button></Row>
        </MenuContextuel>
    )
}

function retirerAttacher(listeIds, fichiers, setFichiers) {
    console.debug("Retirer attachments %O de %O", listeIds, fichiers)
    if(!fichiers || !fichiers.filter) return
    const fichiersMaj = fichiers.filter(item=>!listeIds.includes(item.fileId))
    setFichiers(fichiersMaj)
}

export function onContextMenu(event, value, setContextuel) {
    event.preventDefault()
    const {clientX, clientY} = event

    const posx = clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
    const posy = clientY + document.body.scrollTop + document.documentElement.scrollTop;

    const params = {show: true, x: posx, y: posy}

    setContextuel(params)
}