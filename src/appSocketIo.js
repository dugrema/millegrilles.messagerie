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
      { eventName: 'getMessages', callback: (params, cb) => traiter(socket, mqdao.getMessages, {params, cb}) },
      { eventName: 'getClesFichiers', callback: (params, cb) => traiter(socket, mqdao.getClesFichiers, {params, cb}) },
      { eventName: 'getPermissionMessages', callback: (params, cb) => traiter(socket, mqdao.getPermissionMessages, {params, cb}) },

      // Evenements
      // {eventName: 'ecouterMajFichiers', callback: (_, cb) => {mqdao.ecouterMajFichiers(socket, cb)}},
      // {eventName: 'ecouterMajCollections', callback: (_, cb) => {mqdao.ecouterMajCollections(socket, cb)}},
      // {eventName: 'ecouterTranscodageProgres', callback: (params, cb) => {mqdao.ecouterTranscodageProgres(socket, params, cb)}},
      // {eventName: 'retirerTranscodageProgres', callback: (params, cb) => {mqdao.retirerTranscodageProgres(socket, params, cb)}},
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
