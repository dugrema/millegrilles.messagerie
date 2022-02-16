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

// export function MenuContextuelVoirAttachment(props) {
//     const { 
//         workers, fichier, contextuel, fermerContextuel, showPreview, cuuid, 
//         showSupprimerModalOuvrir, showCopierModalOuvrir, showDeplacerModalOuvrir, 
//         showInfoModalOuvrir, showRenommerModalOuvrir, downloadAction,
//     } = props
//     const { transfertFichiers } = workers

//     // Determiner si preview est disponible
//     let previewDisponible = false
//     if(fichier) {
//         const mimetype = fichier.mimetype || '',
//               mimetypeBase = mimetype.split('/').shift()
//         if(mimetype === 'application/pdf') {
//             previewDisponible = true
//         } else {
//             const versionCourante = fichier.version_courante || {}
//             if(mimetypeBase === 'image' && versionCourante.images) {
//                 previewDisponible = true
//             } else if(mimetypeBase === 'video' && versionCourante.video) {
//                 previewDisponible = true
//             }
//         }
//     }

//     const showPreviewAction = useCallback( event => {
//         if(previewDisponible) showPreview(fichier.fileId)
//         fermerContextuel()
//     }, [fichier, previewDisponible, fermerContextuel])

//     const downloadEvent = useCallback( async event => {
//         //console.debug("Download fichier %O", fichier)
//         downloadAction(fichier)
//         fermerContextuel()
//     }, [fichier, downloadAction, fermerContextuel])

//     const supprimerAction = useCallback( () => supprimerDocuments(fermerContextuel, showSupprimerModalOuvrir), [fermerContextuel, showSupprimerModalOuvrir] )
//     const retirerAction = useCallback( () => retirerMultiple(workers, fermerContextuel, [fichier.fileId], cuuid), [workers, fermerContextuel, fichier, cuuid] )
//     const copierAction = useCallback( () => copier(fermerContextuel, showCopierModalOuvrir), [fermerContextuel, showCopierModalOuvrir] )
//     const deplacerAction = useCallback( () => deplacer(fermerContextuel, showDeplacerModalOuvrir), [fermerContextuel, showDeplacerModalOuvrir] )
//     const renommerAction = useCallback( () => renommer(fermerContextuel, showRenommerModalOuvrir), [fermerContextuel, showRenommerModalOuvrir] )
//     const infoAction = useCallback( () => infoModal(fermerContextuel, showInfoModalOuvrir), [fermerContextuel, showInfoModalOuvrir] )

//     return (
//         <MenuContextuel show={contextuel.show} posX={contextuel.x} posY={contextuel.y} fermer={fermerContextuel}>
//             <Row><Col><Button variant="link" onClick={showPreviewAction} disabled={!previewDisponible}><i className="fa fa-search"/> Preview</Button></Col></Row>
//             <Row><Col><Button variant="link" onClick={downloadEvent}><i className="fa fa-download"/> Download</Button></Col></Row>
//             <Row><Col><Button variant="link" onClick={infoAction}><i className="fa fa-info-circle"/> Info</Button></Col></Row>
//             <hr/>
//             <Row><Col><Button variant="link" onClick={renommerAction}><i className="fa fa-edit"/> Renommer</Button></Col></Row>
//             <Row><Col><Button variant="link" onClick={deplacerAction} disabled={!cuuid}><i className="fa fa-cut"/> Deplacer</Button></Col></Row>
//             <Row><Col><Button variant="link" onClick={copierAction}><i className="fa fa-copy"/> Copier</Button></Col></Row>
//             <Row><Col><Button variant="link" onClick={retirerAction}><i className="fa fa-remove"/> Retirer</Button></Col></Row>
//             <Row><Col><Button variant="link" onClick={supprimerAction}><i className="fa fa-trash-o" /> Supprimer</Button></Col></Row>
//         </MenuContextuel>
//     )
// }

function retirerAttacher(listeIds, fichiers, setFichiers) {
    console.debug("Retirer attachments %O de %O", listeIds, fichiers)
    const fichiersMaj = fichiers.filter(item=>!listeIds.includes(item.fileId))
    setFichiers(fichiersMaj)
}
