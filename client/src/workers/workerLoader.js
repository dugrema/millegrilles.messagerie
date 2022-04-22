import { wrap } from 'comlink'

import ChiffrageWorker from './chiffrage.worker'
import ConnexionWorker from './connexion.worker'
import TransfertWorker from './transfert.worker'
import * as traitementFichiers from './traitementFichiers'

// Exemple de loader pour web workers
export function chargerWorkers() {
    const {worker: chiffrage} = charger(ChiffrageWorker)
    const {worker: connexion} = charger(ConnexionWorker)
    const {worker: transfertFichiers} = charger(TransfertWorker)

    // Chiffrage et x509 sont combines, reduit taille de l'application
    const x509 = chiffrage

    const workers = {
        chiffrage, 
        connexion, 
        x509,
        transfertFichiers,

        // Pseudo-workers
        traitementFichiers,
    }

    // Wiring
    try {
        traitementFichiers.setWorkers(workers)
    } catch(err) {
        console.error("Erreur chargement traitementFichiers : %O", err)
    }
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

    return workers
}

function charger(ClasseWorker) {
    const instance = new ClasseWorker()
    const worker = wrap(instance)
    return {instance, worker}
}