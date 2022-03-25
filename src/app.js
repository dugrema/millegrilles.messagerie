const debug = require('debug')('app')
const express = require('express')

const server6 = require('@dugrema/millegrilles.nodejs/src/server6')
const { extraireExtensionsMillegrille } = require('@dugrema/millegrilles.utiljs/src/forgecommon')

const { configurerEvenements } = require('./appSocketIo.js')
const routeMessagerie = require('./routes/messagerie.js')
// const poster = require('./routes/messageriePoster')
const mqdao = require('./mqdao.js')

async function app(params) {
    debug("Server app params %O", params)
    const app = express()
    const {server, socketIo, amqpdao: amqpdaoInst} = await server6(
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
        // req.idmg = amqpdaoInst.pki.idmg
        req.idmg = req.amqpdao.pki.idmg

        // req.amqpdaoInst = amqpdaoInst
        // req.redisClient = amqpdaoInst.pki.redisClient
        req.mqdao = mqdao

        next()
    })
  
    // Route /messagerie
    app.use('/messagerie', route)
    // route.post('/poster', verifierAuthentificationPoster, poster(amqpdaoInst))
    // route.post('/poster/*', verifierAuthentificationPoster, poster(amqpdaoInst))
    // route.put('/poster/*', verifierAuthentificationPoster, poster(amqpdaoInst))
    // route.put('/poster/*/*', verifierAuthentificationPoster, poster(amqpdaoInst))
    route.use(routeMessagerie(amqpdaoInst))

    return server
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
