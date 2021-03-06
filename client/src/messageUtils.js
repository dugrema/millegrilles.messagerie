import { getClesAttachments } from './cles'
import { base64 } from "multiformats/bases/base64"
import pako from 'pako'

const REGEX_SUBJECT = /^<p>([^<]+)<\/p><p><br><\/p>(.*)/i

export async function posterMessage(workers, certifcatChiffragePem, from, to, content, opts) {
    
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

    const { enveloppeMessage, commandeMaitrecles } = await signerMessage(workers, certifcatChiffragePem, from, to, subject, content, opts)

    // console.debug("Enveloppe message : %O", enveloppeMessage)
    // console.debug("Commande maitre des cles : %O", commandeMaitrecles)

    // poster
    const reponse = await connexion.posterMessage(enveloppeMessage, commandeMaitrecles)
//    console.debug("Reponse poster : %O", reponse)

    return reponse
}

export async function signerMessage(workers, certifcatChiffragePem, from, to, subject, content, opts) {
    opts = opts || {}

    const {connexion, chiffrage} = workers
    const {cc, bcc, attachments, attachmentsCles, fuuids, fuuidsCleSeulement} = opts
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

    let fuuidsCles = fuuids
    if(attachments) {
        // Preparer l'information de dechiffrage (cle) pour tous les attachements
        if(fuuidsCleSeulement) {
            fuuidsCles = [...fuuidsCles, ...fuuidsCleSeulement]
        }

        // Retirer cles deja connues
        const fuuidsClesInconnues = fuuidsCles.filter(item=>!attachmentsCles[item])
        let clesAttachmentsPrets = {...attachmentsCles}
        if(fuuidsClesInconnues.length > 0) {
            console.warn("signerMessage : il manque des cles (%O), charger maintenant", fuuidsClesInconnues)
            const cles = await getClesFormattees(workers, fuuidsClesInconnues)
            clesAttachmentsPrets = {...clesAttachmentsPrets, ...cles}
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
        messageBytes, 'Messagerie', certifcatChiffragePem, 
        {DEBUG: true, identificateurs_document: {'message': 'true'}, nojson: true, type: 'binary'}
    )
    // console.debug("Message chiffre : %O", messageChiffre)

    const commandeMaitrecles = messageChiffre.commandeMaitrecles

    const destinataires = [...new Set([...toFiltre, ...ccFiltre, ...bccFiltre])]  // dedupe

    // Preparer l'enveloppe du message
    const enveloppeMessage = {
        message_chiffre: messageChiffre.ciphertext,
        'hachage_bytes': commandeMaitrecles['hachage_bytes'],
        //'attachments': attachments,
        // to: destinataires,
        fingerprint_certificat: messageSigne['en-tete']['fingerprint_certificat'],
    }
   
    if(attachments) {
        enveloppeMessage.attachments = fuuids
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

    return { enveloppeMessage: enveloppeRoutage, commandeMaitrecles, fuuids }
}

export async function getClesFormattees(workers, fuuidsCles) {
    const cles = await getClesAttachments(workers, fuuidsCles)

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
