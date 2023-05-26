import { usagerDao, forgecommon } from '@dugrema/millegrilles.reactjs'
import { pki } from '@dugrema/node-forge'

const { extraireExtensionsMillegrille } = forgecommon

export async function dechiffrerMessage(workers, message, cle) {
    const { date_envoi, user_id, certificat, millegrille } = message
    let data_chiffre = 'm' + message.contenu  // Ajouter code 'm' pour dechiffrer multibase base64

    let messages_envoyes = date_envoi?true:false
    let userId = user_id,
        resultatValider = null
    if(!messages_envoyes) {
        // Message incoming, valider
        const certForge = pki.certificateFromPem(certificat)
        const extensions = extraireExtensionsMillegrille(certForge)
        userId = extensions.userId

        resultatValider = await workers.chiffrage.verifierMessage(
            message,
            {support_idmg_tiers: true}
        )
        .catch(err=>{
            console.error("Erreur validation message : %O", err)
            return false
        })
    }

    const docChiffre = { data_chiffre }
    // console.debug("Dechiffrer %O avec cle %O", docChiffre, cle)
    const messageDechiffre = await workers.chiffrage.chiffrage.dechiffrerChampsChiffres(docChiffre, cle, {lzma: true})
    
    // console.debug("dechiffrerMessage Message dechiffre : ", messageDechiffre)

    const messageDict = {message: messageDechiffre, validation: {valide: resultatValider, userId}}

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
        console.debug("Cles manquantes : %O", Object.keys(clesInconnues))
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
