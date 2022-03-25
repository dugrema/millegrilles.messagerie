const debug = require('debug')('messagerie')
const express = require('express')

const fichiersBackingStore = require('@dugrema/millegrilles.nodejs/src/fichiersTransfertBackingstore')

const poster = require('./messageriePoster')
const routeMessagerieFichiers = require('./messagerieFichiers.js')

const EXPIRATION_RATE_REDIS = 120  // en secondes
const HIT_RATE_REDIS = 1000  // Hits max par periode

function app(amqpdao, opts) {
    if(!opts) opts = {}
    const idmg = amqpdao.pki.idmg

    let fichierUploadUrl = process.env['MG_CONSIGNATION_URL']
    if(fichierUploadUrl) {
        fichierUploadUrl = new URL(fichierUploadUrl)  // Validation du format
    } else {
        // Mettre url par defaut pour upload sur instance protegee (MQ_HOST, port 443)
        const hostMQ = process.env['MQ_HOST']
        fichierUploadUrl = new URL(`https://${hostMQ}/fichiers_transfert`)
    }

    debug("IDMG: %s, AMQPDAO : %s", idmg, amqpdao !== undefined)

    debug("messagerieFichiers url upload consignation : %s", fichierUploadUrl)
    fichiersBackingStore.configurerThreadPutFichiersConsignation(''+fichierUploadUrl, amqpdao)

    const route = express.Router()

    route.use((req, _res, next)=>{debug("Route messagerie, url %s", req.url); next()})

    route.get('/info.json', routeInfo)
    route.all('/fichiers/*', verifierAuthentification, routeMessagerieFichiers(amqpdao, fichiersBackingStore, opts))
    route.use('/poster', verifierAuthentificationPoster, poster(amqpdao, fichiersBackingStore, opts))
    ajouterStaticRoute(route)

    debug("Route /messagerie de MessagerieWeb est initialisee")

    // Retourner dictionnaire avec route pour server.js
    return route
}
  
function ajouterStaticRoute(route) {
    // Route utilisee pour transmettre fichiers react de la messagerie en production
    var folderStatic =
        process.env.MG_MESSAGERIE_STATIC_RES ||
        process.env.MG_STATIC_RES ||
        'static/messagerie'

    route.get('*', cacheRes, express.static(folderStatic))
    debug("Route %s pour grosfichiers initialisee", folderStatic)
}

function routeInfo(req, res) {
    debug(req.headers)
    const idmgCompte = req.headers['idmg-compte']
    const nomUsager = req.headers['user-prive']
    const host = req.headers.host

    const reponse = {idmgCompte, nomUsager, hostname: host}
    return res.send(reponse)
}

function verifierAuthentification(req, res, next) {
    try {
        const session = req.session
        if( ! (session.nomUsager && session.userId) ) {
            debug("Nom usager/userId ne sont pas inclus dans les req.headers : %O", req.headers)
            res.append('Access-Control-Allow-Origin', '*')  // S'assurer que le message est recu cross-origin
            res.sendStatus(403)
            return
        } else {
            return next()
        }
    } catch(err) {
        console.error("apps.verifierAuthentification Erreur : %O", err)
    }
}

function cacheRes(req, res, next) {
    const url = req.url
    debug("Cache res URL : %s", url)
    
    if(url.endsWith('.chunk.js') || url.endsWith('.chunk.css') || url.endsWith('.worker.js') || url.endsWith('.map')) {
        // Pour les .chunk.js, on peut faire un cache indefini (immuable)
        res.append('Cache-Control', 'public, max-age=86400, immutable')
    } else {
        // Pour les autres, faire un cachee limite
        res.append('Cache-Control', 'public, max-age=600')
    }

    next()
}

function verifierAuthentificationPoster(req, res, next) {
    
    new Promise(async resolve => {
        try {
            // Verifier si on a exces de connexions provenant du meme IP
            if(await appliquerRateLimit(req, 'poster')) {
                // On a un exces d'appel provenant du meme IP
                res.set('Retry-After', '60')    // Par defaut, demander d'attendre 60 secondes
                res.sendStatus(429)             // Too many requests
                return resolve()
            }

            // Aucune authentification requise
            debug("Ok, aucune auth requise")
            next()
            return resolve()
        } catch(err) {
            debug("verifierAuthentification Erreur verification path %s : %O", req.url, err)
            // Erreur parse, on procede avec verification de la session
        }

        res.sendStatus(500)
        resolve()
    })
    .catch(err=>{
        console.error("apps.verifierAuthentification Erreur traitement : %O", err)
        res.sendStatus(500)
    })

}

// Applique un compteur de nombre d'acces dans redis pour une periode TTL
async function appliquerRateLimit(req, typeRate, opts) {
    opts = opts || {}

    const redisClient = req.redisClient  //amqpdaoInst.pki.redisClient
    const adresseExterne = req.headers['x-forwarded-for'] || req.headers['x-real-ip']
    const cleRedis = `messagerie:${typeRate}:${adresseExterne}`

    debug("getCleRedis Cle = %O", cleRedis)
    const quota = await redisClient.get(cleRedis)
    debug("getCleRedis Resultat chargement adresse: %s = %O", adresseExterne, quota)
    if(quota) {
        const quotaInt = Number.parseInt(quota)
        if(quotaInt > 0) {
            // Decrementer quota pour la periode TTL deja etablie
            const quotaMaj = '' + (quotaInt-1)
            redisClient.set(cleRedis, quotaMaj, 'KEEPTTL')
        } else {
            return true  // Limite atteinte
        }
    } else {
        // Entree initiale pour la periode TTL
        const limite = opts.limite || HIT_RATE_REDIS
        const quotaInt = Number.parseInt(limite)
        const quotaMaj = '' + (quotaInt-1)
        const expiration = opts.expiration || EXPIRATION_RATE_REDIS
        redisClient.set(cleRedis, quotaMaj, 'NX', 'EX', expiration)
    }

    return false  // Limite n'est pas atteinte
}

module.exports = app
