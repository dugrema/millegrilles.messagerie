import { openDB } from 'idb'

const DB_NAME = 'messagerie',
      STORE_DOWNLOADS = 'downloads',
    //   STORE_UPLOADS = 'uploads',
      STORE_MESSAGES = 'messages',
      STORE_CONTACTS = 'contacts',
    //   STORE_DRAFTS = 'drafts',
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
    let messageStore

    /*eslint no-fallthrough: "off"*/
    switch(oldVersion) {
        case 0:
            db.createObjectStore(STORE_DOWNLOADS, {keyPath: 'hachage_bytes'})
            messageStore = db.createObjectStore(STORE_MESSAGES, {keyPath: 'uuid_transaction'})
            db.createObjectStore(STORE_CONTACTS, {keyPath: 'uuid_contact'})

            messageStore.createIndex('etatChargement', ['user_id', '_etatChargement'])
            messageStore.createIndex('date_reception', ['user_id', 'date_reception'])
            messageStore.createIndex('from', ['user_id', 'from', 'date_reception'])
            messageStore.createIndex('subject', ['user_id', 'subject', 'date_reception'])

            // db.createObjectStore(STORE_UPLOADS)
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
        }
    }
}

export async function getUuidMessagesParEtatChargement(userId, etatChargement) {
    const db = await ouvrirDB({upgrade: true})
    const index = db.transaction(STORE_MESSAGES, 'readwrite').store.index('etatChargement')
    return await index.getAllKeys([userId, etatChargement])
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
    const skip = opts.skip || 0
    const limit = opts.limit || 40
    const colonne = opts.colonne || 'date_reception'
    const ordre = opts.ordre || -1
    const direction = ordre<0?'prev':'next'
    const inclure_supprime = opts.inclure_supprime || false

    const db = await ouvrirDB({upgrade: true})
    const index = db.transaction(STORE_MESSAGES, 'readwrite').store.index(colonne)

    let position = 0
    const messages = []
    let curseur = await index.openCursor(null, direction)
    while(curseur) {
        const value = curseur.value
        if(value.user_id === userId) {  // Uniquement traiter usager
            if(value.supprime !== true || inclure_supprime === true) {
                if(position++ >= skip) messages.push(curseur.value)
            }
        }
        if(messages.length === limit) break
        curseur = await curseur.continue()
    }

    return messages
}

export async function countMessages(userId, opts) {
    opts = opts || {}
    const inclure_supprime = opts.inclure_supprime || false
    
    const db = await ouvrirDB({upgrade: true})
    const store = db.transaction(STORE_MESSAGES, 'readwrite').store

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
