const debug = require('debug')('messagerie:poster')
const axios = require('axios')
const https = require('https')
const express = require('express')
const fsPromises = require('fs/promises')
const path = require('path')

// const messagesBackingStore = require('@dugrema/millegrilles.nodejs/src/messageQueueBackingStore')

const MESSAGE_LIMIT = 5 * 1024 * 1024,
      TIMEOUT_LIMIT = 15 * 60 * 1000

const jsonParser = express.json({limit: MESSAGE_LIMIT})

//var _urlFichiers = null,
var _httpsAgent = null,
    _pathStaging = '/tmp/messagerieStaging',
    _backingStore = null

function init(amqpdao, backingStore, opts) {
    opts = opts || {}
    _backingStore = backingStore

    // Conserver fingerprint du certificat CA
    // Utilise pour ignorer lors de la creation de la commande MaitreDesCles
    const pki = amqpdao.pki
    _fingerprintCA = pki.fingerprintCa
    const cert = pki.chainePEM,
          key = pki.cle,
          ca = pki.ca
    debug("route Chargement certificat CA, fingerprint : %s", _fingerprintCA)

    // let urlFichiers = process.env.MG_CONSIGNATION_URL
    // if(!urlFichiers) {
    //     if(process.env.MG_FICHIERS_URL) {
    //         urlFichiers = process.env.MG_FICHIERS_URL + '/fichiers_transfert'
    //     } else {
    //         throw new Error("env MG_CONSIGNATION_URL et MG_FICHIERS_URL manquants - au moins un requis pour upload attachments")
    //     }
    // }

    // _urlFichiers = new URL(urlFichiers)
    _httpsAgent = new https.Agent({
        keepAlive: true,
        rejectUnauthorized: false,
        cert, key, ca,
    })
    debug("Https agent : %O", _httpsAgent)

    // Setup thread transfert messages
    // messagesBackingStore.configurerThreadTransfertMessages(amqpdao, message=>traiterMessage(amqpdao, message), {novalid: true})

    const route = express.Router()

    route.use((req, _res, next)=>{
        debug("Route poster, methode %s, url : %s", req.method, req.url)
        next()
    })

    const middlewareRecevoirFichier = backingStore.middlewareRecevoirFichier(opts)
    const middlewareRecevoirFichierOneShot = backingStore.middlewareRecevoirFichier({...opts, chainOnSuccess: true})
    const middlewareReadyFichier = backingStore.middlewareReadyFichier(amqpdao, opts)

    // Reception fichiers (PUT)
    route.put('/:correlation/:position', verifierPermissionUploadAttachment, middlewareRecevoirFichier)

    // Reception fichier one-shot (fichier < limite upload)
    route.put('/:correlation', verifierPermissionUploadAttachment, middlewareRecevoirFichierOneShot, middlewareReadyFichier)

    // Verification fichiers (POST)
    route.post('/:correlation', verifierPermissionUploadAttachment, jsonParser, middlewareReadyFichier)

    // Cleanup
    const middlewareDeleteStaging = backingStore.middlewareDeleteStaging(opts)
    route.delete('/:correlation', middlewareDeleteStaging)
    
    // const middlewareRecevoirMessage = messagesBackingStore.middlewareRecevoirMessage({successStatus: 202, novalid: true})
    // route.post('/', jsonParser, verifierPoster, middlewareRecevoirMessage)
    route.post('/', jsonParser, verifierPoster, traiterPoster)

    return route
}

async function verifierPermissionUploadAttachment(req, res, next) {
    const fuuid = req.params.correlation,
          position = req.params.position
    debug("verifierPermissionUploadAttachment %s, position", fuuid, position)

    // const urlFichiers = new URL(''+_urlFichiers)
    const urlFichiers = new URL(_backingStore.getUrlTransfert())
    urlFichiers.pathname = urlFichiers.pathname + '/' + fuuid

    debug("Verifier existance de %O", urlFichiers)

    // Path fichier/repertoire selon type
    const modeTraitementMultiple = !isNaN(position)
    const pathFichier = modeTraitementMultiple?path.join(_pathStaging, fuuid + '.ready'):path.join(_pathStaging, fuuid + '.dat')

    try {
        const stat = await fsPromises.stat(pathFichier)
        // Le fichier/repertoire existe deja et est completement valide. Refuser demande upload, confirmer fichier OK.
        debug("Stat fichier/repertoire existant : %O", stat)
        const resultat = { ok: 200, status: 1, fuuid }
        return res.status(200).send(resultat)
    } catch(err) {

        if(err.code !== 'ENOENT') {
            // Le fichier n'existe pas deja. On continue (OK)
            return next()
        }
    }

    // Le fichier n'existe pas localement, on verifie dans le back-end
    const response = await axios({
        method: 'HEAD',
        url: ''+urlFichiers,
        httpsAgent: _httpsAgent,
        validateStatus: validateStatusHead,
        timeout: 1500,
    })

    try {
        const status = response.status
        debug("Reponse axios : %s", status)
        if(status === 404) {
            // Le fichier n'existe pas, verifier s'il est requis pour au moins 1 attachment
            const reponseRequis = await req.mqdao.attachmentsRequis({amqpdao: req.amqpdao}, [fuuid])
            debug("Reponse attachments requis : %O", reponseRequis)
            const valeurFuuids = reponseRequis.fuuids || {}
            if(valeurFuuids[fuuid] !== true) {
                // Le fichier n'est pas requis par au moins 1 message
                const resultat = {ok: false, code: 6, fuuid}
                return res.status(403).send(resultat)
            } else {
                // Le fichier est requis (OK)
                return next()
            }
        } else {
            const resultat = {
                ok: status === 200,
                status,
                fuuid,
                code: 7,
                headers: response.headers,
            }
            res.status(200).send(resultat)
        }
    } catch(err) {
        console.error("messageriePoster.verifierPermissionUploadAttachment Erreur %O", err)
        return res.sendStatus(503)
    }

}

function validateStatusHead(status) {
    return status >= 200 && status < 500
}

async function verifierPoster(req, res, next) {
    debug("verifierPoster HEADERS : %O", req.headers)
    const body = req.body
    debug("Message body\n%O", body)

    const pki = req.amqpdao.pki

    // Verifier message incoming
    try {
        const resultat = await pki.verifierMessage(body, {tiers: true})
        debug("poster Resultat verification signature : %O", resultat)
    } catch(err) {
        debug("poster Erreur verification signature : %O", err)
        return res.status(500).send({ok: false, err: ''+err, code: 2})
    }

    next()
}

async function traiterPoster(req, res, next) {
    const amqpdao = req.amqpdao
    const pki = amqpdao.pki
    const enveloppeMessage = req.body

    debug("Message a transmettre\n%O", enveloppeMessage)

    // Verifier commande incoming et sont attachement message 
    try {
        const verificationMessage = await pki.verifierMessage(enveloppeMessage, {tiers: true})
        debug("poster Resultat verification signature message %O", verificationMessage)

        const transfert = enveloppeMessage.attachements.transfert
        debug("traiterMessage Verifier transfert : ", transfert)
        const verificationTransfert = await pki.verifierMessage(transfert, {tiers: true})
        debug("poster Resultat verification signature transfert : %O", verificationTransfert)
    } catch(err) {
        console.error(new Date() + ' traiterPoster ERROR verification message', err)
        return res.status(500).send({code: 1})
    }

    try {
        // Separer le message et les attachements
        const attachements = enveloppeMessage.attachements,
              cles = attachements.cles,
              transfert = attachements.transfert
        const message = {...enveloppeMessage}
        delete message.attachements

        const commande = { message, cles, transfert }

        debug("Commande recevoir pour messagerie :\n%O", commande)
        const reponse = await amqpdao.transmettreCommande(
            'Messagerie', commande, 
            {action: 'recevoirExterne', exchange: '2.prive', timeout: 45_000}
        )
        debug("Reponse commande recevoir :\n%O", reponse)

        if(reponse.ok === true) {
            const messageOriginal = reponse['__original']
            return res.status(201).send(messageOriginal)
        } else {
            return res.status(500).send(messageOriginal)
        }

    } catch(err) {
        console.error(new Date() + ' traiterPoster ERROR preparation message', err)
        return res.status(500).send({ok: false, code: 2})
    }

    throw new Error('Erreur traitement generique')
}

module.exports = init
