import { usagerDao, forgecommon /*saveCleDechiffree, getCleDechiffree*/ } from '@dugrema/millegrilles.reactjs'
import { pki } from '@dugrema/node-forge'
import pako from 'pako'

const { extraireExtensionsMillegrille } = forgecommon

export async function dechiffrerMessage(workers, message) {
    const {uuid_transaction, hachage_bytes, message_chiffre, date_envoi, user_id} = message

    let messages_envoyes = date_envoi?true:false

    let liste_hachage_bytes = [hachage_bytes]
    if(message.attachments) {
        const hachage_bytes_attachments = Object.keys(message.attachments)
        liste_hachage_bytes = [...liste_hachage_bytes, ...hachage_bytes_attachments]
    }

    // Dechiffrer le message
    const messageDechiffre = await getClesMessages(workers, uuid_transaction, {liste_hachage_bytes, messages_envoyes})
        .then(cles=>{
            // console.debug("dechiffrerMessage cles : %O", cles)
            const cle = cles[hachage_bytes],
                cleDechiffree = cle.cleSecrete
            // console.debug("dechiffrerMessage params cle: %O, cleDechiffree: %O\nMessage: %O", cle, cleDechiffree, message_chiffre)
            return workers.chiffrage.chiffrage.dechiffrer(message_chiffre, cleDechiffree, cle.iv, cle.tag)
        })
        .then(messageDechiffre=>pako.inflate(messageDechiffre).buffer)
        .then(messageDechiffre=>new TextDecoder().decode(messageDechiffre))
        .then(JSON.parse)
    
    let userId = user_id,
        resultatValider = null
    if(!messages_envoyes) {
        // Message incoming, valider
        const certificat_message = message.certificat_message,
            certificat_millegrille = message.certificat_millegrille
        const certForge = pki.certificateFromPem(certificat_message)
        const extensions = extraireExtensionsMillegrille(certForge)
        // console.debug("Extensions cert : %O", extensions)
        userId = extensions.userId

        resultatValider = await workers.chiffrage.verifierMessage(
            {...messageDechiffre, '_certificat': certificat_message, '_millegrille': certificat_millegrille}, 
            {support_idmg_tiers: true}
        )
        .catch(err=>{
            console.error("Erreur validation message : %O", err)
            return false
        })
    }

    const messageDict = {...messageDechiffre, validation: {valide: resultatValider, userId}}

    return messageDict
}

export async function getClesMessages(workers, uuid_transaction_message, opts) {
    opts = opts || {}
    const { liste_hachage_bytes } = opts
    const messages_envoyes = opts.messages_envoyes?true:false

    if(liste_hachage_bytes) {
        const cles = {}
        const clesInconnues = liste_hachage_bytes.reduce((acc, item)=>{
            acc[item] = true
            return acc
        }, {})
        // console.debug("Verifier presence de cles locales : %O", liste_hachage_bytes)
        for(let idx=0; idx<liste_hachage_bytes.length; idx++) {
            const hachage_bytes = liste_hachage_bytes[idx]
            // console.debug("Charger localement cle : %s", hachage_bytes)
            const cle = await usagerDao.getCleDechiffree(hachage_bytes)
            if(cle) {
                // console.debug("Cle locale chargee : %O", cle)
                cles[cle.hachage_bytes] = cle
                delete clesInconnues[cle.hachage_bytes]
            } else {
                // console.debug("Cle %s manquante localement", hachage_bytes)
            }
        }
        if(Object.keys(clesInconnues).length === 0) {
            // console.debug('Toutes les cles ont ete trouvees localement : %O', cles)
            return cles
        } else {
            // console.debug("Cles manquantes : %O", Object.keys(clesInconnues))
        }
    }

    const reponseCles = await workers.connexion.getPermissionMessages([uuid_transaction_message], {messages_envoyes})
    const cles = reponseCles.cles
    // console.debug("Reponse cles : %O", reponseCles)
    for(let cle_hachage_bytes in cles) {
        const cle = cles[cle_hachage_bytes]
        // Dechiffrer cle
        const cleDechiffree = await workers.chiffrage.dechiffrerCleSecrete(cle.cle)
        // console.debug("Conserver cle dechiffrer %s : %O", cle_hachage_bytes, cleDechiffree)
        await usagerDao.saveCleDechiffree(cle_hachage_bytes, cleDechiffree, cle)
        cle.cleSecrete = cleDechiffree
    }

    return cles

}

export async function getClesAttachments(workers, liste_hachage_bytes, opts) {
    opts = opts || {}

    const usager = opts.usager

    const cles = {}
    const clesInconnues = liste_hachage_bytes.reduce((acc, item)=>{
        acc[item] = true
        return acc
    }, {})

    // console.debug("Verifier presence de cles locales : %O", liste_hachage_bytes)
    for(let idx=0; idx<liste_hachage_bytes.length; idx++) {
        const hachage_bytes = liste_hachage_bytes[idx]
        // console.debug("Charger localement cle : %s", hachage_bytes)
        const cle = await usagerDao.getCleDechiffree(hachage_bytes)
        if(cle) {
            // console.debug("Cle locale chargee : %O", cle)
            cles[cle.hachage_bytes] = cle
            delete clesInconnues[cle.hachage_bytes]
        } else {
            // console.debug("Cle %s manquante localement", hachage_bytes)
        }
    }
    if(Object.keys(clesInconnues).length === 0) {
        // console.debug('Toutes les cles ont ete trouvees localement : %O', cles)
        return cles
    } else {
        // console.debug("Cles manquantes : %O", Object.keys(clesInconnues))
    }

    const reponseCles = await workers.connexion.getClesFichiers(Object.keys(clesInconnues), usager)
    const clesRecues = reponseCles.cles
    // console.debug("Reponse cles : %O", reponseCles)
    for(let cle_hachage_bytes in clesRecues) {
        const cle = clesRecues[cle_hachage_bytes]
        // Dechiffrer cle
        const cleDechiffree = await workers.chiffrage.dechiffrerCleSecrete(cle.cle)
        // console.debug("Conserver cle dechiffrer %s : %O", cle_hachage_bytes, cleDechiffree)
        await usagerDao.saveCleDechiffree(cle_hachage_bytes, cleDechiffree, cle)
        cle.cleSecrete = cleDechiffree

        cles[cle_hachage_bytes] = cle
    }

    return cles
}

// async function chargerClesMessages(workers, listeMessages) {
//     const { connexion, chiffrage } = workers

//     if(!listeMessages || listeMessages.length === 0) return  // Rien a faire

//     const uuidMessages = listeMessages.map(item=>item.uuid_transaction)
//     const reponseCles = await connexion.getPermissionMessages(uuidMessages)
//     const cles = reponseCles.cles
//     // console.debug("Reponse permission dechiffrage messages : %O", reponseCles)

//     const messagesDechiffres = []
//     for(let idx=0; idx<listeMessages.length; idx++) {
//         const message = listeMessages[idx]
//         // console.debug("Dechiffrer message : %O", message)
//         const {uuid_transaction, hachage_bytes, message_chiffre} = message
//         const cle = cles[hachage_bytes]
//         // Dechiffrer cle asymmetrique
//         const cleDechiffree = await chiffrage.dechiffrerCleSecrete(cle.cle)
//         // const cleDechiffrerBuffer = Buffer.from(cleDechiffree, 'binary').buffer
//         console.debug("Cle secrete dechiffree : %O", cleDechiffree)
//         const messageDechiffre = await chiffrage.chiffrage.dechiffrer(message_chiffre, cleDechiffree, cle.iv, cle.tag, {DEBUG: false})

//         // const messageDechiffre = await chiffrage.chiffrage.testDecipher(message_chiffre, cleDechiffree, cle.iv, {tag: cle.tag})
//         const messageTexte = JSON.parse(new TextDecoder().decode(messageDechiffre))
//         // console.debug("Message texte : %O", messageTexte)
//         // console.debug("Dechiffrage du message")
//         // const messageDechiffre = await decipher.update(message_chiffre)
//         // console.debug("Message dechiffre : %O", messageDechiffre)

//         // Verification du certificat du message
//         const dateMessage = new Date(messageTexte['en-tete'].estampille*1000)
//         // console.debug("Date message : %O", dateMessage)
//         const certificatVerifie = await chiffrage.validerCertificat(message.certificat_message, dateMessage)
//         if(certificatVerifie === true) {
//             // console.debug("Certificat verifie: %O", certificatVerifie)
//             const messageValide = await chiffrage.verifierMessage({_certificat: message.certificat_message, ...messageTexte})
//             if(messageValide === true) {
//                 // console.debug("Message valide : %O", messageValide)
//                 messagesDechiffres.push({...message, dechiffre: messageTexte})
//             } else {
//                 console.warn("Message invalide : %O", messageTexte)
//             }
//         } else {
//             console.warn("Certificat invalide pour message %O", messageTexte)
//         }
//     }

//     return messagesDechiffres
// }