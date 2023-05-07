// import {
//     loadFichierChiffre, fileResourceLoader, imageResourceLoader, videoResourceLoader, audioResourceLoader
// } from '@dugrema/millegrilles.reactjs/src/imageLoading'

import MediaLoader from '@dugrema/millegrilles.reactjs/src/mediaLoader'

// import {supporteFormatWebp, /*supporteFormatWebm*/} from '@dugrema/millegrilles.reactjs/src/detecterAppareils'

const ICONE_FOLDER = <i className="fa fa-folder fa-lg"/>
const ICONE_FICHIER = <i className="fa fa-file fa-lg"/>
const ICONE_FICHIER_PDF = <i className="fa fa-file-pdf-o fa-lg"/>
const ICONE_FICHIER_IMAGE = <i className="fa fa-file-image-o fa-lg"/>
const ICONE_FICHIER_AUDIO = <i className="fa fa-file-audio-o fa-lg"/>
const ICONE_FICHIER_VIDEO = <i className="fa fa-file-video-o fa-lg"/>
const ICONE_FICHIER_TEXT = <i className="fa fa-file-text-o fa-lg"/>
const ICONE_FICHIER_ZIP = <i className="fa fa-file-zip-o fa-lg"/>
const ICONE_QUESTION = <i className="fa fa-question fa-lg"/>

const Icones = {
    ICONE_FOLDER, ICONE_FICHIER, ICONE_FICHIER_PDF, ICONE_FICHIER_IMAGE, ICONE_FICHIER_AUDIO, 
    ICONE_FICHIER_VIDEO, ICONE_FICHIER_TEXT, ICONE_FICHIER_ZIP, ICONE_QUESTION,
}

// // Detection format media
// const supporteWebm = supporteFormatWebm()
// let supporteWebp = false
// supporteFormatWebp().then(supporte=>supporteWebp=supporte).catch(err=>console.warn("Erreur detection webp : %O", err))
// // console.debug("Support webm : %O", supporteWebm)

export { Icones }

// Mapping pour selection d'attachements
// export function mapper(row, workers, opts) {
//     // console.trace("Mapper attachment : %O (opts: %O)", row, opts)
//     opts = opts || {}
//     const version_courante = row.version_courante || row
//     const mimetype = version_courante.mimetype || row.mimetype

//     const { tuuid, fuuid, nom, supprime, date_creation, duree, fuuid_v_courante, favoris, disabled } = row
//     const { genererToken, creerToken } = opts
//     const cles = opts.cles || {}
//     // const supportMedia = opts.supportMedia || {},
//     //       supporteWebp = true  // !!supportMedia.webp

//     // console.debug("!!! MAPPER %O, opts: %O", row, opts)

//     let date_version = '', 
//         mimetype_fichier = '',
//         taille_fichier = ''

//     let thumbnailIcon = '',
//         ids = {},
//         miniThumbnailLoader = null,
//         smallThumbnailLoader = null,
//         loader = null,
//         imageLoader = null,
//         videoLoader = null,
//         audioLoader = null
//     if(!mimetype) {
//         ids.folderId = tuuid  // Collection, tuuid est le folderId
//         thumbnailIcon = Icones.ICONE_FOLDER
//     } else {
//         const { date_fichier, taille, images, video } = version_courante
//         const ref_hachage_bytes = fuuid
//         mimetype_fichier = mimetype
//         date_version = date_fichier
//         taille_fichier = taille
//         ids.fileId = tuuid || fuuid  // Fichier, tuuid est le fileId pour selection attachment, fuuid pour messages recus
//         const mimetypeBase = mimetype.split('/').shift()

//         if(workers && workers.traitementFichiers) {
//             const getFichierChiffre = workers.traitementFichiers.getFichierChiffre

//             // Thumbnails pour navigation
//             if(images) {
//                 const thumbnail = images.thumb || images.thumbnail,
//                     small = images.small || images.poster
//                 if(thumbnail && thumbnail.data_chiffre) {
//                     miniThumbnailLoader = loadFichierChiffre(getFichierChiffre, thumbnail.hachage, thumbnail.mimetype, {dataChiffre: thumbnail.data_chiffre, ref_hachage_bytes, cles})
//                 }
//                 if(small) smallThumbnailLoader = fileResourceLoader(getFichierChiffre, small.hachage, small.mimetype, {thumbnail, ref_hachage_bytes, cles})

//                 imageLoader = imageResourceLoader(getFichierChiffre, images, {supporteWebp, ref_hachage_bytes, cles})
//             }

//             if(video) {
//                 if(video && Object.keys(video).length > 0) {
//                     videoLoader = videoResourceLoader(video, {creerToken, fuuid: fuuid_v_courante, version_courante, baseUrl: '/messagerie/streams'})
//                 } else {
//                     // console.debug("Video - original seulement")
//                     videoLoader = videoResourceLoader({}, {creerToken, fuuid: fuuid_v_courante, version_courante, baseUrl: '/messagerie/streams'})
//                 }
//             } else if(mimetypeBase === 'audio') {
//                 audioLoader = audioResourceLoader(fuuid, {creerToken, fuuid: fuuid_v_courante, version_courante, baseUrl: '/messagerie/streams'})
//             }
        
//             // Loader du fichier source (principal), supporte thumbnail pour chargement
//             loader = loadFichierChiffre(getFichierChiffre, fuuid_v_courante, mimetype, {cles})
//         }

//         if(mimetype === 'application/pdf') {
//             thumbnailIcon = ICONE_FICHIER_PDF
//         } else if(mimetypeBase === 'image') {
//             thumbnailIcon = ICONE_FICHIER_IMAGE
//         } else if(mimetypeBase === 'video') {
//             thumbnailIcon = ICONE_FICHIER_VIDEO
//         } else if(mimetypeBase === 'audio') {
//             thumbnailIcon = ICONE_FICHIER_AUDIO
//         } else if(mimetypeBase === 'application/text') {
//             thumbnailIcon = ICONE_FICHIER_TEXT
//         } else if(mimetypeBase === 'application/zip') {
//             thumbnailIcon = ICONE_FICHIER_ZIP
//         } else { 
//             thumbnailIcon = ICONE_FICHIER
//         }
//     }

//     return {
//         // fileId: tuuid,
//         // folderId: tuuid,
//         ...ids,
//         nom,
//         supprime, 
//         taille: taille_fichier,
//         dateAjout: date_version || date_creation,
//         mimetype: ids.folderId?'Repertoire':mimetype_fichier,
//         // thumbnailSrc,
//         thumbnail: {
//             miniLoader: miniThumbnailLoader,
//             smallLoader: smallThumbnailLoader,
//             thumbnailIcon,
//             thumbnailCaption: nom,
//         },
//         loader,
//         imageLoader,
//         videoLoader,
//         audioLoader,
//         duree,
//         fuuid: fuuid_v_courante,
//         version_courante,
//         favoris,
//         disabled,
//     }
// }

// Formatte un attachment comme si c'etait un fichier
export function mapperRowAttachment(attachment, workers, opts) {
    console.debug("Mapper row attachement : ", attachment)
    const attachmentMapperFichier = mapperFichiers([attachment], true).pop()
    return mapDocumentComplet(workers, attachmentMapperFichier, opts)
}

export function onContextMenu(event, value, setContextuel) {
    event.preventDefault()
    const {clientX, clientY} = event
    // console.debug("ContextMenu %O (%d, %d)", value, clientX, clientY)

    const posx = clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
    const posy = clientY + document.body.scrollTop + document.documentElement.scrollTop;

    const params = {show: true, x: posx, y: posy}

    setContextuel(params)
}

// export function mapDocumentComplet(workers, doc) {

//     const { connexion, traitementFichiers } = workers

//     const { nom, tuuid, date_creation, fuuid_v_courante, mimetype } = doc
//     const version_courante = doc.version_courante?{...doc.version_courante}:null
//     const copie = {...doc, version_courante}
//     const ref_hachage_bytes = fuuid_v_courante

//     if(tuuid) {
//         // Mapper vers fileId ou folderId
//         // Utiliser mimetype pour detecter si c'est un repertoire ou fichier
//         if(mimetype) copie.fileId = tuuid
//         else {
//             copie.mimetype = 'Repertoire'
//             copie.folderId = tuuid
//         }

//         // Remplacer le nom temporairement durant le dechiffrage
//         if(!nom) copie.nom = tuuid
//     }
    
//     if(date_creation) copie.dateAjout = date_creation
//     copie.dateFichier = doc.dateFichier || date_creation

//     // Icones et image
//     copie.thumbnail = {
//         thumbnailIcon: getThumbnailIcon(mimetype),
//         thumbnailCaption: nom,
//     }

//     // Loader du fichier source (principal), supporte thumbnail pour chargement
//     copie.loader = loadFichierChiffre(traitementFichiers.getFichierChiffre, fuuid_v_courante, mimetype)    

//     if(version_courante) {
//         const { anime, taille, images, video, duration, mimetype } = version_courante
        
//         if(taille) copie.taille = taille
//         if(duration) copie.duration = duration

//         if(images) {
//             const imageLoader = imageResourceLoader(
//                 traitementFichiers.getFichierChiffre, 
//                 images, 
//                 {anime, supporteWebp: true, ref_hachage_bytes, fuuid: fuuid_v_courante, mimetype}
//             )
//             copie.imageLoader = imageLoader
//         }

//         if(video) {
//             const creerToken = async fuuids => {
//                 if(typeof(fuuids) === 'string') fuuids = [fuuids]  // Transformer en array
//                 const reponse = await connexion.creerTokenStream(fuuids)
//                 return reponse.token
//             }

//             if(video && Object.keys(video).length > 0) {
//                 copie.videoLoader = videoResourceLoader(video, {creerToken, fuuid: fuuid_v_courante, version_courante})
//             } else {
//                 // console.debug("Video - original seulement")
//                 copie.videoLoader = videoResourceLoader({}, {creerToken, fuuid: fuuid_v_courante, version_courante})
//             }

//         }
//     }

//     return copie
// }

export function mapDocumentComplet(workers, doc, opts) {
    opts = opts || {}

    console.debug("mapDocumentComplet : %O (%O)", doc, opts)

    const creerToken = opts.creerToken
    const { connexion, traitementFichiers } = workers

    // Instance mediaLoader pour contenu (fichier, images, videos)
    const creerTokenStreamInst = async commande => {
        console.debug("Commande creer token stream ", commande)
        const fuuid = commande.fuuidStream
        return creerToken(fuuid)
        // return connexion.creerTokensStreaming(commande)
    }
    const mediaLoader = new MediaLoader(traitementFichiers.getUrlFuuid, traitementFichiers.getCleSecrete, creerTokenStreamInst)

    const { nom, tuuid, date_creation, fuuid_v_courante, mimetype, archive } = doc
    const version_courante = doc.version_courante?{...doc.version_courante}:null
    const copie = {...doc, version_courante}

    if(tuuid) {
        // Mapper vers fileId ou folderId
        // Utiliser mimetype pour detecter si c'est un repertoire ou fichier
        if(mimetype) copie.fileId = tuuid
        else {
            copie.mimetype = 'Repertoire'
            copie.folderId = tuuid
        }

        // Remplacer le nom temporairement durant le dechiffrage
        if(!nom) copie.nom = tuuid
    }
    
    if(date_creation) copie.dateAjout = date_creation
    copie.dateFichier = doc.dateFichier || date_creation

    // Icones et image
    copie.thumbnail = {
        thumbnailIcon: getThumbnailIcon(mimetype),
        thumbnailCaption: nom,
    }

    // Loader du fichier source (principal), supporte thumbnail pour chargement
    copie.loader = mediaLoader.fichierLoader(fuuid_v_courante, {mimetype})

    if(version_courante) {
        const { anime, taille, images, video, duration, mimetype, header } = version_courante
        
        if(taille) copie.taille = taille
        if(duration) copie.duration = duration

        if(images) {
            copie.imageLoader = mediaLoader.imageLoader(images, {cle_id: fuuid_v_courante, fuuid: fuuid_v_courante, mimetype, anime, header})
            copie.thumbnailLoader = mediaLoader.thumbnailLoader(images, {cle_id: fuuid_v_courante})
        }

        if(mimetype.toLowerCase().startsWith('video/')) {
            copie.videoLoader = mediaLoader.videoLoader(video || {}, {fuuid: fuuid_v_courante, mimetype})
        } else if(mimetype.toLowerCase().startsWith('audio/')) {
            copie.audioLoader = mediaLoader.audioLoader(fuuid_v_courante, mimetype)
        }
    }

    return copie
}

function getThumbnailIcon(mimetype) {
    if(!mimetype) return ICONE_FOLDER

    if(mimetype === 'application/pdf') {
        return ICONE_FICHIER_PDF
    }
    
    const mimetypeBase = mimetype.split('/').shift()

    if(mimetypeBase === 'image') {
        return ICONE_FICHIER_IMAGE
    } else if(mimetypeBase === 'video') {
        return ICONE_FICHIER_VIDEO
    } else if(mimetypeBase === 'audio') {
        return ICONE_FICHIER_AUDIO
    } else if(mimetypeBase === 'application/text') {
        return ICONE_FICHIER_TEXT
    } else if(mimetypeBase === 'application/zip') {
        return ICONE_FICHIER_ZIP
    }

    return ICONE_FICHIER
}

export function estMimetypeMedia(mimetype) {
    if(mimetype === 'application/pdf') return true
    
    const mimetypeBase = mimetype.split('/').shift()
    if(mimetypeBase === 'image') {
        return true
    } else if(mimetypeBase === 'video') {
        return true
    }

    return false
}

export function mapperFichiers(fichiers, fichiers_traites, fichiers_status) {

    const listeFichiers = []

    for (const fichier of fichiers) {
        console.debug("Mapper fichier ", fichier)

        const fuuid = fichier.file
        const mimetype = fichier.mimetype || 'application/bytes'
        const traite = fichiers_traites || fichiers_status[fuuid] || false

        const version_courante = {
            nom: fichier.name,
            date_fichier: fichier.date,
            hachage_original: fichier.digest,
            mimetype,
            taille: fichier.encrypted_size || fichier.size,
        }

        const fichierMappe = {
            nom: fichier.name,
            dateFichier: fichier.date,
            mimetype,
            version_courante,

            // Indicateurs de chargement
            traite, 
            disabled: !traite,

            decryption: fichier.decryption,

            // Ids pour utilitaires reutilises de collections
            fileId: fuuid, fuuid_v_courante: fuuid, fuuid,
        }

        if(fichier.media) {
            const media = mapperMedia(fichier.media)
            if(media) Object.assign(version_courante, media)
            if(fichier.media.animated === true) version_courante.anime = true
        }

        listeFichiers.push(fichierMappe)
    }

    return listeFichiers
}

const CHAMPS_MEDIA = ['duration', 'width', 'height']

function mapperMedia(media, fuuid) {
    console.debug("Mapper media ", media)
    const mediaMappe = {}
    for(const champ of CHAMPS_MEDIA) {
        if(media[champ]) mediaMappe[champ] = media[champ]
    }
    
    if(media.images) {
        const images = {}
        mediaMappe.images = images
        for(const image of media.images) {
            const resolution = Math.min(image.width, image.height)
            let key = `${image.mimetype};${resolution}`
            if(resolution <= 128 && image.data) key = 'thumb'
            else if(resolution > 128 && resolution < 360) key = 'small'

            const imageMappee = {
                width: image.width,
                height: image.height,
                resolution,
                mimetype: image.mimetype,
            }
            if(image.data) {
                imageMappee.data = image.data
            } else {
                imageMappee.hachage = image.file
                imageMappee.taille = image.size
                Object.assign(imageMappee, image.decryption)
            }
            
            images[key] = imageMappee
        }
    }

    if(media.videos) {
        // console.warn("!!! TODO mapper videos ", media.videos)
        const videos = {}
        mediaMappe.video = videos
        for (const video of media.videos) {
            const resolution = Math.min(video.width, video.height)
            const key = `${video.mimetype};${video.codec};${resolution}p;${video.quality}`
            const decryption = video.decryption
            const videoMappe = {
                width: video.width,
                height: video.height,
                quality: video.quality,
                fuuid,
                fuuid_video: video.file,
                hachage: video.file,
                mimetype: video.mimetype,
                taille_fichier: video.size,
                bitrate: video.bitrate,
                codec: video.codec,
                ...decryption,
            }
            videos[key] = videoMappe
        }
    }

    return mediaMappe
}