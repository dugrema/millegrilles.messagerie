import { configureStore } from '@reduxjs/toolkit'
import { reducer as messagerie, setup as setupMessagerie } from './messagerieSlice'
import { reducer as contacts, setup as setupContacts } from './contactsSlice'
import { reducer as navigationSecondaire, setup as setupNavigationSecondaire } from './navigationSecondaireSlice'
import uploader, { uploaderMiddlewareSetup } from './uploaderSlice'
import downloader, { downloaderMiddlewareSetup } from './downloaderSlice'

function storeSetup(workers) {

  // Configurer le store redux
  const store = configureStore({

    reducer: { 
      messagerie,
      contacts,
      navigationSecondaire,  // Utilise pour modal de navigation (copier, deplacer)
      uploader, 
      downloader,
    },

    middleware: (getDefaultMiddleware) => {
      
      // const { dechiffrageMiddleware } = setupMessages(workers)
      const { dechiffrageMiddleware: dechiffrageMiddlewareMessages } = setupMessagerie(workers)
      const { dechiffrageMiddleware: dechiffrageMiddlewareContacts } = setupContacts(workers)
      const { dechiffrageMiddleware: dechiffrageNavigationSecondaire } = setupNavigationSecondaire(workers)
      const uploaderMiddleware = uploaderMiddlewareSetup(workers)
      const downloaderMiddleware = downloaderMiddlewareSetup(workers)

      // Prepend, evite le serializability check
      return getDefaultMiddleware()
        .prepend(dechiffrageMiddlewareMessages.middleware)
        .prepend(dechiffrageMiddlewareContacts.middleware)
        .prepend(dechiffrageNavigationSecondaire.middleware)
        .prepend(uploaderMiddleware.middleware)
        .prepend(downloaderMiddleware.middleware)

    },
  })

  return store
}

export default storeSetup
