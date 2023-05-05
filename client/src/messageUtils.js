import { MESSAGE_KINDS } from '@dugrema/millegrilles.utiljs/src/constantes'
import { getClesAttachments } from './cles'
import { base64 } from "multiformats/bases/base64"
import pako from 'pako'

const REGEX_SUBJECT = /^<p>([^<]+)<\/p><p><br><\/p>(.*)/i

export async function posterMessage(workers, certifcatsChiffragePem, from, to, content, opts) {
    
    const { connexion } = workers

    // Extraire premiere ligne pour faire le sujet
    let subject = ''
    try {
        const matchSubject = REGEX_SUBJECT.exec(content)
        if(matchSubject && matchSubject.length === 3) {
            subject = matchSubject[1]
            content = matchSubject[2]
        }
        
    } catch(err) {
        console.error("Erreur preparation sujet : %O", err)
    }
    // console.debug("Subject %O\nContenu %O\nOpts %O", subject, content, opts)

    const { message, commande, cle } = await signerMessage(workers, certifcatsChiffragePem, from, to, subject, content, opts)

    console.debug("posterMessage commande %O\nCle %O", commande, cle)

    // console.debug("Enveloppe message : %O", enveloppeMessage)
    // console.debug("Commande maitre des cles : %O", commandeMaitrecles)

    // poster
    const reponse = await connexion.posterMessage(commande, cle)
    console.debug("Reponse poster : %O", reponse)

    return {...reponse, message, commande}
}

export async function signerMessage(workers, certifcatsChiffragePem, from, to, subject, content, opts) {
    opts = opts || {}

    const {connexion, chiffrage} = workers
    const {cc, bcc, attachments, attachmentsCles, fuuids} = opts
    const champsOptionnels = ['cc', 'bcc', 'reply_to', 'thread', 'files']

    const toFiltre = to.split(';').map(item=>item.trim())
    let ccFiltre = []
    if(cc) {
        ccFiltre = cc.split(';').map(item=>item.trim())
    }
    let bccFiltre = []
    if(bcc) {
        bccFiltre = bcc.split(';').map(item=>item.trim())
    }

    const message = {from, to: toFiltre, subject, content, version: 1, format: 'html'}
    champsOptionnels.forEach(nomChamp=>{
        if(opts[nomChamp]) message[nomChamp] = opts[nomChamp]
    })

    let fuuidsCles = fuuids,
        fuuidAttachmentsTransfert = null
    if(attachments) {
        console.debug("Attachements fichiers : %O\nCles fichiers: %O", attachments, attachmentsCles)

        // Faire une liste des fuuids a transferer pour la commande poster
        fuuidAttachmentsTransfert = attachments.reduce((acc, attachment) =>{
            const hachage_bytes = attachment.fuuid
            acc.push(hachage_bytes)
            const images = attachment.images || {},
                  videos = attachment.video || {}
            Object.values(images).filter(item=>!item.data).forEach(image=>{
                acc.push(image.hachage)
            })
            Object.values(videos).forEach(video=>acc.push(video.fuuid_video))
            return acc
        }, [])
        console.debug("Fuuids a transferer : ", fuuidAttachmentsTransfert)

        // Retirer cles deja connues
        const fuuidsClesInconnues = fuuidsCles.filter(item=>!attachmentsCles[item])
        let clesAttachmentsPrets = {...attachmentsCles}
        if(fuuidsClesInconnues.length > 0) {
            console.warn("signerMessage : il manque des cles (%O), charger maintenant", fuuidsClesInconnues)
            const cles = await getClesFormattees(workers, fuuidsClesInconnues)
            clesAttachmentsPrets = {...clesAttachmentsPrets, ...cles}
        }

        let mappingAttachements = []
        for await (const item of attachments) {
            mappingAttachements.push(await mapperAttachementFile(workers, item, clesAttachmentsPrets))
        }

        message.files = mappingAttachements
    }

    console.debug("Chiffrer le message : %O", message)
    // Compresser le message en gzip
    let messageBytes = JSON.stringify(message)
    // console.debug("Message signe taille %d\n%s", messageBytes.length, messageBytes)
    messageBytes = pako.deflate(new TextEncoder().encode(messageBytes))
    // console.debug("Message signe gzippe : %O", messageBytes)

    // Chiffrer le message 
    const messageChiffre = await chiffrage.chiffrerDocument(
        messageBytes, 'Messagerie', certifcatsChiffragePem, 
        {DEBUG: true, identificateurs_document: {'message': 'true'}, nojson: true, type: 'binary'}
    )
    // console.debug("Message chiffre : %O", messageChiffre)

    const commandeMaitrecles = messageChiffre.commandeMaitrecles

    const destinataires = [...new Set([...toFiltre, ...ccFiltre, ...bccFiltre])]  // dedupe

    const commandeMaitreclesContenu = JSON.parse(commandeMaitrecles.contenu)
    const dechiffrage = {
        format: commandeMaitreclesContenu.format,
        header: commandeMaitreclesContenu.header,
        hachage: commandeMaitreclesContenu['hachage_bytes'],
    }

    const dataChiffre = messageChiffre.doc.data_chiffre.slice(1)  // Retirer le premier character multibase (base64)

    const enveloppeMessageSigne = await connexion.formatterMessage(
        dataChiffre, 'Messagerie',
        {kind: MESSAGE_KINDS.KIND_COMMANDE_INTER_MILLEGRILLE, action: 'nouveauMessage', dechiffrage, ajouterCertificat: false}
    )
    delete enveloppeMessageSigne['certificat']
    delete enveloppeMessageSigne['millegrille']

    // const routageMessage = {
    //     destinataires: destinataires,
    //     message: enveloppeMessageSigne,
    // }
    // if(bcc) routageMessage.bcc = bccFiltre

    // const enveloppeRoutage = await connexion.formatterMessage(
    //     routageMessage, 'Messagerie', {action: 'poster', ajouterCertificat: true})

    return { 
        message,
        commande: {message: enveloppeMessageSigne, fuuids: fuuidAttachmentsTransfert, destinataires},
        cle: commandeMaitrecles, 
    }
}

export async function getClesFormattees(workers, fuuidsCles, opts) {
    opts = opts || {}
    let tentatives = opts.tentatives || 1,
        delai = opts.delai || 5000,
        delaiInitial = opts.delaiInitial
    
    if(delaiInitial) {
        // Introduire un delai initial (e.g. attendre traitement des cles d'un nouveau fichier)
        await new Promise(resolve=>setTimeout(resolve, delaiInitial))
    }

    let cles = null, promise = getClesAttachments(workers, fuuidsCles)
    for(let i=0; i<tentatives; i++) {
        try {
            cles = await promise
            console.debug("Reponse cles : %O", cles)
            if(cles.ok !== false) break
        } catch(err) {
            if(i<tentatives-1) {
                console.info("Erreur chargement cles, on ressaie dans %d ms", delai)
                promise = new Promise(async resolve=>{
                    await new Promise(resolve=>setTimeout(resolve, delai))
                    resolve(getClesAttachments(workers, fuuidsCles))
                })
            } else {
                throw err
            }
        }
    }

    // Encoder les cles secretes en base64
    for(let hachage_bytes in cles) {
        const cle = cles[hachage_bytes]
        const cleSecreteBase64 = base64.encode(new Buffer.from(cle.cleSecrete, 'binary'))
        cle.cleSecrete = cleSecreteBase64

        // Cleanup
        delete cle.date
    }

    return cles
}

async function mapperAttachementFile(workers, fichier, cles) {
    console.debug("Mapper %O (cles: %O)", fichier, cles)
    const { chiffrage } = workers

    const hachage_bytes = fichier.fuuid

    const metadata = fichier.metadata
    // fichier.metadata = metadata

    // console.debug("Dechiffrer metadata %s : %O", hachage_bytes, metadata)
    const cleDechiffrage = cles[hachage_bytes]
    if(cleDechiffrage && metadata.data_chiffre) {
        var metadataDechiffre = await chiffrage.chiffrage.dechiffrerChampsChiffres(metadata, cleDechiffrage)
        console.debug("Metadata dechiffre %s : %O", hachage_bytes, metadataDechiffre)
    } else {
        console.warn("Erreur dechiffrage fuuid %s, cle absente", hachage_bytes)
        return null
    }

    const attachementMappe = {
        name: metadataDechiffre.nom,
        file: hachage_bytes,
        date: metadataDechiffre.dateFichier,
        digest: metadataDechiffre.hachage_original,
        // size: 'todo',
        encrypted_size: fichier.taille,
        mimetype: fichier.mimetype,
        decryption: {
            format: cleDechiffrage.format,
            header: cleDechiffrage.header,
            key: cleDechiffrage.cleSecrete,
        }
    }

    const images = fichier.images,
          videos = fichier.video
    if(images || videos) {
        attachementMappe.media = {}
        const media = attachementMappe.media
        
        // Mapper champs flat
        Object.keys(CHAMPS_MEDIA).map(champ=>{
            const nomChampDestination = CHAMPS_MEDIA[champ]
            if(fichier[champ]) media[nomChampDestination] = fichier[champ]
        })

        if(images) {
            // Mapper images
            media.images = mapperImages(images)
        }

        if(videos) {
            // Mapper videos
            media.videos = mapperVideos(videos)
        }
    }

    return attachementMappe
}

const CHAMPS_MEDIA = {
    duration: 'duration',
    height: 'height',
    width: 'width',
    video_codec: 'video_codec',
}

const CHAMPS_IMAGE_INLINE = {
    width: 'width',
    height: 'height',
    mimetype: 'mimetype',
}

const CHAMPS_IMAGE_ATTACHEE = {
    hachage: 'file',
    width: 'width',
    height: 'height',
    mimetype: 'mimetype',
    taille: 'size',
}

const CHAMPS_VIDEO = {
    fuuid_video: 'file',
    width: 'width',
    height: 'height',
    mimetype: 'mimetype',
    taille_fichier: 'size',
    codec: 'codec',
    bitrate: 'bitrate',
    quality: 'quality',
}

function mapperImages(images) {

    const imagesMappees = []

    for (const image of Object.values(images)) {
        if(image.data) {
            const imageMappee = {
                data: image.data,
            }
            for (const champ of Object.keys(CHAMPS_IMAGE_INLINE)) {
                const champDestination = CHAMPS_IMAGE_INLINE[champ]
                if(image[champ]) imageMappee[champDestination] = image[champ]
            }
            imagesMappees.push(imageMappee)
        } else {
            // Image externe mappee (attachement)
            const imageMappee = {
                decryption: {
                    header: image.header,
                    format: image.format,
                }
            }
            for (const champ of Object.keys(CHAMPS_IMAGE_ATTACHEE)) {
                const champDestination = CHAMPS_IMAGE_ATTACHEE[champ]
                if(image[champ]) imageMappee[champDestination] = image[champ]
            }
            imagesMappees.push(imageMappee)
        }
    }

    return imagesMappees
}

function mapperVideos(videos) {

    const videosMappes = []

    for (const video of Object.values(videos)) {
        const videoMappe = {
            decryption: {
                header: video.header,
                format: video.format,
            }
        }
        for (const champ of Object.keys(CHAMPS_VIDEO)) {
            const champDestination = CHAMPS_VIDEO[champ]
            if(video[champ]) videoMappe[champDestination] = video[champ]
        }
        videosMappes.push(videoMappe)
    }

    return videosMappes
}
