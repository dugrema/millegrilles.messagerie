const debug = require('debug')('messagerie:poster')
const axios = require('axios')
const https = require('https')
const express = require('express')
const fs = require('fs')
const fsPromises = require('fs/promises')
const path = require('path')

const { VerificateurHachage } = require('@dugrema/millegrilles.nodejs/src/hachage')

const MESSAGE_LIMIT = 5 * 1024 * 1024

const jsonParser = express.json({limit: MESSAGE_LIMIT})

var _urlFichiers = null,
    _httpsAgent = null,
    _pathStaging = '/tmp/messagerieStaging'

function route(amqpdaoInst) {
    // Conserver fingerprint du certificat CA
    // Utilise pour ignorer lors de la creation de la commande MaitreDesCles
    const pki = amqpdaoInst.pki
    _fingerprintCA = pki.fingerprintCa
    debug("route Chargement certificat CA, fingerprint : %s", _fingerprintCA)

    _urlFichiers = new URL(process.env.FICHIERS)
    _httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        // ca: pki.ca,
        cert: pki.chainePEM,
        key: pki.cle,
    })
    debug("Https agent : %O", _httpsAgent)

    const route = express.Router()
    route.put('/poster/:fuuid/:position', verifierPermissionUploadAttachment, posterAttachment)
    route.put('/poster/:fuuid', verifierPermissionUploadAttachment, posterAttachment)
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
    const fuuid = req.params.fuuid
    debug("verifierPermissionUploadAttachment %s", fuuid)

    const urlFichiers = new URL(''+_urlFichiers)
    urlFichiers.pathname = urlFichiers.pathname + '/' + fuuid

    debug("Verifier existance de %O", urlFichiers)
    axios({
        method: 'HEAD',
        url: ''+urlFichiers,
        httpsAgent: _httpsAgent,
        validateStatus: validateStatusHead,
        timeout: 1500,
    })
    .then(response=>{
        const status = response.status
        debug("Reponse axios : %s", status)
        if(status === 404) {
            // Le fichier n'existe pas, on poursuit
            next()
        } else {
            const resultat = {
                ok: status === 200,
                status,
                fuuid,
                headers: response.headers,
            }
            res.status(200).send(resultat)
        }
    })
    .catch(err=>{
        console.error("messageriePoster.verifierPermissionUploadAttachment Erreur %O", err)
        res.sendStatus(503)
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
  
    // Verifier si le repertoire existe, le creer au besoin
    const pathCorrelation = path.join(_pathStaging, fuuid)
    
    const modeTraitementMultiple = position >= 0

    // Creer output stream
    let writer = null
    if(modeTraitementMultiple) {
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
        const pathFichier = path.join(pathCorrelation + '.dat')
        writer = fs.createWriteStream(pathFichier)
    }
  
    const promise = new Promise((resolve, reject)=>{
        req.on('end', _=>{
            resolve()
        })
        req.on('error', err=>{
            reject(err)
        })
    })
    req.pipe(writer)
    await promise

    if(modeTraitementMultiple) {
        // Part conserve, pret pour prochain
        const reponse = {ok: true, code: 1, fuuid}
        res.status(200).send(reponse)
    } else {
        await verifierUploadSimple(req, res)
    }
}

async function verifierUploadSimple(req, res) {
    const fuuid = req.params.fuuid
    const pathFichier = path.join(_pathStaging, fuuid + '.dat')
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
        debug("Fichier correlation %s OK", fuuid)

        // Uploader fichier immediatement

        // Completer
        const reponse = {
            ok: true,
            code: 1,
            fuuid,
        }

        // Reponse fichier cree, transfert complete
        res.status(201).send(reponse)
    } catch(err) {
        debug("Fichier %s hachage invalide : %O", fuuid, err)
        const reponse = {
            ok: false,
            code: 4,
            fuuid,
            err: 'Hachage invalide'
        }
        res.status(200).send(reponse)
    }
}

async function traiterPostUpload(req, res) {
    const fuuid = req.params.fuuid
    const pathCorrelation = path.join(_pathStaging, fuuid)
  
    const informationFichier = req.body
    debug("Traitement post %s upload %O", fuuid, informationFichier)
  
    const verificateurHachage = new VerificateurHachage(hachage)
  
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
            debug("Charger fichier %s position %d", correlation, file)
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
            debug("Taille fichier %s : %d", pathOutput, total)
        }
  
        await verificateurHachage.verify()
        debug("Fichier correlation %s OK\nhachage %s", correlation, hachage)
       
        // Fichier OK, marquer repertoire. On va le transferer vers le back-end des que possible.

        // Code indique que le traitement n'est pas fini mais tout est OK
        const reponse = {
            ok: true,
            code: 1,
            fuuid,
        }
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

module.exports = route
