import { useState, useEffect } from 'react'

import { ModalViewer } from '@dugrema/millegrilles.reactjs'
import {trouverLabelImage} from '@dugrema/millegrilles.reactjs/src/labelsRessources'
import {loadFichierChiffre, fileResourceLoader} from '@dugrema/millegrilles.reactjs/src/imageLoading'

function PreviewFichiers(props) {
    // console.debug("PreviewFichiers proppies : %O", props)

    const { workers, fuuid, fichiers, showPreview, setShowPreview, supportMedia } = props

    const [ liste, setListe ] = useState([])

    useEffect(()=>{
        if(showPreview) {
            // console.debug("Liste fichiers pour previews : %O", fichiers)
            const liste = preparerPreviews(workers, fuuid, fichiers, supportMedia)
            // console.debug("Liste fichiers mappee pour previews : %O", liste)
            setListe(liste)
        } else {
            // Vider la liste
            setListe([])
        }
    }, [workers, fuuid, fichiers, showPreview, supportMedia, setListe] )

    // console.debug("PreviewFichiers liste : %O", liste)

    return (
        <ModalViewer 
            show={ showPreview } 
            handleClose={ () => setShowPreview(false) } 
            fichiers={liste} 
            tuuidSelectionne={ fuuid }
        />
    )
}

export default PreviewFichiers

function preparerPreviews(workers, tuuidSelectionne, liste, supportMedia) {
    // console.debug("!!! preparerPreviews : tuuid: %s, liste %O", tuuidSelectionne, liste)

    const optionsLoader = {supporteWebm: supportMedia.webm, supporteWebp: supportMedia.webp}

    const fichierSelectionne = liste.filter(item=>item.fileId===tuuidSelectionne).pop()
    const versionCourante = fichierSelectionne.version_courante || {}
    const mimetypeSelectionne = versionCourante.mimetype || '',
          mimetypeBase = mimetypeSelectionne.split('/').shift()

    if(mimetypeBase === 'image') {
        // Mode carousel d'images
        return liste.filter(filtrerTypesPreview).map(item=>mapImage(workers, item, optionsLoader))
    } else {
        // Mode lecteur fichier / video player - 1 seul fichier
        return [mapFichier(fichierSelectionne, optionsLoader)]
    }
}

function mapFichier(item, optionsLoader) {
    optionsLoader = optionsLoader || {}
    return {
        ...item,
        tuuid: item.fileId,
        // loader: (typeRessource, opts) => resLoader(item, typeRessource, {...optionsLoader, ...opts})
    }
}

function mapImage(workers, item, optionsLoader) {

    const traitementFichiersWorker = workers.traitementFichiers

    const version_courante = item.version_courante || {}
    const images = version_courante.images || {}
    // console.debug("Trouver labels images : %O", images)
    const labelImage = trouverLabelImage(Object.keys(images), {supporteWebp: true})
    const image = images[labelImage]
    // console.debug("Label trouve : %s, image : %O", labelImage, image)
    const thumbnail = images.thumbnail || images.thumb

    let loader = ''
    if(image && image.hachage) {
        const imageFuuid = image.hachage,
              imageMimetype = image.mimetype
        loader = fileResourceLoader(traitementFichiersWorker.getFichierChiffre, imageFuuid, imageMimetype, {thumbnail})
    } else if(thumbnail && thumbnail.hachage && thumbnail.data_chiffre) {
        loader = loadFichierChiffre(traitementFichiersWorker.getFichierChiffre, thumbnail.hachage, thumbnail.mimetype, {dataChiffre: thumbnail.data_chiffre})
    } else {
        console.debug("Aucune information d'image pour %O", item)
        return null
    }

    return {
        ...item,
        tuuid: item.fileId,
        loader,
    }
}

function filtrerTypesPreview(item) {
    if(item && item.mimetype) {
        const mimetype = item.mimetype.toLowerCase(),
              mimetypeBase = mimetype.split('/').shift()
        
        // if(mimetype === 'application/pdf') return true
        if(mimetypeBase === 'image') return true
    }
    return false
}


// import { useState, useEffect } from 'react'

// import { ModalViewer } from '@dugrema/millegrilles.reactjs'

// import { resLoader } from './workers/traitementFichiers.js'

// function PreviewFichiers(props) {

//     console.debug("PreviewsFichiers Proppys : %O", props)

//     const { fuuid, fichiers, showPreview, setShowPreview, support } = props

//     const [ liste, setListe ] = useState([])

//     useEffect(()=>{
//         if(showPreview) {
//             const liste = preparerPreviews(fuuid, fichiers, support)
//             console.debug("Liste previews : %O", liste)
//             setListe(liste)
//         } else {
//             // Vider la liste
//             setListe([])
//         }
//     }, [fuuid, fichiers, showPreview, support, setListe] )

//     return (
//         <ModalViewer 
//             show={ showPreview } 
//             handleClose={ () => setShowPreview(false) } 
//             fichiers={liste} 
//             tuuidSelectionne={ fuuid }
//         />
//     )
// }

// export default PreviewFichiers

// function preparerPreviews(fuuid, liste, support) {

//     console.debug("!!! PreparerPreviews %s : %O", fuuid, liste)

//     const optionsLoader = {supporteWebm: support.webm, supporteWebp: support.webp}

//     const fichierSelectionne = liste.filter(item=>item.fuuid===fuuid).pop()
//     const versionCourante = fichierSelectionne.version_courante || {}
//     const mimetypeSelectionne = versionCourante.mimetype || '',
//           mimetypeBase = mimetypeSelectionne.split('/').shift()

//     if(mimetypeBase === 'video') {
//         // Mode video player - 1 seul fichier
//         return [mapFichier(fichierSelectionne, optionsLoader)]
//     } else {
//         // Mode carousel
//         return liste.filter(filtrerTypesPreview).map(item=>mapFichier(item, optionsLoader))
//     }
// }

// function mapFichier(item, optionsLoader) {
//     return {
//         ...item,
//         tuuid: item.fuuid,
//         loader: (typeRessource, opts) => resLoader(item, typeRessource, optionsLoader)
//     }
// }

// function filtrerTypesPreview(item) {
//     if(item && item.mimetype) {
//         const mimetype = item.mimetype.toLowerCase(),
//               mimetypeBase = mimetype.split('/').shift()
        
//         if(mimetype === 'application/pdf') return true
//         if(mimetypeBase === 'image') return true
//     }
//     return false
// }
