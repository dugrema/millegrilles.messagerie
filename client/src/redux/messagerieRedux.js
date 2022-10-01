import { base64 } from 'multiformats/bases/base64'
import { createSlice, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'

const SOURCE_INBOX = 'inbox',
      SOURCE_OUTBOX = 'outbox',
      SOURCE_CORBEILLE = 'corbeille'

const SAFEGUARD_BATCH_MAX = 1000,
      CONST_SYNC_BATCH_SIZE = 250

const initialState = {
    // Usager
    userId: '',                 // UserId courant, permet de stocker plusieurs users localement
    adresseUsager: '',          // Adresse du serveur local, utilise comme source du message

    // Liste a l'ecran
    source: SOURCE_INBOX,       // Source de la requete - inbox, corbeille, outbox, custom
    sortKeys: {key: 'sujet', ordre: 1}, // Ordre de tri
    liste: null,                // Liste triee de fichiers
    breadcrumb: [],             // Breadcrumb du path de la source affichee
    intervalle: null,           // Intervalle de temps des donnees (filtre)
    selection: null,            // Messages selectionnes
    uuidMessageActif: null,     // Message actif

    // Travail background
    listeDechiffrage: [],       // Liste de messages a dechiffrer
    mergeVersion: 0,            // Utilise pour flagger les changements
}

// Actions

function setUserIdAction(state, action) {
    state.userId = action.payload
}

function setSortKeysAction(state, action) {
    const sortKeys = action.payload
    state.sortKeys = sortKeys
    if(state.liste) state.liste.sort(genererTriListe(sortKeys))
}

function setSourceAction(state, action) {
    state.source = action.payload
    state.intervalle = null
    state.breadcrumb = []
    state.liste = null
}

function setIntervalleAction(state, action) {
    state.intervalle = action.payload
}

function pushMessagesAction(state, action) {
    const mergeVersion = state.mergeVersion
    state.mergeVersion++

    let {liste: payload, clear} = action.payload
    if(clear === true) state.liste = []  // Reset liste

    let liste = state.liste || []
    if( Array.isArray(payload) ) {
        const ajouts = payload.map(item=>{return {...item, '_mergeVersion': mergeVersion}})
        // console.debug("pushAction ajouter ", ajouts)
        liste = liste.concat(ajouts)
    } else {
        const ajout = {...payload, '_mergeVersion': mergeVersion}
        // console.debug("pushAction ajouter ", ajout)
        liste.push(ajout)
    }

    // Trier
    liste.sort(genererTriListe(state.sortKeys))
    // console.debug("pushAction liste triee : %O", liste)

    state.liste = liste
}

function clearMessagesAction(state) {
    state.liste = null
}

// payload {tuuid, data, images, video}
function mergeMessagesDataAction(state, action) {
    const mergeVersion = state.mergeVersion
    state.mergeVersion++

    let payload = action.payload
    if(!Array.isArray(payload)) {
        payload = [payload]
    }

    console.error("mergeMessagesDataAction Not implemented")
    
    // Trier
    state.liste.sort(genererTriListe(state.sortKeys))
}

// Ajouter des messages a la liste a dechiffrer
function pushMessagesChiffresAction(state, action) {
    const fichiers = action.payload
    state.listeDechiffrage = [...state.listeDechiffrage, ...fichiers]
}

function setMessagesChiffresAction(state, action) {
    state.listeDechiffrage = action.payload
}

// Retourne un fichier de la liste a dechiffrer
function clearMessagesChiffresAction(state) {
    state.listeDechiffrage = []
}

function selectionMessagesAction(state, action) {
    state.selection = action.payload
}

// Slice collection

export function creerSlice(name) {

    return createSlice({
        name,
        initialState,
        reducers: {
            setUserId: setUserIdAction,
            pushMessages: pushMessagesAction, 
            // supprimer: supprimerAction,
            clearMessages: clearMessagesAction,
            mergeMessagesData: mergeMessagesDataAction,
            setSortKeys: setSortKeysAction,
            setSource: setSourceAction,
            setIntervalle: setIntervalleAction,
            pushMessagesChiffres: pushMessagesChiffresAction,
            clearMessagesChiffres: clearMessagesChiffresAction,
            selectionMessages: selectionMessagesAction,
            setMessagesChiffres: setMessagesChiffresAction,
        }
    })

}

export function creerThunks(actions, nomSlice) {

    // Action creators are generated for each case reducer function
    const { 
        setUserId, 
        // setCuuid, 
        pushMessages, clearMessages, mergeMessagesData,
        breadcrumbPush, breadcrumbSlice, 
        setSortKeys, setSourceMessages, setIntervalle,
        pushMessagesChiffres, clearMessagesChiffres, selectionMessages,
        setMessagesChiffres,
        // supprimer, 
    } = actions

    console.error("creerThunks Not implemented")

    // Async actions
    function changerDossier(workers, sourceMessages, uuidDossier) {
        return (dispatch, getState) => traiterChangerDossier(workers, sourceMessages, uuidDossier, dispatch, getState)
    }
    
    async function traiterChangerDossier(workers, sourceMessages, uuidDossier, dispatch, getState) {
        const state = getState()[nomSlice]
        const sourcePrecedente = state.source,
              uuidPrecedent = state.uuidDossier
        // console.debug("Cuuid precedent : %O, nouveau : %O", cuuidPrecedent, cuuid)
    
        if(sourcePrecedente === sourceMessages && uuidPrecedent === uuidDossier) return  // Rien a faire, meme source/dossier
    
        dispatch(setSourceMessages(sourceMessages, uuidDossier))
    
        return traiterRafraichirMessages(workers, dispatch, getState)
    }

    async function traiterRafraichirMessages(workers, dispatch, getState, promisesPreparationDossier) {
        // console.debug('traiterRafraichirCollection')
        const { collectionsDao } = workers
    
        const state = getState()[nomSlice]
        const { userId, cuuid } = state
    
        // console.debug("Rafraichir '%s' pour userId", cuuid, userId)
    
        // Nettoyer la liste
        dispatch(clearMessages())
    
        console.error("todo")

        // // Charger le contenu de la collection deja connu
        // promisesPreparationDossier = promisesPreparationDossier || []
        // promisesPreparationDossier.push(collectionsDao.getParCollection(cuuid, userId))
    
        // // Attendre que les listeners soient prets, recuperer contenu idb
        // const contenuIdb = (await Promise.all(promisesPreparationDossier)).pop()
    
        // // Pre-charger le contenu de la liste de fichiers avec ce qu'on a deja dans idb
        // // console.debug("Contenu idb : %O", contenuIdb)
        // if(contenuIdb) {
        //     const { documents, collection } = contenuIdb
        //     // console.debug("Push documents provenance idb : %O", documents)
        //     dispatch(setCollectionInfo(collection))
        //     dispatch(push({liste: documents}))
    
        //     // Detecter les documents connus qui sont dirty ou pas encore dechiffres
        //     const tuuids = documents.filter(item=>item.dirty||!item.dechiffre).map(item=>item.tuuid)
        //     if(tuuids.length > 0) {
        //         dispatch(chargerTuuids(workers, tuuids))
        //             .catch(err=>console.error("Erreur traitement tuuids %O : %O", tuuids, err))
        //     }
        // }
    
        // let compteur = 0
        // for(var cycle=0; cycle<SAFEGUARD_BATCH_MAX; cycle++) {
        //     let resultatSync = await syncCollection(dispatch, workers, cuuid, CONST_SYNC_BATCH_SIZE, compteur)
        //     // console.debug("Sync collection (cycle %d) : %O", cycle, resultatSync)
        //     if( ! resultatSync || ! resultatSync.liste ) break
        //     compteur += resultatSync.liste.length
        //     if( resultatSync.complete ) break
        // }
        // if(cycle === SAFEGUARD_BATCH_MAX) throw new Error("Detection boucle infinie dans syncCollection")
    
        // On marque la fin du chargement/sync
        dispatch(pushMessages({liste: []}))
    }

    const thunks = { 
        changerDossier,
    }

    return thunks
}

export function creerMiddleware(workers, actions, thunks, nomSlice) {
    // Setup du middleware
    const dechiffrageMiddleware = createListenerMiddleware()

    dechiffrageMiddleware.startListening({
        matcher: isAnyOf(actions.pushMessagesChiffres),
        effect: (action, listenerApi) => dechiffrageMiddlewareListener(workers, actions, thunks, nomSlice, action, listenerApi)
    }) 
    
    return { dechiffrageMiddleware }
}

async function dechiffrageMiddlewareListener(workers, actions, _thunks, nomSlice, action, listenerApi) {
    console.debug("dechiffrageMiddlewareListener running effect, action : %O, listener : %O", action, listenerApi)
    const getState = () => listenerApi.getState()[nomSlice]

    const { clesDao, chiffrage, collectionsDao } = workers
    await listenerApi.unsubscribe()
    try {
        console.error("dechiffrageMiddlewareListener Not implemented")
    } finally {
        await listenerApi.subscribe()
    }
}

function genererTriListe(sortKeys) {
    
    const key = sortKeys.key || 'nom',
          ordre = sortKeys.ordre || 1

    return (a, b) => {
        if(a === b) return 0
        if(!a) return 1
        if(!b) return -1

        let valA = a[key], valB = b[key]
        if(key === 'dateFichier') {
            valA = a.dateFichier || a.derniere_modification || a.date_creation
            valB = b.dateFichier || b.derniere_modification || b.date_creation
        } else if(key === 'taille') {
            const version_couranteA = a.version_courante || {},
                  version_couranteB = b.version_courante || {}
            valA = version_couranteA.taille || a.taille
            valB = version_couranteB.taille || b.taille
        }

        if(valA === valB) return 0
        if(!valA) return 1
        if(!valB) return -1

        if(typeof(valA) === 'string') {
            const diff = valA.localeCompare(valB)
            if(diff) return diff * ordre
        } else if(typeof(valA) === 'number') {
            const diff = valA - valB
            if(diff) return diff * ordre
        } else {
            throw new Error(`genererTriListe values ne peut pas etre compare ${''+valA} ? ${''+valB}`)
        }

        // Fallback, nom/tuuid du fichier
        const { tuuid: tuuidA, nom: nomA } = a,
              { tuuid: tuuidB, nom: nomB } = b

        const labelA = nomA || tuuidA,
              labelB = nomB || tuuidB
        
        const compLabel = labelA.localeCompare(labelB)
        if(compLabel) return compLabel * ordre

        // Fallback, tuuid (doit toujours etre different)
        return tuuidA.localeCompare(tuuidB) * ordre
    }
}
