import axios from 'axios'
import multibase from 'multibase'
import { saveCleDechiffree, getCleDechiffree } from '@dugrema/millegrilles.reactjs/src/dbUsager'
import { trouverLabelImage, trouverLabelVideo } from '@dugrema/millegrilles.reactjs/src/labelsRessources'
import { getThumbnail as getIdbThumbnail, saveThumbnailDechiffre } from '../idbCollections'

var _workers = null

export function setWorkers(workers) {
    _workers = workers
}

export async function getThumbnail(fuuid, opts) {
    opts = opts || {}

    // Verifier si le thumbnail est deja dans collections.thumbnails
    try {
        const thumbnailCache = await getIdbThumbnail(fuuid)
        if(thumbnailCache && thumbnailCache.blob) {
            // console.debug("!!! Thumbnail cache : %O", thumbnailCache)
            return thumbnailCache.blob
        }
    } catch(err) {
        console.error('Erreur chargement thumbnail fichier %s', fuuid)
    }

    const blob = await getFichierChiffre(fuuid, opts)
    if(blob) {
        // console.debug("Sauvegarder le thumbnail dechiffre : %O", blob)
        saveThumbnailDechiffre(fuuid, blob)
    }

    return blob
}

export async function getFichierChiffre(fuuid, opts) {
    opts = opts || {}
    const { dataChiffre, mimetype, controller, progress } = opts
    const { connexion, chiffrage } = _workers

    // Recuperer la cle de fichier
    const cleFichierFct = async () => {
        let cleFichier = await getCleDechiffree(fuuid)
        if(cleFichier) return cleFichier

        const reponse = await connexion.getClesFichiers([fuuid])

        cleFichier = reponse.cles[fuuid]
        const cleSecrete = await chiffrage.dechiffrerCleSecrete(cleFichier.cle)
        cleFichier.cleSecrete = cleSecrete

        // Sauvegarder la cle pour reutilisation
        saveCleDechiffree(fuuid, cleSecrete, cleFichier)
            .catch(err=>{
                console.warn("Erreur sauvegarde cle dechiffree %s dans la db locale", err)
            })

        return cleFichier
    }

    let fichierFct = async () => {
        if( dataChiffre ) {
            // Convertir de multibase en array
            return multibase.decode(dataChiffre)
        } else {
            // const controller = new AbortController();
            const signal = controller?controller.signal:null

            // Recuperer le fichier
            const reponse = await axios({
                method: 'GET',
                url: `/fichiers/${fuuid}`,
                responseType: 'arraybuffer',
                // timeout: 120000,
                progress,
                signal,
            })
            // console.debug("!!! Reponse axios : %O", reponse)
            
            return reponse.data
        }
    }

    var [cleFichier, abFichier] = await Promise.all([cleFichierFct(), fichierFct()])
    if(cleFichier && abFichier) {
        try {
            const ab = await chiffrage.chiffrage.dechiffrer(abFichier, cleFichier.cleSecrete, cleFichier.iv, cleFichier.tag)
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
    opts = opts || {}
    const { fileId } = fichier
    const versionCourante = fichier.version_courante || {}
    const { anime } = versionCourante
    console.debug("Loader %s avec sources %O (opts: %O)", typeRessource, fichier, opts)

    let selection = ''
    if(typeRessource === 'video') {
        // Charger video pleine resolution
        const {video} = versionCourante
        if(video) {
            const labelVideo = trouverLabelVideo(Object.keys(video), opts)
            console.debug("Label video trouve : '%s'", labelVideo)
            selection = video[labelVideo]
        }
    } else if(typeRessource === 'image') {
        // Charger image pleine resolution
        const mimetype = versionCourante.mimetype
        if(anime && mimetype.startsWith('image/')) {
            // Pas un video et anime
            selection = {versionCourante, fuuid: fichier.fuuid}
        } else {
            const images = versionCourante.images
            const labelImage = trouverLabelImage(Object.keys(images), opts)
            // console.debug("Label image trouve : '%s'", labelImage)
            selection = images[labelImage]
        }
    } else if(typeRessource === 'poster') {
        // Charger poster (fallback image pleine resolution)
        const images = versionCourante.images
        if(images.poster) selection = images.poster
        else {
            const labelImage = trouverLabelImage(Object.keys(images), opts)
            // console.debug("Label image trouve : '%s'", labelImage)
            selection = images[labelImage]
        }
    } else if(typeRessource === 'thumbnail') {
        // Charger thumbnail (fallback image poster, sinon pleine resolution)
        const images = versionCourante.images
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
        console.debug("Charger video selection %O, mimetype: %O, fuuid video: %s", selection, mimetype, fuuid)
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
        console.warn("Erreur cleanup URL Blob")
    }
}