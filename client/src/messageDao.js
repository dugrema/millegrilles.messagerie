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
            await dbMessagerieIndexedDb.ouvrirDB()  // Test, lance une exception si echec
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
