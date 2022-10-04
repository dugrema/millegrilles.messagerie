import React, { lazy, useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { Provider as ReduxProvider, useDispatch, useSelector } from 'react-redux'

import Container from 'react-bootstrap/Container'
import { useTranslation } from 'react-i18next'

import { trierString, trierNombre } from '@dugrema/millegrilles.utiljs/src/tri'

import ErrorBoundary from './ErrorBoundary'
import useWorkers, {useEtatConnexion, WorkerProvider, useUsager, useEtatPret} from './WorkerContext'
import storeSetup from './redux/store'

import { LayoutMillegrilles, ModalErreur, TransfertModal } from '@dugrema/millegrilles.reactjs'

import messagerieActions, {thunks as messagerieThunks} from './redux/messagerieSlice'
import {thunks as contactsThunks} from './redux/contactsSlice'
import { setUserId as setUserIdUpload, setUploads, supprimerParEtat, continuerUpload, annulerUpload } from './redux/uploaderSlice'
import { setUserId as setUserIdDownload, supprimerDownloadsParEtat, continuerDownload, arreterDownload, setDownloads } from './redux/downloaderSlice'

import { EvenementsMessageHandler } from './Evenements'

import './i18n'

// Importer JS global
import 'react-bootstrap/dist/react-bootstrap.min.js'

// Importer cascade CSS global
import 'bootstrap/dist/css/bootstrap.min.css'
import 'font-awesome/css/font-awesome.min.css'
import 'react-quill/dist/quill.snow.css'
import '@dugrema/millegrilles.reactjs/dist/index.css'

import manifest from './manifest.build'

import './index.scss'
import './App.css'

import Menu from './Menu'

const CONST_UPLOAD_COMPLET_EXPIRE = 2 * 60 * 60 * 1000,  // Auto-cleanup apres 2 heures (millisecs) de l'upload,
      CONST_DOWNLOAD_COMPLET_EXPIRE = 48 * 60 * 60 * 1000  // Auto-cleanup apres 2 jours (millisecs) du download

const ETAT_PREPARATION = 1,
      ETAT_PRET = 2,
      ETAT_UPLOADING = 3,
      ETAT_COMPLETE = 4,
      ETAT_ECHEC = 5,
      ETAT_CONFIRME = 6,
      ETAT_UPLOAD_INCOMPLET = 7

const CONST_ETATS_DOWNLOAD = {
  ETAT_PRET: 1,
  ETAT_EN_COURS: 2,
  ETAT_SUCCES: 3,
  ETAT_ECHEC: 4
}

const AfficherMessages = lazy(() => import('./AfficherMessages'))
const AfficherMessage = lazy(() => import('./AfficherMessage'))
const Contacts = lazy(() => import('./Contacts'))
const NouveauMessage = lazy(() => import('./NouveauMessage'))

function App() {

  return (
    <WorkerProvider attente={<Attente />}>
      <ErrorBoundary>
        <Suspense fallback={<Attente />}>
          <ProviderReduxLayer />
        </Suspense>
      </ErrorBoundary>
    </WorkerProvider>
  )

}
export default App

function ProviderReduxLayer() {

  const workers = useWorkers()
  const store = useMemo(()=>{
    if(!workers) return
    return storeSetup(workers)
  }, [workers])

  return (
    <ReduxProvider store={store}>
        <LayoutMain />
    </ReduxProvider>
  )
}

function LayoutMain() {

  const { i18n } = useTranslation()
  const workers = useWorkers()

  const etatConnexion = useEtatConnexion()
  const dispatch = useDispatch()

  const [showTransfertModal, setShowTransfertModal] = useState(false)

  // Selecteurs de page
  const [afficherContacts, setAfficherContacts] = useState(false)
  const [afficherNouveauMessage, setAfficherNouveauMessage] = useState(false)
  
  const [erreur, setErreur] = useState('')
  const erreurCb = useCallback((err, message)=>{
    console.error("Erreur %s : %O", message, err)
    setErreur({err, message})
  }, [setErreur])
  const handlerCloseErreur = useCallback(()=>setErreur(''), [setErreur])

  const fermerContacts = useCallback(()=>setAfficherContacts(false), [setAfficherContacts])
  const showNouveauMessage = useCallback(()=>setAfficherNouveauMessage(true), [setAfficherNouveauMessage])
  const fermerNouveauMessage = useCallback(()=>setAfficherNouveauMessage(false), [setAfficherNouveauMessage])

  // Modal transfert et actions
  const showTransfertModalOuvrir = useCallback(()=>{ setShowTransfertModal(true) }, [setShowTransfertModal])
  const showTransfertModalFermer = useCallback(()=>{ setShowTransfertModal(false) }, [setShowTransfertModal])
  const handlerSupprimerUploads = useCallback( params => supprimerUploads(workers, dispatch, params, erreurCb), [dispatch, workers, erreurCb])
  const handlerContinuerUploads = useCallback( params => {
    // console.debug("Continuer upload ", params)
    const { correlation } = params
    dispatch(continuerUpload(workers, {correlation}))
      .catch(err=>erreurCb(err, "Erreur continuer uploads"))
  }, [workers])
  const handlerSupprimerDownloads = useCallback( params => supprimerDownloads(workers, dispatch, params, erreurCb), [dispatch, workers, erreurCb])
  const handlerContinuerDownloads = useCallback( params => {
    // console.debug("Continuer upload ", params)
    const { fuuid } = params
    dispatch(continuerDownload(workers, {fuuid}))
      .catch(err=>erreurCb(err, "Erreur continuer uploads"))
  }, [workers])

  const handlerSelect = useCallback(eventKey => {
    switch(eventKey) {
      case 'contacts':
        setAfficherContacts(true)
        break
      case 'nouveauMessage':
        setAfficherNouveauMessage(true)
        break
      case '':
      default:
        // Revenir a la reception de messages
        setAfficherContacts(false)
        setAfficherNouveauMessage(false)
    }
  }, [setAfficherContacts, setAfficherNouveauMessage])

  const menu = (
    <Menu 
        workers={workers}
        etatConnexion={etatConnexion}
        i18n={i18n} 
        manifest={manifest} 
        showTransfertModal={showTransfertModalOuvrir}
        onSelect={handlerSelect} />
  )

  return (
    <LayoutMillegrilles menu={menu}>

      <Container className="contenu">
        <Suspense fallback={<Attente />}>
          <Contenu 
              afficherNouveauMessage={afficherNouveauMessage}
              afficherContacts={afficherContacts}
              fermerContacts={fermerContacts}
              showNouveauMessage={showNouveauMessage}
              fermerNouveauMessage={fermerNouveauMessage}
              erreurCb={erreurCb}
            />
        </Suspense>
      </Container>

      <Modals 
          showTransfertModal={showTransfertModal}
          showTransfertModalFermer={showTransfertModalFermer}
          erreur={erreur}
          handlerCloseErreur={handlerCloseErreur}
          supprimerUploads={handlerSupprimerUploads}
          continuerUploads={handlerContinuerUploads}
          supprimerDownloads={handlerSupprimerDownloads}
          continuerDownloads={handlerContinuerDownloads}
        />

      <InitialiserMessagerie />
      <InitialisationDownload />
      <InitialisationUpload />
      <EvenementsMessageHandler />

    </LayoutMillegrilles>
  )
}

function Contenu(props) {
  const workers = useWorkers()
  const dispatch = useDispatch()
  const uuidMessage = useSelector(state=>state.messagerie.uuidMessageActif)

  const fermerMessage = useCallback(()=>{
    throw new Error("fixme, dispatch message actif uuid")
  }, [dispatch])

  if(!workers) return <Attente />

  const { afficherNouveauMessage, afficherContacts, fermerContacts, showNouveauMessage, fermerNouveauMessage } = props

  // Selection de la page a afficher
  let Page, retour = null
  if(afficherContacts) {
    Page = Contacts
    retour = fermerContacts
  } else if(afficherNouveauMessage) {
    Page = NouveauMessage
    retour = fermerNouveauMessage
  } else if(uuidMessage) {
    Page = AfficherMessage
    retour = fermerMessage
  } else {
    Page = AfficherMessages
  }

  return (
      <ErrorBoundary erreurCb={props.erreurCb}>
          <Suspense fallback={<Attente />}>
            <Page {...props} retour={retour} showNouveauMessage={showNouveauMessage} />
          </Suspense>

          <br/><br/>
          
      </ErrorBoundary>
  )
}

function Attente(props) {
  return <p>Chargement en cours</p>
}

function Modals(props) {

  const { 
    showTransfertModal, showTransfertModalFermer, erreur, handlerCloseErreur, 
    supprimerUploads, continuerUploads,
    supprimerDownloads, continuerDownloads,
  } = props

  const workers = useWorkers()
  const { t } = useTranslation()
  const uploads = useSelector(state=>state.uploader.liste)
  const progresUpload = useSelector(state=>state.uploader.progres)
  const downloads = useSelector(state=>state.downloader.liste)
  const progresDownload = useSelector(state=>state.downloader.progres)

  return (
    <div>
      <TransfertModal 
          workers={workers}
          show={showTransfertModal}
          fermer={showTransfertModalFermer} 
          uploads={uploads}
          progresUpload={progresUpload}
          downloads={downloads}
          progresDownload={progresDownload}
          supprimerUploads={supprimerUploads}
          continuerUploads={continuerUploads}
          supprimerDownloads={supprimerDownloads}
          continuerDownloads={continuerDownloads}
        />

      <ModalErreur 
          workers={workers}
          show={!!erreur} 
          err={erreur.err} 
          message={erreur.message} 
          titre={t('Erreur.titre')} 
          fermer={handlerCloseErreur} 
        />
    </div>
  )
}

// Initialisation du profil usager
function InitialiserMessagerie(props) {

  const workers = useWorkers(),
        usager = useUsager(),
        dispatch = useDispatch()

  const {userId, nomUsager} = useMemo(()=>{
    if(!usager || !usager.extensions) return {}
    return {
      userId: usager.extensions.userId,
      nomUsager: usager.nomUsager
    }
  }, [usager])

  // Init messagerie et contacts
  useEffect(()=>{
    if(!userId) return  // Rien a faire
    dispatch(messagerieActions.setUserId(userId))
    dispatch(messagerieThunks.chargerMessages(workers))
      .catch(err=>console.error("Erreur chargement messages ", err))
    dispatch(contactsThunks.chargerProfil(workers, userId, nomUsager, window.location))
      .then(()=>{
        console.debug("Profil charger, faire les contacts")
        return dispatch(contactsThunks.chargerContacts(workers))
      })
      .catch(err=>console.error("Erreur chargement profil/contacts ", err))
  }, [workers, userId, nomUsager])

}

function InitialisationDownload(props) {

  const workers = useWorkers()
  const usager = useUsager()
  const dispatch = useDispatch()

  const { downloadFichiersDao } = workers

  const userId = useMemo(()=>{
    if(!usager || !usager.extensions) return
    return usager.extensions.userId
  }, [usager])

  useEffect(()=>{ dispatch(setUserIdDownload(userId)) }, [userId])

  useEffect(()=>{
    if(!downloadFichiersDao || !userId) return
    // console.debug("Initialiser uploader")
    downloadFichiersDao.chargerDownloads(userId)
        .then(async downloads=>{
            // console.debug("Download trouves : %O", downloads)

            const completExpire = new Date().getTime() - CONST_DOWNLOAD_COMPLET_EXPIRE

            downloads = downloads.filter(download=>{
                const { fuuid, etat } = download
                if([CONST_ETATS_DOWNLOAD.ETAT_SUCCES].includes(etat)) {
                    // Cleanup
                    if(download.derniereModification <= completExpire) {
                        // Complet et expire, on va retirer l'upload
                        downloadFichiersDao.supprimerFichier(fuuid)
                            .catch(err=>console.error("Erreur supprimer fichier ", err))
                        return false
                    }
                }
                return true
            })

            for await (const download of downloads) {
                const { etat } = download
                if([CONST_ETATS_DOWNLOAD.ETAT_PRET, CONST_ETATS_DOWNLOAD.ETAT_EN_COURS].includes(etat)) {
                  download.etat = CONST_ETATS_DOWNLOAD.ETAT_ECHEC
                    download.tailleCompletee = 0
                    await downloadFichiersDao.updateFichierDownload(download)
                }
            }

            dispatch(setDownloads(downloads))
        })
        .catch(err=>console.error("Erreur initialisation uploader ", err))
  }, [downloadFichiersDao, userId])      

  return ''
}

function InitialisationUpload(props) {

  const workers = useWorkers()
  const usager = useUsager()
  const dispatch = useDispatch()

  const { uploadFichiersDao } = workers

  const userId = useMemo(()=>{
      if(!usager || !usager.extensions) return
      return usager.extensions.userId
  }, [usager])

  useEffect(()=>{
    dispatch(setUserIdUpload(userId))
  }, [userId])

  useEffect(()=>{
      if(!uploadFichiersDao || !userId) return
      // console.debug("Initialiser uploader")
      uploadFichiersDao.chargerUploads(userId)
          .then(async uploads=>{
              // console.debug("Uploads trouves : %O", uploads)
              // uploads.sort(trierListeUpload)
              // Reset etat uploads en cours (incomplets)

              const completExpire = new Date().getTime() - CONST_UPLOAD_COMPLET_EXPIRE

              uploads = uploads.filter(upload=>{
                  const { correlation, etat } = upload
                  if([ETAT_COMPLETE, ETAT_CONFIRME].includes(etat)) {
                      // Cleanup
                      if(upload.derniereModification <= completExpire) {
                          // Complet et expire, on va retirer l'upload
                          // console.debug("Cleanup upload complete ", upload)
                          uploadFichiersDao.supprimerFichier(correlation)
                              .catch(err=>console.error("Erreur supprimer fichier ", err))
                          return false
                      }
                  } else if(ETAT_PREPARATION === etat) {
                      // Cleanup
                      console.warn("Cleanup upload avec preparation incomplete ", upload)
                      uploadFichiersDao.supprimerFichier(correlation)
                          .catch(err=>console.error("Erreur supprimer fichier ", err))
                      return false
                  }
                  return true
              })

              for await (const upload of uploads) {
                  const { correlation, etat } = upload
                  if([ETAT_PRET, ETAT_UPLOADING].includes(etat)) {
                      upload.etat = ETAT_UPLOAD_INCOMPLET

                      const parts = await uploadFichiersDao.getPartsFichier(correlation)
                      const positionsCompletees = upload.positionsCompletees
                      const tailleCompletee = parts.reduce((acc, item)=>{
                          const position = item.position
                          if(positionsCompletees.includes(position)) acc += item.taille
                          return acc
                      }, 0)

                      upload.tailleCompletee = tailleCompletee
                      await uploadFichiersDao.updateFichierUpload(upload)
                  }
              }

              dispatch(setUploads(uploads))
          })
          .catch(err=>console.error("Erreur initialisation uploader ", err))
  }, [uploadFichiersDao, userId])    

  // Rien a afficher
  return ''
}

function trierDate(a, b) {
  let resultat = trierNombre('date_reception', a, b)
  if(resultat === 0) {
    resultat = trierNombre('date_envoi', a, b)
  }
  return resultat
}

function trierSubject(a, b) {
  return trierString('subject', a, b, {chaine: trierDate})
}

function trierFrom(a, b) {
  return trierString('from', a, b, {chaine: trierDate})
}

function supprimerUploads(workers, dispatch, params, erreurCb) {
  const { correlation, succes, echecs } = params
  if(correlation) {
    dispatch(annulerUpload(workers, correlation))
      .catch(err=>erreurCb(err, "Erreur supprimer upload"))
  }
  if(succes === true) {
    dispatch(supprimerParEtat(workers, ETAT_CONFIRME))
      .then(()=>dispatch(supprimerParEtat(workers, ETAT_COMPLETE)))
      .catch(err=>erreurCb(err, "Erreur supprimer uploads"))
  }
  if(echecs === true) {
    dispatch(supprimerParEtat(workers, ETAT_ECHEC))
      .then(()=>dispatch(supprimerParEtat(workers, ETAT_UPLOAD_INCOMPLET)))
      .catch(err=>erreurCb(err, "Erreur supprimer uploads"))
  }
}

function supprimerDownloads(workers, dispatch, params, erreurCb) {
  const { fuuid, succes, echecs } = params
  if(fuuid) {
    Promise.resolve(dispatch(arreterDownload(workers, fuuid)))
      .catch(err=>erreurCb(err, "Erreur supprimer download"))
  }
  if(succes === true) {
    Promise.resolve(dispatch(supprimerDownloadsParEtat(workers, CONST_ETATS_DOWNLOAD.ETAT_SUCCES)))
      .catch(err=>erreurCb(err, "Erreur supprimer downloads"))
  }
  if(echecs === true) {
    Promise.resolve(dispatch(supprimerDownloadsParEtat(workers, CONST_ETATS_DOWNLOAD.ETAT_ECHEC)))
      .catch(err=>erreurCb(err, "Erreur supprimer downloads"))
  }
}
