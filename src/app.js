const debug = require('debug')('app')
const express = require('express')

const { server5 } = require('@dugrema/millegrilles.nodejs/src/server5')
const { extraireExtensionsMillegrille } = require('@dugrema/millegrilles.utiljs/src/forgecommon')

const { configurerEvenements } = require('./appSocketIo.js')
const routeMessagerie = require('./routes/messagerie.js')
const poster = require('./routes/messageriePoster')
const mqdao = require('./mqdao.js')

const EXPIRATION_RATE_REDIS = 60  // en secondes
const HIT_RATE_REDIS = 5  // Hits max par periode

async function app(params) {
    debug("Server app params %O", params)
    const app = express()
    const {server, socketIo, amqpdao: amqpdaoInst} = await server5(
        app,
        configurerEvenements,
        {
            pathApp: '/messagerie', 
            verifierAuthentification: (_req, _res, next) => {next()},  // Override global, gerer par route
            verifierAutorisation, 
            exchange: '2.prive'
        }
    )

    socketIo.use((socket, next)=>{
      socket.mqdao = mqdao
      next()
    })

    // Inserer les routes apres l'initialisation, permet d'avoir le middleware
    // attache avant (app.use comme le logging morgan, injection amqpdao, etc.)
    const route = express.Router()

    // Injecter acces au middleware
    app.use((req, res, next)=>{
        req.idmg = amqpdaoInst.pki.idmg

        req.amqpdaoInst = amqpdaoInst
        req.redisClient = amqpdaoInst.pki.redisClient
        req.mqdao = mqdao

        next()
    })
  
    // Route /messagerie
    app.use('/messagerie', route)
    route.post('/poster', verifierAuthentificationPoster, poster(amqpdaoInst))
    route.put('/poster/*', verifierAuthentificationPoster, poster(amqpdaoInst))
    route.put('/poster/*/*', verifierAuthentificationPoster, poster(amqpdaoInst))
    route.use(verifierAuthentification, routeMessagerie(amqpdaoInst))

    return server
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

function verifierAuthentificationPoster(req, res, next) {
    
    new Promise(async resolve => {
        try {
            const amqpdaoInst = req.amqpdaoInst
            // Verifier si on a exces de connexions provenant du meme IP
            if(await appliquerRateLimit(amqpdaoInst, req, 'poster')) {
                // On a un exces d'appel provenant du meme IP
                res.set('Retry-After', '60')    // Par defaut, demander d'attendre 60 secondes
                res.sendStatus(429)             // Too many requests
                return resolve()
            }

            // Aucune authentification requise
            next()
        } catch(err) {
            debug("verifierAuthentification Erreur verification path %s : %O", url, err)
            // Erreur parse, on procede avec verification de la session
        }

        resolve()
    })
    .catch(err=>{
        console.error("apps.verifierAuthentification Erreur traitement : %O", err)
        res.sendStatus(500)
    })

}

// Applique un compteur de nombre d'acces dans redis pour une periode TTL
async function appliquerRateLimit(amqpdaoInst, req, typeRate, opts) {
    opts = opts || {}

    const redisClient = amqpdaoInst.pki.redisClient
    const adresseExterne = req.headers['x-forwarded-for'] || req.headers['x-real-ip']
    const cleRedis = `messagerie:${typeRate}:${adresseExterne}`
    
    const quota = await getCleRedis(redisClient, cleRedis)
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

function getCleRedis(redisClient, cleRedis) {
    return new Promise((resolve, reject) => {
        redisClient.get(cleRedis, async (err, data)=>{
            if(err) return reject(err)
            resolve(data)
        })
    })
}

function verifierAutorisation(socket, securite, certificatForge) {

    let prive = false, protege = false

    const extensions = extraireExtensionsMillegrille(certificatForge)

    if(['proprietaire', 'delegue'].includes(extensions.delegationGlobale)) {
        // Deleguation globale donne tous les acces
        debug("Usager proprietaire, acces 3.protege OK")
        prive = true
        protege = true
    } else if(extensions.delegationsDomaines.includes('messagerie')) {
        // Delegation au domaine messagerie
        debug("Usager delegue domaine messagerie, acces 3.protege OK")
        prive = true
        protege = true
    } else if(securite === '2.prive') {
        const roles = extensions.roles || []
        if(roles.includes('compte_prive')) {
            debug("Usager prive, acces 2.prive OK")
            prive = true
        }
    }
    
    return {prive, protege}
}

module.exports = app
