import { openDB } from 'idb'

const DB_NAME = 'messagerie',
      STORE_THUMBNAILS = 'thumbnails',
      STORE_DOWNLOADS = 'downloads',
      STORE_UPLOADS = 'uploads',
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
    // console.debug("dbUsagers upgrade, DB object (version %s): %O", oldVersion, db)
    switch(oldVersion) {
        case 0:
            db.createObjectStore(STORE_THUMBNAILS, {keyPath: 'hachage_bytes'})
            db.createObjectStore(STORE_DOWNLOADS, {keyPath: 'hachage_bytes'})
            // db.createObjectStore(STORE_UPLOADS)
        case 1: // Plus recent, rien a faire
            break
        default:
        console.warn("createObjectStores Default..., version %O", oldVersion)
    }
}

export async function saveThumbnailDechiffre(hachage_bytes, blob) {
    const db = await ouvrirDB({upgrade: true})
  
    // Preparer une cle secrete non-exportable
    const data = { hachage_bytes, blob, date: new Date() }
  
    // console.debug("Conserver cle secrete pour fuuid %s : %O", hachage_bytes, data)
  
    return db.transaction(STORE_THUMBNAILS, 'readwrite')
      .objectStore(STORE_THUMBNAILS)
      .put(data)
}

export async function getThumbnail(hachage_bytes) {
    const db = await ouvrirDB({upgrade: true})
    const store = db.transaction(STORE_THUMBNAILS, 'readonly').objectStore(STORE_THUMBNAILS)
    return store.get(hachage_bytes)
}