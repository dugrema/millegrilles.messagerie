import { openDB } from 'idb'

const DB_NAME = 'messagerie',
      STORE_DOWNLOADS = 'downloads',
      STORE_UPLOADS = 'uploads',
      STORE_UPLOADS_FICHIERS = 'uploadsFichiers',
      STORE_MESSAGES = 'messages',
      STORE_CONTACTS = 'contacts',
      STORE_DRAFTS = 'drafts',
      STORE_FICHIERS = 'fichiers',
      VERSION_COURANTE = 2

export function ouvrirDB(opts) {
    opts = opts || {}

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

}

function createObjectStores(db, oldVersion) {
    // console.debug("dbUsagers upgrade, DB object (version %s): %O", oldVersion, db)
    /*eslint no-fallthrough: "off"*/
    let messageStore = null, contactStore = null, fichierStore = null
    try {
        switch(oldVersion) {
            case 0:
            case 1:
                messageStore = db.createObjectStore(STORE_MESSAGES, {keyPath: ['uuid_transaction', 'user_id']})
                contactStore = db.createObjectStore(STORE_CONTACTS, {keyPath: 'uuid_contact'})
                db.createObjectStore(STORE_DRAFTS, {autoIncrement: true})
                
                // Index messages
                // messageStore.createIndex('etatChargement', ['user_id', '_etatChargement'])
                messageStore.createIndex('dechiffre', ['user_id', 'dechiffre'])
                messageStore.createIndex('date_reception', ['user_id', 'date_reception'])
                messageStore.createIndex('date_envoi', ['user_id', 'date_envoi'])
                messageStore.createIndex('from', ['user_id', 'from', 'date_reception'])
                messageStore.createIndex('subject', ['user_id', 'subject', 'date_reception'])
    
                // Index contacts
                contactStore.createIndex('nom', ['user_id', 'dechiffre', 'nom'])
                contactStore.createIndex('dechiffre', ['user_id', 'dechiffre'])

                // Upload/download fichiers
                db.createObjectStore(STORE_DOWNLOADS, {keyPath: 'fuuid'})
                db.createObjectStore(STORE_UPLOADS, {keyPath: 'correlation'})
                
                // Creer store fichiers pour ajouter index sur favorisIdx (nouveau champ helper)
                db.createObjectStore(STORE_UPLOADS_FICHIERS, {keyPath: ['correlation', 'position']})
                fichierStore = db.createObjectStore(STORE_FICHIERS, {keyPath: 'tuuid'})
                fichierStore.createIndex('cuuids', 'cuuids', {unique: false, multiEntry: true})
                fichierStore.createIndex('userFavoris', ['user_id', 'favorisIdx'], {unique: false, multiEntry: false})

            case 2: // Plus recent, rien a faire
                break
            default:
            console.warn("createObjectStores Default..., version %O", oldVersion)
        }
    } catch(err) {
        console.error("Erreur preparation IDB : ", err)
        throw err
    }
}
