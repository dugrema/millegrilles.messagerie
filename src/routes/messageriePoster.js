const debug = require('debug')('messagerie:poster')
const chiffrage = require('@dugrema/millegrilles.nodejs/src/chiffrage')
const express = require('express')

const MESSAGE_LIMIT = 5 * 1024 * 1024

const jsonParser = express.json({limit: MESSAGE_LIMIT})

function route(amqpdaoInst) {
    // Conserver fingerprint du certificat CA
    // Utilise pour ignorer lors de la creation de la commande MaitreDesCles
    _fingerprintCA = amqpdaoInst.pki.fingerprintCa
    debug("route Chargement certificat CA, fingerprint : %s", _fingerprintCA)

    const route = express.Router()
    route.use(jsonParser)
    route.post('/poster', poster)
    return route
}

function poster(req, res) {
    debug("poster Headers: %O", req.headers)

    // Verifier message incoming
    traiterPoster(req)
        .then(reponse=>res.send(reponse))
        .catch(err=>{
            debug("poster Erreur verification signature : %O", err)
            res.sendStatus(500)
        })
    
}

async function traiterPoster(req) {
    // const idmg = req.idmg
    // const host = req.headers.host
    const body = req.body
    debug("Message body\n%O", body)

    const pki = req.amqpdaoInst.pki

    // Verifier message incoming
    const resultat = await pki.verifierMessage(body, {tiers: true})
    debug("poster Resultat verification signature : %O", resultat)

    if ( ! await sauvegarderCle(req, body.chiffrage) ) {
        debug("Sauvegarder cle erreur")
        return {ok: false, err: 'Erreur sauvegarde cle', code: 1}
    } 
    
    if ( ! await sauvegarderMessage(req, body) ) {
        debug("Sauvegarder message erreur")
        return {ok: false, err: 'Erreur sauvegarde message', code: 2}
    }

    return {ok: true, code: 201}
}

async function sauvegarderCle(req, cleInfo) {
    debug("sauvegarderCle Cles\n%O", cleInfo)
    // chiffrage: {
    //     cles: {
    //         z2i3XjxJgyzgMSwpJ5E3xiy1wmPJF2W1moQxYnuTA1NYMrgg38N: 'mqynb5PfQGSGVWy1642c4rTTGxAoye8ieNUKKK8gNIh+2DDW2sdxwLqU5pgmXZY7KC+MwGmLgpOC5mxlCFcetaQVWqJeDufjHol1YG/pqFMo'
    //     },
    //     domaine: 'Messagerie',
    //     format: 'mgs3',
    //     hachage_bytes: 'zSEfXUD16zhzViiUuZt9PVLDXC6FeXUYnetnu1rVbkJdnqbZWJwHNDUekdqJqusT2D3yvfdDe3cy3bhdoWmKdsYCnYUNLx',
    //     identificateurs_document: { message: 'true' },
    //     iv: 'msib8pC725LbXnXKj',
    //     tag: 'mzdgV+iZVHrxiFlNY/aw+iw'
    // }

    const amqpdaoInst = req.amqpdaoInst
    for(const partition in cleInfo.cles) {
        debug("Partition : %s", partition)
        if(partition === _fingerprintCA) continue  // Skip, on utilise une partition autre que CA

        const commande = {...cleInfo}

        // Overrides
        commande.domaine = 'Messagerie'
        commande.identificateurs_document = { message: 'true' }

        debug("Commande maitre des cles vers %s:\n%O", partition, commande)
        const reponse = await amqpdaoInst.transmettreCommande('MaitreDesCles', commande, {partition, action: 'sauvegarderCle'})
        debug("Reponse sauvegarde cle :\n%O", reponse)

        if(reponse.ok === true) {
            // Cle recue et conservee, on n'a pas besoin d'emettre les autres cles
            debug("Cle conservee OK")
            return true
        }
    }

    return false
}

async function sauvegarderMessage(req, infoMessage) {
    const amqpdaoInst = req.amqpdaoInst
    const commande = {
        destinataires: infoMessage.destinataires,
        message: infoMessage.message,
    }

    debug("Commande recevoir pour messagerie :\n%O", commande)
    const reponse = await amqpdaoInst.transmettreCommande('Messagerie', commande, {action: 'recevoir'})
    debug("Reponse commande recevoir :\n%O", reponse)

    return reponse.ok === true
}

module.exports = route
