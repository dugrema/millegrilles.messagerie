import { createSlice, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'

const SAFEGUARD_BATCH_MAX = 1000,
      CONST_SYNC_BATCH_SIZE = 250

const initialState = {
    // Usager
    userId: null,               // UserId courant, permet de stocker plusieurs users localement
    profil: null,               // Profil de l'usager
    cleSecreteProfil: null,     // Cle secrete pour chiffrer/dechiffrer contenu du profil et contacts

    // Liste a l'ecran
    sortKeys: {key: 'sujet', ordre: 1}, // Ordre de tri
    liste: null,                // Liste triee de fichiers
    selection: null,            // Contacts selectionnes
    uuidContactActif: null,     // Contact affiche/actif a l'ecran

    // Travail background
    listeDechiffrage: [],       // Liste de messages a dechiffrer
    mergeVersion: 0,            // Utilise pour flagger les changements
}

// Actions

function setUserIdAction(state, action) {
    state.userId = action.payload
}

function setProfilAction(state, action) {
    state.profil = action.payload
}

function setCleSecreteProfilAction(state, action) {
    state.cleSecreteProfil = action.payload
}

function setSortKeysAction(state, action) {
    const sortKeys = action.payload
    state.sortKeys = sortKeys
    if(state.liste) state.liste.sort(genererTriListe(sortKeys))
}

function pushContactsAction(state, action) {
    const mergeVersion = state.mergeVersion
    state.mergeVersion++

    let {liste: payload, clear} = action.payload
    if(clear === true) state.liste = []  // Reset liste

    let liste = state.liste || []
    if( Array.isArray(payload) ) {
        const ajouts = payload.map(item=>{return {...item, '_mergeVersion': mergeVersion}})
        liste = liste.concat(ajouts)
    } else {
        const ajout = {...payload, '_mergeVersion': mergeVersion}
        liste.push(ajout)
    }

    // Trier
    liste.sort(genererTriListe(state.sortKeys))

    state.liste = liste
}

function clearContactsAction(state) {
    state.liste = null
}

function mergeContactsDataAction(state, action) {
    const mergeVersion = state.mergeVersion
    state.mergeVersion++

    let payload = action.payload
    if(!Array.isArray(payload)) {
        payload = [payload]
    }

    for (const payloadMessage of payload) {
        console.debug("mergeContactsDataAction action: %O, cuuid courant: %O", action, state.cuuid)
        throw new Error("fix me")
    }

    // Trier
    state.liste.sort(genererTriListe(state.sortKeys))
}

// Ajouter des contacts a la liste a dechiffrer
function pushContactsChiffresAction(state, action) {
    const items = action.payload
    state.listeDechiffrage = [...state.listeDechiffrage, ...items]
}

function setContactsChiffresAction(state, action) {
    state.listeDechiffrage = action.payload
}

// Retourne un fichier de la liste a dechiffrer
function clearContactsChiffresAction(state) {
    state.listeDechiffrage = []
}

function selectionContactsAction(state, action) {
    state.selection = action.payload
}

function setContactActifAction(state, action) {
    state.uuidContactActif = action.payload
}

// Slice collection

export function creerSlice(name) {

    return createSlice({
        name,
        initialState,
        reducers: {
            setUserId: setUserIdAction,
            setProfil: setProfilAction,
            setCleSecreteProfil: setCleSecreteProfilAction,
            pushContacts: pushContactsAction, 
            // supprimer: supprimerAction,
            clearContacts: clearContactsAction,
            mergeContactsData: mergeContactsDataAction,
            setSortKeys: setSortKeysAction,
            pushContactsChiffres: pushContactsChiffresAction,
            clearContactsChiffres: clearContactsChiffresAction,
            selectionContacts: selectionContactsAction,
            setContactsChiffres: setContactsChiffresAction,
            setContactActif: setContactActifAction,
        }
    })

}

export function creerThunks(actions, nomSlice) {
    const { setUserId, setProfil, setCleSecreteProfil, pushContacts, clearContacts } = actions
    
    // Async actions
    function chargerProfil(workers, userId, nomUsager, locationUrl) {
        return (dispatch, getState) => traiterChargerProfil(workers, userId, nomUsager, locationUrl, dispatch, getState)
    }

    async function traiterChargerProfil(workers, userId, nomUsager, locationUrl, dispatch, getState) {
        const { connexion, clesDao } = workers

        dispatch(setUserId(userId))
        const hostname = locationUrl.hostname
        const adresse = `@${nomUsager}:${hostname}`
        console.debug("traiterRafraichirContacts userId: %s, adresse : '%s' ", userId, adresse)

        const state = getState()[nomSlice]

        let profil = await connexion.getProfil()
        console.debug("Profil charge : %O", profil)
        if(profil.ok === false && profil.code === 404) {
            console.info("Profil inexistant, on en initialize un nouveau pour usager ", nomUsager)
            profil = await connexion.initialiserProfil(adresse)
        }

        console.debug("Profil charge : ", profil)
        dispatch(setProfil(profil))

        const cle_hachage_bytes = profil.cle_ref_hachage_bytes
        let cleSecrete = await clesDao.getCleLocale(cle_hachage_bytes)
        if(cleSecrete) {
            cleSecrete = cleSecrete.cleSecrete
        } else {
            // Dechiffrer la cle de profil. Conserve dans la DB locale.
            console.debug("Dechiffrer cle recue dans le profil")
            const cles = profil.cles.cles
            let clesSecretes = await clesDao.traiterReponseCles(cles)
            cleSecrete = clesSecretes[cle_hachage_bytes].cleSecrete
        }
        // console.debug("Cle secrete : ", cleSecrete)
    }
    
    function chargerContacts(workers) {
        return (dispatch, getState) => traiterChargerContacts(workers, dispatch, getState)
    }
    
    async function traiterChargerContacts(workers, dispatch, getState) {
        // const state = getState()[nomSlice]
        return traiterRafraichirContacts(workers, dispatch, getState)
    }

    async function traiterRafraichirContacts(workers, dispatch, getState, promisesPreparationContacts) {
        // console.debug('traiterRafraichirCollection')
        const { collectionsDao } = workers
    
        const state = getState()[nomSlice]
        const { userId, cuuid } = state
    
        // console.debug("Rafraichir '%s' pour userId", cuuid, userId)
    
        // Nettoyer la liste
        dispatch(clearContacts())
    
        console.error("todo")
        // Vieux code workers
        // MessageDao.getContacts(userId, {colonne, ordre, limit: PAGE_LIMIT})
        //     .then(formatterContactsCb)
        //     .catch(erreurCb)

        // Vieux code sync
        // workers.connexion.getReferenceContacts({limit: SYNC_LIMIT})
        //     .then(reponse=>MessageDao.mergeReferenceContacts(userId, reponse.contacts))
        //     .then(()=>chargerContenuContacts(workers, userId))
        //     .then(async uuidsCharges => {
        //         if(uuidsCharges && uuidsCharges.length > 0) {
        //             // Rafraichir ecran
        //             const liste = await MessageDao.getContacts(userId, {colonne, ordre, limit: PAGE_LIMIT})
        //             formatterContactsCb(liste)
        //         }
        //     })
        //     .catch(err=>erreurCb(err, "Erreur chargement contacts"))



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
        dispatch(pushContacts({liste: []}))
    }

    const thunks = { 
        chargerProfil,
        chargerContacts,
    }

    return thunks
}

export function creerMiddleware(workers, actions, thunks, nomSlice) {
    // Setup du middleware
    const dechiffrageMiddleware = createListenerMiddleware()

    dechiffrageMiddleware.startListening({
        matcher: isAnyOf(actions.pushContactsChiffres),
        effect: (action, listenerApi) => dechiffrageMiddlewareListener(workers, actions, thunks, nomSlice, action, listenerApi)
    }) 
    
    return { dechiffrageMiddleware }
}

async function dechiffrageMiddlewareListener(workers, actions, _thunks, nomSlice, action, listenerApi) {
    console.debug("dechiffrageMiddlewareListener running effect, action : %O, listener : %O", action, listenerApi)
    console.error("dechiffrageMiddlewareListener Not Implemented")
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