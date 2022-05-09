import { lazy, useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { base64 } from "multiformats/bases/base64"
import { proxy } from 'comlink'

import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Alert from 'react-bootstrap/Alert'

import { pki } from '@dugrema/node-forge'
import { trierString, trierNombre } from '@dugrema/millegrilles.utiljs/src/tri'
import { 
  LayoutApplication, HeaderApplication, FooterApplication, TransfertModal, FormatterDate, AlertTimeout 
} from '@dugrema/millegrilles.reactjs'

import { detecterSupport } from './fonctionsFichiers'
import * as MessageDao from './messageDao'
import { setWorkers as setWorkersTraitementFichiers } from './workers/traitementFichiers'
import { dechiffrerMessage } from './cles'

import stylesCommuns from '@dugrema/millegrilles.reactjs/dist/index.css'

import './App.css'

import Menu from './Menu'

const Accueil = lazy(() => import('./Accueil'))
const AfficherMessage = lazy(() => import('./AfficherMessage'))
const Contacts = lazy(() => import('./Contacts'))
const NouveauMessage = lazy(() => import('./NouveauMessage'))

const PAGE_LIMIT = 40,
      SYNC_BATCH_SIZE = 500,
      CONST_LOCALSTORAGE_USAGER = 'messagerie.usager'

function App() {
  
  const [workers, setWorkers] = useState('')
  const [usager, setUsager] = useState('')
  const [etatConnexion, setEtatConnexion] = useState(false)
  const [formatteurPret, setFormatteurPret] = useState(false)
  const [idmg, setIdmg] = useState('')
  const [certificatMaitreDesCles, setCertificatMaitreDesCles] = useState('')
  const [dnsMessagerie, setDnsMessagerie] = useState('')
  const [etatTransfert, setEtatTransfert] = useState('')
  const [showTransfertModal, setShowTransfertModal] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [erreur, setErreur] = useState('')
  const [supportMedia, setSupportMedia] = useState({})

  const userId = useMemo(()=>{
    if(usager) {
      localStorage.setItem(CONST_LOCALSTORAGE_USAGER, JSON.stringify(usager))
      return usager.extensions.userId
    }
    const usagerLocal = localStorage.getItem(CONST_LOCALSTORAGE_USAGER)
    if(usagerLocal) {
      const usagerLocalObj = JSON.parse(usagerLocal)
      // console.debug("Chargement usager localstorage : %O", usagerLocalObj)
      return usagerLocalObj.extensions.userId
    }
  }, [usager])

  // Transfert d'information entre pages
  const [messageRepondre, setMessageRepondre] = useState('')

  // Liste messages
  const [listeMessages, setListeMessages] = useState([])
  const [compteMessages, setCompteMessages] = useState([])
  const [colonnes, setColonnes] = useState('')
  const [isListeComplete, setListeComplete] = useState(false)
  const [evenementMessage, addEvenementMessage] = useState('')
  const [evenementUpload, addEvenementUpload] = useState('')

  const { transfertFichiers } = workers
  const etatAuthentifie = usager && formatteurPret

  // Selecteurs de page
  const [afficherContacts, setAfficherContacts] = useState(false)
  const [afficherNouveauMessage, setAfficherNouveauMessage] = useState(false)
  const [uuidMessage, setUuidMessage] = useState('')
  const [dossier, setDossier] = useState('')

  const erreurCb = useCallback((err, message)=>{
    console.error("Erreur generique %s : %O", err, message)
    setErreur({err, message})
  }, [setErreur])

  const showTransfertModalOuvrir = useCallback(()=>{ setShowTransfertModal(true) }, [setShowTransfertModal])
  const showTransfertModalFermer = useCallback(()=>{ setShowTransfertModal(false) }, [setShowTransfertModal])
  const showConfirmation = useCallback((confirmation, opts)=>{
    opts = opts || {}
    const autoclose = opts.autoclose!==false?5000:false
    setConfirmation(confirmation)
    if(autoclose) setTimeout(()=>setConfirmation(''), 5000)
  }, [setConfirmation])

  const downloadAction = useCallback( fichier => {
    // console.debug("Download fichier %O", fichier)
    const { 
      fuuid, mimetype, nom: filename, taille, 
      cle
    } = fichier
    let { cleSecrete, iv, tag, format } = cle || {}
    if(typeof(cleSecrete) === 'string') cleSecrete = base64.decode(cleSecrete)

    // Creer dict de cles avec info secrete pour dechiffrer le fichier
    transfertFichiers.down_ajouterDownload(fuuid, {mimetype, filename, taille, password: cleSecrete, iv, tag, format})
        .catch(erreurCb)

  }, [transfertFichiers, erreurCb])

  const formatterMessagesCb = useCallback(messages=>{
    const supprime = dossier === 'supprimes'
    formatterMessages(messages, colonnes, userId, setListeMessages, setCompteMessages, erreurCb, {supprime})
  }, [colonnes, userId, setListeMessages, setCompteMessages, dossier, erreurCb])

  const getMessagesSuivants = useCallback(()=>{
    if(!colonnes || !usager) return
    const { colonne, ordre } = colonnes.tri
    const userId = usager.extensions.userId
    MessageDao.getMessages(userId, {colonne, ordre, skip: listeMessages.length, limit: PAGE_LIMIT}).then(liste=>{
      const nouveauMessagesParUuid = liste.reduce((acc, item)=>{ acc[item.uuid_transaction] = item; return acc }, {})
      const messagesMaj = listeMessages.map(item=>{
        const uuid_transaction = item.uuid_transaction
        const messageNouveau = nouveauMessagesParUuid[uuid_transaction]
        if(messageNouveau) {
          delete nouveauMessagesParUuid[uuid_transaction]
          return messageNouveau
        }
        return item
      })
      Object.values(nouveauMessagesParUuid).forEach(item=>messagesMaj.push(item))  // Ajouter nouveaux messages
      formatterMessagesCb(messagesMaj) 
      setListeComplete(liste.length < PAGE_LIMIT)
    })
    .catch(err=>erreurCb(err, "Erreur chargement messages initiaux : %O", err))
  }, [colonnes, listeMessages, usager, formatterMessagesCb, setListeComplete, erreurCb])

  const repondreMessageCb = useCallback(message => {
    setMessageRepondre(message)
    setUuidMessage('')
    setAfficherNouveauMessage(true)
  }, [setMessageRepondre, setAfficherNouveauMessage])

  const supprimerMessagesCb = useCallback(uuidTransactions => {
    // console.debug("Supprimer message %s", uuidTransactions)
    workers.connexion.supprimerMessages(uuidTransactions)
        .then(reponse=>{
            // console.debug("Messages supprimes : %O", reponse)
        })
        .catch(erreurCb)
  }, [workers, erreurCb])

  // Chargement des proprietes et workers
  useEffect(()=>{
    detecterSupport(setSupportMedia)
    Promise.all([
      importerWorkers(setWorkers),
      MessageDao.init(),
    ])
      .then(()=>{ console.info("Chargement de l'application complete") })
      .catch(err=>{erreurCb(err, "Erreur chargement application")})
  }, [setWorkers, setSupportMedia, erreurCb])

  useEffect(()=>{
    setWorkersTraitementFichiers(workers)
    if(workers) {
      if(workers.connexion) {
        connecter(workers, setUsager, setEtatConnexion, setFormatteurPret)
          .then(infoConnexion=>{console.info("Info connexion : %O", infoConnexion)})
          .catch(err=>{console.debug("Erreur de connexion : %O", err)})
      }
      if(workers.transfertFichiers) {
        // Hook recepteur d'evenements upload
        const proxCb = proxy((pending, pctEnCours, flags)=>{
          // console.debug("Evenement transfert fichier pending=%O, pctEnCours=%O, flags=%O", pending, pctEnCours, flags)
          //if(flags && flags.complete && flags.transaction) {
            addEvenementUpload({rk: 'upload', pending, pctEnCours, ...flags})
          //}
        })
        workers.transfertFichiers.up_setCallbackUpload(proxCb).catch(erreurCb)
      }
    }
  }, [workers, setUsager, setEtatConnexion, setFormatteurPret, addEvenementUpload, erreurCb])

  useEffect(()=>{
      if(!etatAuthentifie) return 

      workers.chiffrage.getIdmgLocal()
        .then(idmg=>{
          setIdmg(idmg)
        })
        .catch(err=>console.error("Erreur chargement idmg local : %O", err))

      workers.connexion.getClesChiffrage()
        .then(cles=>setCertificatMaitreDesCles(cles.certificat))
        .catch(err=>console.error("Erreur chargement cles chiffrage : %O", err))

      workers.connexion.getDomainesMessagerie()
        .then( info => chargerDnsMessagerie(info, setDnsMessagerie) )
        .catch(err=>console.error("Erreur chargement DNS messagerie : %O", err))

  }, [workers, etatAuthentifie, setIdmg, setCertificatMaitreDesCles, setDnsMessagerie])
  
  useEffect(()=>{
    if(workers) setColonnes(preparerColonnes(workers))
  }, [workers, setColonnes])

  const rafraichirListe = useCallback(async listeCourante => {
    if(!colonnes || !userId) return
    const { colonne, ordre } = colonnes.tri
    const skip = listeCourante?listeCourante.length:0

    const inclure_supprime = dossier === 'supprimes'
    
    MessageDao.getMessages(userId, {colonne, ordre, skip, limit: PAGE_LIMIT, supprime: inclure_supprime}).then(liste=>{
      formatterMessagesCb(liste) 
    })
    .catch(err=>erreurCb(err, "Erreur chargement messages initiaux"))
  }, [colonnes, userId, formatterMessagesCb, dossier, erreurCb])

  // Charger liste initiale
  useEffect(()=>{
    setListeComplete(false)  // Reset flag liste
    rafraichirListe().catch(erreurCb)
  }, [colonnes, rafraichirListe, setListeComplete, erreurCb])

  // Sync liste de messages avec la base de donnees locale
  useEffect(()=>{
    if(workers && userId && etatConnexion && etatAuthentifie) {
      const inclure_supprime = dossier === 'supprimes'
      workers.connexion.getReferenceMessages({limit: SYNC_BATCH_SIZE, inclure_supprime})
        .then(reponse=>conserverReferenceMessages(workers, userId, reponse.messages))
        .then(rafraichirListe)
        .catch(erreurCb)
    }
  }, [workers, etatConnexion, userId, etatAuthentifie, dossier, erreurCb, rafraichirListe])

  // Messages listener
  useEffect(()=>{
    const { connexion } = workers
    if(connexion && etatAuthentifie && usager) {
      const cb = proxy(addEvenementMessage)
      const params = {}
      connexion.enregistrerCallbackEvenementMessages(params, cb)
        .catch(err=>console.error("Erreur enregistrement evenements messages : %O", err))
      return () => connexion.retirerCallbackEvenementMessages(params, cb)
        .catch(err=>erreurCb(err, "Erreur retrait evenements messages"))
    }
  }, [workers, etatAuthentifie, usager, addEvenementMessage, erreurCb])

  // Event handling
  useEffect(()=>{
    if(evenementMessage) {
      addEvenementMessage('')  // Clear event pour eviter cycle d'update
      traiterEvenementMessage(workers, listeMessages, userId, evenementMessage, formatterMessagesCb)
        .catch(err=>erreurCb(err, "Erreur traitement evenement message"))
    }
  }, [workers, evenementMessage, listeMessages, userId, formatterMessagesCb, addEvenementMessage, erreurCb])

  return (
    <LayoutApplication>
      
      <HeaderApplication>
        <Menu 
          workers={workers} 
          usager={usager} 
          etatConnexion={etatConnexion} 
          etatTransfert={etatTransfert}
          setAfficherNouveauMessage={setAfficherNouveauMessage}
          setUuidMessage={setUuidMessage}
          setAfficherContacts={setAfficherContacts}
          showTransfertModal={showTransfertModalOuvrir}
        />
      </HeaderApplication>

      <Container>
        <Suspense fallback={<Attente />}>

          <AlertTimeout variant="danger" titre="Erreur" value={erreur} setValue={setErreur} />

          <Alert show={confirmation?true:false} variant="success" onClose={()=>setConfirmation('')} dismissible>
            <Alert.Heading>Confirmation</Alert.Heading>
            <pre>{confirmation}</pre>
          </Alert>

          <Contenu 
            workers={workers} 
            supportMedia={supportMedia}
            usager={usager}
            userId={userId}
            etatConnexion={etatConnexion&&etatAuthentifie}
            etatAuthentifie={etatAuthentifie}
            downloadAction={downloadAction}
            certificatMaitreDesCles={certificatMaitreDesCles}
            afficherNouveauMessage={afficherNouveauMessage}
            setAfficherNouveauMessage={setAfficherNouveauMessage}
            uuidMessage={uuidMessage}
            setUuidMessage={setUuidMessage}
            dnsMessagerie={dnsMessagerie}
            afficherContacts={afficherContacts}
            setAfficherContacts={setAfficherContacts}
            showConfirmation={showConfirmation}
            colonnes={colonnes}
            setColonnes={setColonnes}
            listeMessages={listeMessages}
            isListeComplete={isListeComplete}
            compteMessages={compteMessages}
            getMessagesSuivants={(etatConnexion&&etatAuthentifie)?getMessagesSuivants:null}
            messageRepondre={messageRepondre}
            repondreMessageCb={repondreMessageCb}
            setMessageRepondre={setMessageRepondre}
            supprimerMessagesCb={supprimerMessagesCb}
            evenementUpload={evenementUpload}
            dossier={dossier}
            setDossier={setDossier}
            erreurCb={erreurCb}
          />

        </Suspense>
      </Container>

      <FooterApplication>
        <Footer workers={workers} idmg={idmg} />
      </FooterApplication>

      <TransfertModal 
        show={showTransfertModal}
        fermer={showTransfertModalFermer} 
        workers={workers}
        setEtatTransfert={setEtatTransfert}
        isEtatUploadExterne={true}
        etatUploadExterne={evenementUpload}
        erreurCb={erreurCb}
      />

    </LayoutApplication>
  )
}
export default App

function Attente(props) {
  return <p>Chargement en cours</p>
}

async function importerWorkers(setWorkers) {
  const { chargerWorkers } = await import('./workers/workerLoader')
  const workers = chargerWorkers()
  setWorkers(workers)
}

async function connecter(workers, ...setters) {
  const { connecter: connecterWorker } = await import('./workers/connecter')
  return connecterWorker(workers, ...setters)
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

function Contenu(props) {
  if(!props.workers) return <Attente />

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
    Page = Accueil
  }

  return <Page {...props} />
}

function Footer(props) {
  return (
    <div className={stylesCommuns.centre}>
      <Row><Col>{props.idmg}</Col></Row>
      <Row><Col>Collections de MilleGrilles</Col></Row>
    </div>
  )
}

function preparerColonnes(workers) {

  const params = {
      ordreColonnes: ['date_reception', 'from', 'subject', 'boutonDetail'],
      paramsColonnes: {
          'date_reception': {'label': 'Date', formatteur: FormatterDate, xs: 6, md: 3, lg: 2},
          'from': {'label': 'Auteur', xs: 6, md: 4, lg: 4},
          'subject': {'label': 'Sujet', xs: 10, md: 4, lg: 5},
          'boutonDetail': {label: ' ', className: 'droite', showBoutonContexte: true, xs: 2, md: 1, lg: 1},
      },
      tri: {colonne: 'date_reception', ordre: -1},
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

function formatterMessages(messages, colonnes, userId, setMessagesFormattes, setCompteMessages, erreurCb, opts) {
  opts = opts || {}
  // console.debug("formatterContacts colonnes: %O", colonnes)
  const {colonne, ordre} = colonnes.tri || {}
  // let contactsTries = [...contacts]
  // const userId = usager.extensions.userId

  let messagesTries = messages.map(item=>{
      const certificat = item.certificat_message
      let from = ''
      if(certificat) {
          const cert = pki.certificateFromPem(certificat)
          //const extensions = extraireExtensionsMillegrille(cert)
          from = cert.subject.getField('CN').value
      }

      const fileId = item.uuid_transaction
      // const adresse = item.adresses?item.adresses[0]:''
      return {from, ...item, fileId}
  })

  // console.debug("Contacts a trier : %O", contactsTries)

  switch(colonne) {
      case 'from': messagesTries.sort(trierFrom); break
      case 'subject': messagesTries.sort(trierSubject); break
      default: messagesTries.sort(trierDate)
  }

  if(ordre < 0) messagesTries = messagesTries.reverse()

  setMessagesFormattes(messagesTries)

  // Maj le compte du nombre de messages
  MessageDao.countMessages(userId, opts).then(setCompteMessages).catch(erreurCb)
}

function trierDate(a, b) {
  return trierNombre('date_reception', a, b)
}

function trierSubject(a, b) {
  return trierString('subject', a, b, {chaine: trierDate})
}

function trierFrom(a, b) {
  return trierString('from', a, b, {chaine: trierDate})
}

async function traiterEvenementMessage(workers, listeMessages, userId, evenementMessage, formatterMessagesCb) {
  // console.debug("Evenement message : %O", evenementMessage)
  const action = evenementMessage.routingKey.split('.').pop()
  const message = evenementMessage.message

  // Mettre a jour les items de la liste de messages
  let trouve = false
  let listeMaj = [...listeMessages]
  if(action === 'nouveauMessage') {
    
    // Conserver le message dans la DB
    const messageCharge = {user_id: userId, ...message, '_etatChargement': 'charge'}
    await MessageDao.updateMessage(messageCharge, {replace: true})
    // Dechiffrer le message immediatement
    const messageDechiffre = await dechiffrerMessage(workers, message)
    const resultat = {...messageCharge, ...messageDechiffre, '_etatChargement': 'dechiffre'}
    // Retirer le contenu chiffre
    delete resultat.message_chiffre
    delete resultat.certificat_message
    await MessageDao.updateMessage(resultat, {replace: true})

    const { uuid_transaction } = message
    listeMaj = listeMaj.map(item=>{
      if(item.uuid_transaction === uuid_transaction) {
        trouve = true
        return resultat  // Remplacer message
      }
      return item
    })
    if(!trouve) {
      // console.debug("Ajout nouveau message %O", message)
      listeMaj.push(resultat)
    }

  } else if(action === 'messageLu') {
    const lus = message.lus
    // Verifier le flag pour chaque message dans notre liste (struct message "lus: {uuid_transaction: bool}")
    listeMaj = listeMaj.map(item=>{
      const uuid_transaction = item.uuid_transaction
      if(lus[uuid_transaction] !== undefined) {
        MessageDao.updateMessage({uuid_transaction, lu: lus[uuid_transaction]}).catch(err=>console.error("Erreur maj message lu: %O", err))
        return {...item, lu: lus[uuid_transaction]}
      }
      return item
    })

  } else if(action === 'messagesSupprimes') {
    const uuid_transactions = message.uuid_transactions
    uuid_transactions.forEach(item=>{
      MessageDao.updateMessage({uuid_transaction: item, supprime: true})
        .catch(err=>console.error("Erreur marquer message supprime: %O", err))
    })
    listeMaj = listeMaj.filter(item => !uuid_transactions.includes(item.uuid_transaction))
  }

  formatterMessagesCb(listeMaj)
}

async function conserverReferenceMessages(workers, userId, listeReferences) {
  await MessageDao.mergeReferenceMessages(userId, listeReferences)
  await chargerMessagesNouveaux(workers, userId)
  
  // Recovery (devrait deja etre complete dans chargerMessagesNouveaux)
  await dechiffrerMessages(workers, userId)
}

async function chargerMessagesNouveaux(workers, userId) {
  const { connexion } = workers

  const uuid_transactions = await MessageDao.getUuidMessagesParEtatChargement(userId, 'nouveau')

  const promises = []
  const conserverMessages = async batch => {
    const uuid_messages = [...batch]
    const reponse = await connexion.getMessages({uuid_messages, inclure_supprime: true})
    if(reponse.messages && reponse.messages.length > 0) {
      for await (const message of reponse.messages) {
        const messageCharge = {user_id: userId, ...message, '_etatChargement': 'charge'}
        await MessageDao.updateMessage(messageCharge)

        // Dechiffrer le message immediatement
        const messageDechiffre = await dechiffrerMessage(workers, message)
        const resultat = {...messageCharge, ...messageDechiffre, '_etatChargement': 'dechiffre'}
        // Retirer le contenu chiffre
        delete resultat.message_chiffre
        delete resultat.certificat_message
        await MessageDao.updateMessage(resultat, {replace: true})
      }
    }
  }

  let batch_uuid_transactions = []
  while(uuid_transactions.length > 0) {
    batch_uuid_transactions.push(uuid_transactions.shift())

    if(batch_uuid_transactions.length === 5) {
      const p = conserverMessages(batch_uuid_transactions).catch(err=>console.error("Erreur traitement batch messages : %O", err))
      promises.push(p)
      batch_uuid_transactions = []  // Reset liste
    }
  }

  if(batch_uuid_transactions.length > 0) {
    const p = conserverMessages(batch_uuid_transactions)
    promises.push(p)
  }

  await Promise.all(promises)
}

async function dechiffrerMessages(workers, userId) {
  const uuid_transactions = await MessageDao.getUuidMessagesParEtatChargement(userId, 'charge')

  const conserverMessages = async batch => {
    const uuid_messages = [...batch]
    // console.debug("Traiter batch messages non dechiffres : %O", uuid_messages)

    for await (const uuid_message of uuid_messages) {
      const message = await MessageDao.getMessage(uuid_message)
      const messageDechiffre = await dechiffrerMessage(workers, message)
      const resultat = {...message, ...messageDechiffre, '_etatChargement': 'dechiffre'}
      // Retirer le contenu chiffre
      delete resultat.message_chiffre
      delete resultat.certificat_message
      await MessageDao.updateMessage(resultat, {replace: true})
    }

  }

  let batch_uuid_transactions = []
  while(uuid_transactions.length > 0) {
    batch_uuid_transactions.push(uuid_transactions.shift())

    if(batch_uuid_transactions.length === 5) {
      conserverMessages(batch_uuid_transactions).catch(err=>console.error("Erreur traitement batch messages : %O", err))
      batch_uuid_transactions = []  // Reset liste
    }
  }

  if(batch_uuid_transactions.length > 0) {
    conserverMessages(batch_uuid_transactions).catch(err=>console.error("Erreur traitement batch messages : %O", err))
  }

}
