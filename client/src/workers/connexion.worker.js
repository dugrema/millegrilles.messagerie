import { expose } from 'comlink'
import * as ConnexionClient from '@dugrema/millegrilles.reactjs/src/connexionClient'
import {formatterDateString} from '@dugrema/millegrilles.reactjs/src/formatterUtils'

const CONST_DOMAINE_GROSFICHIERS = 'GrosFichiers',
      CONST_DOMAINE_MAITREDESCLES = 'MaitreDesCles',
      // CONST_DOMAINE_FICHIERS = 'fichiers',
      CONST_DOMAINE_MESSAGERIE = 'Messagerie'
      // CONST_DOMAINE_TOPOLOGIE = 'CoreTopologie'

function getProfil(requete) {
  requete = requete || {}
  return ConnexionClient.emitBlocking('getProfil', requete, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'getProfil', ajouterCertificat: true})
}

function getMessages(requete) {
  return ConnexionClient.emitBlocking('getMessages', requete, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'getMessages', ajouterCertificat: true})
}

function getReferenceMessages(requete) {
  return ConnexionClient.emitBlocking('getReferenceMessages', requete, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'getReferenceMessages', ajouterCertificat: true})
}

function getMessagesAttachments(requete) {
  return ConnexionClient.emitBlocking('getMessagesAttachments', requete, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'getMessagesAttachments', ajouterCertificat: true})
}

function getPermissionMessages(uuid_transaction_messages, opts) {
  opts = opts || {}
  const messages_envoyes = opts.messages_envoyes?true:false
  const requete = {uuid_transaction_messages, messages_envoyes}
  return ConnexionClient.emitBlocking('getPermissionMessages', requete, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'getPermissionMessages', ajouterCertificat: true})
}

function getClesChiffrage() {
  return ConnexionClient.emitBlocking('getClesChiffrage', {})
}

function initialiserProfil(adresse) {
  return ConnexionClient.emitBlocking('initialiserProfil', {adresse}, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'initialiserProfil', ajouterCertificat: true})
}

function getContacts(params) {
  return ConnexionClient.emitBlocking('getContacts', params, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'getContacts', ajouterCertificat: true})
}

function getReferenceContacts(params) {
  return ConnexionClient.emitBlocking('getReferenceContacts', params, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'getReferenceContacts', ajouterCertificat: true})
}

function majContact(contact) {
  return ConnexionClient.emitBlocking('majContact', contact, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'majContact', ajouterCertificat: true})
}

function marquerLu(uuid_message, flag_lu) {
  const data = {uuid_transaction: uuid_message, lu: flag_lu}
  return ConnexionClient.emitBlocking('marquerLu', data, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'lu', ajouterCertificat: true})
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

function creerTokensStreaming(commande) {
  return ConnexionClient.emitBlocking('creerTokensStreaming', commande, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'conserverClesAttachments', ajouterCertificat: true})
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

function supprimerMessages(uuidTransactions) {
  if(!Array.isArray(uuidTransactions)) {
    uuidTransactions = [uuidTransactions]
  }
  const commande = { uuid_transactions: uuidTransactions }
  return ConnexionClient.emitBlocking('supprimerMessages', commande, {domaine: CONST_DOMAINE_MESSAGERIE, action: 'supprimerMessages', ajouterCertificat: true})
}

function supprimerContacts(uuidContacts) {
  if(!Array.isArray(uuidContacts)) {
    uuidContacts = [uuidContacts]
  }
  const commande = { uuid_contacts: uuidContacts }
  return ConnexionClient.emitBlocking('supprimerContacts', commande, {domaine: 'Messagerie', action: 'supprimerContacts', ajouterCertificat: true})
}

function creerTokenStream(commande) {
  return ConnexionClient.emitBlocking('creerTokenStream', commande, {domaine: CONST_DOMAINE_MAITREDESCLES, action: 'verifierPreuve', ajouterCertificat: true})
}

async function enregistrerCallbackEvenementContact(params, cb) { 
  return ConnexionClient.subscribe('enregistrerCallbackEvenementContact', cb, params)
}

async function retirerCallbackEvenementContact(params, cb) {
  return ConnexionClient.unsubscribe('retirerCallbackEvenementContact', cb, params) 
}

async function enregistrerCallbackEvenementMessages(params, cb) { 
  // const commande = await ConnexionClient.formatterMessage(params, 'Messagerie')
  return ConnexionClient.subscribe('enregistrerCallbackEvenementMessages', cb, params)
}

async function retirerCallbackEvenementMessages(params, cb) {
  return ConnexionClient.unsubscribe('retirerCallbackEvenementMessages', cb, params) 
}

function enregistrerCallbackMajFichier(params, cb) { 
  return ConnexionClient.subscribe('enregistrerCallbackMajFichier', cb, params)
}

function retirerCallbackMajFichier(params, cb) { 
  return ConnexionClient.unsubscribe('retirerCallbackMajFichier', cb, params) 
}

// Grosfichiers

function getDocuments(tuuids) {
  return ConnexionClient.emitBlocking(
    'getDocuments',
    {tuuids_documents: tuuids},
    {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'documentsParTuuid', attacherCertificat: true}
  )
}

function syncCollection(cuuid, opts) {
  opts = opts || {}
  const {skip, limit} = opts
  const requete = {skip, limit}
  if(cuuid) requete.cuuid = cuuid
  const params = {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'syncCollection', ajouterCertificat: true}
  // console.debug("syncCollection %O, %O", requete, params)
  return ConnexionClient.emitBlocking('syncCollection', requete, params)
}

async function getClesFichiers(fuuids) {
  const params = { fuuids }
  // return ConnexionClient.emitBlocking('getPermissionCles', params, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'getClesFichiers', ajouterCertificat: true})
  return ConnexionClient.emitBlocking('getPermissionCles', params, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'getClesFichiers', ajouterCertificat: true})
}

// function getCollection(tuuidsDocuments) {
//   const params = {tuuid_collection: tuuidsDocuments}
//   return ConnexionClient.emitBlocking('getCollection', params, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'contenuCollection', ajouterCertificat: true})
// }

// function getDocumentsParFuuid(fuuids) {
//   return ConnexionClient.emitBlocking(
//     'getDocumentsParFuuid',
//     {fuuids_documents: fuuids},
//     {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'documentsParFuuid', attacherCertificat: true}
//   )
// }

// function getFavoris() {
//   return ConnexionClient.emitBlocking('getFavoris', {}, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'favoris', ajouterCertificat: true})
// }

// Exposer methodes du Worker
expose({
    ...ConnexionClient, 
    getClesChiffrage, 

    // Requetes et commandes privees
    getProfil, getMessages, getReferenceMessages, getPermissionMessages, getMessagesAttachments,
    posterMessage,
    getDomainesMessagerie, getContacts, getReferenceContacts, majContact, marquerLu,
    copierFichierTiers, getCollectionUpload,
    supprimerMessages, supprimerContacts,

    initialiserProfil, // creerTokenStream,

    // GrosFichiers pour attachements
    syncCollection, getDocuments, getClesFichiers, creerTokensStreaming,
    // getCollection, getDocumentsParFuuid, getFavoris,

    // Listeners
    enregistrerCallbackEvenementContact, retirerCallbackEvenementContact,
    enregistrerCallbackEvenementMessages, retirerCallbackEvenementMessages,
    enregistrerCallbackMajFichier, retirerCallbackMajFichier,

})
