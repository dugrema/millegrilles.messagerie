import { ouvrirDB } from './idbMessagerie'

const STORE_DOWNLOADS = 'downloads'

export function init() {
    return ouvrirDB()
}

export async function entretien() {
    const db = await ouvrirDB()

    // Retirer les valeurs expirees
    //await retirerDownloadsExpires(db)
}

export async function updateFichierDownload(doc) {
    const { fuuid, userId } = doc
    if(!fuuid) throw new Error('updateFichierUpload Le document doit avoir un champ fuuid')

    const db = await ouvrirDB()
    const store = db.transaction(STORE_DOWNLOADS, 'readwrite').store
    let docExistant = await store.get(fuuid)
    if(!docExistant) {
        if(!userId) throw new Error('updateFichierDownload Le document doit avoir un champ userId')
        docExistant = {...doc}
    } else {
        Object.assign(docExistant, doc)
    }

    docExistant.derniereModification = new Date().getTime()

    await store.put(docExistant)
}

export async function supprimerDownload(fuuid) {
    const db = await ouvrirDB()
    const storeUploads = db.transaction(STORE_DOWNLOADS, 'readwrite').store
    await storeUploads.delete(fuuid)
}

export async function chargerDownloads(userId) {
    if(!userId) throw new Error("Il faut fournir le userId")
    const db = await ouvrirDB()
    const store = db.transaction(STORE_DOWNLOADS, 'readonly').store
    let curseur = await store.openCursor()
    const uploads = []
    while(curseur) {
        const userIdCurseur = curseur.value.userId
        if(userIdCurseur === userId) uploads.push(curseur.value)
        curseur = await curseur.continue()
    }
    return uploads
}


