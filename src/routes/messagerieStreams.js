const debug = require('debug')('routes:messagerieStreams')
const express = require('express')

function init(amqpdao, opts) {
    opts = opts || {}

    const route = express.Router()

    // Autoriser acces stream
    route.get('/streams/verifier', verifierAutorisationStream)

    debug("Route /messagerie/streams initialisee")
    
    return route
}

async function verifierAutorisationStream(req, res) {
    try {
        debug("verifierAutorisationFichier Headers %O", req.headers)

        const uriVideo = req.headers['x-original-uri']
        const urlVideo = new URL('https://localhost/' + uriVideo)
        const tokenVideo = urlVideo.searchParams.get('token')

        const reFuuid = /\/messagerie\/streams\/([A-Za-z0-9]+)(\/.*)?/
        const matches = reFuuid.exec(urlVideo.pathname)
        debug("Matches : %O", matches)
        const fuuid = matches[1]
        debug("Fuuid : %s, token : %s", fuuid, tokenVideo)

        if(!fuuid || !tokenVideo) return res.sendStatus(400)

        const redisClient = req.redisClient
        // const adresseExterne = req.headers['x-forwarded-for'] || req.headers['x-real-ip']
        const cleRedis = `streamtoken:${fuuid}:${tokenVideo}`

        debug("getCleRedis Cle = %O", cleRedis)
        const cleFuuid = await redisClient.get(cleRedis)
        if(cleFuuid === 'ok') {
            return res.sendStatus(200)
        } else {
            return res.sendStatus(403)
        }
    } catch(err) {
        console.error("ERROR verifierAutorisationFichier : %O", err)
        return res.sendStatus(500)
    }
}

// function verifierAutorisationStream(req, res) {
//     debug("verifierAutorisationStream Headers %O", req.headers)
//     //debug("verifierAutorisationStream Session %O", req.session)

//     const uriVideo = req.headers['x-original-uri']
//     const reFuuid = /\/messagerie\/streams\/([A-Za-z0-9]+)(\/.*)?/
//     const matches = reFuuid.exec(uriVideo)
//     debug("Matches : %O", matches)

//     if(!matches || matches.length < 1) {
//         debug("verifierAutorisationStream Mauvais url : %s", req.url)
//         return res.sendStatus(400)
//     }

//     const fuuid = matches[1]
//     const userId = req.session.userId
//     debug("Fuuid a charger pour usager %s : %s", userId, fuuid)

//     if(!userId) {
//         console.error("Erreur session, userId manquant sur %s", req.url)
//         debug("Erreur session, userId manquant : %O", req.session)
//         return res.sendStatus(400)
//     }

//     const mq = req.amqpdao
//     const requete = { user_id: userId, fuuids: [fuuid] }
//     mq.transmettreRequete('GrosFichiers', requete, {action: 'verifierAccesFuuids', exchange: '2.prive', attacherCertificat: true})
//         .then(resultat=>{
//             if(resultat.acces_tous === true) {
//                 debug("verifierAutorisationStream Acces stream OK")
//                 return res.sendStatus(200)
//             } else {
//                 debug("verifierAutorisationStream Acces stream refuse")
//                 return res.sendStatus(403)
//             }
//         })
//         .catch(err=>{
//             debug("verifierAutorisationStream Erreur verification acces stream : %O", err)
//             return res.sendStatus(500)
//         })
// }

module.exports = init