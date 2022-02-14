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

export function mapper(row, workers) {
    const { tuuid, nom, supprime, date_creation, duree, fuuid_v_courante, version_courante, favoris } = row

    // console.debug("!!! MAPPER %O", row)

    let date_version = '', 
        mimetype_fichier = '',
        taille_fichier = ''

    let thumbnailIcon = '',
        ids = {},
        thumbnailLoader = null
    if(!version_courante) {
        ids.folderId = tuuid  // Collection, tuuid est le folderId
        thumbnailIcon = Icones.ICONE_FOLDER
    } else {
        const { mimetype, date_fichier, taille, images, video } = version_courante
        mimetype_fichier = mimetype
        date_version = date_fichier
        taille_fichier = taille
        ids.fileId = tuuid    // Fichier, tuuid est le fileId
        const mimetypeBase = mimetype.split('/').shift()

        if(workers && images) {
            const thumbnail = images.thumb || images.thumbnail,
                  small = images.small || images.poster
            let miniLoader = null, smallLoader
            if(thumbnail) {
                if (thumbnail.data_chiffre) {
                    // console.debug("!!! Loader thumbnail chiffre : %O", thumbnail)
                    miniLoader = loadThumbnailChiffre(thumbnail.hachage, workers, {dataChiffre: thumbnail.data_chiffre})
                }
            }
            // if(small) {
            //     smallLoader = loadThumbnailChiffre(small.hachage, workers)
            // }
            thumbnailLoader = {
                load: async (setSrc, opts) => {
                    let loadSmall = (opts.mini?false:true)
                    try {
                        await miniLoader.load(setSrc)
                    } catch(err) {
                        console.error("Erreur chargement mini thumbnail pour image %s : %O", tuuid, err)
                        loadSmall = true  // Tenter de charger small en remplacement
                    }

                    if(loadSmall) {
                        smallLoader = loadThumbnailChiffre(small.hachage, workers)
                        await smallLoader.load(setSrc)
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

export function mapperRecherche(row, workers) {
    const { 
        fuuid, tuuid, nom, supprime, favoris, date_creation, date_version, 
        // mimetype, taille, 
        thumb_data, thumb_hachage_bytes,
        version_courante,
        score,
    } = row

    // console.debug("!!! MAPPER %O", row)

    let mimetype_fichier = '',
        taille_fichier = ''

    let thumbnailIcon = '',
        ids = {},
        thumbnailLoader = null
    if(!fuuid) {
        ids.folderId = tuuid  // Collection, tuuid est le folderId
        thumbnailIcon = Icones.ICONE_FOLDER
    } else {
        const { mimetype, date_fichier, taille, images, video } = version_courante
        mimetype_fichier = mimetype
        taille_fichier = taille
        ids.fileId = tuuid    // Fichier, tuuid est le fileId
        ids.fuuid = fuuid
        const mimetypeBase = mimetype.split('/').shift()

        if(workers && thumb_data && thumb_hachage_bytes) {
            let loader = null
            if (thumb_data) {
                // console.debug("!!! Loader thumbnail chiffre : %O", thumbnail)
                loader = loadThumbnailChiffre(thumb_hachage_bytes, workers, {dataChiffre: thumb_data})
            }
            thumbnailLoader = {
                load: async (setSrc, opts) => {
                    if(loader) {
                        try {
                            await loader.load(setSrc)
                        } catch(err) {
                            console.error("Erreur chargement mini thumbnail pour image %s : %O", tuuid, err)
                        }
                    }
                },
                unload: () => {
                    if(loader) loader.unload()
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
        version_courante,
        fuuid,
        favoris,
        score,
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
    // console.debug("!!! loadThumbnailChiffre workers : %O", workers)
    const { traitementFichiers } = workers
    const blobPromise = traitementFichiers.getThumbnail(fuuid, opts)
        .then(blob=>{
            // console.debug("!!! BLOB cree : %O", blob)
            return URL.createObjectURL(blob)
        })
        .catch(err=>{
            console.error("Erreur creation blob thumbnail %s : %O", fuuid, err)
        })
    
    return {
        load: async setSrc => {
            opts = opts || {}
            const urlBlob = await blobPromise
            // console.debug("!!! Blob charger pour thumbnail %s (opts: %O)", fuuid, opts)
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