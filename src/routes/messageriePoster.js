const debug = require('debug')('messagerie:poster')
const axios = require('axios')
const https = require('https')
const express = require('express')
const fs = require('fs')
const fsPromises = require('fs/promises')
const path = require('path')
const readdirp = require('readdirp')

const { VerificateurHachage } = require('@dugrema/millegrilles.nodejs/src/hachage')

const MESSAGE_LIMIT = 5 * 1024 * 1024,
      TIMEOUT_LIMIT = 15 * 60 * 1000

const jsonParser = express.json({limit: MESSAGE_LIMIT})

var _urlFichiers = null,
    _httpsAgent = null,
    _pathStaging = '/tmp/messagerieStaging'

function route(amqpdaoInst) {
    // Conserver fingerprint du certificat CA
    // Utilise pour ignorer lors de la creation de la commande MaitreDesCles
    const pki = amqpdaoInst.pki
    _fingerprintCA = pki.fingerprintCa
    const cert = pki.chainePEM,
          key = pki.cle,
          ca = pki.ca
    debug("route Chargement certificat CA, fingerprint : %s", _fingerprintCA)

    _urlFichiers = new URL(process.env.FICHIERS_TRANSFERT)
    _httpsAgent = new https.Agent({
        keepAlive: true,
        rejectUnauthorized: false,
        cert, key, ca,
    })
    debug("Https agent : %O", _httpsAgent)

    const route = express.Router()
    route.put('/poster/:fuuid/:position', verifierPermissionUploadAttachment, posterAttachment)
    route.put('/poster/:fuuid', verifierPermissionUploadAttachment, posterAttachment)
    route.post('/poster/:fuuid', traiterPostUpload)
    route.post('/poster', jsonParser, poster)
    return route
}

function poster(req, res) {
    debug("poster Headers: %O", req.headers)

    // Verifier message incoming
    traiterPoster(req)
        .then(reponse=>res.send(reponse))
        .catch(err=>{
            debug("poster Erreur verification signature : %O", err)
            res.sendStatus(500)
        })
    
}

function verifierPermissionUploadAttachment(req, res, next) {
    const fuuid = req.params.fuuid,
          position = req.params.position
    debug("verifierPermissionUploadAttachment %s, position", fuuid, position)

    const urlFichiers = new URL(''+_urlFichiers)
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
                const reponseRequis = await req.mqdao.attachmentsRequis({amqpdao: req.amqpdaoInst}, [fuuid])
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

function posterAttachment(req, res) {
    const fuuid = req.params.fuuid
    debug("posterAttachment %s", fuuid)

    traiterUpload(req, res)
    .catch(err=>{
        console.error("messageriePoster.posterAttachment erreur %O", err)
        const reponse = {
            ok: false,
            code: 2,
            fuuid,
            err: ''+err
        }
        res.status(200).send(reponse)
    })
}

async function traiterPoster(req) {
    // const idmg = req.idmg
    // const host = req.headers.host
    const body = req.body
    debug("Message body\n%O", body)

    const pki = req.amqpdaoInst.pki

    // Verifier message incoming
    const resultat = await pki.verifierMessage(body, {tiers: true})
    debug("poster Resultat verification signature : %O", resultat)

    if ( ! await sauvegarderCle(req, body.chiffrage) ) {
        debug("Sauvegarder cle erreur")
        return {ok: false, err: 'Erreur sauvegarde cle', code: 1}
    } 
    
    if ( ! await sauvegarderMessage(req, body) ) {
        debug("Sauvegarder message erreur")
        return {ok: false, err: 'Erreur sauvegarde message', code: 2}
    }

    return {ok: true, code: 201}
}

async function sauvegarderCle(req, cleInfo) {
    debug("sauvegarderCle Cles\n%O", cleInfo)
    // chiffrage: {
    //     cles: {
    //         z2i3XjxJgyzgMSwpJ5E3xiy1wmPJF2W1moQxYnuTA1NYMrgg38N: 'mqynb5PfQGSGVWy1642c4rTTGxAoye8ieNUKKK8gNIh+2DDW2sdxwLqU5pgmXZY7KC+MwGmLgpOC5mxlCFcetaQVWqJeDufjHol1YG/pqFMo'
    //     },
    //     domaine: 'Messagerie',
    //     format: 'mgs3',
    //     hachage_bytes: 'zSEfXUD16zhzViiUuZt9PVLDXC6FeXUYnetnu1rVbkJdnqbZWJwHNDUekdqJqusT2D3yvfdDe3cy3bhdoWmKdsYCnYUNLx',
    //     identificateurs_document: { message: 'true' },
    //     iv: 'msib8pC725LbXnXKj',
    //     tag: 'mzdgV+iZVHrxiFlNY/aw+iw'
    // }

    const amqpdaoInst = req.amqpdaoInst
    for(const partition in cleInfo.cles) {
        debug("Partition : %s", partition)
        if(partition === _fingerprintCA) continue  // Skip, on utilise une partition autre que CA

        const commande = {...cleInfo}

        // Overrides
        commande.domaine = 'Messagerie'
        commande.identificateurs_document = { message: 'true' }

        debug("Commande maitre des cles vers %s:\n%O", partition, commande)
        const reponse = await amqpdaoInst.transmettreCommande('MaitreDesCles', commande, {partition, action: 'sauvegarderCle'})
        debug("Reponse sauvegarde cle :\n%O", reponse)

        if(reponse.ok === true) {
            // Cle recue et conservee, on n'a pas besoin d'emettre les autres cles
            debug("Cle conservee OK")
            return true
        }
    }

    return false
}

async function sauvegarderMessage(req, infoMessage) {
    const amqpdaoInst = req.amqpdaoInst
    const commande = {
        destinataires: infoMessage.destinataires,
        message: infoMessage.message,
    }

    debug("Commande recevoir pour messagerie :\n%O", commande)
    const reponse = await amqpdaoInst.transmettreCommande('Messagerie', commande, {action: 'recevoir'})
    debug("Reponse commande recevoir :\n%O", reponse)

    return reponse.ok === true
}

async function traiterUpload(req, res) {
    const {position, fuuid} = req.params
    debug("/poster/%s PUT position %d", fuuid, position)
  
    // const pathStaging = req.pathConsignation.consignationPathUploadStaging
  
    const modeTraitementMultiple = !isNaN(position)

    // Creer output stream
    let writer = null
    if(modeTraitementMultiple) {
        // Verifier si le repertoire existe, le creer au besoin
        const pathCorrelation = path.join(_pathStaging, fuuid + '.work')
        try {
            await fsPromises.mkdir(pathCorrelation, {recursive: true})
        } catch(err) {
            if(err.code !== 'EEXIST') {
                debug("Erreur creation repertoire staging : %O", err)
                throw err
            }
        }
        const pathFichier = path.join(pathCorrelation, position + '.part')
        writer = fs.createWriteStream(pathFichier)
    } else {
        // One-shot upload
        try {
            await fsPromises.mkdir(_pathStaging, {recursive: true})
        } catch(err) {
            if(err.code !== 'EEXIST') {
                debug("Erreur creation repertoire staging : %O", err)
                throw err
            }
        }        
        const pathFichier = path.join(_pathStaging, fuuid + '.dat.work')
        writer = fs.createWriteStream(pathFichier)
    }
  
    const promise = new Promise((resolve, reject)=>{
        let compteurData = 0
        req.on('data', data => {
            compteurData += data.length
            if(compteurData > MESSAGE_LIMIT) {
                const error = new Error("Taille PUT depasse la limite")
                error.code = 413
                reject(error)
            }
        })
        req.on('end', _=>{
            resolve()
        })
        req.on('error', err=>{
            reject(err)
        })
    })
    req.pipe(writer)

    try {
        await promise

        if(modeTraitementMultiple) {
            // Part conserve, pret pour prochain
            const reponse = {ok: true, code: 1, fuuid}
            res.status(200).send(reponse)
        } else {
            await verifierUploadSimple(req, res)
        }
    } catch(err) {
        if(err.code) {
            console.error("Taille PUT %s depasse la limite de %d", fuuid, MESSAGE_LIMIT)
            const reponse = { ok: false, code: 3, fuuid, err: ''+err }
            return res.status(err.code).send(reponse)
        } else {
            throw err
        }
    }
}

async function verifierUploadSimple(req, res) {
    const fuuid = req.params.fuuid
    const pathFichier = path.join(_pathStaging, fuuid + '.dat.work')
    const pathFichierDat = pathFichier.replace('.work', '')
    debug("Verifier hachage fichier %s", pathFichier)
    const verificateurHachage = new VerificateurHachage(fuuid)

    const fileReader = fs.createReadStream(pathFichier)
    
    let total = 0
    fileReader.on('data', chunk=>{
        // Verifier hachage
        verificateurHachage.update(chunk)
        total += chunk.length
    })
    const promise = new Promise((resolve, reject)=>{
        fileReader.on('end', _=>resolve())
        fileReader.on('error', err=>reject(err))
    })
    await promise
    debug("Taille fichier %s : %d", pathFichier, total)

    try {
        await verificateurHachage.verify()
    } catch(err) {
        debug("Fichier %s hachage invalide : %O", fuuid, err)
        const reponse = {
            ok: false,
            code: 4,
            fuuid,
            err: 'Hachage invalide'
        }
        return res.status(200).send(reponse)
    }

    await fsPromises.rename(pathFichier, pathFichierDat)
    debug("Fichier correlation %s OK", fuuid)

    try {
        // Uploader fichier immediatement
        await transfererFichierLocal(fuuid, pathFichierDat, false)

        // Completer
        const reponse = {ok: true, code: 1, fuuid}

        // Reponse fichier cree, transfert complete
        res.status(201).send(reponse)

        // Transfert complete, on efface le fichier
        fsPromises.rm(pathFichierDat)
            .catch(err=>console.error("messageriePoster.verifierUploadSimple Erreur suppression fichier (upload local complete) %s : %O", pathFichierDat, err))

    } catch(err) {
        debug("Fichier %s hachage invalide : %O", fuuid, err)
        const reponse = {
            ok: true, code: 5, fuuid,
            err: 'Delai transfert fichier local, on va reessayer plus tard.'
        }
        return res.status(202).send(reponse)
    }

}

async function traiterPostUpload(req, res) {
    const fuuid = req.params.fuuid
    const pathCorrelation = path.join(_pathStaging, fuuid + '.work')
  
    const informationFichier = req.body
    debug("Traitement post %s upload %O", fuuid, informationFichier)
  
    const verificateurHachage = new VerificateurHachage(fuuid)
  
    // Verifier le hachage
    try {
        // Trouver le nombre de fichiers/parties
        var files = await readdirp.promise(pathCorrelation, {fileFilter: '*.part'})
        if(files.length === 0) {
            // Aucuns fichiers trouves
            return res.sendStatus(404)
        }

        // Verifier le contenu de toutes les parties
        // Convertir les noms de fichier en integer
        files = files.map(file=>{
            return Number(file.path.split('.')[0])
        })
        // Trier en ordre numerique
        files.sort((a,b)=>{return a-b})

        for(let idx in files) {
            const file = files[idx]
            debug("Charger fichier %s position %d", fuuid, file)
            const pathFichier = path.join(pathCorrelation, file + '.part')
            const fileReader = fs.createReadStream(pathFichier)
    
            let total = 0
            fileReader.on('data', chunk=>{
                // Verifier hachage
                verificateurHachage.update(chunk)
                total += chunk.length
            })
    
            const promise = new Promise((resolve, reject)=>{
                fileReader.on('end', _=>resolve())
                fileReader.on('error', err=>reject(err))
            })
    
            await promise
            debug("Taille fichier %s : %d", fuuid, total)
        }
  
        await verificateurHachage.verify()
        debug("Fichier correlation %s OK", fuuid)
       
        // Fichier OK, marquer repertoire. On va le transferer vers le back-end des que possible.
        const pathReady = path.join(_pathStaging, fuuid + '.ready')
        await fsPromises.rename(pathCorrelation, pathReady)
        
        // Lancer processus d'upload (promise en parallele)
        transfererFichierLocal(fuuid, pathReady, true)
            .catch(err=>console.error("messageriePoster.traiterPostUpload Erreur upload fichier batch %s : %O", fuuid, err))

        // Code indique que le traitement n'est pas fini mais tout est OK
        const reponse = {ok: true, code: 1, fuuid}
        res.status(202).send(reponse)
  
    } catch(err) {
        console.error("ERROR uploadFichier.traiterPostUpload: Erreur de verification du hachage : %O", err)
        const reponse = {
            ok: false,
            code: 4,
            fuuid,
            err: 'Hachage invalide'
        }
        res.status(500).send(reponse)
    }
}

async function transfererFichierLocal(fuuid, pathFichier, modeTraitementMultiple) {
    debug("transfererFichierLocal modeTraitementMultiple: %s, Path %s", modeTraitementMultiple, pathFichier)
    if(modeTraitementMultiple) {
        var files = await readdirp.promise(pathFichier, {fileFilter: '*.part'})
        for(let idx in files) {
            const file = files[idx]
            const pathFichierPart = path.join(pathFichier, file.path)
            const position = Number(file.path.split('.')[0])
            debug("PUT fichier local position %d : %s", position, file.path)
            const reponsePut = await putFichierLocal(fuuid, pathFichierPart, position)
            // debug("transfererFichierLocal Reponse PUT fichier local : %O", reponse)
            if(reponsePut.status !== 200) throw new Error(`Erreur transfert put fichier local ${reponsePut.status}`)
        }
    } else {
        const reponsePut = await putFichierLocal(fuuid, pathFichier)
        // debug("transfererFichierLocal Reponse PUT fichier local : %O", reponse)
        if(reponsePut.status !== 200) throw new Error(`Erreur transfert fichier local ${reponsePut.status}`)
    }

    const reponsePost = await finaliserFichierLocal(fuuid)
    if(reponsePost.status !== 200) throw new Error(`Erreur verification fichier local ${reponsePost.status}`)
}

async function putFichierLocal(fuuid, pathFichier, position) {
    debug("transfererFichierLocal position: %s, Path %s", position, pathFichier)
    const modeTraitementMultiple = ! isNaN(position)
    const statFichier = await fsPromises.stat(pathFichier)
    const fileSize = statFichier.size
    if(fileSize > MESSAGE_LIMIT) {
        throw new Error("Erreur taille fichier : %d > MESSAGE_LIMIT", fileSize)
    }
    const headers = {
        'Content-Type': 'application/stream',
        'Content-Length': fileSize,
    }
    const readStream = fs.createReadStream(pathFichier)
    const urlFichiers = new URL(''+_urlFichiers)
    if(modeTraitementMultiple) {
        urlFichiers.pathname = path.join(urlFichiers.pathname, fuuid, ''+position)
    } else {
        urlFichiers.pathname = path.join(urlFichiers.pathname, fuuid, ''+0)
    }
    return axios({
        method: 'PUT',
        url: ''+urlFichiers,
        headers,
        data: readStream,
        httpsAgent: _httpsAgent,
        maxBodyLength: MESSAGE_LIMIT,
        timeout: TIMEOUT_LIMIT,  // 15 minutes upload limit
    })
}

async function finaliserFichierLocal(fuuid) {
    debug("finaliserFichierLocal fuuid %s", fuuid)
    const headers = {
    }
    const urlFichiers = new URL(''+_urlFichiers)
    urlFichiers.pathname = path.join(urlFichiers.pathname, fuuid)
    return axios({
        method: 'POST',
        url: ''+urlFichiers,
        headers,
        httpsAgent: _httpsAgent,
        timeout: 3 * 60 * 1000,  // 3 minutes attente limite
    })
}

module.exports = route
