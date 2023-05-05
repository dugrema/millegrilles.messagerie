import { base64 } from 'multiformats/bases/base64'
import { createSlice, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { dechiffrerMessage } from '../cles'

const SOURCE_RECEPTION = 'reception',
      SOURCE_OUTBOX = 'outbox',
      SOURCE_CORBEILLE = 'corbeille'

const SAFEGUARD_BATCH_MAX = 1000,
      CONST_SYNC_BATCH_SIZE = 250,
      CONST_TAILLE_BATCH_MESSAGES_DECHIFFRER = 20

const initialState = {
    // Usager
    userId: '',                 // UserId courant, permet de stocker plusieurs users localement
    adresseUsager: '',          // Adresse du serveur local, utilise comme source du message

    // Liste a l'ecran
    source: null,               // Source de la requete - reception, corbeille, outbox, custom
    sortKeys: {key: 'date_reception', ordre: -1}, // Ordre de tri
    liste: null,                // Liste triee de fichiers
    selection: null,            // Messages selectionnes
    message_id: null,           // Message actif

    // Reponse/transfert message
    uuidMessageRepondre: null,
    uuidMessageTransfert: null,

    // Travail background
    listeDechiffrage: [],       // Liste de messages a dechiffrer
    mergeVersion: 0,            // Utilise pour flagger les changements
    syncEnCours: false,         // Flag qui indique sync/dechiffrage en cours
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

    let doitTrier = false
    let supprime = state.source === SOURCE_CORBEILLE
    let liste = state.liste || []

    for (const payloadMessage of payload) {
        let { message_id } = payloadMessage
        // console.debug("mergeMessagesDataAction action: %O, uuid_transaction : %O", action, uuid_transaction)

        // Ajout flag _mergeVersion pour rafraichissement ecran
        const data = {...payloadMessage}
        data['_mergeVersion'] = mergeVersion
        
        let retirer = (data.supprime?true:false) !== supprime,
            peutAppend = !retirer

        // Recuperer version courante (en memoire)
        let dataCourant = liste.filter(item=>item.message_id === message_id).pop()

        if(dataCourant) {
            if(retirer) {
                liste = liste.filter(item=>item.message_id !== message_id)
            } else {
                dataCourant = {...dataCourant, ...data}
                let listeModifiee = liste.map(item=>{
                    if(item.message_id !== message_id) return item
                    return dataCourant
                })
                liste = listeModifiee
                doitTrier = true
            }
        } else if(peutAppend) {
            liste.push(data)
            doitTrier = true
        }
    }

    // Trier
    if(doitTrier) {
        // console.debug("mergeMessagesDataAction trier")
        liste.sort(genererTriListe(state.sortKeys))
    }

    state.liste = liste
}

// Ajouter des messages a la liste a dechiffrer
function pushMessagesChiffresAction(state, action) {
    const messages = action.payload
    // console.debug("pushMessagesChiffresAction Dechiffrer ", messages)
    state.listeDechiffrage = [...state.listeDechiffrage, ...messages]
    state.syncEnCours = true
}

function setMessagesChiffresAction(state, action) {
    state.listeDechiffrage = action.payload
}

function selectionMessagesAction(state, action) {
    state.selection = action.payload
}

function supprimerMessagesAction(state, action) {
    let messages = action.payload
    if(!Array.isArray(messages)) messages = [messages]
    messages = messages.map(item=>{
        if(typeof(item) === 'string') return item
        return item.message_id
    })
    state.liste = state.liste.filter(item=>{
        return ! messages.includes(item.message_id)
    })
}

function setUuidMessageActifAction(state, action) {
    state.message_id = action.payload
    state.uuidMessageRepondre = null
    state.uuidMessageTransfert = null
}

// Repondre au message actif
function preparerRepondreMessageAction(state, action) {
    const uuidMessage = state.message_id || action.payload
    if(!uuidMessage) return
    state.message_id = ''  // Valeur pour nouveau message
    state.uuidMessageRepondre = uuidMessage
}

// Transferer le message actif (conserver attachments)
function preparerTransfererMessageAction(state, action) {
    const message_id = state.message_id || action.payload
    if(!message_id) return
    state.message_id = ''  // Valeur pour nouveau message
    state.uuidMessageTransfert = message_id
}

function setSourceMessagesAction(state, action) {
    const sourceMessages = action.payload
    state.source = sourceMessages
    state.listeDechiffrage = []
}

function setSyncEnCoursAction(state, action) {
    state.syncEnCours = action.payload
}

function clearSyncEnCoursAction(state, action) {
    state.syncEnCours = false
}

// Slice collection

export function creerSlice(name) {

    return createSlice({
        name,
        initialState,
        reducers: {
            setUserId: setUserIdAction,
            pushMessages: pushMessagesAction, 
            supprimerMessages: supprimerMessagesAction,
            clearMessages: clearMessagesAction,
            mergeMessagesData: mergeMessagesDataAction,
            setSortKeys: setSortKeysAction,
            pushMessagesChiffres: pushMessagesChiffresAction,
            selectionMessages: selectionMessagesAction,
            setMessagesChiffres: setMessagesChiffresAction,
            setUuidMessageActif: setUuidMessageActifAction,
            preparerRepondreMessage: preparerRepondreMessageAction,
            preparerTransfererMessage: preparerTransfererMessageAction,
            setSourceMessages: setSourceMessagesAction,
            setSyncEnCours: setSyncEnCoursAction,
            clearSyncEnCours: clearSyncEnCoursAction,
        }
    })

}

export function creerThunks(actions, nomSlice) {

    // Action creators are generated for each case reducer function
    const { pushMessages, clearMessages, pushMessagesChiffres, setSourceMessages, setSyncEnCours } = actions

    // Async actions
    function chargerMessages(workers, sourceMessages) {
        return (dispatch, getState) => traiterChargerMessages(workers, dispatch, getState, sourceMessages)
    }
    
    async function traiterChargerMessages(workers, dispatch, getState, sourceMessages) {
        const state = getState()[nomSlice]
        const sourcePrecedente = state.source
    
        if(sourcePrecedente === sourceMessages) return  // Rien a faire, meme source/dossier
        dispatch(setSourceMessages(sourceMessages))
    
        return traiterRafraichirMessages(workers, dispatch, getState)
    }

    async function traiterRafraichirMessages(workers, dispatch, getState, promisesPreparationDossier) {
        const { messagerieDao } = workers
    
        const state = getState()[nomSlice]
        const { userId, source } = state
    
        // console.debug("Rafraichir messages pour userId %s source %s", userId, source)
    
        // Nettoyer la liste
        dispatch(clearMessages())

        let contenuIdb = null, 
            supprime = false, 
            messages_envoyes = source === SOURCE_OUTBOX
        if(source === SOURCE_RECEPTION) {
            // Charger le contenu de la collection deja connu et dechiffre
            contenuIdb = await messagerieDao.getMessages(userId)
        } else if(source === SOURCE_OUTBOX) {
            contenuIdb = await messagerieDao.getMessages(userId, {messages_envoyes: true})
        } else if(source === SOURCE_CORBEILLE) {
            supprime = true
            contenuIdb = await messagerieDao.getMessages(userId, {supprime: true})
        } else {
            throw new Error("Source de messages non supportee : ", source)
        }

        // console.debug("traiterRafraichirMessages Messages ", contenuIdb)
        if(contenuIdb && contenuIdb.length > 0) {
            // Remplacer la liste de contacts
            dispatch(pushMessages({liste: contenuIdb, clear: true}))
        } else {
            // Nettoyer la liste
            dispatch(clearMessages())
        }

        const cbChargerMessages = messages => dispatch(chargerMessagesParSyncid(workers, messages))

        try {
            // let dateMinimum = 0
            const dateMaximum = Math.floor(new Date().getTime() / 1000)  // Charger messages plus vieux que maintenant
            let skipCount = 0
            for(var cycle=0; cycle<SAFEGUARD_BATCH_MAX; cycle++) {
                let resultatSync = await syncMessages(
                    workers, CONST_SYNC_BATCH_SIZE, dateMaximum, skipCount, cbChargerMessages, 
                    {messages_envoyes, supprime}
                  )
                // if( ! resultatSync || ! resultatSync.messages || resultatSync.messages.length < CONST_SYNC_BATCH_SIZE ) break

                // Incrementer compteur
                const messages = resultatSync.messages || []
                const compteBatch = messages.length
                skipCount += compteBatch
                if(compteBatch < CONST_SYNC_BATCH_SIZE) break  // Complete
                if( resultatSync.complete ) break

                // dateMinimum = resultatSync.messages.reduce(
                //     (acc, item) => acc < item.date_reception ?item.date_reception:acc,   // Garder date la plus elevee
                //     0  // Commencer a la date 0
                // )
            }
            if(cycle === SAFEGUARD_BATCH_MAX) throw new Error("Detection boucle infinie dans syncCollection")
        } catch(err) {
            console.error("traiterRafraichirMessages Erreur sync messages ", err)
        }
    
        // Pousser liste a dechiffrer
        const messagesChiffres = await messagerieDao.getMessagesChiffres(userId, {messages_envoyes, supprime})
        // console.debug("traiterRafraichirMessages Dechiffrer ", messagesChiffres)
        dispatch(pushMessagesChiffres(messagesChiffres))
    }

    function chargerMessagesParSyncid(workers, messages) {
        return (dispatch, getState) => traiterChargerMessagesParSyncid(workers, messages, dispatch, getState)
    }

    async function traiterChargerMessagesParSyncid(workers, messages, dispatch, getState) {
        const { messagerieDao } = workers
        const state = getState()[nomSlice]
        const userId = state.userId,
              source = state.source
    
        const messages_envoyes = source === SOURCE_OUTBOX

        dispatch(setSyncEnCours(true))

        console.debug("traiterChargerMessagesParSyncid messages ", messages)

        let batchUuids = new Set()
        for await (const messageSync of messages) {
            // Extraire le message_id
            const message_id = messageSync.message.id

            const messageIdb = await messagerieDao.getMessage(userId, message_id)
            // console.debug("traiterChargerMessagesParSyncid Message idb pour %s = %O", message_id, messageIdb)
            if(messageIdb) {
                // const messageObj = {...messageSync, message_id}
                // delete messageObj.message
                const messageObj = {
                    message_id,
                    date_envoi: messageSync.date_envoi,
                    date_reception: messageSync.date_reception,
                    fichiers_completes: messageSync.fichiers_completes,
                    lu: messageSync.lu,
                    supprime: messageSync.supprime,
                }

                // Message connu, merge flags
                const messageMaj = await messagerieDao.updateMessage(messageObj, {userId})

                // console.debug("Message maj avec sync ", messageMaj)
                if(messageMaj.dechiffre === 'true') {
                    // Deja dechiffre, on le guarde
                    dispatch(actions.mergeMessagesData(messageMaj))
                }
            } else {
                // Message inconnu, on le charge
                // console.debug("traiterChargerMessagesParSyncid Message inconnu ", message_id)
                batchUuids.add(message_id)
            }
        }
    
        batchUuids = [...batchUuids]
        if(batchUuids.length > 0) {
            console.debug("Charger messages du serveur ", batchUuids)
            const listeMessages = await chargerBatchMessages(workers, batchUuids, {messages_envoyes})
            console.debug("Liste messages recue : ", listeMessages)
            await messagerieDao.mergeReferenceMessages(userId, listeMessages)
        }
    }
    
    const thunks = { 
        chargerMessages, chargerMessagesParSyncid,
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
    // console.debug("dechiffrageMiddlewareListener running effect, action : %O, listener : %O", action, listenerApi)
    const { clesDao, messagerieDao } = workers

    const getState = () => listenerApi.getState()[nomSlice]

    // Recuperer la cle secrete du profil pour dechiffrer les contacts
    const userId = getState().userId,
          source = getState().source
    // const cleDechiffrage = await clesDao.getCleLocale(cle_ref_hachage_bytes)

    // console.debug("dechiffrageMiddlewareListener Dechiffrer messages source ", source)
    const messages_envoyes = source === 'outbox'

    await listenerApi.unsubscribe()
    try {
        let messagesChiffres = [...getState().listeDechiffrage]
        while(messagesChiffres.length > 0) {
            // console.debug("dechiffrer contacts ", messagesChiffres)
            const batchMessages = messagesChiffres.slice(0, CONST_TAILLE_BATCH_MESSAGES_DECHIFFRER)  // Batch messages
            messagesChiffres = messagesChiffres.slice(CONST_TAILLE_BATCH_MESSAGES_DECHIFFRER)  // Clip 
            listenerApi.dispatch(actions.setMessagesChiffres(messagesChiffres))
            console.debug("dechiffrageMiddlewareListener Dechiffrer %d, reste %d", batchMessages.length, messagesChiffres.length)
            console.debug("dechiffrageMiddlewareListener Batch messages ", batchMessages)

            // Identifier hachage_bytes et message_id de la bacth de messages
            const liste_hachage_bytes = batchMessages.reduce((acc, item)=>{
                const infoDechiffrage = item.message.dechiffrage
                acc.add(infoDechiffrage.hachage)
                return acc
            }, new Set())
            const message_ids = batchMessages.map(item=>item.message.id)
            try {
                console.debug("dechiffrageMiddlewareListener Charger message_ids %O, cles %O", message_ids, liste_hachage_bytes)
                var cles = await clesDao.getClesMessages(liste_hachage_bytes, message_ids, {messages_envoyes})
                console.debug("dechiffrageMiddlewareListener Cles dechiffrage messages ", cles)
            } catch(err) {
                console.warn("dechiffrageMiddlewareListener Erreur chargement cles batch %O : %O", liste_hachage_bytes, err)
                messagesChiffres = [...getState().listeDechiffrage]
                continue  // Skip
            }

            for await (const message of batchMessages) {
                const docCourant = {...message.message, certificat: message.certificat_message, millegrille: message.millegrille_message}
                console.debug("dechiffrageMiddlewareListener Dechiffrer ", docCourant)

                // Dechiffrer message
                const infoDechiffrage = docCourant.dechiffrage
                const cleDechiffrageMessage = cles[infoDechiffrage.hachage]
                console.debug("Cle dechiffrage message : ", cleDechiffrageMessage)
                try {
                    // Override parametres dechiffrage au besoin
                    if(infoDechiffrage.header) cleDechiffrageMessage.header = infoDechiffrage.header
                    if(infoDechiffrage.format) cleDechiffrageMessage.format = infoDechiffrage.format

                    const dataDechiffre = await dechiffrerMessage(workers, docCourant, cleDechiffrageMessage)
                    console.debug("Contenu dechiffre : ", dataDechiffre)
                    const { message: messageDechiffre, validation } = dataDechiffre
                    const messageMaj = {
                        message_id: message.message_id, 
                        message: {...message.message, contenu: undefined},  // Retirer contenu chiffre du message
                        contenu: messageDechiffre, 
                        dechiffre: 'true',
                        valide: validation.valide === false,
                        certificat_message: undefined,
                        millegrille_message: undefined,
                    }

                    // // Sauvegarder dans IDB
                    const messageMerged = await messagerieDao.updateMessage(messageMaj, {userId})

                    // // Mettre a jour liste a l'ecran
                    listenerApi.dispatch(actions.mergeMessagesData(messageMerged))
                } catch(err) {
                    console.error("Erreur dechiffrage message %O : %O", message, err)
                }
            }

            messagesChiffres = [...getState().listeDechiffrage]
        }
    } finally {
        await listenerApi.subscribe()
        listenerApi.dispatch(actions.clearSyncEnCours())
    }
}

// async function syncMessages(workers, limit, dateMinimum, cbChargerMessages, opts) {
async function syncMessages(workers, limit, dateMaximum, skipCount, cbChargerMessages, opts) {
    opts = opts || {}
    const { connexion } = workers

    const { messages_envoyes, supprime, inclure_supprime } = opts

    // console.debug("syncMessages limit %d date min %d, opts %O", limit, dateMinimum, opts)

    const reponseMessages = await connexion.getReferenceMessages(
        // {limit, date_minimum: dateMinimum, messages_envoyes, supprime, inclure_supprime}
        {limit, date_maximum: dateMaximum, skip: skipCount, messages_envoyes, supprime, inclure_supprime}
    )
    const messages = reponseMessages.messages || []
    console.debug("syncMessages Reponse ", messages)
    if(messages.length > 0) {
        await cbChargerMessages(messages)
            // .catch(err=>console.error("Erreur traitement chargeMessagesParSyncid %O : %O", messages, err))
    }

    return reponseMessages
}

async function chargerBatchMessages(workers, batchUuids, opts) {
    opts = opts || {}
    const { connexion } = workers
    const { messages_envoyes } = opts
    const reponse = await connexion.getMessages(
        {message_ids: batchUuids, limit: batchUuids.length, messages_envoyes}
    )
    console.debug("chargerBatchMessages Reponse ", reponse)
    if(!reponse.err) {
        const messages = reponse.messages
        return messages
    } else {
        throw reponse.err
    }
}

function genererTriListe(sortKeys) {
    
    const key = sortKeys.key || 'date_reception',
          ordre = sortKeys.ordre || 1

    // console.trace("genererTriListe key %O, ordre %O", key, ordre)

    return (a, b) => {
        if(a === b) return 0
        if(!a) return 1
        if(!b) return -1

        let valA = a[key], valB = b[key]
        if(valA === valB) return 0
        if(!valA) return 1
        if(!valB) return -1

        if(typeof(valA) === 'string') {
            const diff = valA.localeCompare(valB)
            if(diff!==0) return diff * ordre
        } else if(typeof(valA) === 'number') {
            const diff = valA - valB
            if(diff!==0) return diff * ordre
        } else {
            throw new Error(`genererTriListe values ne peut pas etre compare ${''+valA} ? ${''+valB}`)
        }

        // Fallback, nom/tuuid du fichier
        const { from: auteurA, subject: subjectA, message_id: message_idA } = a,
              { from: auteurB, subject: subjectB, message_id: message_idB } = b

        if(subjectA && subjectB) {
            const compSubject = subjectA.localeCompare(subjectB) & ordre
            if(compSubject !== 0) return compSubject
        }
                  
        if(auteurA && auteurB) {
            const compAuteur = auteurA.localeCompare(auteurB) & ordre
            if(compAuteur !== 0) return compAuteur
        }

        // Fallback, uuid (doit toujours etre different)
        return message_idA.localeCompare(message_idB) * ordre
    }
}
