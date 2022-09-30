import { ouvrirDB } from './idbMessagerie'

const STORE_FICHIERS = 'fichiers'

// Met dirty a true et dechiffre a false si mismatch derniere_modification
export async function syncDocuments(docs) {
    if(!docs) return []

    const db = await ouvrirDB()
    const store = db.transaction(STORE_FICHIERS, 'readwrite').store

    let dirtyDocs = []
    for await (const infoFichier of docs) {
        const { tuuid, derniere_modification } = infoFichier
        const fichierDoc = await store.get(tuuid)
        if(fichierDoc) {
            if(derniere_modification !== fichierDoc.derniere_modification) {
                // Fichier connu avec une date differente
                dirtyDocs.push(tuuid)
                if(fichierDoc.dirty !== false) {
                    // Conserver flag dirty
                    fichierDoc.dirty = true
                    await store.put(fichierDoc)
                }
            } else if(fichierDoc.dirty) {
                // Flag existant
                dirtyDocs.push(tuuid)
            }
        } else {
            // Fichier inconnu
            dirtyDocs.push(tuuid)
        }
    }

    return dirtyDocs
}

// opts {merge: true, dechiffre: true}, met dirty a false
export async function updateDocument(doc, opts) {
    opts = opts || {}

    const { tuuid, user_id } = doc
    if(!tuuid) throw new Error('updateDocument tuuid doit etre fourni')
    if(!user_id) throw new Error('updateDocument user_id doit etre fourni')

    const flags = ['dirty', 'dechiffre', 'expiration']
          
    const db = await ouvrirDB()
    const store = db.transaction(STORE_FICHIERS, 'readwrite').store
    const fichierDoc = (await store.get(tuuid)) || {}
    Object.assign(fichierDoc, doc)
    
    // Changer flags
    flags.forEach(flag=>{
        const val = opts[flag]
        if(val !== undefined) fichierDoc[flag] = val
    })
    if(doc.favoris || fichierDoc.favoris) fichierDoc.favorisIdx = 1

    await store.put(fichierDoc)
}

export async function deleteDocuments(tuuids) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_FICHIERS, 'readwrite').store
    for await (const tuuid of tuuids) {
        await store.delete(tuuid)
    }
}

export async function getParTuuids(tuuids) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_FICHIERS, 'readonly').store
    const fichiers = Promise.all( tuuids.map(tuuid=>store.get(tuuid)) )
    return fichiers
}

// cuuid falsy donne favoris
export async function getParCollection(cuuid, userId) {
    const db = await ouvrirDB()

    let collection = null
    if(cuuid) {
        const store = db.transaction(STORE_FICHIERS, 'readonly').store
        collection = await store.get(cuuid)
    }

    let curseur = null
    const store = db.transaction(STORE_FICHIERS, 'readonly').store        
    //curseur = await store.openCursor()
    if(cuuid) {
        const index = store.index('cuuids')
        curseur = await index.openCursor(cuuid)
    } else {
        // Favoris
        const index = store.index('userFavoris')
        curseur = await index.openCursor([userId, 1])
    }

    const docs = []
    while(curseur) {
        const value = curseur.value
        // console.debug("getParCollection Row %O = %O", curseur, value)
        const { cuuids, favoris, user_id, supprime } = value
        if(supprime === true) {
            // Supprime
        } else if(!cuuid) {
            // Favoris
            if(user_id === userId && favoris === true) docs.push(value)
        } else if(cuuids && cuuids.includes(cuuid)) {
            docs.push(value)
        }
        curseur = await curseur.continue()
    }

    // console.debug('getParCollection cuuid %s userId: %s resultat collection %O, documents %O', cuuid, userId, collection, docs)

    return { collection, documents: docs }
}

export async function getPlusrecent(intervalle, userId) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_FICHIERS, 'readonly').store

    const { debut, fin } = intervalle
    if(!debut) throw new Error("Date debut est requise dans l'intervalle")
    // console.debug("Date debut : %O", new Date(debut*1000))
    // if(fin) console.debug("Date fin : %O", new Date(fin*1000))

    let curseur = await store.openCursor()
    const docs = []
    while(curseur) {
        const value = curseur.value
        const { tuuid, cuuids, favoris, user_id, supprime } = value
        // console.debug("Message %O = %O", key, value)
        let conserver = false

        if(user_id !== userId) {
            // User different, ignorer
        } else if(supprime === true) {
            // Supprime, ignorer
        } else {
            const champsDate = ['derniere_modification', 'date_creation']
            champsDate.forEach(champ=>{
                const valDate = value[champ]
                if(valDate) {
                    // console.debug("Date %s: %s = %O", value.tuuid, champ, new Date(valDate*1000))
                    if(valDate >= debut) {
                        if(fin) {
                            if(valDate <= fin) conserver = true
                        } else {
                            // Pas de date de fin
                            conserver = true
                        }
                    }
                }
            })
        }
        
        if(conserver) docs.push(value)
        
        curseur = await curseur.continue()
    }

    // console.debug('getPlusrecent intervalle %O userId: %s resultat documents %O', intervalle, userId, docs)

    return docs
}

export async function getSupprime(intervalle, userId) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_FICHIERS, 'readonly').store

    const { debut, fin } = intervalle
    if(!debut) throw new Error("getSupprime Date debut est requise dans l'intervalle")
    // console.debug("getSupprime Date debut : %O", new Date(debut*1000))
    // if(fin) console.debug("getSupprime Date fin : %O", new Date(fin*1000))

    let curseur = await store.openCursor()
    const docs = []
    while(curseur) {
        const value = curseur.value
        // console.debug("Message %O = %O", key, value)
        const { supprime } = value
        let conserver = false

        if(supprime === true) {
            const champsDate = ['derniere_modification', 'date_creation']
            champsDate.forEach(champ=>{
                const valDate = value[champ]
                if(valDate) {
                    // console.debug("Date %s: %s = %O", value.tuuid, champ, new Date(valDate*1000))
                    if(valDate >= debut) {
                        if(fin) {
                            if(valDate <= fin) conserver = true
                        } else {
                            // Pas de date de fin
                            conserver = true
                        }
                    }
                }
            })
        }
        
        if(conserver) docs.push(value)
        
        curseur = await curseur.continue()
    }

    // console.debug('getSupprime intervalle %O userId: %s resultat documents %O', intervalle, userId, docs)

    return docs
}

export async function entretien() {
    const db = await ouvrirDB()

    // Retirer les valeurs expirees
    await retirerFichiersExpires(db)
}

// Supprime le contenu de idb
export async function clear() {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_FICHIERS, 'readwrite').store
    store.clear()
}

async function retirerFichiersExpires(db) {
    const now = new Date().getTime()
    // console.debug("Expirer documents avant ", new Date(now))
    const store = db.transaction(STORE_FICHIERS, 'readwrite').store
    let curseur = await store.openCursor()
    while(curseur) {
        const { expiration } = curseur.value
        if(expiration < now) {
            // console.debug("Expirer %s : %O", tuuid, new Date(expiration))
            curseur.delete()
        }
        curseur = await curseur.continue()
    }
}
