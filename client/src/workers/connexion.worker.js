import { expose } from 'comlink'
import * as ConnexionClient from '@dugrema/millegrilles.reactjs/src/connexionClient'
import {formatterDateString} from '@dugrema/millegrilles.reactjs/src/formatterUtils'

const CONST_DOMAINE_GROSFICHIERS = 'GrosFichiers',
      CONST_DOMAINE_MAITREDESCLES = 'MaitreDesCles',
      CONST_DOMAINE_FICHIERS = 'fichiers',
      CONST_DOMAINE_MESSAGERIE = 'Messagerie',
      CONST_DOMAINE_TOPOLOGIE = 'CoreTopologie'

function getProfil(requete) {
  requete = requete || {}
  return ConnexionClient.emitBlocking('getProfil', requete, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'getProfil', ajouterCertificat: true})
}

function getMessages(requete) {
  return ConnexionClient.emitBlocking('getMessages', requete, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'getMessages', ajouterCertificat: true})
}

function getPermissionMessages(uuid_transaction_messages) {
  const requete = {uuid_transaction_messages}
  return ConnexionClient.emitBlocking('getPermissionMessages', requete, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'getPermissionMessages', ajouterCertificat: true})
}

function getClesChiffrage() {
  return ConnexionClient.emitBlocking('getClesChiffrage', {})
}

function initialiserProfil(adresse) {
  return ConnexionClient.emitBlocking('initialiserProfil', {adresse}, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'initialiserProfil', ajouterCertificat: true})
}

function getContacts() {
  return ConnexionClient.emitBlocking('getContacts', {}, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'getContacts', ajouterCertificat: true})
}

function majContact(contact) {
  return ConnexionClient.emitBlocking('majContact', contact, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'majContact', ajouterCertificat: true})
}

function marquerLu(uuid_message, flag_lu) {
  const data = {uuid_transaction: uuid_message, lu: flag_lu}
  return ConnexionClient.emitBlocking('marquerLu', data, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'lu', ajouterCertificat: true})
}

// GrosFichiers pour attachements

async function getClesFichiers(fuuids, usager, opts) {
  opts = opts || {}

  if(opts.cache) console.warn("TODO - supporter cache cles dans idb")

  // TODO - tenter de charger via idb

  const extensions = usager || {}
  const delegationGlobale = extensions.delegationGlobale

  if(!delegationGlobale) {
    const params = { fuuids }
    return ConnexionClient.emitBlocking('getPermissionCles', params, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'getClesFichiers', ajouterCertificat: true})
  } else {
    const permission = opts.permission
    const params = { liste_hachage_bytes: fuuids, permission }
    return ConnexionClient.emitBlocking('getClesFichiers', params, {domaine: CONST_DOMAINE_MAITREDESCLES, action: 'dechiffrage', ajouterCertificat: true})
  }
}

function getCollection(tuuidsDocuments) {
  const params = {tuuid_collection: tuuidsDocuments}
  return ConnexionClient.emitBlocking('getCollection', params, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'contenuCollection', ajouterCertificat: true})
}

function getDocuments(tuuids) {
  return ConnexionClient.emitBlocking(
    'getDocuments',
    {tuuids_documents: tuuids},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'documentsParTuuid', attacherCertificat: true}
  )
}

function getDocumentsParFuuid(fuuids) {
  return ConnexionClient.emitBlocking(
    'getDocumentsParFuuid',
    {fuuids_documents: fuuids},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'documentsParFuuid', attacherCertificat: true}
  )
}

function getFavoris() {
  return ConnexionClient.emitBlocking('getFavoris', {}, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'favoris', ajouterCertificat: true})
}

async function posterMessage(message, commandeMaitrecles, opts) {
  opts = opts || {}

  // Les messages vont etre signes separement et emis en meme temps vers le serveur
  const messageSigne = await ConnexionClient.formatterMessage(message, 'Messagerie', {action: 'poster', ajouterCertificat: true})
  // const commandeMaitreclesSignee = await ConnexionClient.formatterMessage(commandeMaitrecles, 'poster', {domaine: 'MaitreDesCles'})

  return ConnexionClient.emitBlocking('posterMessage', {message: messageSigne, commandeMaitrecles})
}

async function getDomainesMessagerie() {
  return ConnexionClient.emitBlocking('getDomainesMessagerie', {})
}

function copierFichierTiers(commande) {
  return ConnexionClient.emitBlocking('copierFichierTiers', commande, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'copierFichierTiers', ajouterCertificat: true})
}

function getCollectionUpload() {
  const dateFormattee = formatterDateString({format: 'YYYY-MM-DD'})
  const commande = {
    favoris_id: 'messagerie',
    path_collections: [
      'outgoing',
      dateFormattee,
    ]
  }
  return ConnexionClient.emitBlocking('getCollectionUpload', commande, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'favorisCreerPath', ajouterCertificat: true})
}

async function enregistrerCallbackEvenementContact(params, cb) { 
  // const commande = await ConnexionClient.formatterMessage(params, 'Messagerie')
  return ConnexionClient.subscribe('enregistrerCallbackEvenementContact', cb, params)
}

async function retirerCallbackEvenementContact(params, cb) {
  return ConnexionClient.unsubscribe('retirerCallbackEvenementContact', cb, params) 
}

// Exposer methodes du Worker
expose({
    ...ConnexionClient, 
    getClesChiffrage, 

    // Requetes et commandes privees
    getProfil, getMessages, getPermissionMessages,
    posterMessage,
    getDomainesMessagerie, getContacts, majContact, marquerLu,
    copierFichierTiers, getCollectionUpload,

    initialiserProfil,

    // GrosFichiers pour attachements
    getClesFichiers, getCollection, getDocuments, getDocumentsParFuuid, getFavoris,

    // Listeners
    enregistrerCallbackEvenementContact, retirerCallbackEvenementContact,

})
