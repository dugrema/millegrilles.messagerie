const CONST_TIMEOUT_CERTIFICAT = 2 * 60 * 1000

function build(workers) {

    let cacheCertificatsMaitredescles = null

    return {
        // Recupere une liste de cles, les conserve dans le usagerDao (cache) si applicable
        getCles(liste_hachage_bytes) {
            return getCles(workers, liste_hachage_bytes)
        },
        getCertificatsMaitredescles() {
            if(cacheCertificatsMaitredescles) return cacheCertificatsMaitredescles
            return getCertificatsMaitredescles(workers)
                .then(reponse=>{
                    cacheCertificatsMaitredescles = reponse
                    setTimeout(()=>{
                        cacheCertificatsMaitredescles = null
                    }, CONST_TIMEOUT_CERTIFICAT)
                    return reponse
                  })
        },
        traiterReponseCles(reponseCles) {
            return traiterReponseCles(workers, reponseCles)
        },
        getCleLocale(hachage_bytes) {
            return getCleLocale(workers, hachage_bytes)
        }
    }
}

export default build

async function getCles(workers, liste_hachage_bytes) {

    if(typeof(liste_hachage_bytes) === 'string') liste_hachage_bytes = [liste_hachage_bytes]

    const { connexion, usagerDao } = workers

    const clesManquantes = [],
          clesDechiffrees = {}

    // Recuperer cles connues localement
    for await (const hachage_bytes of liste_hachage_bytes) {
        const cleDechiffree = await usagerDao.getCleDechiffree(hachage_bytes)
        if(cleDechiffree) {
            clesDechiffrees[hachage_bytes] = cleDechiffree
        } else {
            clesManquantes.push(hachage_bytes)
        }
    }

    console.debug("Cles connues : %d, cles manquantes : %d", Object.keys(clesDechiffrees).length, clesManquantes.length)
    if(clesManquantes.length > 0) {
        // Recuperer les cles du serveur
        const reponseClesChiffrees = await connexion.getClesFichiers(liste_hachage_bytes)
        const cles = await traiterReponseCles(workers, reponseClesChiffrees.cles)
        Object.assign(clesDechiffrees, cles)
    }

    return clesDechiffrees
}

async function getCertificatsMaitredescles(workers) {
    const { connexion } = workers
    const reponse = await connexion.getCertificatsMaitredescles()
    return reponse
}

async function traiterReponseCles(workers, reponseCles) {
    const { chiffrage, usagerDao } = workers
    const clesDechiffrees = {}
    for await(const cleHachage_bytes of Object.keys(reponseCles)) {
        const infoCle = {...reponseCles[cleHachage_bytes]}
        const cleSecrete = await chiffrage.dechiffrerCleSecrete(infoCle.cle)

        infoCle.cleSecrete = cleSecrete
        delete infoCle.cle  // Supprimer cle chiffree

        // Sauvegarder la cle pour reutilisation
        usagerDao.saveCleDechiffree(cleHachage_bytes, cleSecrete, infoCle)
            .catch(err=>{
                console.warn("clesDao.getCles Erreur sauvegarde cle dechiffree %s dans la db locale", err)
            })
    
        clesDechiffrees[cleHachage_bytes] = infoCle
    }
    return clesDechiffrees
}

async function getCleLocale(workers, hachage_bytes) {
    const { usagerDao } = workers
    return await usagerDao.getCleDechiffree(hachage_bytes)
}