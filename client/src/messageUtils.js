export async function posterMessage(workers, certifcatChiffragePem, from, to, subject, content, opts) {
    
    const { connexion } = workers
    const { enveloppeMessage, commandeMaitrecles } = await signerMessage(workers, certifcatChiffragePem, from, to, subject, content, opts)
    console.debug("Enveloppe message : %O", enveloppeMessage)
    console.debug("Commande maitre des cles : %O", commandeMaitrecles)

    // poster
    const reponse = await connexion.posterMessage(enveloppeMessage, commandeMaitrecles )
    console.debug("Reponse poster : %O", reponse)

}

export async function signerMessage(workers, certifcatChiffragePem, from, to, subject, content, opts) {
    opts = opts || {}

    const {connexion, chiffrage} = workers
    const {cc, bcc, reply_to, attachments, attachments_inline} = opts
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

    const destinataires = [...toFiltre, ...ccFiltre]

    // Preparer l'enveloppe du message
    const enveloppeMessage = {
        message_chiffre: messageChiffre.ciphertext,
        'hachage_bytes': commandeMaitrecles['hachage_bytes'],
        //'attachments': attachments,
        to: destinataires,
        fingerprint_certificat: messageSigne['en-tete']['fingerprint_certificat'],
    }
    if(bcc) enveloppeMessage.bcc = bccFiltre
    if(attachments) enveloppeMessage.attachments = attachments

    return { enveloppeMessage, commandeMaitrecles }
}