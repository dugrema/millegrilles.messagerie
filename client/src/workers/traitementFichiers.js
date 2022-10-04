import axios from 'axios'
import multibase from 'multibase'
import { trouverLabelImage, trouverLabelVideo } from '@dugrema/millegrilles.reactjs/src/labelsRessources'
import { ajouterUpload } from '../redux/uploaderSlice'
import * as Comlink from 'comlink'

const UPLOAD_BATCH_SIZE = 5 * 1024 * 1024,
      ETAT_PREPARATION = 1,
      ETAT_PRET = 2

const CACHE_TEMP_NAME = 'fichiersDechiffresTmp'

function setup(workers) {
    return {
        getFichierChiffre(fuuid, opts) {
            return getFichierChiffre(workers, fuuid, opts)
        },
        traiterAcceptedFiles(dispatch, usager, cuuid, acceptedFiles, opts) {
            opts = opts || {}
            return traiterAcceptedFiles(workers, dispatch, usager, cuuid, acceptedFiles, opts)
        },
        resLoader,
        clean,
        downloadCache,
    }
}

export default setup

async function getFichierChiffre(workers, fuuid, opts) {
    opts = opts || {}
    const { dataChiffre, mimetype, controller, progress, ref_hachage_bytes } = opts
    const { connexion, chiffrage, usagerDao } = workers

    // Recuperer la cle de fichier
    const cleFichierFct = async () => {
        const hachage_bytes = ref_hachage_bytes || fuuid

        let cleFichier = null
        try {
            cleFichier = await usagerDao.getCleDechiffree(hachage_bytes)
            if(cleFichier) return cleFichier
        } catch(err) {
            console.error("Erreur acces usagerDao ", err)
        }

        const reponse = await connexion.getClesFichiers([hachage_bytes])

        cleFichier = reponse.cles[hachage_bytes]
        const cleSecrete = await chiffrage.dechiffrerCleSecrete(cleFichier.cle)
        cleFichier.cleSecrete = cleSecrete

        // Sauvegarder la cle pour reutilisation
        usagerDao.saveCleDechiffree(hachage_bytes, cleSecrete, cleFichier)
            .catch(err=>{
                console.warn("Erreur sauvegarde cle dechiffree %s dans la db locale", err)
            })

        return cleFichier
    }

    let fichierFct = async () => {
        if( dataChiffre ) {
            // Convertir de multibase en array
            // console.debug("Data chiffre a dechiffrer : %O", dataChiffre)
            return multibase.decode(dataChiffre)
        } else {
            // const controller = new AbortController();
            const signal = controller?controller.signal:null

            // Recuperer le fichier
            const reponse = await axios({
                method: 'GET',
                url: `/messagerie/fichiers/${fuuid}`,
                responseType: 'arraybuffer',
                timeout: 20000,
                progress,
                // signal,
            })
            const abIn = Buffer.from(reponse.data)
            return abIn
        }
    }

    var [cleFichier, abFichier] = await Promise.all([cleFichierFct(), fichierFct()])
    if(cleFichier && abFichier) {
        // console.debug("Dechiffrer : cle %O, contenu : %O", cleFichier, abFichier)
        try {
            const champsOverrides = ['header', 'format']
            const overrides = {}
            for (const champ of champsOverrides) {
                if(opts[champ]) overrides[champ] = opts[champ]
            }
            const cleEffective = {...cleFichier, ...overrides}  // Permet override par header, format, etc pour images/video
            // console.debug("Dechiffre avec cle effective %O (cle %O)", cleEffective, cleFichier)
            const ab = await chiffrage.chiffrage.dechiffrer(cleFichier.cleSecrete, abFichier, cleEffective)
            // console.debug("Contenu dechiffre : %O", ab)
            const blob = new Blob([ab], {type: mimetype})
            return blob
        } catch(err) {
            console.error("Erreur dechiffrage traitementFichiers : %O", err)
            throw err
        }
    }

    console.error("Erreur chargement image %s (erreur recuperation cle ou download)", fuuid)
}

/* Donne acces aux ressources, selection via typeRessource. Chargement async. 
   Retourne { src } qui peut etre un url ou un blob. 
*/
export function resLoader(fichier, typeRessource, opts) {
    // console.debug("Res loader fichier %s : typeRessource %O, opts %O", fichier, typeRessource, opts)
    opts = opts || {}
    const { fileId } = fichier
    const versionCourante = fichier.version_courante || {}
    const { anime } = versionCourante
    // console.debug("Loader %s avec sources %O (opts: %O)", typeRessource, fichier, opts)

    let selection = ''
    if(typeRessource === 'video') {
        // Charger video pleine resolution
        const {video} = versionCourante
        if(video) {
            const labelVideo = trouverLabelVideo(Object.keys(video), opts)
            // console.debug("Label video trouve : '%s'", labelVideo)
            selection = video[labelVideo]
        }
    } else if(typeRessource === 'image') {
        // Charger image pleine resolution
        const mimetype = versionCourante.mimetype
        if(anime && mimetype.startsWith('image/')) {
            // Pas un video et anime
            selection = {versionCourante, fuuid: fichier.fuuid}
        } else {
            const images = versionCourante.images || {}
            const labelImage = trouverLabelImage(Object.keys(images), opts)
            // console.debug("Label image trouve : '%s'", labelImage)
            selection = images[labelImage]
        }
    } else if(typeRessource === 'poster') {
        // Charger poster (fallback image pleine resolution)
        const images = versionCourante.images || {}
        if(images.poster) selection = images.poster
        else {
            const labelImage = trouverLabelImage(Object.keys(images), opts)
            // console.debug("Label image trouve : '%s'", labelImage)
            selection = images[labelImage]
        }
    } else if(typeRessource === 'thumbnail') {
        // Charger thumbnail (fallback image poster, sinon pleine resolution)
        const images = versionCourante.images || {}
        if(images.thumbnail) selection = images.thumbnail
        else if(images.poster) selection = images.poster
        else {
            const labelImage = trouverLabelImage(Object.keys(images), opts)
            // console.debug("Label image trouve : '%s'", labelImage)
            selection = images[labelImage]
        }
    } else if(typeRessource === 'original') {
        // Charger contenu original
        selection = {versionCourante, fuuid: fichier.fuuid}
    }

    if(selection) {
        const fuuid = selection.fuuid_video || selection.hachage || selection.fuuid
        const mimetype = selection.mimetype || versionCourante.mimetype || fichier.mimetype
        if(!fuuid) {
            console.warn("Aucun fuuid trouve pour file_id: %s (selection: %O)", fileId, selection)
            throw new Error(`Aucun fuuid trouve pour file_id: ${fileId}`)
        }
        // console.debug("Charger video selection %O, mimetype: %O, fuuid video: %s", selection, mimetype, fuuid)
        const controller = new AbortController()
        const urlBlob = getFichierChiffre(fuuid, {mimetype, controller})
            .then(blob=>URL.createObjectURL(blob))
            // .catch(err=>console.error("Erreur creation url blob fichier %s : %O", selection.hachage, err))

        return { srcPromise: urlBlob, clean: ()=>{
            try { controller.abort() } catch(err) {console.debug("Erreur annulation getFichierChiffre : %O", err)}
            clean(urlBlob) 
        }}
    }

    return false
}

async function clean(urlBlobPromise) {
    try {
        const urlBlob = await urlBlobPromise
        // console.debug("Cleanup blob %s", urlBlob)
        URL.revokeObjectURL(urlBlob)
    } catch(err) {
        console.debug("Erreur cleanup URL Blob : %O", err)
    }
}

async function traiterAcceptedFiles(workers, dispatch, usager, cuuid, acceptedFiles, opts) {
    opts = opts || {}
    const { setProgres } = opts
    const { clesDao, transfertFichiers } = workers
    const userId = usager.extensions.userId
    // console.debug("traiterAcceptedFiles Debut pour userId %s, cuuid %s, fichiers %O", userId, cuuid, acceptedFiles)

    const certificatMaitredescles = await clesDao.getCertificatsMaitredescles()
    // console.debug("Set certificat maitre des cles ", certificatMaitredescles)
    await transfertFichiers.up_setCertificat(certificatMaitredescles.certificat)

    const ajouterPartProxy = Comlink.proxy((correlation, compteurPosition, chunk) => ajouterPart(workers, correlation, compteurPosition, chunk))
    const updateFichierProxy = Comlink.proxy((doc, opts) => updateFichier(workers, dispatch, doc, opts))
    const setProgresProxy = setProgres?Comlink.proxy(setProgres):null
    const resultat = await transfertFichiers.traiterAcceptedFiles(
        acceptedFiles, userId, cuuid, 
        ajouterPartProxy, 
        updateFichierProxy,
        setProgresProxy
    )
    return resultat
}

async function ajouterPart(workers, correlation, compteurPosition, chunk) {
    const { uploadFichiersDao } = workers
    // console.debug("ajouterPart %s position %d : %O", correlation, compteurPosition, chunk)
    await uploadFichiersDao.ajouterFichierUploadFile(correlation, compteurPosition, chunk)
}

async function updateFichier(workers, dispatch, doc, opts) {
    opts = opts || {}
    const correlation = doc.correlation
    const demarrer = opts.demarrer || false,
          err = opts.err

    const { uploadFichiersDao } = workers

    // console.debug("Update fichier %s demarrer? %s err? %O : %O", correlation, demarrer, err, doc)

    if(err) {
        console.error("Erreur upload fichier %s : %O", correlation, err)
        // Supprimer le fichier dans IDB
        uploadFichiersDao.supprimerFichier(correlation)
            .catch(err=>console.error('updateFichier Erreur nettoyage %s suite a une erreur : %O', correlation, err))
        return
    }
    
    await uploadFichiersDao.updateFichierUpload(doc)

    // Declencher l'upload si applicable
    if(demarrer) dispatch(ajouterUpload(doc))
}

export async function downloadCache(fuuid, opts) {
    opts = opts || {}
    if(fuuid.currentTarget) fuuid = fuuid.currentTarget.value
    // console.debug("Download fichier : %s = %O", fuuid, opts)
    const cacheTmp = await caches.open(CACHE_TEMP_NAME)
    const cacheFichier = await cacheTmp.match('/'+fuuid)
    // console.debug("Cache fichier : %O", cacheFichier)
    if(cacheFichier) {
        promptSaveFichier(await cacheFichier.blob(), opts)
    } else {
        console.warn("Fichier '%s' non present dans le cache", fuuid)
    }
}

function promptSaveFichier(blob, opts) {
    opts = opts || {}
    const filename = opts.filename
    let objectUrl = null
    try {
        objectUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        if (filename) a.download = filename
        if (opts.newTab) a.target = '_blank'
        a.click()
    } finally {
        if (objectUrl) {
            try {
                URL.revokeObjectURL(objectUrl)
            } catch (err) {
                console.debug("Erreur revokeObjectURL : %O", err)
            }
        }
    }
}




// --------------------------- previous ---------------------------------

// import axios from 'axios'
// import multibase from 'multibase'
// import { usagerDao } from '@dugrema/millegrilles.reactjs'
// import { trouverLabelImage, trouverLabelVideo } from '@dugrema/millegrilles.reactjs/src/labelsRessources'
// import { base64 } from 'multiformats/bases/base64'

// var _workers = null

// export function setWorkers(workers) {
//     _workers = workers
// }

// export async function getFichierChiffre(fuuid, opts) {
//     // console.debug("!!! getFichierChiffre %s !!! opts %O", fuuid, opts)
//     opts = opts || {}
//     const { dataChiffre, mimetype, controller, progress, cles } = opts
//     const { connexion, chiffrage } = _workers

//     // Recuperer la cle de fichier
//     const cleFichierFct = async () => {
//         let cleFichier = await usagerDao.getCleDechiffree(fuuid)
//         if(cleFichier) return cleFichier

//         let cleSecrete = null
//         if( cles[fuuid] ) {
//             cleFichier = {...cles[fuuid]}
//             // console.debug("Mapper cle fuuid %s : %O", fuuid, cleFichier)
//             // Decoder cleSecrete de base64 a buffer
//             cleSecrete = base64.decode(cleFichier.cleSecrete)
//             cleFichier.cleSecrete = cleSecrete
//             // console.debug("Cle secrete mappee : %O", cleFichier)
//         } else {
//             const reponse = await connexion.getClesFichiers([fuuid])
//             cleFichier = reponse.cles[fuuid]
//             cleSecrete = await chiffrage.dechiffrerCleSecrete(cleFichier.cle)
//             cleFichier.cleSecrete = cleSecrete
//         }

//         // Sauvegarder la cle pour reutilisation
//         usagerDao.saveCleDechiffree(fuuid, cleSecrete, cleFichier)
//             .catch(err=>{
//                 console.warn("Erreur sauvegarde cle dechiffree %s dans la db locale", err)
//             })

//         return cleFichier
//     }

//     let fichierFct = async () => {
//         if( dataChiffre ) {
//             // Convertir de multibase en array
//             return multibase.decode(dataChiffre)
//         } else {
//             // const controller = new AbortController();
//             const signal = controller?controller.signal:null

//             // Recuperer le fichier
//             const reponse = await axios({
//                 method: 'GET',
//                 url: `/messagerie/fichiers/${fuuid}`,
//                 responseType: 'arraybuffer',
//                 // timeout: 120000,
//                 progress,
//                 signal,
//             })
//             // console.debug("!!! Reponse axios : %O", reponse)
            
//             return reponse.data
//         }
//     }

//     var [cleFichier, abFichier] = await Promise.all([cleFichierFct(), fichierFct()])
//     if(cleFichier && abFichier) {
//         try {
//             const ab = await chiffrage.chiffrage.dechiffrer(abFichier, cleFichier.cleSecrete, cleFichier.iv, cleFichier.tag)
//             // console.debug("!!!! blob %s mimetype %s", fuuid, mimetype)
//             const blob = new Blob([ab], {type: mimetype})
//             return blob
//         } catch(err) {
//             console.error("Erreur dechiffrage traitementFichiers : %O", err)
//             throw err
//         }
//     }

//     console.error("Erreur chargement image %s (erreur recuperation cle ou download)", fuuid)
// }

// /* Donne acces aux ressources, selection via typeRessource. Chargement async. 
//    Retourne { src } qui peut etre un url ou un blob. 
// */
// export function resLoader(fichier, typeRessource, opts) {
//     // console.debug("Res loader fichier %s : typeRessource %O, opts %O", fichier, typeRessource, opts)
//     opts = opts || {}
//     const { fileId } = fichier
//     const versionCourante = fichier.version_courante || {}
//     const { anime } = versionCourante
//     // console.debug("Loader %s avec sources %O (opts: %O)", typeRessource, fichier, opts)

//     let selection = ''
//     if(typeRessource === 'video') {
//         // Charger video pleine resolution
//         const {video} = versionCourante
//         if(video) {
//             const labelVideo = trouverLabelVideo(Object.keys(video), opts)
//             // console.debug("Label video trouve : '%s'", labelVideo)
//             selection = video[labelVideo]
//         }
//     } else if(typeRessource === 'image') {
//         // Charger image pleine resolution
//         const mimetype = versionCourante.mimetype
//         if(anime && mimetype.startsWith('image/')) {
//             // Pas un video et anime
//             selection = {versionCourante, fuuid: fichier.fuuid}
//         } else {
//             const images = versionCourante.images || {}
//             const labelImage = trouverLabelImage(Object.keys(images), opts)
//             // console.debug("Label image trouve : '%s'", labelImage)
//             selection = images[labelImage]
//         }
//     } else if(typeRessource === 'poster') {
//         // Charger poster (fallback image pleine resolution)
//         const images = versionCourante.images || {}
//         if(images.poster) selection = images.poster
//         else {
//             const labelImage = trouverLabelImage(Object.keys(images), opts)
//             // console.debug("Label image trouve : '%s'", labelImage)
//             selection = images[labelImage]
//         }
//     } else if(typeRessource === 'thumbnail') {
//         // Charger thumbnail (fallback image poster, sinon pleine resolution)
//         const images = versionCourante.images || {}
//         if(images.thumbnail) selection = images.thumbnail
//         else if(images.poster) selection = images.poster
//         else {
//             const labelImage = trouverLabelImage(Object.keys(images), opts)
//             // console.debug("Label image trouve : '%s'", labelImage)
//             selection = images[labelImage]
//         }
//     } else if(typeRessource === 'original') {
//         // Charger contenu original
//         selection = {versionCourante, fuuid: fichier.fuuid}
//     }

//     if(selection) {
//         const fuuid = selection.fuuid_video || selection.hachage || selection.fuuid
//         const mimetype = selection.mimetype || versionCourante.mimetype || fichier.mimetype
//         if(!fuuid) {
//             console.warn("Aucun fuuid trouve pour file_id: %s (selection: %O)", fileId, selection)
//             throw new Error(`Aucun fuuid trouve pour file_id: ${fileId}`)
//         }
//         // console.debug("Charger video selection %O, mimetype: %O, fuuid video: %s", selection, mimetype, fuuid)
//         const controller = new AbortController()
//         const urlBlob = getFichierChiffre(fuuid, {mimetype, controller})
//             .then(blob=>URL.createObjectURL(blob))
//             // .catch(err=>console.error("Erreur creation url blob fichier %s : %O", selection.hachage, err))

//         return { srcPromise: urlBlob, clean: ()=>{
//             try { controller.abort() } catch(err) {console.debug("Erreur annulation getFichierChiffre : %O", err)}
//             clean(urlBlob) 
//         }}
//     }

//     return false
// }

// async function clean(urlBlobPromise) {
//     try {
//         const urlBlob = await urlBlobPromise
//         // console.debug("Cleanup blob %s", urlBlob)
//         URL.revokeObjectURL(urlBlob)
//     } catch(err) {
//         console.debug("Erreur cleanup URL Blob : %O", err)
//     }
// }
