import { base64 } from 'multiformats/bases/base64'
import { createSlice, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { dechiffrerMessage } from '../cles'

const SOURCE_INBOX = 'inbox',
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
    source: SOURCE_INBOX,       // Source de la requete - inbox, corbeille, outbox, custom
    sortKeys: {key: 'date_reception', ordre: -1}, // Ordre de tri
    liste: null,                // Liste triee de fichiers
    selection: null,            // Messages selectionnes
    uuidMessageActif: null,     // Message actif

    // Reponse/transfert message
    uuidMessageRepondre: null,
    uuidMessageTransfert: null,

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
    console.debug("pushAction liste triee : %O", liste)

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
    let liste = state.liste || []

    for (const payloadMessage of payload) {
        let { uuid_transaction } = payloadMessage
        // console.debug("mergeMessagesDataAction action: %O, uuid_transaction : %O", action, uuid_transaction)

        // Ajout flag _mergeVersion pour rafraichissement ecran
        const data = {...payloadMessage}
        data['_mergeVersion'] = mergeVersion
        
        let retirer = data.supprime === true,
            peutAppend = !retirer

        // Recuperer version courante (en memoire)
        let dataCourant = liste.filter(item=>item.uuid_transaction === uuid_transaction).pop()

        if(dataCourant) {
            if(retirer) {
                liste = liste.filter(item=>item.uuid_transaction !== uuid_transaction)
            } else {
                dataCourant = {...dataCourant, ...data}
                let listeModifiee = liste.map(item=>{
                    if(item.uuid_transaction !== uuid_transaction) return item
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
    state.listeDechiffrage = [...state.listeDechiffrage, ...messages]
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
        return item.uuid_transaction
    })
    state.liste = state.liste.filter(item=>{
        return ! messages.includes(item.uuid_transaction)
    })
}

function setUuidMessageActifAction(state, action) {
    state.uuidMessageActif = action.payload
    state.uuidMessageRepondre = null
    state.uuidMessageTransfert = null
}

// Repondre au message actif
function preparerRepondreMessageAction(state, action) {
    const uuidMessage = state.uuidMessageActif || action.payload
    if(!uuidMessage) return
    state.uuidMessageActif = ''  // Valeur pour nouveau message
    state.uuidMessageRepondre = uuidMessage
}

// Transferer le message actif (conserver attachments)
function preparerTransfererMessageAction(state, action) {
    const uuidMessage = state.uuidMessageActif || action.payload
    if(!uuidMessage) return
    state.uuidMessageActif = ''  // Valeur pour nouveau message
    state.uuidMessageTransfert = uuidMessage
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
        }
    })

}

export function creerThunks(actions, nomSlice) {

    // Action creators are generated for each case reducer function
    const { pushMessages, clearMessages, pushMessagesChiffres } = actions

    // Async actions
    function chargerMessages(workers) {
        return (dispatch, getState) => traiterChargerMessages(workers, dispatch, getState)
    }
    
    async function traiterChargerMessages(workers, dispatch, getState) {
        // const state = getState()[nomSlice]
        // const sourcePrecedente = state.source,
        //       uuidPrecedent = state.uuidDossier
    
        // if(sourcePrecedente === sourceMessages && uuidPrecedent === uuidDossier) return  // Rien a faire, meme source/dossier
        // dispatch(setSourceMessages(sourceMessages, uuidDossier))
    
        return traiterRafraichirMessages(workers, dispatch, getState)
    }

    async function traiterRafraichirMessages(workers, dispatch, getState, promisesPreparationDossier) {
        const { messagerieDao } = workers
    
        const state = getState()[nomSlice]
        const { userId } = state
    
        console.debug("Rafraichir messages pour userId", userId)
    
        // Nettoyer la liste
        dispatch(clearMessages())

        // // Charger le contenu de la collection deja connu et dechiffre
        const contenuIdb = await messagerieDao.getMessages(userId)
        console.debug("traiterRafraichirMessages Messages ", contenuIdb)
        if(contenuIdb && contenuIdb.length > 0) {
            // Remplacer la liste de contacts
            dispatch(pushMessages({liste: contenuIdb, clear: true}))
        } else {
            // Nettoyer la liste
            dispatch(clearMessages())
        }
    
        const cbChargerMessages = messages => dispatch(chargerMessagesParSyncid(workers, messages))

        try {
            let dateMinimum = 0
            for(var cycle=0; cycle<SAFEGUARD_BATCH_MAX; cycle++) {
                let resultatSync = await syncMessages(workers, CONST_SYNC_BATCH_SIZE, dateMinimum, cbChargerMessages)
                if( ! resultatSync || ! resultatSync.messages || resultatSync.messages.length < CONST_SYNC_BATCH_SIZE ) break
                if( resultatSync.complete ) break

                dateMinimum = resultatSync.messages.reduce(
                    (acc, item) => acc < item.date_reception ?item.date_reception:acc,   // Garder date la plus elevee
                    0  // Commencer a la date 0
                )
            }
            if(cycle === SAFEGUARD_BATCH_MAX) throw new Error("Detection boucle infinie dans syncCollection")
        } catch(err) {
            console.error("traiterRafraichirMessages Erreur sync messages ", err)
        }
    
        // Pousser liste a dechiffrer
        const messagesChiffres = await messagerieDao.getMessagesChiffres(userId)
        dispatch(pushMessagesChiffres(messagesChiffres))
    }

    function chargerMessagesParSyncid(workers, messages) {
        return (dispatch, getState) => traiterChargerMessagesParSyncid(workers, messages, dispatch, getState)
    }

    async function traiterChargerMessagesParSyncid(workers, messages, dispatch, getState) {
        const { messagerieDao } = workers
        const state = getState()[nomSlice]
        const userId = state.userId
    
        console.debug("traiterChargerMessagesParSyncid messages ", messages)

        let batchUuids = new Set()
        for await (const messageSync of messages) {
            const uuid_transaction = messageSync.uuid_transaction
            const messageIdb = await messagerieDao.getMessage(userId, uuid_transaction)
            // console.debug("Message idb pour %s = %O", uuid_transaction, messageIdb)
            if(messageIdb) {
                // Message connu, merge flags
                const messageMaj = await messagerieDao.updateMessage(messageSync, {userId})
                // console.debug("Message maj avec sync ", messageMaj)
                if(messageMaj.dechiffre === 'true') {
                    // Deja dechiffre, on le guarde
                    dispatch(actions.mergeMessagesData(messageMaj))
                }
            } else {
                // Message inconnu, on le charge
                // console.debug("Message inconnu ", uuid_transaction)
                batchUuids.add(uuid_transaction)
            }
        }
    
        batchUuids = [...batchUuids]
        if(batchUuids.length > 0) {
            // console.debug("Charger messages du serveur ", batchUuids)
            const listeMessages = await chargerBatchMessages(workers, batchUuids)
            // console.debug("Liste messages recue : ", listeMessages)
            await messagerieDao.mergeReferenceMessages(userId, listeMessages)
        }
    }
    
    const thunks = { 
        chargerMessages,
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
    const { clesDao, chiffrage, messagerieDao } = workers

    const getState = () => listenerApi.getState()[nomSlice]

    // Recuperer la cle secrete du profil pour dechiffrer les contacts
    const userId = getState().userId
    // const cleDechiffrage = await clesDao.getCleLocale(cle_ref_hachage_bytes)

    await listenerApi.unsubscribe()
    try {
        let messagesChiffres = [...getState().listeDechiffrage]
        while(messagesChiffres.length > 0) {
            // console.debug("dechiffrer contacts ", messagesChiffres)
            const batchMessages = messagesChiffres.slice(0, CONST_TAILLE_BATCH_MESSAGES_DECHIFFRER)  // Batch messages
            messagesChiffres = messagesChiffres.slice(CONST_TAILLE_BATCH_MESSAGES_DECHIFFRER)  // Clip 
            listenerApi.dispatch(actions.setMessagesChiffres(messagesChiffres))
            // console.debug("dechiffrageMiddlewareListener Dechiffrer %d, reste %d", batchMessages.length, messagesChiffres.length)

            // Identifier hachage_bytes et uuid_transaction de la bacth de messages
            const liste_hachage_bytes = batchMessages.reduce((acc, item)=>{
                acc.add(item.hachage_bytes)
                return acc
            }, new Set())
            const uuid_transaction_messages = batchMessages.map(item=>item.uuid_transaction)
            const cles = await clesDao.getClesMessages(liste_hachage_bytes, uuid_transaction_messages)
            // console.debug("dechiffrageMiddlewareListener Cles dechiffrage messages ", cles)

            for await (const message of batchMessages) {
                const docCourant = {...message}  // Copie du proxy contact (read-only)
                // console.debug("dechiffrageMiddlewareListener Dechiffrer ", docCourant)
                
                // Dechiffrer message
                const cleDechiffrageMessage = cles[docCourant.hachage_bytes]
                // console.debug("Cle dechiffrage message : ", cleDechiffrageMessage)
                try {
                    const dataDechiffre = await dechiffrerMessage(workers, message, cleDechiffrageMessage)
                    // console.debug("Contenu dechiffre : ", dataDechiffre)

                    const validation = dataDechiffre.validation
                    if(validation.valide !== true) {
                        console.warn("Message invalide %s, skip", message.uuid_transaction)
                        continue
                    }

                    // Ajout/override champs de metadonne avec contenu dechiffre
                    Object.assign(docCourant, dataDechiffre)
                    docCourant.dechiffre = 'true'

                    // Cleanup objet dechiffre
                    delete docCourant.message_chiffre
                    delete docCourant.hachage_bytes
                    delete docCourant.certificat_message
                    delete docCourant.certificat_millegrille
                    delete docCourant['_signature']

                    // Sauvegarder dans IDB
                    await messagerieDao.updateMessage(docCourant, {replace: true})

                    // Mettre a jour liste a l'ecran
                    listenerApi.dispatch(actions.mergeMessagesData(docCourant))
                } catch(err) {
                    console.error("Erreur dechiffrage message %O : %O", message, err)
                }
            }

            messagesChiffres = [...getState().listeDechiffrage]
        }
    } finally {
        await listenerApi.subscribe()
    }
}

async function syncMessages(workers, limit, dateMinimum, cbChargerMessages) {
    const { connexion } = workers

    console.debug("Sync messages limit %d date min %d", limit, dateMinimum)

    const reponseMessages = await connexion.getReferenceMessages({limit, date_minimum: dateMinimum})
    const messages = reponseMessages.messages || []
    console.debug("Reponse sync messages ", messages)
    if(messages.length > 0) {
        await cbChargerMessages(messages)
            // .catch(err=>console.error("Erreur traitement chargeMessagesParSyncid %O : %O", messages, err))
    }

    return reponseMessages
}

async function chargerBatchMessages(workers, batchUuids) {
    const { connexion } = workers
    const reponse = await connexion.getMessages({uuid_transactions: batchUuids, limit: batchUuids.length})
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
        const { from: auteurA, subject: subjectA, uuid_transaction: uuid_transactionA } = a,
              { from: auteurB, subject: subjectB, uuid_transaction: uuid_transactionB } = b

        if(subjectA && subjectB) {
            const compSubject = subjectA.localeCompare(subjectB) & ordre
            if(compSubject !== 0) return compSubject
        }
                  
        if(auteurA && auteurB) {
            const compAuteur = auteurA.localeCompare(auteurB) & ordre
            if(compAuteur !== 0) return compAuteur
        }

        // Fallback, uuid (doit toujours etre different)
        return uuid_transactionA.localeCompare(uuid_transactionB) * ordre
    }
}
