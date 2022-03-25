const debug = require('debug')('routes:messagerieFichiers')
const express = require('express')
const bodyParser = require('body-parser')

function init(amqpdao, backingStore, opts) {
    opts = opts || {}

    const route = express.Router()

    // Reception fichiers (PUT)
    const middlewareRecevoirFichier = backingStore.middlewareRecevoirFichier(opts)
    route.put('/messagerie/fichiers/:correlation/:position', middlewareRecevoirFichier)

    // Verification fichiers (POST)
    const middlewareReadyFichier = backingStore.middlewareReadyFichier(amqpdao, opts)
    route.post('/messagerie/fichiers/:correlation', bodyParser.json(), middlewareReadyFichier)

    // Cleanup
    const middlewareDeleteStaging = backingStore.middlewareDeleteStaging(opts)
    route.delete('/messagerie/fichiers/:correlation', middlewareDeleteStaging)

    debug("Route /messagerie/fichiers initialisee")
    
    return route
}

module.exports = init
