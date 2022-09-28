import { createSlice, isAnyOf, createListenerMiddleware } from '@reduxjs/toolkit'
import path from 'path'
import { proxy } from 'comlink'

const CACHE_TEMP_NAME = 'fichiersDechiffresTmp',
      DECHIFFRAGE_TAILLE_BLOCK = 64 * 1024,
      SLICE_NAME = 'downloader',
      STORE_DOWNLOADS = 'downloads',
      EXPIRATION_CACHE_MS = 24 * 60 * 60 * 1000,
      CONST_PROGRESS_UPDATE_THRESHOLD = 10 * 1024 * 1024,
      CONST_PROGRESS_UPDATE_INTERVAL = 1000

const ETAT_PRET = 1,
      ETAT_EN_COURS = 2,
      ETAT_SUCCES = 3,
      ETAT_ECHEC = 4
      
const initialState = {
    liste: [],                  // Liste de fichiers en traitement (tous etats confondus)
    userId: '',                 // UserId courant, permet de stocker plusieurs users localement
    progres: null,              // Pourcentage de progres en int
    completesCycle: [],         // Conserve la liste des uploads completes qui restent dans le total de progres
}

// Actions

function setUserIdAction(state, action) {
    state.userId = action.payload
}

function setDownloadsAction(state, action) {
    // Merge listes
    const listeDownloads = action.payload
    const listeExistanteMappee = state.liste.reduce((acc, item)=>{
        acc[item.fuuid] = item
        return acc
    }, {})

    // Retirer les uploads connus
    const nouvelleListe = listeDownloads.filter(item=>!listeExistanteMappee[item.fuuid])
    
    // Push les items manquants a la fin de la liste
    nouvelleListe.forEach(item=>state.liste.push(item))
    
    const { pourcentage } = calculerPourcentage(state.liste, [])

    state.liste.sort(sortDateCreation)
    state.completesCycle = []
    state.progres = pourcentage
}

function pushDownloadAction(state, action) {
    const docDownload = action.payload

    console.debug("pushDownloadAction payload : ", docDownload)
    state.liste.push(docDownload)

    const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
    state.progres = pourcentage
}

function updateDownloadAction(state, action) {
    const docDownload = action.payload
    const fuuid = docDownload.fuuid

    // Trouver objet existant
    const infoDownload = state.liste.filter(item=>item.fuuid === fuuid).pop()

    // Detecter changement etat a confirme
    if(docDownload.etat === ETAT_SUCCES) {
        state.completesCycle.push(fuuid)
    }

    if(!infoDownload) state.liste.push(infoDownload)    // Append
    else Object.assign(infoDownload, docDownload)       // Merge

    const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
    state.progres = pourcentage
}

function continuerDownloadAction(state, action) {
    const docDownload = action.payload
    
    // docDownload peut etre null si on fait juste redemarrer le middleware
    if(docDownload) {
        const fuuid = docDownload.fuuid

        // Trouver objet existant
        const infoDownload = state.liste.filter(item=>item.fuuid === fuuid).pop()

        if(!infoDownload) state.liste.push(infoDownload)    // Append
        else Object.assign(infoDownload, docDownload)       // Merge
    }

    const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
    state.progres = pourcentage
}

function retirerDownloadAction(state, action) {
    const fuuid = action.payload
    state.liste = state.liste.filter(item=>item.fuuid !== fuuid)

    const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
    state.progres = pourcentage
}

function clearDownloadsAction(state, action) {
    state.liste = []
    state.progres = null
}

function supprimerDownloadAction(state, action) {
    const fuuid = action.payload
    state.liste = state.liste.filter(item=>item.fuuid !== fuuid)
}

function arretDownloadAction(state, action) {
    // Middleware trigger seulement
}

function clearCycleDownloadAction(state, action) {
    state.completesCycle = []
}

const downloaderSlice = createSlice({
    name: SLICE_NAME,
    initialState,
    reducers: {
        setUserId: setUserIdAction,
        setDownloads: setDownloadsAction,
        pushDownload: pushDownloadAction,
        continuerDownload: continuerDownloadAction,
        retirerDownload: retirerDownloadAction,
        clearDownloads: clearDownloadsAction,
        supprimerDownload: supprimerDownloadAction,
        arretDownload: arretDownloadAction,
        clearCycleDownload: clearCycleDownloadAction,
        updateDownload: updateDownloadAction,
    }
})

export const { 
    setUserId, setDownloads, 
    pushDownload, continuerDownload, retirerDownload, arretDownload,
    clearDownloads, clearCycleDownload,
    updateDownload, supprimerDownload,
} = downloaderSlice.actions
export default downloaderSlice.reducer

// Thunks

export function ajouterDownload(workers, docDownload) {
    return (dispatch, getState) => traiterAjouterDownload(workers, docDownload, dispatch, getState)
}

async function traiterAjouterDownload(workers, docDownload, dispatch, getState) {
    const { downloadFichiersDao, clesDao } = workers
    
    // console.debug("traiterCompleterDownload ", fuuid)
    console.debug("traiterAjouterDownload payload : ", docDownload)
    
    const userId = getState()[SLICE_NAME].userId
    if(!userId) throw new Error("userId n'est pas initialise dans downloaderSlice")

    const fuuid = docDownload.fuuid || docDownload.fuuid_v_courante
    const version_courante = docDownload.version_courante || {}
    const taille = version_courante.taille
    const infoDownload = getState()[SLICE_NAME].liste.filter(item=>item.fuuid === fuuid).pop()
    console.debug("ajouterDownloadAction fuuid %s info existante %O", fuuid, infoDownload)
    if(!infoDownload) {
        // Ajouter l'upload, un middleware va charger le reste de l'information
        // console.debug("Ajout upload %O", correlation)

        await clesDao.getCles([fuuid])  // Fetch pour cache (ne pas stocker dans redux)

        const nouveauDownload = {
            ...docDownload,
            fuuid,
            taille,
            userId,
            etat: ETAT_PRET,
            dateCreation: new Date().getTime(),
        }

        // Conserver le nouveau download dans IDB
        await downloadFichiersDao.updateFichierDownload(nouveauDownload)

        dispatch(pushDownload(nouveauDownload))
    } else {
        throw new Error(`Download ${fuuid} existe deja`)
    }    
}

export function arreterDownload(workers, fuuid) {
    return (dispatch, getState) => traiterArreterDownload(workers, fuuid, dispatch, getState)
}

async function traiterArreterDownload(workers, fuuid, dispatch, getState) {
    // console.debug("traiterCompleterDownload ", fuuid)
    const { downloadFichiersDao, transfertFichiers } = workers
    const state = getState()[SLICE_NAME]
    const download = state.liste.filter(item=>item.fuuid===fuuid).pop()
    if(download) {
        
        // Arreter et retirer download state (interrompt le middleware au besoin)
        dispatch(supprimerDownload(fuuid))

        await transfertFichiers.down_supprimerDownloadsCache(fuuid)

        // Supprimer le download dans IDB, cache
        await downloadFichiersDao.supprimerDownload(fuuid)
    }
}

export function completerDownload(workers, fuuid) {
    return (dispatch, getState) => traiterCompleterDownload(workers, fuuid, dispatch, getState)
}

async function traiterCompleterDownload(workers, fuuid, dispatch, getState) {
    // console.debug("traiterCompleterDownload ", fuuid)
    const { downloadFichiersDao, traitementFichiers } = workers
    const state = getState()[SLICE_NAME]
    const download = state.liste.filter(item=>item.fuuid===fuuid).pop()
    if(download) {
        const downloadCopie = {...download}
        downloadCopie.etat = ETAT_SUCCES
        downloadCopie.dateConfirmation = new Date().getTime()
        downloadCopie.tailleCompletee = downloadCopie.taille

        // Maj contenu download
        await downloadFichiersDao.updateFichierDownload(downloadCopie)

        // Maj redux state
        dispatch(updateDownload(downloadCopie))

        try {
            // Prompt sauvegarder
            console.debug("TraitementFichiers ", traitementFichiers)
            const fuuid = download.fuuid,
                filename = download.nom
            await traitementFichiers.downloadCache(fuuid, {filename})
        } catch(err) {
            console.warn("Erreur prompt pour sauvgarder fichier downloade ", err)
        }
    }
}

export function supprimerDownloadsParEtat(workers, etat) {
    return (dispatch, getState) => traiterSupprimerDownloadsParEtat(workers, etat, dispatch, getState)
}

async function traiterSupprimerDownloadsParEtat(workers, etat, dispatch, getState) {
    const { downloadFichiersDao, transfertFichiers } = workers
    const downloads = getState()[SLICE_NAME].liste.filter(item=>item.etat === etat)
    for await (const download of downloads) {
        const fuuid = download.fuuid

        // Arreter et retirer download state (interrompt le middleware au besoin)
        dispatch(supprimerDownload(fuuid))

        await transfertFichiers.down_supprimerDownloadsCache(fuuid)

        // Supprimer le download dans IDB, cache
        await downloadFichiersDao.supprimerDownload(fuuid)
    }
}

// Middleware
export function downloaderMiddlewareSetup(workers) {
    const uploaderMiddleware = createListenerMiddleware()
    
    uploaderMiddleware.startListening({
        matcher: isAnyOf(ajouterDownload, setDownloads, continuerDownload),
        effect: (action, listenerApi) => downloaderMiddlewareListener(workers, action, listenerApi)
    }) 
    
    return uploaderMiddleware
}

async function downloaderMiddlewareListener(workers, action, listenerApi) {
    //console.debug("downloaderMiddlewareListener running effect, action : %O, listener : %O", action, listenerApi)
    // console.debug("Arret upload info : %O", arretUpload)

    await listenerApi.unsubscribe()
    try {
        // Reset liste de fichiers completes utilises pour calculer pourcentage upload
        listenerApi.dispatch(clearCycleDownload())

        const task = listenerApi.fork( forkApi => tacheDownload(workers, listenerApi, forkApi) )
        const stopAction = listenerApi.condition(arretDownload.match)
        await Promise.race([task.result, stopAction])

        // console.debug("downloaderMiddlewareListener Task %O\nstopAction %O", task, stopAction)
        task.result.catch(err=>console.error("Erreur task : %O", err))
        // stopAction
        //     .then(()=>task.cancel())
        //     .catch(()=>{
        //         // Aucun impact
        //     })

        const resultat = await task.result  // Attendre fin de la tache en cas d'annulation
        // console.debug("downloaderMiddlewareListener Sequence download terminee, resultat %O", resultat)
    } finally {
        await listenerApi.subscribe()
    }
}

async function tacheDownload(workers, listenerApi, forkApi) {
    // console.debug("Fork api : %O", forkApi)
    const dispatch = listenerApi.dispatch

    let nextDownload = getProchainDownload(listenerApi.getState()[SLICE_NAME].liste)

    const cancelToken = {cancelled: false}
    const aborted = event => {
        // console.debug("Aborted ", event)
        cancelToken.cancelled = true
    }
    forkApi.signal.onabort = aborted

    if(!nextDownload) return  // Rien a faire

    // Commencer boucle d'upload
    while(nextDownload) {
        console.debug("Next download : %O", nextDownload)
        const fuuid = nextDownload.fuuid
        try {
            await downloadFichier(workers, dispatch, nextDownload, cancelToken)

            // Trouver prochain upload
            if (forkApi.signal.aborted) {
                // console.debug("tacheUpload annulee")
                marquerDownloadEtat(workers, dispatch, fuuid, {etat: ETAT_ECHEC})
                    .catch(err=>console.error("Erreur marquer upload echec %s : %O", fuuid, err))
                return
            }
            nextDownload = getProchainDownload(listenerApi.getState()[SLICE_NAME].liste)

        } catch (err) {
            console.error("Erreur tache download fuuid %s: %O", fuuid, err)
            marquerDownloadEtat(workers, dispatch, fuuid, {etat: ETAT_ECHEC})
                .catch(err=>console.error("Erreur marquer upload echec %s : %O", fuuid, err))
            throw err
        }
    }
}

async function downloadFichier(workers, dispatch, fichier, cancelToken) {
    // console.debug("Upload fichier workers : ", workers)
    const { transfertFichiers, clesDao } = workers
    const fuuid = fichier.fuuid

    // await marquerDownloadEtat(workers, dispatch, fuuid, {etat: ETAT_EN_COURS})
    const cles = await clesDao.getCles([fuuid])  // Fetch pour cache (ne pas stocker dans redux)
    const valueCles = Object.values(cles).pop()
    delete valueCles.date
    // valueCles.cleSecrete = base64.encode(valueCles.cleSecrete)

    // transfertFichiers.download() ...
    const frequenceUpdate = 500
    let dernierUpdate = 0
    const progressCb = proxy( tailleCompletee => {
        const now = new Date().getTime()
        if(now - frequenceUpdate > dernierUpdate) {
            dernierUpdate = now
            marquerDownloadEtat(workers, dispatch, fuuid, {tailleCompletee})
                .catch(err=>console.warn("progressCb Erreur maj download ", err))
        }
    })

    const url = ''+fuuid
    const paramsDownload = {
        url,
        fuuid, hachage_bytes: fuuid, filename: fichier.nom, mimetype: fichier.mimetype,
        password: valueCles.cleSecrete, ...valueCles,
    }
    console.debug("Params download : ", paramsDownload)
    const resultat = await transfertFichiers.downloadCacheFichier(paramsDownload, progressCb)
    console.debug("Resultat download fichier : ", resultat)

    if(cancelToken && cancelToken.cancelled) {
        console.warn("Upload cancelled")
        return
    }

    // Upload complete, dispatch nouvel etat
    await marquerDownloadEtat(workers, dispatch, fuuid, {etat: ETAT_SUCCES})
    await dispatch(completerDownload(workers, fuuid))
        .catch(err=>console.error("Erreur cleanup fichier upload ", err))
}

async function marquerDownloadEtat(workers, dispatch, fuuid, etat) {
    const contenu = {fuuid, ...etat}
    const { downloadFichiersDao } = workers
    await downloadFichiersDao.updateFichierDownload(contenu)
    return dispatch(updateDownload(contenu))
}

function getProchainDownload(liste) {
    // console.debug("Get prochain upload pre-tri ", liste)
    const listeCopie = liste.filter(item=>item.etat === ETAT_PRET)
    listeCopie.sort(trierListeDownload)
    // console.debug("Get prochain upload : ", listeCopie)
    return listeCopie.shift()
}

function sortDateCreation(a, b) {
    if(a === b) return 0
    if(!a) return 1
    if(!b) return -1

    const dcA = a.dateCreation,
          dcB = b.dateCreation
    
    if(dcA === dcB) return 0
    if(!dcA) return 1
    if(!dcB) return -1

    return dcA - dcB
}

function calculerPourcentage(liste, completesCycle) {
    let tailleTotale = 0, 
        tailleCompleteeTotale = 0

    const inclureEtats = [ETAT_PRET, ETAT_ECHEC, ETAT_EN_COURS]
    liste.forEach( download => {
        const { fuuid, etat, tailleCompletee, taille } = download

        let inclure = false
        if(inclureEtats.includes(etat)) inclure = true
        else if(ETAT_SUCCES === etat && completesCycle.includes(fuuid)) inclure = true

        if(inclure) {
            tailleCompleteeTotale += tailleCompletee
            tailleTotale += taille
        }
    })

    const pourcentage = Math.floor(100 * tailleCompleteeTotale / tailleTotale)

    return {total: tailleTotale, complete: tailleCompleteeTotale, pourcentage}
}

export function trierListeDownload(a, b) {
    if(a === b) return 0
    if(!a) return 1
    if(!b) return -1

    // // Trier par taille completee (desc)
    // const tailleCompleteeA = a.tailleCompletee,
    //       tailleCompleteeB = b.tailleCompletee
    // if(tailleCompleteeA !== tailleCompleteeB) {
    //     if(!tailleCompleteeA) return 1
    //     if(!tailleCompleteeB) return -1
    //     return tailleCompleteeB - tailleCompleteeA
    // }

    // Trier par date de creation
    const dateCreationA = a.dateCreation,
          dateCreationB = b.dateCreation
    // if(dateCreationA === dateCreationB) return 0
    if(dateCreationA !== dateCreationB) return dateCreationA - dateCreationB
    if(!dateCreationA) return 1
    if(!dateCreationB) return -1

    const cA = a.correlation,
          cB = b.correlation
    return cA.localeCompare(cB)
}
