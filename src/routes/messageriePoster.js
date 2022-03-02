const debug = require('debug')('messagerie:poster')
const express = require('express')

const MESSAGE_LIMIT = 5 * 1024 * 1024

const jsonParser = express.json({limit: MESSAGE_LIMIT})

function route() {
    const route = express.Router()
    route.use(jsonParser)
    route.post('/poster', poster)
    return route
}

function poster(req, res) {
    debug("poster Headers: %O", req.headers)
    const idmg = req.idmg
    const host = req.headers.host
    const body = req.body
    debug("Message body\n%O", body)

    const pki = req.amqpdaoInst.pki

    // Verifier message incoming
    pki.verifierMessage(body, {tiers: true})
        .then(resultat=>{
            debug("poster Resultat verification signature : %O", resultat)
            const reponse = {hostname: host, idmg}
            res.send(reponse)
        })
        .catch(err=>{
            debug("poster Erreur verification signature : %O", err)
            return res.sendStatus(500)
        })
    
}

module.exports = route
