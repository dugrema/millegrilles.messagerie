import { openDB } from 'idb'

const DB_NAME = 'messagerie',
      STORE_DOWNLOADS = 'downloads',
      STORE_UPLOADS = 'uploads',
      STORE_MESSAGES = 'messages',
      STORE_CONTACTS = 'contacts',
      STORE_DRAFTS = 'drafts',
      VERSION_COURANTE = 1,
      MAX_AGE_DEFAUT = 6 * 60 * 60  // 6h en secondes

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
    console.debug("dbUsagers upgrade, DB object (version %s): %O", oldVersion, db)
    let messageStore
    switch(oldVersion) {
        case 0:
            db.createObjectStore(STORE_DOWNLOADS, {keyPath: 'hachage_bytes'})
            messageStore = db.createObjectStore(STORE_MESSAGES, {keyPath: 'uuid_transaction'})
            db.createObjectStore(STORE_CONTACTS, {keyPath: 'uuid_contact'})

            messageStore.createIndex('etatChargement', '_etatChargement')
            messageStore.createIndex('date_reception', 'date_reception')
            messageStore.createIndex('from', 'from')
            messageStore.createIndex('subject', 'subject')

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

export async function mergeReferenceMessages(messages) {
    const db = await ouvrirDB({upgrade: true})

    // Parcourir chaque message pour voir s'il existe deja
    const store = db.transaction(STORE_MESSAGES, 'readwrite').objectStore(STORE_MESSAGES)
    for await (let message of messages) {
        const uuid_transaction = message.uuid_transaction
        const messageExistant = await store.get(uuid_transaction)
        if(!messageExistant) {
            console.debug("Conserver nouveau message : %O", message)
            await store.put({...message, '_etatChargement': 'nouveau'})
        }
    }
}

/**
 * Retourne tous les messages, invoque callback pour chaque.
 * @param {*} cb Callback invoque pour chaque message identifie
 */
export async function traiterMessages(cb) {
    const db = await ouvrirDB({upgrade: true})
    let cursor = await db.transaction(STORE_MESSAGES, 'readwrite').store.openCursor()
    //for await (let message of allMessages) {
    while(cursor) {
        const {key, value: message} = cursor
        console.debug("Cursor : %s = %O", key, message)
        // const resultat = await cb(message)
        //if(resultat) {
            // Remplacer la valeur
            // const store = db.transaction(STORE_MESSAGES, 'readwrite').objectStore(STORE_MESSAGES)
            // await store.put(resultat)
        //}
        cursor = await cursor.continue()
    }
}

export async function getUuidMessagesParEtatChargement(etatChargement) {
    const db = await ouvrirDB({upgrade: true})
    const index = db.transaction(STORE_MESSAGES, 'readwrite').store.index('etatChargement')
    return await index.getAllKeys(etatChargement)
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

export async function getMessages(opts) {
    opts = opts || {}
    const skip = opts.skip || 0
    const limit = opts.limit || 40
    const colonne = opts.colonne || 'date_reception'
    const ordre = opts.ordre || -1
    const direction = ordre<0?'prev':'next'

    const db = await ouvrirDB({upgrade: true})
    const index = db.transaction(STORE_MESSAGES, 'readwrite').store.index(colonne, direction)
    const uuid_transactions = []
    let curseur = await index.openCursor()
    let position = 0
    const messages = []

    while(curseur) {
        if(position >= skip) messages.push(curseur.value)
        if(position > limit) break
        curseur = await curseur.continue()
    }

    return messages
}