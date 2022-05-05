/* DAO pour messages stockes dans le navigateur */
import * as dbMessagerieIndexedDb from './dbMessagerieIndexedDb'
// import * as dbMessageroeLocalStorage from './dbMessagerieLocalStorage'

let _dao = null,
    _ready = false

const FORCE_LOCALSTORAGE = false

export function init() {

    // DEBUG
    if(FORCE_LOCALSTORAGE) { 
        console.warn("messageDao init avec FORCE_LOCALSTORAGE=true")
        throw new Error("TODO")
        // _dao = dbUsagerStorage
        // _ready = true
        // return Promise.resolve(_ready)
    }

    const promise = new Promise(async (resolve, reject) => {
        // Detecter si idb est disponible, fallback sur localstorage
        try {
            await dbMessagerieIndexedDb.ouvrirDB({upgrade: true})  // Test, lance une exception si echec
            _dao = dbMessagerieIndexedDb
            _ready = true
        } catch(err) {
            // if(window.localStorage) {
            //     console.info("IndexedDB non disponible, fallback sur localStorage (err: %s)", ''+err)
            //     _dao = dbUsagerStorage
            //     _ready = true
            // } else {
                console.error("Storage non disponible")
                _ready = false
                return reject(err)
            // }
        }
        resolve(_ready)
    })

    _ready = promise

    return promise
}

init()  // Detection initiale

export function ready() {
    if(!_ready) return false
    return _ready
}

// export async function getListeUsagers(...args) {
//     if(_ready === false) throw new Error("usagerDao pas initialise")
//     await _ready
//     return _dao.getListeUsagers(...args)
// }

export async function mergeReferenceMessages(...args) {
    if(_ready === false) throw new Error("messageDao pas initialise")
    await _ready
    return _dao.mergeReferenceMessages(...args)
}

export async function getUuidMessagesParEtatChargement(...args) {
    if(_ready === false) throw new Error("messageDao pas initialise")
    await _ready
    return _dao.getUuidMessagesParEtatChargement(...args)
}

export async function updateMessage(...args) {
    if(_ready === false) throw new Error("messageDao pas initialise")
    await _ready
    return _dao.updateMessage(...args)
}

export async function getMessage(...args) {
    if(_ready === false) throw new Error("messageDao pas initialise")
    await _ready
    return _dao.getMessage(...args)
}

export async function getMessages(...args) {
    if(_ready === false) throw new Error("messageDao pas initialise")
    await _ready
    return _dao.getMessages(...args)
}

export async function countMessages(...args) {
    if(_ready === false) throw new Error("messageDao pas initialise")
    await _ready
    return _dao.countMessages(...args)
}

export async function mergeReferenceContacts(...args) {
    if(_ready === false) throw new Error("messageDao pas initialise")
    await _ready
    return _dao.mergeReferenceContacts(...args)
}

export async function updateContact(...args) {
    if(_ready === false) throw new Error("messageDao pas initialise")
    await _ready
    return _dao.updateContact(...args)
}

export async function getUuidContactsParEtatChargement(...args) {
    if(_ready === false) throw new Error("messageDao pas initialise")
    await _ready
    return _dao.getUuidContactsParEtatChargement(...args)
}

export async function getContacts(...args) {
    if(_ready === false) throw new Error("messageDao pas initialise")
    await _ready
    return _dao.getContacts(...args)
}

export async function countContacts(...args) {
    if(_ready === false) throw new Error("messageDao pas initialise")
    await _ready
    return _dao.countContacts(...args)
}
