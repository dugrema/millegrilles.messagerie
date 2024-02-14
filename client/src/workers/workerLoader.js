import { wrap, proxy, releaseProxy } from 'comlink'

import { usagerDao } from '@dugrema/millegrilles.reactjs'
// import * as collectionsDao from '../redux/collectionsIdbDao'
import * as messagerieDao from '../redux/messagerieIdbDao'
// import * as uploadFichiersDao from '../redux/uploaderIdbDao'
// import * as downloadFichiersDao from '../redux/downloaderIdbDao'
import clesDao from './clesDao'
// import setupTraitementFichiers from './traitementFichiers'

let _block = false

export function setupWorkers() {
    if(_block) throw new Error("double init")
    _block = true

    // Chiffrage et x509 sont combines, reduit taille de l'application
    const connexion = wrapWorker(new Worker(new URL('./connexion.worker', import.meta.url), {type: 'module'}))
    const chiffrage = wrapWorker(new Worker(new URL('./chiffrage.worker', import.meta.url), {type: 'module'}))
    // const transfertFichiers = wrapWorker(new Worker(new URL('./transfert.worker', import.meta.url), {type: 'module'}))
  
    const workerInstances = { 
        chiffrage, connexion,
        //, transfertFichiers
    }
  
    const workers = Object.keys(workerInstances).reduce((acc, item)=>{
        acc[item] = workerInstances[item].proxy
        return acc
      }, {})

    // Pseudo-worker
    workers.x509 = chiffrage.proxy
    workers.messagerieDao = messagerieDao           // IDB messagerie
    workers.usagerDao = usagerDao                   // IDB usager
    // workers.traitementFichiers = setupTraitementFichiers(workers) // Upload et download
    workers.clesDao = clesDao(workers)              // Cles asymetriques
    // workers.collectionsDao = collectionsDao            // IDB collections fichiers
    // workers.uploadFichiersDao = uploadFichiersDao      // IDB upload fichiers
    // workers.downloadFichiersDao = downloadFichiersDao  // IDB download fichiers

    const ready = wireWorkers(workers)

    return { workerInstances, workers, ready }
}

async function wireWorkers(workers) {
    const { connexion, chiffrage, 
        // transfertFichiers,
    } = workers
    
    try {
        // console.debug("wireWorkers configuration transfertFichiers")
        // await transfertFichiers.up_setChiffrage(chiffrage) //.catch(err=>console.error("Erreur chargement transfertFichiers/up worker : %O", err))

        // await transfertFichiers.down_setChiffrage(chiffrage) //.catch(err=>console.error("Erreur chargement transfertFichiers/down worker : %O", err))

        // const urlLocal = new URL(window.location.href)
        // urlLocal.pathname = '/messagerie/fichiers'
        // const downloadHref = urlLocal.href
        // console.info("wireWorkers Download path : %O", downloadHref)
        // transfertFichiers.down_setUrlDownload(downloadHref)
        
        // urlLocal.pathname = '/messagerie/upload'
        // const uploadHref = urlLocal.href
        // console.info("wireWorkers Upload path : %O", uploadHref)
        // transfertFichiers.up_setPathServeur('/messagerie/upload')

        const location = new URL(window.location)
        location.pathname = '/fiche.json'
        // console.debug("Charger fiche ", location.href)
      
        const axiosImport = await import('axios')
        const axios = axiosImport.default
        const reponse = await axios.get(location.href)
        // console.debug("Reponse fiche ", reponse)
        const data = reponse.data || {}
        const fiche = JSON.parse(data.contenu)
        console.debug("Reponse fiche ", fiche)
        const ca = fiche.ca
        if(ca) {
            // console.debug("initialiserCertificateStore (connexion, chiffrage)")
            await Promise.all([
                connexion.initialiserCertificateStore(ca, {isPEM: true, DEBUG: false}),
                chiffrage.initialiserCertificateStore(ca, {isPEM: true, DEBUG: false})
            ])
        } else {
            throw new Error("Erreur initialisation - fiche/CA non disponible")
        }

    } catch(err) {
        console.error("wireWorkers Erreur preparation workers ", err)
        throw err
    }
}

function wrapWorker(worker) {
    const proxy = wrap(worker)
    return {proxy, worker}
}

export function cleanupWorkers(workers) {
    Object.values(workers).forEach((workerInstance) => {
        try {
            const {worker, proxy} = workerInstance
            proxy[releaseProxy]()
            worker.terminate()
        } catch(err) {
            console.warn("Errreur fermeture worker : %O\n(Workers: %O)", err, workers)
        }
    })
}
