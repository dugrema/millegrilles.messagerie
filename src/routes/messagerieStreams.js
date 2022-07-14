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

function verifierAutorisationStream(req, res) {
    debug("verifierAutorisationStream Headers %O", req.headers)
    //debug("verifierAutorisationStream Session %O", req.session)

    const uriVideo = req.headers['x-original-uri']
    const reFuuid = /\/messagerie\/streams\/([A-Za-z0-9]+)(\/.*)?/
    const matches = reFuuid.exec(uriVideo)
    debug("Matches : %O", matches)

    if(!matches || matches.length < 1) {
        debug("verifierAutorisationStream Mauvais url : %s", req.url)
        return res.sendStatus(400)
    }

    const fuuid = matches[1]
    const userId = req.session.userId
    debug("Fuuid a charger pour usager %s : %s", userId, fuuid)

    if(!userId) {
        console.error("Erreur session, userId manquant sur %s", req.url)
        debug("Erreur session, userId manquant : %O", req.session)
        return res.sendStatus(400)
    }

    const mq = req.amqpdao
    const requete = { user_id: userId, fuuids: [fuuid] }
    mq.transmettreRequete('GrosFichiers', requete, {action: 'verifierAccesFuuids', exchange: '2.prive', attacherCertificat: true})
        .then(resultat=>{
            if(resultat.acces_tous === true) {
                debug("verifierAutorisationStream Acces stream OK")
                return res.sendStatus(200)
            } else {
                debug("verifierAutorisationStream Acces stream refuse")
                return res.sendStatus(403)
            }
        })
        .catch(err=>{
            debug("verifierAutorisationStream Erreur verification acces stream : %O", err)
            return res.sendStatus(500)
        })
}

module.exports = init
