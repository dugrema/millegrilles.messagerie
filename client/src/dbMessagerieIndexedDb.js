import { openDB } from 'idb'

const DB_NAME = 'messagerie',
      STORE_DOWNLOADS = 'downloads',
    //   STORE_UPLOADS = 'uploads',
      STORE_MESSAGES = 'messages',
      STORE_CONTACTS = 'contacts',
      STORE_DRAFTS = 'drafts',
      VERSION_COURANTE = 1
    //   MAX_AGE_DEFAUT = 6 * 60 * 60  // 6h en secondes

export function ouvrirDB(opts) {
    opts = opts || {}

    if(opts.upgrade) {
        return openDB(DB_NAME, VERSION_COURANTE, {
            upgrade(db, oldVersion) {
                createObjectStores(db, oldVersion)
            },
            blocked() {
                console.error("OpenDB %s blocked", DB_NAME)
            },
            blocking() {
                console.warn("OpenDB, blocking")
            }
        })
    } else {
        // console.debug("Ouverture DB sans upgrade usager : %s", DB_NAME)
        return openDB(DB_NAME)
    }
}

function createObjectStores(db, oldVersion) {
    // console.debug("dbUsagers upgrade, DB object (version %s): %O", oldVersion, db)
    let messageStore, contactStore

    /*eslint no-fallthrough: "off"*/
    switch(oldVersion) {
        case 0:
            db.createObjectStore(STORE_DOWNLOADS, {keyPath: 'hachage_bytes'})
            messageStore = db.createObjectStore(STORE_MESSAGES, {keyPath: ['uuid_transaction', 'user_id']})
            contactStore = db.createObjectStore(STORE_CONTACTS, {keyPath: 'uuid_contact'})
            db.createObjectStore(STORE_DRAFTS, {autoIncrement: true})
            
            // Index messages
            messageStore.createIndex('etatChargement', ['user_id', '_etatChargement'])
            messageStore.createIndex('date_reception', ['user_id', 'date_reception'])
            messageStore.createIndex('date_envoi', ['user_id', 'date_envoi'])
            messageStore.createIndex('from', ['user_id', 'from', 'date_reception'])
            messageStore.createIndex('subject', ['user_id', 'subject', 'date_reception'])

            // Index contacts
            contactStore.createIndex('etatChargement', ['user_id', '_etatChargement'])
            contactStore.createIndex('nom', ['user_id', 'nom'])

        case 1: // Plus recent, rien a faire
            break
        default:
            console.warn("createObjectStores Default..., version %O", oldVersion)
    }
}

export async function getMessage(uuid_transaction) {
    const db = await ouvrirDB({upgrade: true})
    const store = db.transaction(STORE_MESSAGES, 'readonly').objectStore(STORE_MESSAGES)
    return store.get(uuid_transaction)
}

export async function mergeReferenceMessages(userId, messages) {
    const db = await ouvrirDB({upgrade: true})

    // Parcourir chaque message pour voir s'il existe deja
    const store = db.transaction(STORE_MESSAGES, 'readwrite').objectStore(STORE_MESSAGES)
    for await (let message of messages) {
        const uuid_transaction = message.uuid_transaction
        const messageExistant = await store.get(uuid_transaction)
        if(!messageExistant) {
            // console.debug("Conserver nouveau message : %O", message)
            await store.put({user_id: userId, ...message, '_etatChargement': 'nouveau'})
        } else {
            // Verifier si on doit ajouter date_envoi ou date_reception
            const { date_envoi: date_envoi_ref, date_reception: date_reception_ref } = message
            const { date_envoi: date_envoi_local, date_reception: date_reception_local } = messageExistant
            if(date_reception_ref && !date_reception_local) {
                // Injecter date reception (le message etait deja dans boite d'envoi)
                await store.put({date_reception: date_reception_ref})
            } else if(date_envoi_ref && !date_envoi_local) {
                // Injecter date envoi (le message etait deja dans la boite d'envoi)
                await store.put({date_envoi: date_envoi_ref})
            }
        }
    }
}

export async function getUuidMessagesParEtatChargement(userId, etatChargement, opts) {
    opts = opts || {}
    const messages_envoyes = opts.messages_envoyes?true:false

    const db = await ouvrirDB({upgrade: true})
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
    const db = await ouvrirDB({upgrade: true})
    const store = db.transaction(STORE_MESSAGES, 'readwrite').store
    if(opts.replace) {
        await store.put(message)
    } else {
        const messageOriginal = await store.get(message.uuid_transaction)
        const messageMaj = {...messageOriginal, ...message}
        await store.put(messageMaj)
    }
}

export async function getMessages(userId, opts) {
    opts = opts || {}

    const filtreFct = preparerFiltreMessages(userId, opts)

    const ordre = opts.ordre || -1
    const direction = ordre<0?'prev':'next'
    const messages_envoyes = opts.messages_envoyes?true:false
    const colonne = opts.colonne || (messages_envoyes?'date_envoi':'date_reception')
    const limit = opts.limit || 40
    const skipCount = opts.skip || 0

    const db = await ouvrirDB({upgrade: true})
    const index = db.transaction(STORE_MESSAGES, 'readonly').store.index(colonne)

    let position = 0
    const messages = []
    let curseur = await index.openCursor(null, direction)
    while(curseur) {
        const value = curseur.value

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
    
    const db = await ouvrirDB({upgrade: true})
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
    const db = await ouvrirDB({upgrade: true})
    console.debug("mergeReferenceContacts contacts: %O", contacts)

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
                    const contactStale = {...contactExistant, ...contact, '_etatChargement': 'stale'}
                    console.debug("Contact doit etre maj : %O", contactStale)
                    await store.put(contactStale)
                }
            } else {
                console.debug("Conserver nouveau contact : %O", contact)
                await store.put({user_id: userId, ...contact, '_etatChargement': 'nouveau'})
            }
        }
    }
}

export async function getUuidContactsParEtatChargement(userId, etatChargement) {
    const db = await ouvrirDB({upgrade: true})
    const index = db.transaction(STORE_CONTACTS, 'readwrite').store.index('etatChargement')
    return await index.getAllKeys([userId, etatChargement])
}

export async function updateContact(contact, opts) {
    opts = opts || {}
    const db = await ouvrirDB({upgrade: true})
    const store = db.transaction(STORE_CONTACTS, 'readwrite').store
    if(opts.replace) {
        await store.put(contact)
    } else {
        const contactOriginal = await store.get(contact.uuid_contact)
        const contactMaj = {...contactOriginal, ...contact}
        await store.put(contactMaj)
    }
}

export async function getContacts(userId, opts) {
    opts = opts || {}
    const skip = opts.skip || 0
    const limit = opts.limit || 100
    const colonne = opts.colonne || 'nom'
    const ordre = opts.ordre || 1
    const direction = ordre<0?'prev':'next'
    const inclure_supprime = opts.inclure_supprime || false

    const db = await ouvrirDB({upgrade: true})
    const index = db.transaction(STORE_CONTACTS, 'readwrite').store.index(colonne)

    let position = 0
    const contacts = []
    let curseur = await index.openCursor(null, direction)
    while(curseur) {
        const value = curseur.value
        if(value.user_id === userId) {  // Uniquement traiter usager
            if(value.supprime !== true || inclure_supprime === true) {
                if(position++ >= skip) contacts.push(curseur.value)
            }
        }
        if(contacts.length === limit) break
        curseur = await curseur.continue()
    }

    return contacts
}

export async function countContacts(userId, opts) {
    opts = opts || {}
    const inclure_supprime = opts.inclure_supprime || false

    const db = await ouvrirDB({upgrade: true})
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
    const db = await ouvrirDB({upgrade: true})
    const store = db.transaction(STORE_CONTACTS, 'readwrite').store
    const promises = uuidContacts.map(item=>store.delete(item))
    return Promise.all(promises)
}

// Draft

export async function ajouterDraft() {
    const db = await ouvrirDB({upgrade: true})
    const store = db.transaction(STORE_DRAFTS, 'readwrite').store
    return store.add({})
}

export async function sauvegarderDraft(idDraft, message) {
    const db = await ouvrirDB({upgrade: true})
    const store = db.transaction(STORE_DRAFTS, 'readwrite').store
    return store.put(message, idDraft)
}

export async function getListeDrafts() {
    const db = await ouvrirDB({upgrade: true})
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
    const db = await ouvrirDB({upgrade: true})
    const store = db.transaction(STORE_DRAFTS, 'readwrite').store
    const draft = await store.get(idDraft)
    return {idDraft, ...draft}
}

export async function supprimerDraft(idDraft) {
    console.debug("Supprimer draft : %O", idDraft)
    const db = await ouvrirDB({upgrade: true})
    const store = db.transaction(STORE_DRAFTS, 'readwrite').store
    await store.delete(idDraft)
}
