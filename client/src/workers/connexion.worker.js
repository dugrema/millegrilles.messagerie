import { expose } from 'comlink'
// import { ConnexionClient, saveCleDechiffree, getCleDechiffree } from '@dugrema/millegrilles.reactjs'
import * as ConnexionClient from '@dugrema/millegrilles.reactjs/src/connexionClient'

const CONST_DOMAINE_GROSFICHIERS = 'GrosFichiers',
      CONST_DOMAINE_MAITREDESCLES = 'MaitreDesCles',
      CONST_DOMAINE_FICHIERS = 'fichiers'

function getFavoris() {
  return ConnexionClient.emitBlocking('getFavoris', {}, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'favoris', ajouterCertificat: true})
}

function getCorbeille() {
  return ConnexionClient.emitBlocking('getCorbeille', {}, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'getCorbeille', ajouterCertificat: true})
}

function getRecents(params) {
  return ConnexionClient.emitBlocking('getRecents', params, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'activiteRecente', ajouterCertificat: true})
}

function getContenuCollection(tuuidsDocuments) {
  const params = {tuuid_collection: tuuidsDocuments}
  return ConnexionClient.emitBlocking('getCollection', params, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'contenuCollection', ajouterCertificat: true})
}

async function getClesFichiers(fuuids, usager, opts) {
  opts = opts || {}

  if(opts.cache) console.warn("TODO - supporter cache cles dans idb")

  // Todo - tenter de charger 

  const extensions = usager || {}
  const delegationGlobale = extensions.delegationGlobale

  let permission = null
  if(!delegationGlobale) {
    // On doit demander une permission en premier
    const params = { fuuids }
    permission = await ConnexionClient.emitBlocking('getPermissionCle', params, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'getPermission', ajouterCertificat: true})
    console.debug("Permission recue : %O", permission)
  }

  const params = {
    liste_hachage_bytes: fuuids,
    permission,
  }
  return ConnexionClient.emitBlocking('getClesFichiers', params, {domaine: CONST_DOMAINE_MAITREDESCLES, action: 'dechiffrage', ajouterCertificat: true})
}

async function getPermission(fuuids) {
  // Test pour delegation
  // const extensions = usager || {}
  // const delegationGlobale = extensions.delegationGlobale
  // let permission = null
  // if(!delegationGlobale) {}

  // On doit demander une permission en premier
  const params = { fuuids }
  const permission = await ConnexionClient.emitBlocking('getPermissionCle', params, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'getPermission', ajouterCertificat: true})
  console.debug("Permission recue : %O", permission)

  return permission
}

function creerCollection(nomCollection, opts) {
  opts = opts || {}
  const params = {nom: nomCollection}
  if(opts.cuuid) params.cuuid = opts.cuuid
  if(opts.favoris) params.favoris = true
  return ConnexionClient.emitBlocking(
    'creerCollection', 
    params, 
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'nouvelleCollection', ajouterCertificat: true}
  )
}

function toggleFavoris(etatFavoris) {
  // Format etatFavoris : {tuuid1: false, tuuid2: true, ...}
  return ConnexionClient.emitBlocking(
    'changerFavoris',
    {favoris: etatFavoris},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'changerFavoris', attacherCertificat: true}
  )
}

function retirerDocumentsCollection(cuuid, tuuids) {
  return ConnexionClient.emitBlocking(
    'retirerDocuments',
    {cuuid, retirer_tuuids: tuuids},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'retirerDocumentsCollection', attacherCertificat: true}
  )
}

function supprimerDocuments(tuuids) {
  return ConnexionClient.emitBlocking(
    'supprimerDocuments',
    {tuuids},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'supprimerDocuments', attacherCertificat: true}
  )
}

function decrireFichier(tuuid, params) {
  return ConnexionClient.emitBlocking(
    'decrireFichier',
    {...params, tuuid},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'decrireFichier', attacherCertificat: true}
  )
}

function decrireCollection(tuuid, params) {
  return ConnexionClient.emitBlocking(
    'decrireCollection',
    {...params, tuuid},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'decrireCollection', attacherCertificat: true}
  )
}

function getDocuments(tuuids) {
  return ConnexionClient.emitBlocking(
    'getDocuments',
    {tuuids_documents: tuuids},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'documentsParTuuid', attacherCertificat: true}
  )
}

function recupererDocuments(tuuids) {
  return ConnexionClient.emitBlocking(
    'recupererDocuments',
    {tuuids},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'recupererDocuments', attacherCertificat: true}
  )
}

function copierVersCollection(cuuid, tuuids) {
  return ConnexionClient.emitBlocking(
    'copierVersCollection',
    {cuuid, inclure_tuuids: tuuids},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'ajouterFichiersCollection', attacherCertificat: true}
  )
}

function deplacerFichiersCollection(cuuid_origine, cuuid_destination, tuuids) {
  return ConnexionClient.emitBlocking(
    'deplacerFichiersCollection',
    {cuuid_origine, cuuid_destination, inclure_tuuids: tuuids},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'deplacerFichiersCollection', attacherCertificat: true}
  )
}

function rechercheIndex(mots_cles, from_idx, size) {
  from_idx = from_idx?from_idx:0
  size = size?size:50
  return ConnexionClient.emitBlocking(
    'rechercheIndex',
    {mots_cles, from_idx, size},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'rechercheIndex', attacherCertificat: true}
  )
}

function transcoderVideo(commande) {
  return ConnexionClient.emitBlocking(
    'transcoderVideo',
    commande,
    {domaine: CONST_DOMAINE_FICHIERS, action: 'transcoderVideo', attacherCertificat: true}
  )
}

// Fonctions delegues

function indexerContenu(reset) {
  return ConnexionClient.emitBlocking(
    'indexerContenu',
    {reset},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'indexerContenu', attacherCertificat: true}
  )
}

// async function regenererPreviews(uuidFichiers) {
//   const commande = { uuid: uuidFichiers }
//   return connexionClient.emitBlocking(
//     'grosfichiers/regenererPreviews',
//     commande,
//     {domaine: 'GrosFichiers', action: 'completerPreviews', attacherCertificat: true}
//   )
// }

async function enregistrerCallbackMajFichier(cb) {
  ConnexionClient.socketOn('evenement.grosfichiers.majFichier', cb)
  const resultat = await ConnexionClient.emitBlocking('ecouterMajFichiers', {}, {noformat: true})
  if(!resultat) {
    throw new Error("Erreur enregistrerCallbackMajFichier")
  }
}

async function enregistrerCallbackMajCollection(cb) {
  ConnexionClient.socketOn('evenement.grosfichiers.majCollection', cb)
  const resultat = await ConnexionClient.emitBlocking('ecouterMajCollections', {}, {noformat: true})
  if(!resultat) {
    throw new Error("Erreur enregistrerCallbackMajFichier")
  }
}

async function enregistrerCallbackTranscodageProgres(fuuid, cb) {
  console.debug("!!! enregistrerCallbackTranscodageProgres fuuid %s", fuuid)
  ConnexionClient.socketOn('evenement.fichiers.transcodageProgres', cb)
  const resultat = await ConnexionClient.emitBlocking('ecouterTranscodageProgres', {fuuid}, {noformat: true})
  if(!resultat) {
    throw new Error("Erreur enregistrerCallbackMajFichier")
  }
}

async function supprimerCallbackTranscodageProgres(fuuid) {
  console.debug("!!! supprimerCallbackTranscodageProgres fuuid %s", fuuid)
  ConnexionClient.socketOff('evenement.fichiers.transcodageProgres')
  const resultat = await ConnexionClient.emitBlocking('retirerTranscodageProgres', {fuuid}, {noformat: true})
  if(!resultat) {
    throw new Error("Erreur enregistrerCallbackMajFichier")
  }
}

// comlinkExpose({
//   ...ConnexionClient,
//   connecter,  // Override de connexionClient.connecter
//   setCallbacks,

//   requeteDocuments, getClesChiffrage, getFichiersActivite, getFichiersCorbeille,
//   //getCleFichier,
//   getFavoris, getSites, getCollections, getContenuCollection,
//   ajouterDocumentsDansCollection, creerCollection, toggleFavoris, supprimerDocuments,
//   retirerDocumentsCollection, recupererDocuments, renommerDocument, decrireCollection,
//   decrireFichier, transcoderVideo, getConversionsMedia,
//   demandePermissionDechiffragePublic, getCleFichierProtege,
//   estActif, regenererPreviews, rechercherIndex, indexerFichiers,

//   enregistrerCallbackMajFichier, enregistrerCallbackMajCollection,
//   enregistrerCallbackTranscodageProgres, supprimerCallbackTranscodageProgres,
// })

// Exposer methodes du Worker
expose({
    ...ConnexionClient, 

    // Requetes et commandes privees
    getDocuments, getClesFichiers,
    getFavoris, getCorbeille, getRecents, getContenuCollection,
    creerCollection, toggleFavoris, 
    recupererDocuments, retirerDocumentsCollection, supprimerDocuments,
    decrireFichier, decrireCollection,
    copierVersCollection, deplacerFichiersCollection,
    rechercheIndex, transcoderVideo, getPermission,

    // Event listeners prives
    enregistrerCallbackMajFichier, enregistrerCallbackMajCollection,
    enregistrerCallbackTranscodageProgres, supprimerCallbackTranscodageProgres,

    // Commandes delegue
    indexerContenu,

})
