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
    const idmg = req.idmg
    const host = req.headers.host
    const body = req.body
    debug("Message body\n%O", body)

    const pki = req.amqpdaoInst.pki

    await sauvegarderCle(req, body.chiffrage)

    // Verifier message incoming
    const resultat = await pki.verifierMessage(body, {tiers: true})
    debug("poster Resultat verification signature : %O", resultat)
    const reponse = {hostname: host, idmg}
    
    return reponse
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
            return true
        }
    }

}

module.exports = route
