import { getClesAttachments } from './cles'
import { base64 } from "multiformats/bases/base64"

export async function posterMessage(workers, certifcatChiffragePem, from, to, subject, content, opts) {
    
    const { connexion } = workers
    const { enveloppeMessage, commandeMaitrecles } = await signerMessage(workers, certifcatChiffragePem, from, to, subject, content, opts)
    console.debug("Enveloppe message : %O", enveloppeMessage)
    console.debug("Commande maitre des cles : %O", commandeMaitrecles)

    // poster
    const reponse = await connexion.posterMessage(enveloppeMessage, commandeMaitrecles)
    console.debug("Reponse poster : %O", reponse)

    return reponse
}

export async function signerMessage(workers, certifcatChiffragePem, from, to, subject, content, opts) {
    opts = opts || {}

    console.debug("Signer message, params opts : %O", opts)

    const {connexion, chiffrage} = workers
    const {cc, bcc, attachments, fuuids} = opts
    const champsOptionnels = ['cc', 'bcc', 'reply_to', 'attachments', 'attachments_inline']

    const toFiltre = to.split(';').map(item=>item.trim())
    const ccFiltre = []
    if(cc) {
        ccFiltre = cc.split(';').map(item=>item.trim())
    }
    const bccFiltre = []
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
        fuuidsCles = fuuidsCles || attachments.map(item=>item.fuuid)
        console.debug("Get cles attachments fuuids : %O", fuuidsCles)
        const cles = await getClesAttachments(workers, fuuidsCles)
        console.debug("Reponse cles : %O", cles)

        // Encoder les cles secretes en base64
        for(let hachage_bytes in cles) {
            const cle = cles[hachage_bytes]
            const cleSecreteBase64 = base64.encode(new Buffer.from(cle.cleSecrete, 'binary'))
            cle.cleSecrete = cleSecreteBase64

            // Cleanup
            delete cle.date
        }

        // const attachmentsCles = attachments.map( attachment => {
        //     const { fuuid } = attachment
        //     const cle = cles[fuuid]
        //     const cleSecreteBase64 = base64.encode(new Buffer.from(cle.cleSecrete, 'binary'))
        //     return {
        //         ...attachment,
        //         cleSecrete: cleSecreteBase64, 
        //         format: cle.format,
        //         iv: cle.iv,
        //         tag: cle.tag,
        //     }
        // })

        message.attachments = {
            cles,
            fichiers: attachments
        }
    }

    // Signer le message
    console.debug("Signer message : %O", message)
    const messageSigne = await connexion.formatterMessage(message, 'message')
    console.debug("Message signe : %O", messageSigne)

    // Chiffrer le message 
    delete messageSigne['_certificat']  // Retirer certificat
    const messageChiffre = await chiffrage.chiffrerDocument(
        messageSigne, 'Messagerie', certifcatChiffragePem, 
        {DEBUG: true, identificateurs_document: {'message': 'true'}}
    )
    console.debug("Message chiffre : %O", messageChiffre)

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
        enveloppeMessage.attachments = fuuidsCles
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

    return { enveloppeMessage: enveloppeRoutage, commandeMaitrecles }
}