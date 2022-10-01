import React, { lazy, useState, useEffect, useCallback, useMemo, Suspense } from 'react'

import Container from 'react-bootstrap/Container'
import { Provider as ReduxProvider, useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import { trierString, trierNombre } from '@dugrema/millegrilles.utiljs/src/tri'

import ErrorBoundary from './ErrorBoundary'
import useWorkers, {useEtatConnexion, WorkerProvider, useUsager} from './WorkerContext'
import storeSetup from './redux/store'

import { LayoutMillegrilles, ModalErreur, TransfertModal, FormatterDate } from '@dugrema/millegrilles.reactjs'

import messagerieActions from './redux/messagerieSlice'
import contactsActions, {thunks as contactsThunks} from './redux/contactsSlice'
import { setUserId as setUserIdUpload, setUploads, supprimerParEtat, continuerUpload, annulerUpload } from './redux/uploaderSlice'
import { setUserId as setUserIdDownload, supprimerDownloadsParEtat, continuerDownload, arreterDownload, setDownloads } from './redux/downloaderSlice'


// import Contacts, {chargerContenuContacts} from './Contacts'

import { detecterSupport } from './fonctionsFichiers'
import setWorkersTraitementFichiers from './workers/traitementFichiers'
import { dechiffrerMessage } from './cles'

import './i18n'

// Importer JS global
import 'react-bootstrap/dist/react-bootstrap.min.js'

// Importer cascade CSS global
import 'bootstrap/dist/css/bootstrap.min.css'
import 'font-awesome/css/font-awesome.min.css'
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

const PAGE_LIMIT = 40,
      SYNC_BATCH_SIZE = 500,
      CONST_LOCALSTORAGE_USAGER = 'messagerie.usager'

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
  const [uuidMessage, setUuidMessage] = useState('')
  const [dossier, setDossier] = useState('')
  
  const [erreur, setErreur] = useState('')
  const erreurCb = useCallback((err, message)=>{
    console.error("Erreur %s : %O", message, err)
    setErreur({err, message})
  }, [setErreur])
  const handlerCloseErreur = useCallback(()=>setErreur(''), [setErreur])

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
        console.debug("Afficher contacts")
        setAfficherContacts(true)
        break
      case '':
      default:
        setAfficherContacts(false)
    }
  }, [setAfficherContacts])

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
              uuidMessage={uuidMessage}
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

    </LayoutMillegrilles>
  )
}

function Contenu(props) {
  const workers = useWorkers()

  if(!workers) return <Attente />

  const { afficherNouveauMessage, afficherContacts, uuidMessage } = props

  // Selection de la page a afficher
  let Page
  if(afficherContacts) {
    Page = Contacts
  } else if(afficherNouveauMessage) {
    Page = NouveauMessage
  } else if(uuidMessage) {
    Page = AfficherMessage
  } else {
    Page = AfficherMessages
  }

  return (
      <ErrorBoundary erreurCb={props.erreurCb}>
          <Suspense fallback={<Attente />}>
            <Page {...props}/>
          </Suspense>

          <br/><br/>
          
      </ErrorBoundary>
  )
}

// function App() {
  
//   const [workers, setWorkers] = useState('')
//   const [usager, setUsager] = useState('')
//   const [etatConnexion, setEtatConnexion] = useState(false)
//   const [formatteurPret, setFormatteurPret] = useState(false)
//   const [idmg, setIdmg] = useState('')
//   const [certificatMaitreDesCles, setCertificatMaitreDesCles] = useState('')
//   const [dnsMessagerie, setDnsMessagerie] = useState('')
//   const [etatTransfert, setEtatTransfert] = useState('')
//   const [showTransfertModal, setShowTransfertModal] = useState(false)
//   const [confirmation, setConfirmation] = useState(false)
//   const [erreur, setErreur] = useState('')
//   const [supportMedia, setSupportMedia] = useState({})

//   const userId = useMemo(()=>{
//     if(usager) {
//       localStorage.setItem(CONST_LOCALSTORAGE_USAGER, JSON.stringify(usager))
//       return usager.extensions.userId
//     }
//     const usagerLocal = localStorage.getItem(CONST_LOCALSTORAGE_USAGER)
//     if(usagerLocal) {
//       const usagerLocalObj = JSON.parse(usagerLocal)
//       // console.debug("Chargement usager localstorage : %O", usagerLocalObj)
//       return usagerLocalObj.extensions.userId
//     }
//   }, [usager])

//   // Transfert d'information entre pages
//   const [messageRepondre, setMessageRepondre] = useState('')

//   // Liste messages
//   const [listeMessages, setListeMessages] = useState([])
//   const [compteMessages, setCompteMessages] = useState([])
//   const [colonnes, setColonnes] = useState('')
//   const [isListeComplete, setListeComplete] = useState(false)
//   const [evenementMessage, addEvenementMessage] = useState('')
//   const [evenementUpload, addEvenementUpload] = useState('')

//   const { transfertFichiers } = workers
//   const etatAuthentifie = usager && formatteurPret

//   // Selecteurs de page
//   const [afficherContacts, setAfficherContacts] = useState(false)
//   const [afficherNouveauMessage, setAfficherNouveauMessage] = useState(false)
//   const [uuidMessage, setUuidMessage] = useState('')
//   const [dossier, setDossier] = useState('')

//   const erreurCb = useCallback((err, message)=>{
//     console.error("Erreur generique %s : %O", err, message)
//     setErreur({err, message})
//   }, [setErreur])

//   const showTransfertModalOuvrir = useCallback(()=>{ setShowTransfertModal(true) }, [setShowTransfertModal])
//   const showTransfertModalFermer = useCallback(()=>{ setShowTransfertModal(false) }, [setShowTransfertModal])
//   const showConfirmation = useCallback((confirmation, opts)=>{
//     opts = opts || {}
//     const autoclose = opts.autoclose!==false?5000:false
//     setConfirmation(confirmation)
//     if(autoclose) setTimeout(()=>setConfirmation(''), 5000)
//   }, [setConfirmation])

//   const downloadAction = useCallback( fichier => {
//     // console.debug("Download fichier %O", fichier)
//     const { 
//       fuuid, mimetype, nom: filename, taille, 
//       cle
//     } = fichier
//     let { cleSecrete, iv, tag, format } = cle || {}
//     if(typeof(cleSecrete) === 'string') cleSecrete = base64.decode(cleSecrete)

//     // Creer dict de cles avec info secrete pour dechiffrer le fichier
//     transfertFichiers.down_ajouterDownload(fuuid, {mimetype, filename, taille, password: cleSecrete, iv, tag, format})
//         .catch(erreurCb)

//   }, [transfertFichiers, erreurCb])

//   const formatterMessagesCb = useCallback(messages=>{
//     const supprime = dossier === 'supprimes',
//           messages_envoyes = dossier === 'envoyes'
//     formatterMessages(messages, colonnes, userId, setListeMessages, setCompteMessages, erreurCb, {dossier, messages_envoyes, supprime})
//   }, [colonnes, userId, setListeMessages, setCompteMessages, dossier, erreurCb])

//   const getMessagesSuivants = useCallback(()=>{
//     if(!colonnes || !usager) return
//     const { colonne, ordre } = colonnes.tri
//     const userId = usager.extensions.userId
//     MessageDao.getMessages(userId, {colonne, ordre, skip: listeMessages.length, limit: PAGE_LIMIT}).then(liste=>{
//       const nouveauMessagesParUuid = liste.reduce((acc, item)=>{ acc[item.uuid_transaction] = item; return acc }, {})
//       const messagesMaj = listeMessages.map(item=>{
//         const uuid_transaction = item.uuid_transaction
//         const messageNouveau = nouveauMessagesParUuid[uuid_transaction]
//         if(messageNouveau) {
//           delete nouveauMessagesParUuid[uuid_transaction]
//           return messageNouveau
//         }
//         return item
//       })
//       Object.values(nouveauMessagesParUuid).forEach(item=>messagesMaj.push(item))  // Ajouter nouveaux messages
//       formatterMessagesCb(messagesMaj) 
//       setListeComplete(liste.length < PAGE_LIMIT)
//     })
//     .catch(err=>erreurCb(err, "Erreur chargement messages initiaux : %O", err))
//   }, [colonnes, listeMessages, usager, formatterMessagesCb, setListeComplete, erreurCb])

//   const repondreMessageCb = useCallback(message => {
//     setMessageRepondre({message, conserverAttachments: false})
//     setUuidMessage('')
//     setAfficherNouveauMessage(true)
//   }, [setMessageRepondre, setAfficherNouveauMessage])

//   const transfererMessageCb = useCallback(message => {
//     setMessageRepondre({message, conserverAttachments: true, clearTo: true})
//     setUuidMessage('')
//     setAfficherNouveauMessage(true)
//   }, [setMessageRepondre, setAfficherNouveauMessage])

//   const supprimerMessagesCb = useCallback(uuidTransactions => {
//     // console.debug("Supprimer message %s", uuidTransactions)
//     workers.connexion.supprimerMessages(uuidTransactions)
//         .then(reponse=>{
//             // console.debug("Messages supprimes : %O", reponse)
//         })
//         .catch(erreurCb)
//   }, [workers, erreurCb])

//   // Chargement des proprietes et workers
//   useEffect(()=>{
//     detecterSupport(setSupportMedia)
//     Promise.all([
//       importerWorkers(setWorkers),
//       MessageDao.init(),
//     ])
//       .then(()=>{ console.info("Chargement de l'application complete") })
//       .catch(err=>{erreurCb(err, "Erreur chargement application")})
//   }, [setWorkers, setSupportMedia, erreurCb])

//   useEffect(()=>{
//     setWorkersTraitementFichiers(workers)
//     if(workers) {
//       if(workers.connexion) {
//         connecter(workers, setUsager, setEtatConnexion, setFormatteurPret)
//           .then(infoConnexion=>{console.info("Info connexion : %O", infoConnexion)})
//           .catch(err=>{console.debug("Erreur de connexion : %O", err)})
//       }
//       if(workers.transfertFichiers) {
//         // Hook recepteur d'evenements upload
//         const proxCb = proxy((pending, pctEnCours, flags)=>{
//           // console.debug("Evenement transfert fichier pending=%O, pctEnCours=%O, flags=%O", pending, pctEnCours, flags)
//           //if(flags && flags.complete && flags.transaction) {
//             addEvenementUpload({rk: 'upload', pending, pctEnCours, ...flags})
//           //}
//         })
//         workers.transfertFichiers.up_setCallbackUpload(proxCb).catch(erreurCb)
//       }
//     }
//   }, [workers, setUsager, setEtatConnexion, setFormatteurPret, addEvenementUpload, erreurCb])

//   useEffect(()=>{
//       if(!etatAuthentifie) return 

//       workers.chiffrage.getIdmgLocal()
//         .then(idmg=>{
//           setIdmg(idmg)
//         })
//         .catch(err=>console.error("Erreur chargement idmg local : %O", err))

//       workers.connexion.getClesChiffrage()
//         .then(cles=>{
//           console.debug("Cles chiffrage : %O", cles)
//           setCertificatMaitreDesCles(cles.certificat)
//         })
//         .catch(err=>console.error("Erreur chargement cles chiffrage : %O", err))

//       workers.connexion.getDomainesMessagerie()
//         .then( info => chargerDnsMessagerie(info, setDnsMessagerie) )
//         .catch(err=>console.error("Erreur chargement DNS messagerie : %O", err))

//   }, [workers, etatAuthentifie, setIdmg, setCertificatMaitreDesCles, setDnsMessagerie])
  
//   useEffect(()=>{
//     if(workers) {
//       let messages_envoyes = false
//       if(dossier === 'envoyes') messages_envoyes = true
//       setColonnes(preparerColonnes(workers, {messages_envoyes}))
//     }
//   }, [workers, setColonnes, dossier])

//   const rafraichirListe = useCallback(async listeCourante => {
//     if(!colonnes || !userId) return
//     const { colonne, ordre } = colonnes.tri
//     const skip = listeCourante?listeCourante.length:0

//     const inclure_supprime = dossier === 'supprimes',
//           envoyes = dossier === 'envoyes', 
//           params_messages = {colonne, ordre, skip, limit: PAGE_LIMIT, supprime: inclure_supprime, messages_envoyes: envoyes}
    
//     MessageDao.getMessages(userId, params_messages).then(liste=>{
//       // console.debug("Rafraichir liste resultat : %O", liste)
//       formatterMessagesCb(liste) 
//     })
//     .catch(err=>erreurCb(err, "Erreur chargement messages initiaux"))
//   }, [colonnes, userId, formatterMessagesCb, dossier, erreurCb])

//   // Sync liste de messages avec la base de donnees locale
//   useEffect(()=>{
//     if(workers && userId && etatConnexion && etatAuthentifie) {
//       const inclure_supprime = dossier === 'supprimes',
//             envoyes = dossier === 'envoyes'
//       workers.connexion.getReferenceMessages({limit: SYNC_BATCH_SIZE, inclure_supprime, messages_envoyes: envoyes})
//         .then(reponse=>conserverReferenceMessages(workers, userId, reponse.messages, {messages_envoyes: envoyes}))
//         .then(rafraichirListe)
//         .catch(erreurCb)
//     }
//   }, [workers, etatConnexion, userId, etatAuthentifie, dossier, erreurCb, rafraichirListe])

//   // Messages listener
//   useEffect(()=>{
//     const { connexion } = workers
//     if(connexion && etatAuthentifie && usager) {
//       const cb = proxy(addEvenementMessage)
//       const params = {}
//       connexion.enregistrerCallbackEvenementMessages(params, cb)
//         .catch(err=>console.error("Erreur enregistrement evenements messages : %O", err))
//       return () => connexion.retirerCallbackEvenementMessages(params, cb)
//         .catch(err=>erreurCb(err, "Erreur retrait evenements messages"))
//     }
//   }, [workers, etatAuthentifie, usager, addEvenementMessage, erreurCb])

//   // Event handling
//   useEffect(()=>{
//     if(evenementMessage) {
//       addEvenementMessage('')  // Clear event pour eviter cycle d'update
//       traiterEvenementMessage(workers, listeMessages, userId, evenementMessage, formatterMessagesCb)
//         .catch(err=>erreurCb(err, "Erreur traitement evenement message"))
//     }
//   }, [workers, evenementMessage, listeMessages, userId, formatterMessagesCb, addEvenementMessage, erreurCb])

//   // Contacts, sync initial
//   useEffect(()=>{
//     if(colonnes && userId && etatConnexion && etatAuthentifie) {
//         workers.connexion.getReferenceContacts({limit: SYNC_BATCH_SIZE})
//             .then(reponse=>MessageDao.mergeReferenceContacts(userId, reponse.contacts))
//             .then(()=>chargerContenuContacts(workers, userId))
//             .catch(err=>erreurCb(err, "Erreur chargement contacts"))
//     }
//   }, [workers, etatConnexion, etatAuthentifie, colonnes, userId, erreurCb])

//   return (
//     <LayoutApplication>
      
//       <HeaderApplication>
//         <Menu 
//           workers={workers} 
//           usager={usager} 
//           etatConnexion={etatConnexion} 
//           etatTransfert={etatTransfert}
//           setAfficherNouveauMessage={setAfficherNouveauMessage}
//           setUuidMessage={setUuidMessage}
//           setAfficherContacts={setAfficherContacts}
//           showTransfertModal={showTransfertModalOuvrir}
//         />
//       </HeaderApplication>

//       <Container>
//         <Suspense fallback={<Attente />}>

//           <AlertTimeout variant="danger" titre="Erreur" value={erreur} setValue={setErreur} />

//           <Alert show={confirmation?true:false} variant="success" onClose={()=>setConfirmation('')} dismissible>
//             <Alert.Heading>Confirmation</Alert.Heading>
//             <pre>{confirmation}</pre>
//           </Alert>

//           <Contenu 
//             workers={workers} 
//             supportMedia={supportMedia}
//             usager={usager}
//             userId={userId}
//             etatConnexion={etatConnexion&&etatAuthentifie}
//             etatAuthentifie={etatAuthentifie}
//             downloadAction={downloadAction}
//             certificatMaitreDesCles={certificatMaitreDesCles}
//             afficherNouveauMessage={afficherNouveauMessage}
//             setAfficherNouveauMessage={setAfficherNouveauMessage}
//             uuidMessage={uuidMessage}
//             setUuidMessage={setUuidMessage}
//             dnsMessagerie={dnsMessagerie}
//             afficherContacts={afficherContacts}
//             setAfficherContacts={setAfficherContacts}
//             showConfirmation={showConfirmation}
//             colonnes={colonnes}
//             setColonnes={setColonnes}
//             listeMessages={listeMessages}
//             isListeComplete={isListeComplete}
//             compteMessages={compteMessages}
//             getMessagesSuivants={(etatConnexion&&etatAuthentifie)?getMessagesSuivants:null}
//             messageRepondre={messageRepondre}
//             repondreMessageCb={repondreMessageCb}
//             transfererMessageCb={transfererMessageCb}
//             setMessageRepondre={setMessageRepondre}
//             supprimerMessagesCb={supprimerMessagesCb}
//             evenementUpload={evenementUpload}
//             dossier={dossier}
//             setDossier={setDossier}
//             erreurCb={erreurCb}
//           />

//         </Suspense>
//       </Container>

//       <FooterApplication>
//         <Footer workers={workers} idmg={idmg} />
//       </FooterApplication>

//       <TransfertModal 
//         show={showTransfertModal}
//         fermer={showTransfertModalFermer} 
//         workers={workers}
//         setEtatTransfert={setEtatTransfert}
//         isEtatUploadExterne={true}
//         etatUploadExterne={evenementUpload}
//         erreurCb={erreurCb}
//       />

//     </LayoutApplication>
//   )
// }
// export default App

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

function chargerDnsMessagerie(infoDns, setDnsMessagerie) {
  console.info("Info domaines messagerie : %O", infoDns)
  const listeMessagerie = infoDns.filter(item=>item.application==='messagerie_web')
  if(listeMessagerie.length === 0) {
    throw new Error("Serveur de messagerie n'est pas installe ou demarre")
  } if(listeMessagerie.length === 1) {
    const item = listeMessagerie.shift()
    const url = new URL(item.url)
    const hostDns = url.host
    console.info("Host dns messagerie local par defaut : %s", hostDns)
    setDnsMessagerie(hostDns)
  } else {
    // Todo
    throw new Error("TO DO - handling plusieurs serveurs messagerie / serveur manquant")
  }
}

// Initialisation du profil usager
function InitialiserMessagerie(props) {

  const workers = useWorkers()
  const usager = useUsager()
  const dispatch = useDispatch()

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
    // dispatch(contactsActions.setUserId(userId))
    dispatch(messagerieActions.setUserId(userId))
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

function preparerColonnes(workers, opts) {
  opts = opts || {}

  const messages_envoyes = opts.messages_envoyes?true:false
  const colonne_date = messages_envoyes?'date_envoi':'date_reception'

  const params = {
      ordreColonnes: [colonne_date, 'from', 'subject', 'boutonDetail'],
      paramsColonnes: {
          [colonne_date]: {'label': 'Date', formatteur: FormatterDate, xs: 6, md: 3, lg: 2},
          'from': {'label': 'Auteur', xs: 6, md: 4, lg: 4},
          'subject': {'label': 'Sujet', xs: 10, md: 4, lg: 5},
          'boutonDetail': {label: ' ', className: 'droite', showBoutonContexte: true, xs: 2, md: 1, lg: 1},
      },
      tri: {colonne: colonne_date, ordre: -1},
      // rowLoader: data => dechiffrerMessage(workers, data)
      rowLoader: async data => {
          if(data['_etatChargement'] !== 'dechiffre') {
            const messageDechiffre = await dechiffrerMessage(workers, data)
            return {...data, ...messageDechiffre, '_etatChargement': 'dechiffre'}
          } else {
            return data
          }
      },
      rowClassname: data => {
        if(data.lu !== true) return 'nouveau'
        return ''
      }
  }

  return params
}

// function formatterMessages(messages, colonnes, userId, setMessagesFormattes, setCompteMessages, erreurCb, opts) {
//   opts = opts || {}
//   // console.debug("formatterContacts colonnes: %O", colonnes)
//   const {colonne, ordre} = colonnes.tri || {}
//   // let contactsTries = [...contacts]
//   // const userId = usager.extensions.userId

//   let messagesTries = messages.map(item=>{
//       const certificat = item.certificat_message
//       let from = ''
//       if(certificat) {
//           const cert = pki.certificateFromPem(certificat)
//           //const extensions = extraireExtensionsMillegrille(cert)
//           from = cert.subject.getField('CN').value
//       }

//       const fileId = item.uuid_transaction
//       // const adresse = item.adresses?item.adresses[0]:''
//       return {from, ...item, fileId}
//   })

//   // console.debug("Contacts a trier : %O", contactsTries)

//   switch(colonne) {
//       case 'from': messagesTries.sort(trierFrom); break
//       case 'subject': messagesTries.sort(trierSubject); break
//       default: messagesTries.sort(trierDate)
//   }

//   if(ordre < 0) messagesTries = messagesTries.reverse()

//   setMessagesFormattes(messagesTries)

//   // Maj le compte du nombre de messages
//   MessageDao.countMessages(userId, opts).then(setCompteMessages).catch(erreurCb)
// }

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

// async function traiterEvenementMessage(workers, listeMessages, userId, evenementMessage, formatterMessagesCb) {
//   // console.debug("Evenement message : %O", evenementMessage)
//   const action = evenementMessage.routingKey.split('.').pop()
//   const message = evenementMessage.message

//   // Mettre a jour les items de la liste de messages
//   let trouve = false
//   let listeMaj = [...listeMessages]
//   if(action === 'nouveauMessage') {
    
//     // Conserver le message dans la DB
//     const messageCharge = {user_id: userId, ...message, '_etatChargement': 'charge'}
//     await MessageDao.updateMessage(messageCharge)  //, {replace: true})
//     // Dechiffrer le message immediatement
//     const messageDechiffre = await dechiffrerMessage(workers, message)
//     const resultat = {...messageCharge, ...messageDechiffre, '_etatChargement': 'dechiffre'}
    
//     // Retirer le contenu chiffre
//     delete resultat.message_chiffre
//     delete resultat.certificat_message
//     delete resultat.certificat_millegrille
//     await MessageDao.updateMessage(resultat)  //, {replace: true})

//     const { uuid_transaction } = message
//     listeMaj = listeMaj.map(item=>{
//       if(item.uuid_transaction === uuid_transaction) {
//         trouve = true
//         return resultat  // Remplacer message
//       }
//       return item
//     })
//     if(!trouve) {
//       // console.debug("Ajout nouveau message %O", message)
//       listeMaj.push(resultat)
//     }

//   } else if(action === 'messageLu') {
//     const lus = message.lus
//     // Verifier le flag pour chaque message dans notre liste (struct message "lus: {uuid_transaction: bool}")
//     listeMaj = listeMaj.map(item=>{
//       const uuid_transaction = item.uuid_transaction
//       if(lus[uuid_transaction] !== undefined) {
//         MessageDao.updateMessage({uuid_transaction, lu: lus[uuid_transaction]}).catch(err=>console.error("Erreur maj message lu: %O", err))
//         return {...item, lu: lus[uuid_transaction]}
//       }
//       return item
//     })

//   } else if(action === 'messagesSupprimes') {
//     const uuid_transactions = message.uuid_transactions
//     uuid_transactions.forEach(item=>{
//       MessageDao.updateMessage({uuid_transaction: item, supprime: true})
//         .catch(err=>console.error("Erreur marquer message supprime: %O", err))
//     })
//     listeMaj = listeMaj.filter(item => !uuid_transactions.includes(item.uuid_transaction))
//   }

//   formatterMessagesCb(listeMaj)
// }

// async function conserverReferenceMessages(workers, userId, listeReferences, opts) {
//   opts = opts || {}
//   const messages_envoyes = opts.messages_envoyes?true:false
//   await MessageDao.mergeReferenceMessages(userId, listeReferences)
//   await chargerMessagesNouveaux(workers, userId, {messages_envoyes})
  
//   // Recovery (devrait deja etre complete dans chargerMessagesNouveaux)
//   await dechiffrerMessages(workers, userId)
// }

// async function chargerMessagesNouveaux(workers, userId, opts) {
//   opts = opts || {}
//   const messages_envoyes = opts.messages_envoyes
//   const { connexion } = workers

//   const uuid_transactions = await MessageDao.getUuidMessagesParEtatChargement(userId, 'nouveau', {messages_envoyes})

//   const promises = []
//   const conserverMessages = async batch => {
//     const uuid_messages = [...batch]
//     const reponse = await connexion.getMessages({uuid_messages, inclure_supprime: true, messages_envoyes})
//     if(reponse.messages && reponse.messages.length > 0) {
//       for await (const message of reponse.messages) {
//         const messageCharge = {user_id: userId, ...message, '_etatChargement': 'charge'}
//         await MessageDao.updateMessage(messageCharge)

//         // Dechiffrer le message immediatement
//         const messageDechiffre = await dechiffrerMessage(workers, message)
//         const resultat = {...messageCharge, ...messageDechiffre, '_etatChargement': 'dechiffre'}

//         // Retirer le contenu chiffre
//         delete resultat.message_chiffre
//         delete resultat.certificat_message
//         delete resultat.certificat_millegrille
//         await MessageDao.updateMessage(resultat)  //, {replace: true})
//       }
//     }
//   }

//   let batch_uuid_transactions = []
//   while(uuid_transactions.length > 0) {
//     batch_uuid_transactions.push(uuid_transactions.shift())

//     if(batch_uuid_transactions.length === 5) {
//       const p = conserverMessages(batch_uuid_transactions).catch(err=>console.error("Erreur traitement batch messages : %O", err))
//       promises.push(p)
//       batch_uuid_transactions = []  // Reset liste
//     }
//   }

//   if(batch_uuid_transactions.length > 0) {
//     const p = conserverMessages(batch_uuid_transactions)
//     promises.push(p)
//   }

//   await Promise.all(promises)
// }

// async function dechiffrerMessages(workers, userId) {
//   const uuid_transactions = await MessageDao.getUuidMessagesParEtatChargement(userId, 'charge')

//   const conserverMessages = async batch => {
//     const uuid_messages = [...batch]
//     // console.debug("Traiter batch messages non dechiffres : %O", uuid_messages)

//     for await (const uuid_message of uuid_messages) {
//       const message = await MessageDao.getMessage(uuid_message)
//       const messageDechiffre = await dechiffrerMessage(workers, message)
//       const resultat = {...message, ...messageDechiffre, '_etatChargement': 'dechiffre'}
//       // Retirer le contenu chiffre
//       delete resultat.message_chiffre
//       delete resultat.certificat_message
//       await MessageDao.updateMessage(resultat)  // , {replace: true})
//     }

//   }

//   let batch_uuid_transactions = []
//   while(uuid_transactions.length > 0) {
//     batch_uuid_transactions.push(uuid_transactions.shift())

//     if(batch_uuid_transactions.length === 5) {
//       conserverMessages(batch_uuid_transactions).catch(err=>console.error("Erreur traitement batch messages : %O", err))
//       batch_uuid_transactions = []  // Reset liste
//     }
//   }

//   if(batch_uuid_transactions.length > 0) {
//     conserverMessages(batch_uuid_transactions).catch(err=>console.error("Erreur traitement batch messages : %O", err))
//   }

// }

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
