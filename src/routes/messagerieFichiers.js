const debug = require('debug')('routes:messagerieFichiers')
const express = require('express')
const bodyParser = require('body-parser')

const backingStore = require('@dugrema/millegrilles.nodejs/src/fichiersTransfertBackingstore')

function init(amqpdao, fichierUploadUrl, opts) {
    opts = opts || {}

    debug("messagerieFichiers url upload consignation : %s", fichierUploadUrl)

    backingStore.configurerThreadPutFichiersConsignation(fichierUploadUrl, amqpdao)

    const route = express.Router()

    route.use((req, res, next)=>{
        debug("REQ messagerieFichiers url : %s", req.url)
        next()
    })

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
