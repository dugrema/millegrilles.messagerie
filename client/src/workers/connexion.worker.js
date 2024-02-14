import { expose } from 'comlink'
import connexionClient from '@dugrema/millegrilles.reactjs/src/connexionClientV2'
import {formatterDateString} from '@dugrema/millegrilles.reactjs/src/formatterUtils'
import { MESSAGE_KINDS } from '@dugrema/millegrilles.utiljs/src/constantes'

const CONST_DOMAINE_GROSFICHIERS = 'GrosFichiers',
      CONST_DOMAINE_MAITREDESCLES = 'MaitreDesCles',
      CONST_DOMAINE_MESSAGERIE = 'Messagerie'

function getProfil(requete) {
  requete = requete || {}
  return connexionClient.emitWithAck(
    'getProfil', requete, 
    {kind: MESSAGE_KINDS.KIND_REQUETE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'getProfil', ajouterCertificat: true}
  )
}

function getMessages(requete) {
  return connexionClient.emitWithAck(
    'getMessages', requete, 
    {kind: MESSAGE_KINDS.KIND_REQUETE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'getMessages', ajouterCertificat: true}
  )
}

function getReferenceMessages(requete) {
  return connexionClient.emitWithAck(
    'getReferenceMessages', requete, 
    {kind: MESSAGE_KINDS.KIND_REQUETE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'getReferenceMessages', ajouterCertificat: true}
  )
}

function getMessagesAttachments(requete) {
  return connexionClient.emitWithAck(
    'getMessagesAttachments', requete, 
    {kind: MESSAGE_KINDS.KIND_REQUETE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'getMessagesAttachments', ajouterCertificat: true}
  )
}

function getPermissionMessages(message_ids, opts) {
  opts = opts || {}
  const messages_envoyes = opts.messages_envoyes?true:false
  const requete = {message_ids, messages_envoyes}
  return connexionClient.emitWithAck(
    'getPermissionMessages', requete, 
    {kind: MESSAGE_KINDS.KIND_REQUETE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'getPermissionMessages', ajouterCertificat: true}
  )
}

function getClesChiffrage() {
  return connexionClient.emitWithAck('getClesChiffrage', {noformat: true})
}

function initialiserProfil(adresse) {
  return connexionClient.emitWithAck(
    'initialiserProfil', {adresse}, 
    {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'initialiserProfil', ajouterCertificat: true}
  )
}

function getContacts(params) {
  return connexionClient.emitWithAck(
    'getContacts', params, 
    {kind: MESSAGE_KINDS.KIND_REQUETE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'getContacts', ajouterCertificat: true}
  )
}

function getReferenceContacts(params) {
  return connexionClient.emitWithAck(
    'getReferenceContacts', params, 
    {kind: MESSAGE_KINDS.KIND_REQUETE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'getReferenceContacts', ajouterCertificat: true}
  )
}

function majContact(contact) {
  return connexionClient.emitWithAck(
    'majContact', contact, 
    {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'majContact', ajouterCertificat: true}
  )
}

function marquerLu(message_id, flag_lu) {
  const data = {message_id, lu: flag_lu}
  return connexionClient.emitWithAck(
    'marquerLu', data, 
    {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'lu', ajouterCertificat: true}
  )
}

async function posterMessage(message, commandeMaitrecles, opts) {
  opts = opts || {}

  // Les messages vont etre signes separement et emis en meme temps vers le serveur
  // const messageSigne = await connexionClient.formatterMessage(message, 'Messagerie', {action: 'poster', ajouterCertificat: true})
  // const commandeMaitreclesSignee = await connexionClient.formatterMessage(commandeMaitrecles, 'poster', {domaine: 'MaitreDesCles'})

  return connexionClient.emitWithAck(
    'posterMessage', message,
    {
      kind: MESSAGE_KINDS.KIND_COMMANDE, 
      domaine: CONST_DOMAINE_MESSAGERIE, action: 'poster', 
      attachements: {cle: commandeMaitrecles}, ajouterCertificat: true
    }
  )
}

async function getDomainesMessagerie() {
  return connexionClient.emitWithAck('getDomainesMessagerie', {noformat: true})
}

function copierFichierTiers(commande) {
  return connexionClient.emitWithAck(
    'copierFichierTiers', commande, 
    {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: CONST_DOMAINE_GROSFICHIERS, action: 'copierFichierTiers', ajouterCertificat: true}
  )
}

function creerTokensStreaming(commande) {
  return connexionClient.emitWithAck(
    'creerTokensStreaming', commande, 
    {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'conserverClesAttachments', ajouterCertificat: true}
  )
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
  return connexionClient.emitWithAck(
    'getCollectionUpload', commande, 
    {kind: MESSAGE_KINDS.KIND_REQUETE, domaine: CONST_DOMAINE_GROSFICHIERS, action: 'favorisCreerPath', ajouterCertificat: true}
  )
}

function supprimerMessages(message_ids) {
  if(!Array.isArray(message_ids)) {
    message_ids = [message_ids]
  }
  const commande = { message_ids }
  return connexionClient.emitWithAck(
    'supprimerMessages', commande, 
    {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'supprimerMessages', ajouterCertificat: true}
  )
}

function supprimerContacts(uuidContacts) {
  if(!Array.isArray(uuidContacts)) {
    uuidContacts = [uuidContacts]
  }
  const commande = { uuid_contacts: uuidContacts }
  return connexionClient.emitWithAck('supprimerContacts', commande, {domaine: 'Messagerie', action: 'supprimerContacts', ajouterCertificat: true})
}

function creerTokenStream(commande) {
  throw new Error('obsolete')
  return connexionClient.emitWithAck('creerTokenStream', commande, {domaine: CONST_DOMAINE_MAITREDESCLES, action: 'verifierPreuve', ajouterCertificat: true})
}

async function getClepubliqueWebpush(params) {
  params = params || {}
  return connexionClient.emitWithAck(
    'getClepubliqueWebpush', 
    params, 
    {kind: MESSAGE_KINDS.KIND_REQUETE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'getClepubliqueWebpush', ajouterCertificat: true}
  )
}

async function sauvegarderUsagerConfigNotifications(params) {
  params = params || {}
  return connexionClient.emitWithAck(
    'sauvegarderUsagerConfigNotifications', 
    params, 
    {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'sauvegarderUsagerConfigNotifications', ajouterCertificat: true}
  )
}

async function sauvegarderSubscriptionWebpush(params) {
  params = params || {}
  return connexionClient.emitWithAck(
    'sauvegarderSubscriptionWebpush', 
    params, 
    {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'sauvegarderSubscriptionWebpush', ajouterCertificat: true}
  )
}

async function retirerSubscriptionWebpush(params) {
  params = params || {}
  return connexionClient.emitWithAck(
    'retirerSubscriptionWebpush', 
    params, 
    {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: CONST_DOMAINE_MESSAGERIE, action: 'retirerSubscriptionWebpush', ajouterCertificat: true}
  )
}

async function enregistrerCallbackEvenementContact(params, cb) { 
  return connexionClient.subscribe('enregistrerCallbackEvenementContact', cb, params)
}

async function retirerCallbackEvenementContact(params, cb) {
  return connexionClient.unsubscribe('retirerCallbackEvenementContact', cb, params) 
}

async function enregistrerCallbackEvenementMessages(params, cb) { 
  // const commande = await connexionClient.formatterMessage(params, 'Messagerie')
  return connexionClient.subscribe('enregistrerCallbackEvenementMessages', cb, params)
}

async function retirerCallbackEvenementMessages(params, cb) {
  return connexionClient.unsubscribe('retirerCallbackEvenementMessages', cb, params) 
}

function enregistrerCallbackMajFichier(params, cb) { 
  return connexionClient.subscribe('enregistrerCallbackMajFichier', cb, params)
}

function retirerCallbackMajFichier(params, cb) { 
  return connexionClient.unsubscribe('retirerCallbackMajFichier', cb, params) 
}

// Grosfichiers

function getDocuments(tuuids) {
  return connexionClient.emitWithAck(
    'getDocuments',
    {tuuids_documents: tuuids},
    {kind: MESSAGE_KINDS.KIND_REQUETE, domaine: CONST_DOMAINE_GROSFICHIERS, action: 'documentsParTuuid', attacherCertificat: true}
  )
}

function syncCollection(cuuid, opts) {
  opts = opts || {}
  const {skip, limit} = opts
  const requete = {skip, limit}
  if(cuuid) requete.cuuid = cuuid
  const params = {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: CONST_DOMAINE_GROSFICHIERS, action: 'syncCollection', ajouterCertificat: true}
  // console.debug("syncCollection %O, %O", requete, params)
  return connexionClient.emitWithAck('syncCollection', requete, params)
}

async function getClesFichiers(fuuids) {
  const params = { fuuids }
  // return connexionClient.emitWithAck('getPermissionCles', params, {domaine: CONST_DOMAINE_GROSFICHIERS, action: 'getClesFichiers', ajouterCertificat: true})
  return connexionClient.emitWithAck(
    'getPermissionCles', params, 
    {kind: MESSAGE_KINDS.KIND_REQUETE, domaine: CONST_DOMAINE_GROSFICHIERS, action: 'getClesFichiers', ajouterCertificat: true}
  )
}

// Exposer methodes du Worker
expose({
    ...connexionClient, 
    
    getClesChiffrage, 

    // Requetes et commandes privees
    getProfil, getMessages, getReferenceMessages, getPermissionMessages, getMessagesAttachments,
    posterMessage,
    getDomainesMessagerie, getContacts, getReferenceContacts, majContact, marquerLu,
    copierFichierTiers, getCollectionUpload,
    supprimerMessages, supprimerContacts,

    initialiserProfil, getClepubliqueWebpush,
    // creerTokenStream,
    sauvegarderUsagerConfigNotifications, sauvegarderSubscriptionWebpush, retirerSubscriptionWebpush,

    // GrosFichiers pour attachements
    syncCollection, getDocuments, getClesFichiers, creerTokensStreaming,
    // getCollection, getDocumentsParFuuid, getFavoris,

    // Listeners
    enregistrerCallbackEvenementContact, retirerCallbackEvenementContact,
    enregistrerCallbackEvenementMessages, retirerCallbackEvenementMessages,
    enregistrerCallbackMajFichier, retirerCallbackMajFichier,

})
