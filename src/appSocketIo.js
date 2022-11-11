// Gestion evenements socket.io pour /millegrilles
const debug = require('debug')('appSocketIo')
const mqdao = require('./mqdao.js')

// const debug = debugLib('appSocketIo')

const routingKeysPrive = [
  'appSocketio.nodejs',  // Juste pour trouver facilement sur exchange - debug
]

const ROUTING_KEYS_FICHIERS = [
  'evenement.grosfichiers.majFichier',
]

const ROUTING_KEYS_COLLECTIONS = [
  'evenement.grosfichiers.majCollection',
]

function configurerEvenements(socket) {

  return {
    listenersPublics: [
      { eventName: 'challenge', callback: (params, cb) => traiter(socket, mqdao.challenge, {params, cb}) },
    ],
    listenersPrives: [
      { eventName: 'getClesChiffrage', callback: (params, cb) => traiter(socket, mqdao.getClesChiffrage, {params, cb}) },
      { eventName: 'getProfil', callback: (params, cb) => traiter(socket, mqdao.getProfil, {params, cb}) },
      { eventName: 'getMessages', callback: (params, cb) => traiter(socket, mqdao.getMessages, {params, cb}) },
      { eventName: 'getReferenceMessages', callback: (params, cb) => traiter(socket, mqdao.getReferenceMessages, {params, cb}) },
      { eventName: 'getMessagesAttachments', callback: (params, cb) => traiter(socket, mqdao.getMessagesAttachments, {params, cb}) },
      { eventName: 'getClesFichiers', callback: (params, cb) => traiter(socket, mqdao.getClesFichiers, {params, cb}) },
      { eventName: 'getPermissionMessages', callback: (params, cb) => traiter(socket, mqdao.getPermissionMessages, {params, cb}) },
      { eventName: 'posterMessage', callback: (params, cb) => traiter(socket, mqdao.posterMessage, {params, cb}) },
      { eventName: 'getDomainesMessagerie', callback: (params, cb) => traiter(socket, mqdao.getDomainesMessagerie, {params, cb}) },
      { eventName: 'initialiserProfil', callback: (params, cb) => traiter(socket, mqdao.initialiserProfil, {params, cb}) },
      { eventName: 'getContacts', callback: (params, cb) => traiter(socket, mqdao.getContacts, {params, cb}) },
      { eventName: 'getReferenceContacts', callback: (params, cb) => traiter(socket, mqdao.getReferenceContacts, {params, cb}) },
      { eventName: 'majContact', callback: (params, cb) => traiter(socket, mqdao.majContact, {params, cb}) },
      { eventName: 'marquerLu', callback: (params, cb) => traiter(socket, mqdao.marquerLu, {params, cb}) },
      { eventName: 'supprimerMessages', callback: (params, cb) => traiter(socket, mqdao.supprimerMessages, {params, cb}) },
      { eventName: 'supprimerContacts', callback: (params, cb) => traiter(socket, mqdao.supprimerContacts, {params, cb}) },
      // { eventName: 'creerTokenStream', callback: (params, cb) => traiter(socket, mqdao.creerTokenStream, {params, cb}) },
      { eventName: 'creerTokensStreaming', callback: (params, cb) => traiter(socket, mqdao.creerTokensStreaming, {params, cb}) },

      // GrosFichiers pour attachements
      { eventName: 'syncCollection', callback: (params, cb) => traiter(socket, mqdao.syncCollection, {params, cb}) },
      { eventName: 'getDocuments', callback: (params, cb) => traiter(socket, mqdao.getDocuments, {params, cb}) },
      { eventName: 'getPermissionCles', callback: (params, cb) => traiter(socket, mqdao.getPermissionCles, {params, cb}) },
      // { eventName: 'getCollection', callback: (params, cb) => traiter(socket, mqdao.getCollection, {params, cb}) },
      // { eventName: 'getDocumentsParFuuid', callback: (params, cb) => traiter(socket, mqdao.getDocumentsParFuuid, {params, cb}) },
      // { eventName: 'getFavoris', callback: (params, cb) => traiter(socket, mqdao.getFavoris, {params, cb}) },
      { eventName: 'copierFichierTiers', callback: (params, cb) => traiter(socket, mqdao.copierFichierTiers, {params, cb}) },
      // { eventName: 'getCollectionUpload', callback: (params, cb) => traiter(socket, mqdao.favorisCreerPath, {params, cb}) },

      // Evenements
      {eventName: 'enregistrerCallbackEvenementContact', callback: (params, cb) => {mqdao.enregistrerCallbackEvenementContact(socket, params, cb)}},
      {eventName: 'retirerCallbackEvenementContact', callback: (params, cb) => {mqdao.retirerCallbackEvenementContact(socket, params, cb)}},
      {eventName: 'enregistrerCallbackEvenementMessages', callback: (params, cb) => {mqdao.enregistrerCallbackEvenementMessages(socket, params, cb)}},
      {eventName: 'retirerCallbackEvenementMessages', callback: (params, cb) => {mqdao.retirerCallbackEvenementMessages(socket, params, cb)}},
      {eventName: 'enregistrerCallbackMajFichier', callback: (params, cb) => {mqdao.enregistrerCallbackMajFichier(socket, params, cb)}},
      {eventName: 'retirerCallbackMajFichier', callback: (params, cb) => {mqdao.retirerCallbackMajFichier(socket, params, cb)}},
    ],
    listenersProteges: [
      // PROTEGE
      // { eventName: 'indexerContenu', callback: (params, cb) => traiter(socket, mqdao.indexerContenu, {params, cb}) },
    ]
  }

}

async function traiter(socket, methode, {params, cb}) {
  const reponse = await methode(socket, params)
  if(cb) cb(reponse)
}

module.exports = { configurerEvenements }
