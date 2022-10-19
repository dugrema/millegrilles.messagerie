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

    const { enveloppeMessage, commandeMaitrecles, message } = await signerMessage(workers, certifcatsChiffragePem, from, to, subject, content, opts)

    // console.debug("Enveloppe message : %O", enveloppeMessage)
    // console.debug("Commande maitre des cles : %O", commandeMaitrecles)

    // poster
    const reponse = await connexion.posterMessage(enveloppeMessage, commandeMaitrecles)
//    console.debug("Reponse poster : %O", reponse)

    const uuid_message = reponse.message.uuid_message

    return {...reponse, messageOriginal: message, uuid_message}
}

export async function signerMessage(workers, certifcatsChiffragePem, from, to, subject, content, opts) {
    opts = opts || {}

    const {connexion, chiffrage} = workers
    const {cc, bcc, attachments, attachmentsCles, fuuids} = opts
    const champsOptionnels = ['cc', 'bcc', 'reply_to', 'uuid_thread', 'attachments', 'attachments_inline']

    const toFiltre = to.split(';').map(item=>item.trim())
    let ccFiltre = []
    if(cc) {
        ccFiltre = cc.split(';').map(item=>item.trim())
    }
    let bccFiltre = []
    if(bcc) {
        bccFiltre = bcc.split(';').map(item=>item.trim())
    }

    const message = {from, to: toFiltre, subject, content}
    champsOptionnels.forEach(nomChamp=>{
        if(opts[nomChamp]) message[nomChamp] = opts[nomChamp]
    })

    let fuuidsCles = fuuids,
        fuuidAttachmentsTransfert = null
    if(attachments) {
        console.debug("signerMessage Message attachments : %O", attachments)
        // Preparer l'information de dechiffrage (cle) pour tous les attachements
        // if(fuuidsCleSeulement) {
        //     fuuidsCles = [...fuuidsCles, ...fuuidsCleSeulement]
        // }

        // Faire une liste des fuuids d'attachments a transferer (pour l'enveloppe postmaster)
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

        // Retirer cles deja connues
        const fuuidsClesInconnues = fuuidsCles.filter(item=>!attachmentsCles[item])
        let clesAttachmentsPrets = {...attachmentsCles}
        if(fuuidsClesInconnues.length > 0) {
            console.warn("signerMessage : il manque des cles (%O), charger maintenant", fuuidsClesInconnues)
            const cles = await getClesFormattees(workers, fuuidsClesInconnues)
            clesAttachmentsPrets = {...clesAttachmentsPrets, ...cles}
        }

        // console.debug("Cles attachments : ", clesAttachmentsPrets)

        // Dechiffrer metadata du fichier (remplacer data_chiffre par data)
        for await (const attachment of attachments) {
            const hachage_bytes = attachment.fuuid
            const metadata = {...attachment.metadata}
            attachment.metadata = metadata

            // console.debug("Dechiffrer metadata %s : %O", hachage_bytes, metadata)
            const cleDechiffrage = clesAttachmentsPrets[hachage_bytes]
            if(cleDechiffrage && metadata.data_chiffre) {
                const data_dechiffre = await chiffrage.chiffrage.dechiffrerChampsChiffres(metadata, cleDechiffrage)
                // console.debug("Metadata dechiffre %s : %O", hachage_bytes, data_dechiffre)
                delete metadata.data_chiffre
                metadata.data = data_dechiffre
            } else {
                console.warn("Erreur dechiffrage fuuid %s, cle absente", hachage_bytes)
            }
        }

        message.attachments = {
            cles: clesAttachmentsPrets,
            fichiers: attachments
        }
    }

    // Signer le message
    // console.debug("Signer message : %O", message)
    const messageSigne = await connexion.formatterMessage(message, 'message')
    delete messageSigne['_certificat']  // Retirer certificat
    // console.debug("Message signe : %O", messageSigne)
    
    // Compresser le message en gzip
    let messageBytes = JSON.stringify(messageSigne)
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

    // Preparer l'enveloppe du message
    const enveloppeMessage = {
        message_chiffre: messageChiffre.doc.data_chiffre,
        hachage_bytes: commandeMaitrecles['hachage_bytes'],
        fingerprint_certificat: messageSigne['en-tete']['fingerprint_certificat'],
    }
   
    // if(attachments) {
    //     enveloppeMessage.attachments = fuuids
    // }
    if(fuuidAttachmentsTransfert) {
        enveloppeMessage.attachments = fuuidAttachmentsTransfert
    }

    const enveloppeMessageSigne = await connexion.formatterMessage(enveloppeMessage, 'Messagerie')
    delete enveloppeMessageSigne['_certificat']

    const routageMessage = {
        destinataires: destinataires,
        message: enveloppeMessageSigne,
    }
    if(bcc) routageMessage.bcc = bccFiltre

    const enveloppeRoutage = await connexion.formatterMessage(
        routageMessage, 'Messagerie', {action: 'poster', ajouterCertificat: true})

    return { enveloppeMessage: enveloppeRoutage, commandeMaitrecles, fuuids, message }
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
