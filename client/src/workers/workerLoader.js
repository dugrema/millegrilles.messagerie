import { wrap, releaseProxy } from 'comlink'

import { usagerDao } from '@dugrema/millegrilles.reactjs'
// import * as collectionsDao from '../redux/collectionsIdbDao'
// import * as uploadFichiersDao from '../redux/uploaderIdbDao'
// import * as downloadFichiersDao from '../redux/downloaderIdbDao'
// import clesDao from './clesDao'
import setupTraitementFichiers from './traitementFichiers'

let _block = false

export function setupWorkers() {
    if(_block) throw new Error("double init")
    _block = true

    // Chiffrage et x509 sont combines, reduit taille de l'application
    const connexion = wrapWorker(new Worker(new URL('./connexion.worker', import.meta.url), {type: 'module'}))
    const chiffrage = wrapWorker(new Worker(new URL('./chiffrage.worker', import.meta.url), {type: 'module'}))
    const transfertFichiers = wrapWorker(new Worker(new URL('./transfert.worker', import.meta.url), {type: 'module'}))
  
    const workerInstances = { chiffrage, connexion, transfertFichiers }
  
    const workers = Object.keys(workerInstances).reduce((acc, item)=>{
        acc[item] = workerInstances[item].proxy
        return acc
      }, {})

    // Pseudo-worker
    workers.x509 = chiffrage.proxy
    // workers.collectionsDao = collectionsDao         // IDB collections
    workers.usagerDao = usagerDao                   // IDB usager
    workers.traitementFichiers = setupTraitementFichiers(workers) // Upload et download
    // workers.clesDao = clesDao(workers)              // Cles asymetriques
    // workers.uploadFichiersDao = uploadFichiersDao   // IDB upload fichiers
    // workers.downloadFichiersDao = downloadFichiersDao  // IDB download fichiers

    const ready = wireWorkers(workers)

    return { workerInstances, workers, ready }
}

async function wireWorkers(workers) {
    const { connexion, chiffrage, transfertFichiers } = workers
    connexion.setX509Worker(chiffrage).catch(err=>console.error("Erreur chargement connexion worker : %O", err))
    transfertFichiers.down_setChiffrage(chiffrage).catch(err=>console.error("Erreur chargement transfertFichiers/down worker : %O", err))
    transfertFichiers.up_setChiffrage(chiffrage).catch(err=>console.error("Erreur chargement transfertFichiers/up worker : %O", err))

    const urlLocal = new URL(window.location.href)
    urlLocal.pathname = '/messagerie/fichiers'
    const downloadHref = urlLocal.href
    console.debug("Download path : %O", downloadHref)
    transfertFichiers.down_setUrlDownload(downloadHref)
    
    urlLocal.pathname = '/messagerie/upload'
    const uploadHref = urlLocal.href
    console.debug("Upload path : %O", uploadHref)
    transfertFichiers.up_setPathServeur('/messagerie/upload')
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


// import { wrap } from 'comlink'

// import ChiffrageWorker from './chiffrage.worker'
// import ConnexionWorker from './connexion.worker'
// import TransfertWorker from './transfert.worker'
// import * as traitementFichiers from './traitementFichiers'

// // Exemple de loader pour web workers
// export function chargerWorkers() {
//     const {worker: chiffrage} = charger(ChiffrageWorker)
//     const {worker: connexion} = charger(ConnexionWorker)
//     const {worker: transfertFichiers} = charger(TransfertWorker)

//     // Chiffrage et x509 sont combines, reduit taille de l'application
//     const x509 = chiffrage

//     const workers = {
//         chiffrage, 
//         connexion, 
//         x509,
//         transfertFichiers,

//         // Pseudo-workers
//         traitementFichiers,
//     }

//     // Wiring
//     try {
//         traitementFichiers.setWorkers(workers)
//     } catch(err) {
//         console.error("Erreur chargement traitementFichiers : %O", err)
//     }
//     connexion.setX509Worker(chiffrage).catch(err=>console.error("Erreur chargement connexion worker : %O", err))
//     transfertFichiers.down_setChiffrage(chiffrage).catch(err=>console.error("Erreur chargement transfertFichiers/down worker : %O", err))
//     transfertFichiers.up_setChiffrage(chiffrage).catch(err=>console.error("Erreur chargement transfertFichiers/up worker : %O", err))

//     const urlLocal = new URL(window.location.href)
//     urlLocal.pathname = '/messagerie/fichiers'
//     const downloadHref = urlLocal.href
//     console.debug("Download path : %O", downloadHref)
//     transfertFichiers.down_setUrlDownload(downloadHref)
    
//     urlLocal.pathname = '/messagerie/upload'
//     const uploadHref = urlLocal.href
//     console.debug("Upload path : %O", uploadHref)
//     transfertFichiers.up_setPathServeur('/messagerie/upload')

//     return workers
// }

// function charger(ClasseWorker) {
//     const instance = new ClasseWorker()
//     const worker = wrap(instance)
//     return {instance, worker}
// }