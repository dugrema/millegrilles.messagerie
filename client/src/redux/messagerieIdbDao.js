import { ouvrirDB } from './idbMessagerie'

const DB_NAME = 'messagerie',
      STORE_MESSAGES = 'messages',
      STORE_CONTACTS = 'contacts',
      STORE_DRAFTS = 'drafts'
// const MAX_AGE_DEFAUT = 6 * 60 * 60  // 6h en secondes

export async function init() {
    try {
        return await ouvrirDB()
    } catch(err) {
        // Catch pour affichage erreur worker
        console.error("Erreur ouvrirDB ", err)
        throw err
    }
}

export async function getMessage(userId, uuid_transaction) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_MESSAGES, 'readonly').objectStore(STORE_MESSAGES)
    return store.get([uuid_transaction, userId])
}

export async function getMessagesChiffres(userId, opts) {
    opts = opts || {}
    const messages_envoyes = opts.messages_envoyes?true:false,
          supprime = opts.supprime?true:false

    const db = await ouvrirDB()
    const index = db.transaction(STORE_MESSAGES, 'readwrite').store.index('dechiffre')
    
    const messages = []
    let curseur = await index.openCursor([userId, 'false'])
    while(curseur) {
        const value = curseur.value
        
        // Filtre par type envoye/recu
        let conserver = true
        if(messages_envoyes && !value.date_envoi) conserver = false
        else if(!messages_envoyes && !value.date_reception) conserver = false
        
        if(supprime !== value.supprime?true:false) conserver = false
        
        if(conserver) messages.push(curseur.value)
        
        curseur = await curseur.continue()
    }

    return messages
}

export async function mergeReferenceMessages(userId, messages) {
    const db = await ouvrirDB()

    // Parcourir chaque message pour voir s'il existe deja
    const store = db.transaction(STORE_MESSAGES, 'readwrite').objectStore(STORE_MESSAGES)
    for await (let message of messages) {
        const message_id = message.message.id
        const messageExistant = await store.get(message_id)
        const fichiers = message.fichiers
        const fichiers_completes = message.fichiers_completes || false
        if(!messageExistant) {
            // console.debug("mergeReferenceMessages Conserver nouveau message : %O", message)
            const nouveauMessage = {
                message_id,
                user_id: userId, 
                ...message, 
                fichiers, 
                fichiers_completes: fichiers_completes, 
                'dechiffre': 'false'
            }
            // console.debug("Put nouveau message ", nouveauMessage)
            await store.put(nouveauMessage)
        } else {
            // Verifier si on doit ajouter date_envoi ou date_reception
            const { date_envoi: date_envoi_ref, date_reception: date_reception_ref } = message
            const { date_envoi: date_envoi_local, date_reception: date_reception_local } = messageExistant
            let datesOverrides = {}
            if(date_reception_ref && !date_reception_local) {
                // Injecter date reception (le message etait deja dans boite de reception)
                // console.debug("mergeReferenceMessages Injecter date reception %O dans %s", date_reception_ref, uuid_transaction)
                datesOverrides.date_reception = date_reception_ref
            } else if(date_envoi_ref && !date_envoi_local) {
                // Injecter date envoi (le message etait deja dans la boite d'envoi)
                // console.debug("mergeReferenceMessages Injecter date envoi %O dans %s", date_envoi_ref, uuid_transaction)
                datesOverrides.date_envoi = date_envoi_ref
            } else {
                // console.debug("Rien a merger pour %O", message)
            }

            const messageMaj = {
                ...messageExistant, 
                fichiers_completes: fichiers_completes, 
                ...datesOverrides
            }
            if(fichiers) messageMaj.fichiers = fichiers
            // console.debug("Put message maj : ", messageMaj)
            await store.put(messageMaj)
        }
    }
}

export async function getUuidMessagesParEtatChargement(userId, etatChargement, opts) {
    opts = opts || {}
    const messages_envoyes = opts.messages_envoyes?true:false

    const db = await ouvrirDB()
    const index = db.transaction(STORE_MESSAGES, 'readwrite').store.index('etatChargement')

    let curseur = await index.openCursor([userId, etatChargement])
    const uuid_messages = []
    while(curseur) {
        const { key, value } = curseur
        // console.debug("Message %O = %O", key, value)
        const { uuid_transaction, date_envoi, date_reception } = value
        if(messages_envoyes) {
            // S'assurer que c'est un message envoye (avec date_envoi)
            if(date_envoi) uuid_messages.push(uuid_transaction)
        } else {
            if(date_reception) uuid_messages.push(uuid_transaction)
        }
        curseur = await curseur.continue()
    }

    return uuid_messages
}

export async function updateMessage(message, opts) {
    opts = opts || {}
    const db = await ouvrirDB()
    const store = db.transaction(STORE_MESSAGES, 'readwrite').store
    try {
        if(opts.replace) {
            throw new Error('obsolete')
            // await store.put(message)
            // return message
        } else {
            // console.debug('updateMessage avec %O (opts: %O)', message, opts)
            const userId = message.user_id || opts.userId
            if(!userId) throw new Error("messagerieIdbDao.updateMessage userId doit etre fourni")
            const messageOriginal = await store.get([message.message_id, userId])
            const messageMaj = {...messageOriginal, ...message}
            // console.debug("Maj message : ", messageMaj)
            await store.put(messageMaj)
            return messageMaj
        }
    } catch(err) {
        console.error('messagerieIdbDao.updateMessage Erreur', err)
        throw err
    }
}

export async function getMessages(userId, opts) {
    opts = opts || {}

    const filtreFct = preparerFiltreMessages(userId, opts)

    const ordre = opts.ordre || -1
    const direction = ordre<0?'prev':'next'
    const messages_envoyes = opts.messages_envoyes?true:false
    const colonne = opts.colonne || (messages_envoyes?'date_envoi':'date_reception')
    const limit = opts.limit || 1000
    const skipCount = opts.skip || 0

    const db = await ouvrirDB()
    const index = db.transaction(STORE_MESSAGES, 'readonly').store.index(colonne)

    let position = 0
    const messages = []
    const keyRange = IDBKeyRange.bound([userId, 0], [userId, Number.MAX_SAFE_INTEGER])
    let curseur = await index.openCursor(keyRange, direction)
    while(curseur) {
        const value = curseur.value
        // console.debug("IDB value ", curseur.key, curseur.value)
        if(filtreFct(value)) {
            if(position++ >= skipCount) messages.push(value)
        }

        if(messages.length === limit) break
        curseur = await curseur.continue()
    }

    return messages
}

function preparerFiltreMessages(userId, opts) {

    const inclure_supprime = opts.inclure_supprime || false
    const supprime = opts.supprime || false,
          messages_envoyes = opts.messages_envoyes?true:false

    const filtreFct = data => {
        const { date_envoi, date_reception } = data

        let conserver = false,
            skip = false

        if(messages_envoyes) {
            if(!date_envoi) skip = true  // Skip message (recu)
        } else {
            if(!date_reception) skip = true  // Skip message (envoye)
        }

        if(!skip && data.user_id === userId) {  // Uniquement traiter usager
            if(supprime === false) {
                if(data.supprime !== true || inclure_supprime === true) {
                    conserver = true
                }
            } else if(supprime === true) {
                if(data.supprime === true) {
                    conserver = true
                }
            }
        }

        return conserver
    }

    return filtreFct
}

export async function countMessages(userId, opts) {
    opts = opts || {}
    // const inclure_supprime = opts.inclure_supprime || false
    // const supprime = opts.supprime || false
    
    const db = await ouvrirDB()
    const store = db.transaction(STORE_MESSAGES, 'readonly').store

    const filtreFct = preparerFiltreMessages(userId, opts)

    let compteur = 0
    let curseur = await store.openCursor()
    while(curseur) {
        const value = curseur.value
        if(filtreFct(value)) {
            compteur++
        }
        curseur = await curseur.continue()
    }
    return compteur
}

// Contacts

export async function mergeReferenceContacts(userId, contacts) {
    const db = await ouvrirDB()
    // console.debug("mergeReferenceContacts contacts: %O", contacts)

    // Parcourir chaque message pour voir s'il existe deja
    const store = db.transaction(STORE_CONTACTS, 'readwrite').store
    for await (let contact of contacts) {
        const uuid_contact = contact.uuid_contact

        if(contact.supprime === true) {
            await store.delete(uuid_contact)
        } else {
            const contactExistant = await store.get(uuid_contact)
            if(contactExistant) {
                // Sync, verifier date
                const date_modification_locale = contactExistant.date_modification
                if(date_modification_locale < contact.date_modification) {
                    // Indiquer que le contact doit etre maj
                    const contactStale = {...contactExistant, ...contact}
                    // console.debug("Contact doit etre maj : %O", contactStale)
                    await store.put(contactStale)
                }
            } else {
                // console.debug("Conserver nouveau contact : %O", contact)
                await store.put({user_id: userId, ...contact, dechiffre: 'false'})
            }
        }
    }
}

export async function getUuidContactsParEtatChargement(userId, etatChargement) {
    const db = await ouvrirDB()
    const index = db.transaction(STORE_CONTACTS, 'readwrite').store.index('etatChargement')
    return await index.getAllKeys([userId, etatChargement])
}

export async function updateContact(userId, contact, opts) {
    opts = opts || {}
    const replace = opts.replace || false
    const db = await ouvrirDB()
    const store = db.transaction(STORE_CONTACTS, 'readwrite').store
    let contactDb = null
    if(replace === true) {
        contactDb = {user_id: userId}
    } else {
        contactDb = (await store.get(contact.uuid_contact)) || {user_id: userId}
    }
    Object.assign(contactDb, contact)
    await store.put(contactDb)
}

export async function getContactsChiffres(userId, opts) {
    const db = await ouvrirDB()
    const index = db.transaction(STORE_CONTACTS, 'readwrite').store.index('dechiffre')
    
    const contacts = []
    let curseur = await index.openCursor([userId, 'false'])
    while(curseur) {
        const value = curseur.value
        if(value.supprime !== true) contacts.push(curseur.value)
        curseur = await curseur.continue()
    }

    return contacts
}

export async function getContacts(userId, opts) {
    opts = opts || {}
    const skip = opts.skip || 0
    const limit = opts.limit || 100
    // const colonne = opts.colonne || 'nom'
    const ordre = opts.ordre || 1
    const direction = ordre<0?'prev':'next'
    const inclure_supprime = opts.inclure_supprime || false

    const db = await ouvrirDB()
    const index = db.transaction(STORE_CONTACTS, 'readwrite').store.index('dechiffre')

    let position = 0
    const contacts = []
    const keyRange = IDBKeyRange.only([userId, 'true'])
    // let curseur = await index.openCursor(keyRange, direction)
    // console.debug("KeyRange : ", keyRange)
    let curseur = await index.openCursor(keyRange, 'next')

    while(curseur) {
        const value = curseur.value
        if(value.supprime !== true || inclure_supprime === true) {
            if(position++ >= skip) contacts.push(value)
        }
        if(contacts.length === limit) break
        curseur = await curseur.continue()
    }

    return contacts
}

export async function countContacts(userId, opts) {
    opts = opts || {}
    const inclure_supprime = opts.inclure_supprime || false

    const db = await ouvrirDB()
    const store = db.transaction(STORE_CONTACTS, 'readwrite').store

    let compteur = 0
    let curseur = await store.openCursor()
    while(curseur) {
        const value = curseur.value
        if(value.user_id === userId) {  // Uniquement traiter usager
            if(value.supprime !== true || inclure_supprime === true) {
                compteur++
            }
        }
        curseur = await curseur.continue()
    }

    return compteur
}

export async function supprimerContacts(uuidContacts) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_CONTACTS, 'readwrite').store
    const promises = uuidContacts.map(item=>store.delete(item))
    return Promise.all(promises)
}

// Draft

export async function ajouterDraft() {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_DRAFTS, 'readwrite').store
    return store.add({})
}

export async function sauvegarderDraft(idDraft, message) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_DRAFTS, 'readwrite').store
    return store.put(message, idDraft)
}

export async function getListeDrafts() {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_DRAFTS, 'readwrite').store
    let cursor = await store.openCursor()
    const drafts = []
    while(cursor) {
        const { key, value } = cursor
        // console.debug("getListeDrafts key: %s, value : %O", key, value)
        drafts.push({idDraft: key, ...value})
        cursor = await cursor.continue()
    }
    return drafts
}

export async function getDraft(idDraft) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_DRAFTS, 'readwrite').store
    const draft = await store.get(idDraft)
    return {idDraft, ...draft}
}

export async function supprimerDraft(idDraft) {
    // console.debug("Supprimer draft : %O", idDraft)
    const db = await ouvrirDB()
    const store = db.transaction(STORE_DRAFTS, 'readwrite').store
    await store.delete(idDraft)
}
