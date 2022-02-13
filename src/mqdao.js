const debug = require('debug')('mqdao')

const L2Prive = '2.prive',
      L3Protege = '3.protege'

const DOMAINE_MESSAGERIE = 'Messagerie',
      DOMAINE_GROSFICHIERS = 'GrosFichiers',
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

let _certificatMaitreCles = null,
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

async function getClesChiffrage(socket, params) {
    let certificatMaitreCles = _certificatMaitreCles
    if(!certificatMaitreCles) {
        debug("Requete pour certificat maitre des cles")

        try {
            certificatMaitreCles = await socket.amqpdao.transmettreRequete(
                CONST_DOMAINE_MAITREDESCLES, {}, 
                {action: 'certMaitreDesCles', decoder: true}
            )

            // TTL
            setTimeout(()=>{_certificatMaitreCles=null}, 120_000)
        } catch(err) {
            console.error("mqdao.transmettreRequete ERROR : %O", err)
            return {ok: false, err: ''+err}
        }
    
        // certificatMaitreCles = await transmettreRequete(socket, params, 'certMaitreDesCles', {domaine: CONST_DOMAINE_MAITREDESCLES})
        _certificatMaitreCles = certificatMaitreCles
    }
    return certificatMaitreCles
}

function getProfil(socket, params) {
    return transmettreRequete(socket, params, 'getProfil')
}

function getMessages(socket, params) {
    return transmettreRequete(socket, params, 'getMessages')
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

async function transmettreRequete(socket, params, action, opts) {
    opts = opts || {}
    const domaine = opts.domaine || DOMAINE_MESSAGERIE
    const exchange = opts.exchange || L2Prive
    try {
        verifierMessage(params, domaine, action)
        return await socket.amqpdao.transmettreRequete(
            domaine, 
            params, 
            {action, exchange, noformat: true, decoder: true}
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

// async function ecouterMajFichiers(socket, cb) {
//     const userId = socket.userId
//     debug("ecouterMajFichiers userId : %s", socket.userId)
//     const opts = {
//         routingKeys: ROUTING_KEYS_FICHIERS,
//         exchange: [L2Prive],
//         userId,
//     }
//     socket.subscribe(opts, cb)
// }

// async function ecouterMajCollections(socket, cb) {
//     const userId = socket.userId
//     debug("ecouterMajCollections userId : %s", socket.userId)
//     const opts = {
//         routingKeys: ROUTING_KEYS_COLLECTIONS,
//         exchange: [L2Prive],
//         userId,
//     }
//     socket.subscribe(opts, cb)
// }

// async function ecouterTranscodageProgres(socket, params, cb) {
//     const opts = {
//         routingKeys: [`evenement.fichiers.${params.fuuid}.transcodageProgres`],
//         exchange: [L2Prive],
//     }
//     socket.subscribe(opts, cb)
// }

// async function retirerTranscodageProgres(socket, params, cb) {
//     const routingKeys = [`2.prive/evenement.fichiers.${params.fuuid}.transcodageProgres`]
//     socket.unsubscribe({routingKeys})
//     if(cb) cb(true)
// }

module.exports = {
    challenge, getClesChiffrage,
    getProfil, getMessages, getPermissionMessages, getClesFichiers, getContacts,
    posterMessage, 
    
    getDomainesMessagerie,
    initialiserProfil,

    // ecouterMajFichiers, ecouterMajCollections, ecouterTranscodageProgres, 
    // retirerTranscodageProgres, 
}
