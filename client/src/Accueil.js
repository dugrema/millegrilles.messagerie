import { useState, useEffect } from 'react'

function Accueil(props) {

    const { workers, etatConnexion, usager, downloadAction } = props

    const [listeMessages, setListeMessages] = useState([])

    useEffect( () => { 
        if(!etatConnexion) return
        workers.connexion.getMessages({}).then(async messages=>{
            console.debug("Messages recus : %O", messages)
            setListeMessages(messages)
            await chargerClesMessages(workers, messages)
        })
    }, [workers, etatConnexion, setListeMessages])

    return (
        <>
            <h1>Messagerie</h1>
        </>
    )

}

export default Accueil

async function chargerClesMessages(workers, listeMessages) {
    const { connexion, chiffrage } = workers

    const uuidMessages = listeMessages.messages.map(item=>item.uuid_transaction)
    const reponseCles = await connexion.getPermissionMessages(uuidMessages)
    const cles = reponseCles.cles
    console.debug("Reponse permission dechiffrage messages : %O", reponseCles)

    for(let idx=0; idx<listeMessages.messages.length; idx++) {
        const message = listeMessages.messages[idx]
        console.debug("Dechiffrer message : %O", message)
        const {uuid_transaction, hachage_bytes, message_chiffre} = message
        const cle = cles[hachage_bytes]
        // Dechiffrer cle asymmetrique
        const cleDechiffree = await chiffrage.dechiffrerCleSecrete(cle.cle)
        // const cleDechiffrerBuffer = Buffer.from(cleDechiffree, 'binary').buffer
        console.debug("Cle secrete dechiffree : %O", cleDechiffree)
        const messageDechiffre = await chiffrage.chiffrage.dechiffrer(message_chiffre, cleDechiffree, cle.iv, cle.tag, {DEBUG: true})

        // const messageDechiffre = await chiffrage.chiffrage.testDecipher(message_chiffre, cleDechiffree, cle.iv, {tag: cle.tag})
        const messageTexte = JSON.parse(new TextDecoder().decode(messageDechiffre))
        console.debug("Message texte : %O", messageTexte)
        // console.debug("Dechiffrage du message")
        // const messageDechiffre = await decipher.update(message_chiffre)
        console.debug("Message dechiffre : %O", messageDechiffre)

        // Verification du certificat du message
        const dateMessage = new Date(messageTexte['en-tete'].estampille*1000)
        console.debug("Date message : %O", dateMessage)
        // const dateCorrompue = new Date(dateMessage * 1000)
        // dateCorrompue.setFullYear(2019)
        const certificatVerifie = await chiffrage.validerCertificat(message.certificat_message, dateMessage)
        if(certificatVerifie === true) {
            console.debug("Certificat verifie: %O", certificatVerifie)
            const messageValide = await chiffrage.verifierMessage({_certificat: message.certificat_message, ...messageTexte})
            if(messageValide === true) {
                console.debug("Message valide : %O", messageValide)
            } else {
                console.warn("Message invalide : %O", messageTexte)
            }
        } else {
            console.warn("Certificat invalide pour message %O", messageTexte)
        }
    }

}
