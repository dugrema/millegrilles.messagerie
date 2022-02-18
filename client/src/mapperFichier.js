import { base64 } from "multiformats/bases/base64"

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

export { Icones }

export function mapper(row, workers, opts) {
    opts = opts || {}
    const { tuuid, nom, supprime, date_creation, duree, fuuid_v_courante, version_courante, favoris } = row

    let cles = opts.cles || {}
    console.debug("!!! MAPPER %O\nOpts: %O", row, opts)

    let date_version = '', 
        mimetype_fichier = '',
        taille_fichier = ''

    let thumbnailIcon = '',
        ids = {},
        thumbnailLoader = null
    if(!version_courante) {
        // console.debug("mapper folder pour %O", row)
        ids.folderId = tuuid  // Collection, tuuid est le folderId
        thumbnailIcon = Icones.ICONE_FOLDER
    } else {
        console.debug("mapper fichier, info courante : %O", version_courante)
        const { mimetype, date_fichier, taille, images, video } = version_courante
        mimetype_fichier = mimetype
        date_version = date_fichier
        taille_fichier = taille
        ids.fileId = tuuid || fuuid_v_courante    // Fichier, tuuid est le fileId
        const mimetypeBase = mimetype.split('/').shift()

        if(workers && images) {
            const thumbnail = images.thumb || images.thumbnail,
                  small = images.small || images.poster
            
            // Mini (inline) thumbnail loader
            let miniLoader = null
            if(thumbnail) {
                const cle = {...cles[thumbnail.hachage]}
                if(thumbnail.data_chiffre && cle) {
                    console.debug("Decoder cle : %O", cle)
                    // cle.cleSecrete = base64.decode(cle.cleSecrete)
                    miniLoader = loadThumbnailChiffre(thumbnail.hachage, workers, {cle, dataChiffre: thumbnail.data_chiffre})
                }
            }

            let smallLoader = null
            thumbnailLoader = {
                load: async (setSrc, opts) => {
                    let loadSmall = (opts.mini?false:true)

                    if(loadSmall && small) {
                        console.debug("Load small hachage %s", small.hachage)
                        const cle = {...cles[small.hachage]}
                        // cle.cleSecrete = base64.decode(cle.cleSecrete)
                        smallLoader = loadThumbnailChiffre(small.hachage, workers, {cle})
                        try {
                            await smallLoader.load(setSrc)
                        } catch(err) {
                            if(miniLoader) {
                                console.warn("Erreur chargement small %s, fallback mini", small.hachage)
                                await miniLoader.load(setSrc)
                            } else {
                                console.error("Erreur chargement small %s : %O", small.hachage, err)
                            }
                        }
                    } else {
                        console.debug("Load mini mini du fichier %s", small.hachage)
                        try {
                            await miniLoader.load(setSrc)
                            return
                        } catch(err) {
                            console.error("Erreur chargement mini thumbnail pour image %s : %O", tuuid, err)
                            loadSmall = true  // Tenter de charger small en remplacement
                        }
                    }
                },
                unload: () => {
                    if(miniLoader) miniLoader.unload()
                    if(smallLoader) smallLoader.unload()
                }
            }
        }

        if(mimetype === 'application/pdf') {
            thumbnailIcon = ICONE_FICHIER_PDF
        } else if(mimetypeBase === 'image') {
            thumbnailIcon = ICONE_FICHIER_IMAGE
        } else if(mimetypeBase === 'video') {
            thumbnailIcon = ICONE_FICHIER_VIDEO
        } else if(mimetypeBase === 'audio') {
            thumbnailIcon = ICONE_FICHIER_AUDIO
        } else if(mimetypeBase === 'application/text') {
            thumbnailIcon = ICONE_FICHIER_TEXT
        } else if(mimetypeBase === 'application/zip') {
            thumbnailIcon = ICONE_FICHIER_ZIP
        } else { 
            thumbnailIcon = ICONE_FICHIER
        }
    }

    return {
        // fileId: tuuid,
        // folderId: tuuid,
        ...ids,
        nom,
        supprime, 
        taille: taille_fichier,
        dateAjout: date_version || date_creation,
        mimetype: ids.folderId?'Repertoire':mimetype_fichier,
        // thumbnailSrc,
        thumbnailLoader,
        thumbnailIcon,
        thumbnailCaption: nom,
        duree,
        fuuid: fuuid_v_courante,
        version_courante,
        favoris,
    }
}

export function onContextMenu(event, value, setContextuel) {
    event.preventDefault()
    const {clientX, clientY} = event
    // console.debug("ContextMenu %O (%d, %d)", value, clientX, clientY)

    const params = {show: true, x: clientX, y: clientY}

    setContextuel(params)
}

function loadThumbnailChiffre(fuuid, workers, opts) {
    console.debug("loadThumbnailChiffre fuuid %s, opts : %O", fuuid, opts)
    const { traitementFichiers } = workers
    const blobPromise = traitementFichiers.getThumbnail(fuuid, opts)
        .then(blob=>URL.createObjectURL(blob))
        .catch(err=>console.error("Erreur creation blob thumbnail %s : %O", fuuid, err))
    
    return {
        load: async setSrc => {
            opts = opts || {}
            const urlBlob = await blobPromise
            console.debug("!!! Blob charger pour thumbnail %s (opts: %O)", fuuid, opts)
            setSrc(urlBlob)
        },
        unload: async () => {
            // console.debug("Unload thumbnail %s", fuuid)
            const urlBlob = await blobPromise
            // console.debug("Cleanup URL blob : %O", urlBlob)
            if(urlBlob) URL.revokeObjectURL(urlBlob)
        }
    }
}