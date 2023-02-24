const { MilleGrillesAmqpDAO } = require('@dugrema/millegrilles.nodejs')
const { pki: pkiForge } = require('@dugrema/node-forge')
const { extraireExtensionsMillegrille } = require('@dugrema/millegrilles.utiljs/src/forgecommon')
const { getRandom } = require('@dugrema/millegrilles.utiljs/src/random')
const { hacher } = require('@dugrema/millegrilles.nodejs/src/hachage')
const { signerTokenFichier } = require('@dugrema/millegrilles.nodejs/src/jwt')

const debug = require('debug')('mqdao')

const L1Public = '1.public',
      L2Prive = '2.prive',
      L3Protege = '3.protege'

const DOMAINE_MESSAGERIE = 'Messagerie',
      CONST_DOMAINE_GROSFICHIERS = 'GrosFichiers',
      CONST_DOMAINE_MAITREDESCLES = 'MaitreDesCles',
      CONST_DOMAINE_FICHIERS = 'fichiers',
      CONST_DOMAINE_TOPOLOGIE = 'CoreTopologie'

const ROUTING_KEYS_FICHIERS = [
    //'evenement.grosfichiers.majFichier',
]

const ROUTING_KEYS_COLLECTIONS = [
    //'evenement.grosfichiers.majCollection',
]

// const EVENEMENTS_SUPPORTES = [
// ...ROUTING_KEYS_FICHIERS,
// ...ROUTING_KEYS_COLLECTIONS,
// ]

let // _certificatsMaitreCles = null,
    _domainesApplications = null

function challenge(socket, params) {
    // Repondre avec un message signe
    const reponse = {
        reponse: params.challenge,
        message: 'Trust no one',
        nomUsager: socket.nomUsager,
        userId: socket.userId,
    }
    return socket.amqpdao.pki.formatterMessage(reponse, 'challenge', {ajouterCertificat: true})
}

async function getClesChiffrage(socket) {
    const certificats = await socket.amqpdao.getCertificatsMaitredescles()
    return certificats
}

function getProfil(socket, params) {
    return transmettreRequete(socket, params, 'getProfil')
}

function getMessages(socket, params) {
    return transmettreRequete(socket, params, 'getMessages')
}

function getReferenceMessages(socket, params) {
    return transmettreRequete(socket, params, 'getReferenceMessages')
}

function getMessagesAttachments(socket, params) {
    return transmettreRequete(socket, params, 'getMessagesAttachments')
}

function getPermissionMessages(socket, params) {
    return transmettreRequete(socket, params, 'getPermissionMessages')
}

function getClesFichiers(socket, params) {
    return transmettreRequete(socket, params, 'dechiffrage', {domaine: CONST_DOMAINE_MAITREDESCLES})
}

function getContacts(socket, params) {
    return transmettreRequete(socket, params, 'getContacts')
}

function getReferenceContacts(socket, params) {
    return transmettreRequete(socket, params, 'getReferenceContacts')
}

async function posterMessage(socket, params) {
    const { message, commandeMaitrecles } = params

    debug("Poster message\n%O\nCommande maitre cles : %O", message, commandeMaitrecles)

    const partition = commandeMaitrecles['_partition']
    const reponseMaitreCles = await transmettreCommande(socket, commandeMaitrecles, 'sauvegarderCle', {domaine: CONST_DOMAINE_MAITREDESCLES, partition})
    debug("Reponse maitre des cles : %O", reponseMaitreCles)
    const reponseMessage = await transmettreCommande(socket, message, 'poster')
    debug("Reponse poster message : %O", reponseMessage)

    return {message: reponseMessage, maitreCles: reponseMaitreCles}
}

function majContact(socket, params) {
    return transmettreCommande(socket, params, 'majContact')
}

function marquerLu(socket, params) {
    return transmettreCommande(socket, params, 'lu')
}

function attachmentsRequis(socket, fuuids) {
    return socket.amqpdao.transmettreRequete(
        DOMAINE_MESSAGERIE, 
        {fuuids}, 
        {action: 'attachmentRequis', ajouterCertificat: true, exchange: L2Prive, noformat: false, decoder: true}
    )
}

async function getDomainesMessagerie(socket, params) {
    let domainesApplications = _domainesApplications
    if(!domainesApplications) {
        debug("Requete pour applications/domaines (dns messagerie)")

        try {
            domainesApplications = await socket.amqpdao.transmettreRequete(
                CONST_DOMAINE_TOPOLOGIE, {}, 
                {action: 'listeApplicationsDeployees', decoder: true}
            )

            // TTL
            setTimeout(()=>{_domainesApplications=null}, 120_000)

            _domainesApplications = domainesApplications
        } catch(err) {
            console.error("mqdao.transmettreRequete ERROR : %O", err)

            // Utiliser ancienne version si disponible
            if(!domainesApplications) {
                // Aucune version disponible
                return {ok: false, err: ''+err}
            }
        }
    }

    return domainesApplications
}

async function initialiserProfil(socket, params) {
    return transmettreCommande(socket, params, 'initialiserProfil')
}

// async function creerTokenStream(socket, params) {
//     const fuuid = params.fuuid

//     // Verifier l'autorisation d'acces au stream
//     const reponse = await transmettreRequete(socket, params, 'verifierPreuve', 
//         {domaine: CONST_DOMAINE_MAITREDESCLES, partition: params.partition, noformat: true})

//     debug("Reponse preuve : %O", reponse)
//     if(reponse.verification && reponse.verification[fuuid] === true) {
//         // Creer un token random pour le stream
//         const randomBytes = getRandom(32)
//         const token = (await hacher(randomBytes, {hashingCode: 'blake2s-256', encoding: 'base58btc'})).slice(1)
//         const cleStream = `streamtoken:${fuuid}:${token}`
//         const timeoutStream = 2 * 60 * 60

//         // Conserver token dans Redis
//         const redisClient = socket.redisClient
//         await redisClient.set(cleStream, 'ok', {NX: true, EX: timeoutStream})

//         return {token}
//     } else {
//         return {ok: false, err: "Cle refusee ou inconnue"}
//     }
// }

function supprimerMessages(socket, params) {
    return transmettreCommande(socket, params, 'supprimerMessages')
}

function supprimerContacts(socket, params) {
    return transmettreCommande(socket, params, 'supprimerContacts')
}

function getClepubliqueWebpush(socket, params) {
    return transmettreRequete(socket, params, 'getClepubliqueWebpush', {exchange: L1Public})
}

// Section GrosFichiers pour attachements

function getDocuments(socket, params) {
    return transmettreRequete(socket, params, 'documentsParTuuid', {domaine: CONST_DOMAINE_GROSFICHIERS})
}

function syncCollection(socket, params) {
    return transmettreRequete(socket, params, 'syncCollection', {domaine: CONST_DOMAINE_GROSFICHIERS})
}
  
function getPermissionCles(socket, params) {
    return transmettreRequete(socket, params, 'getClesFichiers', {domaine: CONST_DOMAINE_GROSFICHIERS})
}

// function getDocumentsParFuuid(socket, params) {
//     return transmettreRequete(socket, params, 'documentsParFuuid', {domaine: CONST_DOMAINE_GROSFICHIERS})
// }

// function getFavoris(socket, params) {
//     return transmettreRequete(socket, params, 'favoris', {domaine: CONST_DOMAINE_GROSFICHIERS})
// }

// function getCollection(socket, params) {
//     return transmettreRequete(socket, params, 'contenuCollection', {domaine: CONST_DOMAINE_GROSFICHIERS})
// }

function copierFichierTiers(socket, params) {
    return transmettreCommande(socket, params, 'copierFichierTiers', {domaine: CONST_DOMAINE_GROSFICHIERS})
}

// function favorisCreerPath(socket, params) {
//     return transmettreCommande(socket, params, 'favorisCreerPath', {domaine: CONST_DOMAINE_GROSFICHIERS})
// }

async function creerTokensStreaming(socket, params) {

    const fuuidVideo = params.fuuidVideo,
          mimetype = params.mimetype,
          dechiffrageVideo = params.dechiffrageVideo || {}

    // const paramsCles = {}
    // for(const champ of ['format', 'header', 'iv', 'tag']) {
    //     if(params[champ]) paramsCles[champ] = params[champ]
    // }

    debug("creerTokensStreaming Params ", params)

    try {
        const reponse = await transmettreCommande(socket, params, 'conserverClesAttachments')

        const fuuids = []
        for(const fuuid of Object.keys(reponse.resultat)) {
            const ok = reponse.resultat[fuuid]
            if(ok === true) fuuids.push(fuuid)
        }

        const pki = socket.amqpdao.pki
        const { cle: clePriveePem, fingerprint } = pki
        const userId = socket.userId

        const jwts = {}
        for await (const fuuid of fuuids) {
            // const cle = cles[fuuid]

            // const format = cle.format,
            //       header = cle.header,
            //       iv = cle.iv,
            //       tag = cle.tag

            const jwt = await signerTokenFichier(fingerprint, clePriveePem, userId, fuuid)
            debug("JWT cree pour userId %s sur fuuid %s : %O", userId, fuuid, jwt)
            jwts[fuuid] = jwt

            if(fuuidVideo) {
                const jwt = await signerTokenFichier(fingerprint, clePriveePem, userId, fuuidVideo, {ref: fuuid, mimetype, ...dechiffrageVideo})
                debug("JWT cree pour userId %s sur video %s (fuuid %s) : %O", userId, fuuidVideo, fuuid, jwt)
                jwts[fuuidVideo] = jwt
            }
        }

        return {ok: true, jwts}
    } catch(err) {
        console.error("creerTokensStreaming ERROR ", err)
        return {ok: false, err: ''+err}
    }
}

// Listeners

const CONST_ROUTINGKEYS_EVENEMENT_CONTACT = [
    'evenement.Messagerie.{USER_ID}.majContact',
    'evenement.Messagerie.{USER_ID}.contactsSupprimes',
]

async function enregistrerCallbackEvenementContact(socket, params, cb) {
    const userId = socket.userId  // Ignorer params, utiliser userId de la session
    const routingKeys = CONST_ROUTINGKEYS_EVENEMENT_CONTACT.map(item=>item.replace("{USER_ID}", userId))
    const opts = { routingKeys, exchanges: ['2.prive'] }
    socket.subscribe(opts, cb)
}

function retirerCallbackEvenementContact(socket, params, cb) {
    const userId = socket.userId
    const routingKeys = CONST_ROUTINGKEYS_EVENEMENT_CONTACT.map(item=>item.replace("{USER_ID}", userId))
    const opts = { routingKeys, exchanges: ['2.prive'] }
    socket.unsubscribe(opts, cb)
}

const CONST_ROUTINGKEYS_EVENEMENT_MESSAGE = [
    'evenement.Messagerie.{USER_ID}.nouveauMessage',
    'evenement.Messagerie.{USER_ID}.messageLu',
    'evenement.Messagerie.{USER_ID}.messagesSupprimes',
]

async function enregistrerCallbackEvenementMessages(socket, params, cb) {
    const userId = socket.userId  // Ignorer params, utiliser userId de la session
    const routingKeys = CONST_ROUTINGKEYS_EVENEMENT_MESSAGE.map(item=>item.replace("{USER_ID}", userId))
    const opts = { routingKeys, exchanges: ['2.prive'] }
    socket.subscribe(opts, cb)
}

function retirerCallbackEvenementMessages(socket, params, cb) {
    const userId = socket.userId
    const routingKeys = CONST_ROUTINGKEYS_EVENEMENT_MESSAGE.map(item=>item.replace("{USER_ID}", userId))
    const opts = { routingKeys, exchanges: ['2.prive'] }
    socket.unsubscribe(opts, cb)
}

const CONST_ROUTINGKEYS_MAJFICHIER = ['evenement.grosfichiers.majFichier']

const mapperMajFichiers = {
  exchanges: ['2.prive'],
  routingKeyTest: /^evenement\.grosfichiers\.majFichier$/,
  mapRoom: (message, _rk, _exchange) => {
    const tuuid = message.tuuid
    if(tuuid) {
      return `2.prive/evenement.grosfichiers.majFichier/${tuuid}`
    }
  }
}

function enregistrerCallbackMajFichier(socket, params, cb) {
  const tuuids = params.tuuids
  const opts = { 
    routingKeys: CONST_ROUTINGKEYS_MAJFICHIER,
    exchanges: ['2.prive'],
    roomParam: tuuids,
    mapper: mapperMajFichiers,
  }

  debug("enregistrerCallbackMajFichier : %O", opts)
  socket.subscribe(opts, cb)
}

function retirerCallbackMajFichier(socket, params, cb) {
  const tuuids = params.tuuids
  const opts = { 
    routingKeys: CONST_ROUTINGKEYS_MAJFICHIER, 
    exchanges: ['2.prive'],
    roomParam: tuuids,
  }
  debug("retirerCallbackMajFichier sur %O", opts)
  socket.unsubscribe(opts, cb)
}

// Fonctions generiques

async function transmettreRequete(socket, params, action, opts) {
    opts = opts || {}
    const domaine = opts.domaine || DOMAINE_MESSAGERIE
    const exchange = opts.exchange || L2Prive
    const partition = opts.partition
    try {
        verifierMessage(params, domaine, action)
        return await socket.amqpdao.transmettreRequete(
            domaine, 
            params, 
            {action, partition, exchange, noformat: true, decoder: true}
        )
    } catch(err) {
        console.error("mqdao.transmettreRequete ERROR : %O", err)
        return {ok: false, err: ''+err}
    }
}

async function transmettreCommande(socket, params, action, opts) {
    opts = opts || {}
    const domaine = opts.domaine || DOMAINE_MESSAGERIE
    const exchange = opts.exchange || L2Prive
    const nowait = opts.nowait
    const partition = opts.partition
    try {
        verifierMessage(params, domaine, action)
        return await socket.amqpdao.transmettreCommande(
            domaine, 
            params, 
            {action, partition, exchange, noformat: true, decoder: true, nowait}
        )
    } catch(err) {
        console.error("mqdao.transmettreCommande ERROR : %O", err)
        return {ok: false, err: ''+err}
    }
}

/* Fonction de verification pour eviter abus de l'API */
function verifierMessage(message, domaine, action) {
    const entete = message['en-tete'] || {},
          domaineRecu = entete.domaine,
          actionRecue = entete.action
    if(domaineRecu !== domaine) throw new Error(`Mismatch domaine (${domaineRecu} !== ${domaine})"`)
    if(actionRecue !== action) throw new Error(`Mismatch action (${actionRecue} !== ${action})"`)
}


module.exports = {
    challenge, getClesChiffrage,
    getProfil, getMessages, getReferenceMessages, getPermissionMessages, getClesFichiers, getMessagesAttachments,
    getContacts, getReferenceContacts, 
    posterMessage, majContact, marquerLu, 
    attachmentsRequis, supprimerMessages, supprimerContacts,
    
    getDomainesMessagerie,
    initialiserProfil,
    // creerTokenStream,
    getClepubliqueWebpush,

    // GrosFichiers
    syncCollection, getDocuments, getPermissionCles, copierFichierTiers, creerTokensStreaming,
    // getDocumentsParFuuid, getFavoris, getCollection, favorisCreerPath,

    // Evenements
    enregistrerCallbackEvenementContact, retirerCallbackEvenementContact,
    enregistrerCallbackEvenementMessages, retirerCallbackEvenementMessages,
    enregistrerCallbackMajFichier, retirerCallbackMajFichier,

    // ecouterMajFichiers, ecouterMajCollections, ecouterTranscodageProgres, 
    // retirerTranscodageProgres, 
}
