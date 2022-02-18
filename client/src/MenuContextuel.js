import { useCallback} from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

import { MenuContextuel } from '@dugrema/millegrilles.reactjs'

export function MenuContextuelAttacher(props) {
    console.debug("MenuContextuelAttacher proppys : %O", props)
    const { 
        workers, attachment, attachments, setAttachments, contextuel, 
        fermerContextuel, showPreview, showInfoModalOuvrir, downloadAction,
    } = props

    // // Determiner si preview est disponible
    // let previewDisponible = false
    // if(fichier) {
    //     const mimetype = fichier.mimetype || '',
    //           mimetypeBase = mimetype.split('/').shift()
    //     if(mimetype === 'application/pdf') {
    //         previewDisponible = true
    //     } else {
    //         const versionCourante = fichier.version_courante || {}
    //         if(mimetypeBase === 'image' && versionCourante.images) {
    //             previewDisponible = true
    //         } else if(mimetypeBase === 'video' && versionCourante.video) {
    //             previewDisponible = true
    //         }
    //     }
    // }

    // const showPreviewAction = useCallback( event => {
    //     if(previewDisponible) showPreview(fichier.fileId)
    //     fermerContextuel()
    // }, [fichier, previewDisponible, fermerContextuel])

    // const downloadEvent = useCallback( async event => {
    //     //console.debug("Download fichier %O", fichier)
    //     downloadAction(fichier)
    //     fermerContextuel()
    // }, [fichier, downloadAction, fermerContextuel])

    const retirerAction = useCallback( () => retirerAttacher([attachment.fileId], attachments, setAttachments), [attachment, attachments, setAttachments] )
    // const infoAction = useCallback( () => infoModal(fermerContextuel, showInfoModalOuvrir), [fermerContextuel, showInfoModalOuvrir] )

    return (
        <MenuContextuel show={contextuel.show} posX={contextuel.x} posY={contextuel.y} fermer={fermerContextuel}>
            {/* <Row><Col><Button variant="link" onClick={showPreviewAction} disabled={!previewDisponible}><i className="fa fa-search"/> Preview</Button></Col></Row>
            <Row><Col><Button variant="link" onClick={downloadEvent}><i className="fa fa-download"/> Download</Button></Col></Row>
            <Row><Col><Button variant="link" onClick={infoAction}><i className="fa fa-info-circle"/> Info</Button></Col></Row> */}
            <hr/>
            <Row><Col><Button variant="link" onClick={retirerAction}><i className="fa fa-remove"/> Retirer</Button></Col></Row>
        </MenuContextuel>
    )
}

export function MenuContextuelAttacherMultiselect(props) {

    const { attachments, setAttachments, selection, contextuel, fermerContextuel } = props

    const retirerAction = useCallback( () => retirerAttacher(selection, attachments, setAttachments), [selection])

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

export function MenuContextuelAfficherAttachments(props) {
    console.debug("MenuContextuelAfficherAttachments proppys : %O", props)
    const { 
        workers, attachment, cles, contextuel, 
        fermerContextuel, downloadAction,
        choisirCollectionCb,
    } = props

    // // Determiner si preview est disponible
    // let previewDisponible = false
    // if(fichier) {
    //     const mimetype = fichier.mimetype || '',
    //           mimetypeBase = mimetype.split('/').shift()
    //     if(mimetype === 'application/pdf') {
    //         previewDisponible = true
    //     } else {
    //         const versionCourante = fichier.version_courante || {}
    //         if(mimetypeBase === 'image' && versionCourante.images) {
    //             previewDisponible = true
    //         } else if(mimetypeBase === 'video' && versionCourante.video) {
    //             previewDisponible = true
    //         }
    //     }
    // }

    // const showPreviewAction = useCallback( event => {
    //     if(previewDisponible) showPreview(fichier.fileId)
    //     fermerContextuel()
    // }, [fichier, previewDisponible, fermerContextuel])

    const downloadEvent = useCallback( 
        event => { 
            console.debug("Downloader attachment : %O", attachment)
            const fuuid = attachment.fuuid
            const cle = cles[fuuid]
            const attachmentInfo = {...attachment, cle}
            downloadAction(attachmentInfo)
        }, 
        [attachment, downloadAction, fermerContextuel]
    )

    const copierCb = useCallback( () => choisirCollectionCb(attachment), [attachment, choisirCollectionCb] )

    // const infoAction = useCallback( () => infoModal(fermerContextuel, showInfoModalOuvrir), [fermerContextuel, showInfoModalOuvrir] )

    return (
        <MenuContextuel show={contextuel.show} posX={contextuel.x} posY={contextuel.y} fermer={fermerContextuel}>
            {/* <Row><Col><Button variant="link" onClick={showPreviewAction} disabled={!previewDisponible}><i className="fa fa-search"/> Preview</Button></Col></Row> */}
            <Row><Col><Button variant="link" onClick={downloadEvent}><i className="fa fa-download"/> Download</Button></Col></Row>
            <Row><Col><Button variant="link" onClick={copierCb}><i className="fa fa-copy"/> Copier</Button></Col></Row>
            {/* <Row><Col><Button variant="link" onClick={infoAction}><i className="fa fa-info-circle"/> Info</Button></Col></Row> */}
        </MenuContextuel>
    )
}

function retirerAttacher(listeIds, fichiers, setFichiers) {
    console.debug("Retirer attachments %O de %O", listeIds, fichiers)
    const fichiersMaj = fichiers.filter(item=>!listeIds.includes(item.fileId))
    setFichiers(fichiersMaj)
}

export function onContextMenu(event, value, setContextuel) {
    event.preventDefault()
    const {clientX, clientY} = event

    const params = {show: true, x: clientX, y: clientY}

    setContextuel(params)
}