const debug = require('debug')('messagerie:poster')
const axios = require('axios')
const https = require('https')
const express = require('express')
const fsPromises = require('fs/promises')
const path = require('path')

const messagesBackingStore = require('@dugrema/millegrilles.nodejs/src/messageQueueBackingStore')

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
    messagesBackingStore.configurerThreadTransfertMessages(amqpdao, message=>traiterMessage(amqpdao, message), {novalid: true})

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
    
    const middlewareRecevoirMessage = messagesBackingStore.middlewareRecevoirMessage({successStatus: 202, novalid: true})
    route.post('/', jsonParser, verifierPoster, middlewareRecevoirMessage)

    return route
}

function verifierPermissionUploadAttachment(req, res, next) {
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

    fsPromises.stat(pathFichier)
    .then(stat=>{
        // Le fichier/repertoire existe deja et est completement valide. Refuser demande upload, confirmer fichier OK.
        debug("Stat fichier/repertoire existant : %O", stat)
        const resultat = { ok: 200, status: 1, fuuid }
        res.status(200).send(resultat)
    })
    .catch(async err=>{
        if(err.code !== 'ENOENT') {
            // Erreur, mais le fichier n'existe pas. On continue.
            return next()
        }

        // Le fichier n'existe pas localement, on verifie dans le back-end
        axios({
            method: 'HEAD',
            url: ''+urlFichiers,
            httpsAgent: _httpsAgent,
            validateStatus: validateStatusHead,
            timeout: 1500,
        })
        .then(async response=>{
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
                    res.status(403).send(resultat)
                } else {
                    // Le fichier est requis (OK)
                    next()
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
        })
        .catch(err=>{
            console.error("messageriePoster.verifierPermissionUploadAttachment Erreur %O", err)
            res.sendStatus(503)
        })
    })

}

function validateStatusHead(status) {
    return status >= 200 && status < 500
}

async function verifierPoster(req, res, next) {
    // const idmg = req.idmg
    // const host = req.headers.host
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

async function traiterMessage(amqpdao, message) {
    debug("Message a transmettre\n%O", message)

    const pki = amqpdao.pki

    // Verifier message incoming
    try {
        const resultat = await pki.verifierMessage(message, {tiers: true})
        debug("poster Resultat verification signature : %O", resultat)
    } catch(err) {
        err.code = 2
        throw err
    }

    if ( ! await sauvegarderCle(amqpdao, message.chiffrage) ) {
        debug("Sauvegarder cle erreur")
        const err = new Error('Erreur sauvegarde cle')
        err.code = 1
        throw err
    } 
    
    if ( ! await sauvegarderMessage(amqpdao, message) ) {
        debug("Sauvegarder message erreur")
        const err = new Error('Erreur sauvegarde message')
        err.code = 2
        throw err
    }

    return true
}

async function sauvegarderCle(amqpdao, cleInfo) {
    debug("sauvegarderCle Cles\n%O", cleInfo)

    for(const partition in cleInfo.cles) {
        debug("Partition : %s", partition)
        if(partition === _fingerprintCA) continue  // Skip, on utilise une partition autre que CA

        const commande = {...cleInfo}

        // Overrides
        commande.domaine = 'Messagerie'
        commande.identificateurs_document = { message: 'true' }

        debug("Commande maitre des cles vers %s:\n%O", partition, commande)
        const reponse = await amqpdao.transmettreCommande('MaitreDesCles', commande, {partition, action: 'sauvegarderCle'})
        debug("Reponse sauvegarde cle :\n%O", reponse)

        if(reponse.ok === true) {
            // Cle recue et conservee, on n'a pas besoin d'emettre les autres cles
            debug("Cle conservee OK")
            return true
        }
    }

    debug("Erreur sauvegarde cles, seule la cle CA est present (if any) : %O", cleInfo.cles)

    return false
}

async function sauvegarderMessage(amqpdao, infoMessage) {
    const commande = {
        destinataires: infoMessage.destinataires,
        message: infoMessage.message,
    }

    debug("Commande recevoir pour messagerie :\n%O", commande)
    const reponse = await amqpdao.transmettreCommande('Messagerie', commande, {action: 'recevoir'})
    debug("Reponse commande recevoir :\n%O", reponse)

    return reponse.ok === true
}

module.exports = init
