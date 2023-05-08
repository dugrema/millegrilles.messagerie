import { createSlice, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'

const SAFEGUARD_BATCH_MAX = 1000,
      CONST_SYNC_BATCH_SIZE = 250

const initialState = {
    // Usager
    userId: null,               // UserId courant, permet de stocker plusieurs users localement
    profil: null,               // Profil de l'usager

    // Liste a l'ecran
    sortKeys: {key: 'nom', ordre: 1}, // Ordre de tri
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

    let doitTrier = false

    for (const payloadMessage of payload) {
        let { uuid_contact } = payloadMessage
        // console.debug("mergeContactsDataAction action: %O, uuid_contact : %O", action, payloadMessage.uuid_contact)

        // Ajout flag _mergeVersion pour rafraichissement ecran
        const data = {...payloadMessage}
        data['_mergeVersion'] = mergeVersion

        const liste = state.liste || []
        
        let retirer = data.supprime === true,
            peutAppend = !retirer

        // Recuperer version courante (en memoire)
        let dataCourant = liste.filter(item=>item.uuid_contact === uuid_contact).pop()

        if(dataCourant) {
            if(retirer) {
                state.liste = liste.filter(item=>item.uuid_contact !== uuid_contact)
            } else {
                dataCourant = {...dataCourant, ...data}
                let listeModifiee = liste.map(item=>{
                    if(item.uuid_contact !== uuid_contact) return item
                    return dataCourant
                })
                state.liste = listeModifiee
            }
        } else if(peutAppend) {
            liste.push(data)
            state.liste = liste
            doitTrier = true
        }
    }

    // Trier
    if(doitTrier) state.liste.sort(genererTriListe(state.sortKeys))
}

// Ajouter des contacts a la liste a dechiffrer
function pushContactsChiffresAction(state, action) {
    const items = action.payload
    state.listeDechiffrage = [...state.listeDechiffrage, ...items]
}

function setContactsChiffresAction(state, action) {
    state.listeDechiffrage = action.payload
}

function selectionContactsAction(state, action) {
    state.selection = action.payload
}

function setContactActifAction(state, action) {
    state.uuidContactActif = action.payload
}

function supprimerContactsAction(state, action) {
    let contacts = action.payload
    if(!Array.isArray(contacts)) contacts = [contacts]
    state.liste = state.liste.filter(item=>{
        return ! contacts.includes(item.uuid_contact)
    })
}

// Slice collection

export function creerSlice(name) {

    return createSlice({
        name,
        initialState,
        reducers: {
            setUserId: setUserIdAction,
            setProfil: setProfilAction,
            pushContacts: pushContactsAction, 
            supprimerContacts: supprimerContactsAction,
            clearContacts: clearContactsAction,
            mergeContactsData: mergeContactsDataAction,
            setSortKeys: setSortKeysAction,
            pushContactsChiffres: pushContactsChiffresAction,
            selectionContacts: selectionContactsAction,
            setContactsChiffres: setContactsChiffresAction,
            setContactActif: setContactActifAction,
        }
    })

}

export function creerThunks(actions, nomSlice) {
    const { setUserId, setProfil, pushContacts, pushContactsChiffres, setContactsChiffres, clearContacts } = actions
    
    // Async actions
    function chargerProfil(workers, userId, nomUsager, locationUrl) {
        return (dispatch, getState) => traiterChargerProfil(workers, userId, nomUsager, locationUrl, dispatch, getState)
    }

    async function traiterChargerProfil(workers, userId, nomUsager, locationUrl, dispatch, getState) {
        const { connexion, chiffrage, clesDao } = workers

        dispatch(setUserId(userId))
        const hostname = locationUrl.hostname
        const adresse = `@${nomUsager}:${hostname}`
        // console.debug("traiterRafraichirContacts userId: %s, adresse : '%s' ", userId, adresse)

        let profil = await connexion.getProfil()
        // console.debug("Profil charge : %O", profil)
        if(profil.ok === false && profil.code === 404) {
            console.info("Profil inexistant, on en initialize un nouveau pour usager ", nomUsager)
            await connexion.initialiserProfil(adresse)
            // Recharger profil avec cles
            profil = await connexion.getProfil()
        }

        // console.debug("Profil charge : ", profil)
        dispatch(setProfil(profil))

        const cle_hachage_bytes = profil.cle_ref_hachage_bytes
        let cle = await clesDao.getCleLocale(cle_hachage_bytes)
        if(!cle) {
            // Dechiffrer la cle de profil. Conserve dans la DB locale.
            // console.debug("Dechiffrer cle recue dans le profil")
            const cles = profil.cles.cles
            let clesSecretes = await clesDao.traiterReponseCles(cles)
            cle = clesSecretes[cle_hachage_bytes]
        }
        // console.debug("traiterChargerProfil Cle secrete hachage bytes %s = %O", cle_hachage_bytes, cle)

        if(profil.email_chiffre) {
            // console.debug("Dechiffrer champs email chiffres")
            const dataDechiffre = await chiffrage.chiffrage.dechiffrerChampsChiffres(profil.email_chiffre, cle, {DEBUG: true})
            // console.debug("Champs email dechiffres ", dataDechiffre)
            profil = {...profil, ...dataDechiffre}
            dispatch(setProfil(profil))
        }
    }
    
    function chargerContacts(workers) {
        return (dispatch, getState) => traiterChargerContacts(workers, dispatch, getState)
    }
    
    async function traiterChargerContacts(workers, dispatch, getState) {
        // console.debug('traiterRafraichirCollection')
        const { messagerieDao } = workers
    
        const state = getState()[nomSlice]
        const { userId } = state

        // Charger le contenu de la collection deja connu et dechiffre
        const contenuIdb = await messagerieDao.getContacts(userId)
        if(contenuIdb && contenuIdb.length > 0) {
            // Remplacer la liste de contacts
            dispatch(pushContacts({liste: contenuIdb, clear: true}))
        } else {
            // Nettoyer la liste
            dispatch(pushContacts({liste: [], clear: true}))
        }
    
        const cbChargerContacts = contacts => dispatch(chargerContactsParSyncid(workers, contacts))

        let compteur = 0
        for(var cycle=0; cycle<SAFEGUARD_BATCH_MAX; cycle++) {
            let resultatSync = await syncContacts(workers, CONST_SYNC_BATCH_SIZE, compteur, cbChargerContacts)
            if( ! resultatSync || ! resultatSync.contacts || resultatSync.contacts.length === 0 ) break
            compteur += resultatSync.contacts.length
            if( resultatSync.complete ) break
        }
        if(cycle === SAFEGUARD_BATCH_MAX) throw new Error("Detection boucle infinie dans syncCollection")
    
        // Pousser liste a dechiffrer
        const contactsChiffres = await messagerieDao.getContactsChiffres(userId)
        dispatch(pushContactsChiffres(contactsChiffres))
    }

    function chargerContactsParSyncid(workers, contacts) {
        return (dispatch, getState) => traiterChargerContactsParSyncid(workers, contacts, dispatch, getState)
    }

    async function traiterChargerContactsParSyncid(workers, contacts, dispatch, getState) {
        const state = getState()[nomSlice]
        const userId = state.userId

        const { messagerieDao } = workers
        const batchUuids = contacts.filter(item=>item.supprime!==true).map(item=>item.uuid_contact)

        const listeContacts = await chargerBatchContacts(workers, batchUuids)

        await messagerieDao.mergeReferenceContacts(userId, listeContacts)
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
    // console.debug("dechiffrageMiddlewareListener running effect, action : %O, listener : %O", action, listenerApi)
    const getState = () => listenerApi.getState()[nomSlice]
    const { clesDao, chiffrage, messagerieDao } = workers

    // Recuperer la cle secrete du profil pour dechiffrer les contacts
    const userId = getState().userId,
          profil = getState().profil,
          cle_ref_hachage_bytes = profil.cle_ref_hachage_bytes
    const cleDechiffrage = await clesDao.getCleLocale(cle_ref_hachage_bytes)
    // console.debug("dechiffrageMiddlewareListener cle dechiffrage ", cleDechiffrage)
    await listenerApi.unsubscribe()
    try {
        let contactsChiffres = [...getState().listeDechiffrage]
        while(contactsChiffres.length > 0) {
            // console.debug("dechiffrer contacts ", contactsChiffres)
            const batchContacts = contactsChiffres.slice(0, 50)  // Batch de 20 fichiers a la fois
            contactsChiffres = contactsChiffres.slice(50)  // Clip 
            listenerApi.dispatch(actions.setContactsChiffres(contactsChiffres))
            // console.debug("dechiffrageMiddlewareListener Dechiffrer %d, reste %d", batchContacts.length, contactsChiffres.length)

            for await (const contact of batchContacts) {
                const docCourant = {...contact}  // Copie du proxy contact (read-only)
                const ref_hachage_bytes = docCourant.ref_hachage_bytes
                if(ref_hachage_bytes === cle_ref_hachage_bytes) {
                    const cleDechiffrageContact = {...cleDechiffrage, ...contact}
                    // console.debug("Dechiffrer doc %O avec info cle %O", docCourant, cleDechiffrageContact)
                    try {
                        const dataDechiffre = await chiffrage.chiffrage.dechiffrerChampsChiffres(docCourant, cleDechiffrageContact, {DEBUG: true})
                        // console.debug("Contenu dechiffre : ", dataDechiffre)
                        
                        // Ajout/override champs de metadonne avec contenu dechiffre
                        Object.assign(docCourant, dataDechiffre)
                        docCourant.dechiffre = 'true'
                        docCourant.uuid_contact = contact.uuid_contact
                        
                        // Cleanup objet dechiffre
                        delete docCourant.data_chiffre
                        delete docCourant.ref_hachage_bytes
                        delete docCourant.header
                        delete docCourant.format
                        
                        // Conserver contact dechiffre
                        await messagerieDao.updateContact(userId, docCourant, {replace: true})
                        listenerApi.dispatch(actions.mergeContactsData(docCourant))
                    } catch(err) {
                        console.warn("Erreur dechiffrage contact %s : %O", contact.uuid_contact, err)
                    }
                } else {
                    console.error("ref_hachage_bytes : %O, cle : %O", ref_hachage_bytes, cle_ref_hachage_bytes)
                    throw new Error("Contact avec mauvais cle - TODO")
                }
            }

            contactsChiffres = [...getState().listeDechiffrage]
        }
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

        if(valA === valB) return 0
        if(!valA) return 1
        if(!valB) return -1

        if(typeof(valA) === 'string') {
            valA = valA.toLocaleLowerCase()
            valB = valB.toLocaleLowerCase()
            const diff = valA.localeCompare(valB)
            if(diff) return diff * ordre
        } else if(typeof(valA) === 'number') {
            const diff = valA - valB
            if(diff) return diff * ordre
        } else {
            throw new Error(`genererTriListe values ne peut pas etre compare ${''+valA} ? ${''+valB}`)
        }

        const uuid_contactA = a.uuid_contact,
              uuid_contactB = b.uuid_contact
        // Fallback, uuid_contact (doit toujours etre different)
        return uuid_contactA.localeCompare(uuid_contactB) * ordre
    }
}

async function syncContacts(workers, limit, skip, cbChargerContacts) {
    const { connexion } = workers

    // Vieux code sync
    const reponseContacts = await connexion.getReferenceContacts({limit, skip})
    const contacts = reponseContacts.contacts || []
    // console.debug("Reponse sync contacts ", contacts)
    if(contacts.length > 0) {
        cbChargerContacts(contacts)
            .catch(err=>console.error("Erreur traitement chargerContactsParSyncid %O : %O", contacts, err))
    }

    return reponseContacts
}

async function chargerBatchContacts(workers, batchUuids) {
    const { connexion } = workers
    // console.debug("chargerBatchContacts ", batchUuids)
    const reponse = await connexion.getContacts({uuid_contacts: batchUuids, limit: batchUuids.length})
    // console.debug("chargerBatchContacts reponse ", reponse)
    if(!reponse.err) {
        const contacts = reponse.contacts
        return contacts
    } else {
        throw reponse.err
    }
}
