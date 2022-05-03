import { lazy, useState, useEffect, useCallback, Suspense } from 'react'
import { base64 } from "multiformats/bases/base64"
import { proxy } from 'comlink'

import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Alert from 'react-bootstrap/Alert'

import { pki } from '@dugrema/node-forge'
import { trierString, trierNombre } from '@dugrema/millegrilles.utiljs/src/tri'
import { LayoutApplication, HeaderApplication, FooterApplication, TransfertModal, forgecommon, FormatterDate } from '@dugrema/millegrilles.reactjs'

import { ouvrirDB } from './idbCollections'
import { setWorkers as setWorkersTraitementFichiers } from './workers/traitementFichiers'
import { dechiffrerMessage } from './cles'

import stylesCommuns from '@dugrema/millegrilles.reactjs/dist/index.css'

import './App.css'

import Menu from './Menu'
// import TransfertModal from './TransfertModal'

const { extraireExtensionsMillegrille } = forgecommon

const Accueil = lazy(() => import('./Accueil'))
const AfficherMessage = lazy(() => import('./AfficherMessage'))
const Contacts = lazy(() => import('./Contacts'))
const NouveauMessage = lazy(() => import('./NouveauMessage'))

const PAGE_LIMIT = 40

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

  // Liste messages
  const [listeMessages, setListeMessages] = useState([])
  const [colonnes, setColonnes] = useState('')
  const [isListeComplete, setListeComplete] = useState(false)
  const [evenementMessage, addEvenementMessage] = useState('')

  const { connexion, transfertFichiers } = workers
  const etatAuthentifie = usager && formatteurPret

  // Selecteurs de page
  const [afficherContacts, setAfficherContacts] = useState(false)
  const [afficherNouveauMessage, setAfficherNouveauMessage] = useState(false)
  const [uuidMessage, setUuidMessage] = useState('')

  const showTransfertModalOuvrir = useCallback(()=>{ setShowTransfertModal(true) }, [setShowTransfertModal])
  const showTransfertModalFermer = useCallback(()=>{ setShowTransfertModal(false) }, [setShowTransfertModal])
  const showConfirmation = useCallback((confirmation, opts)=>{
    opts = opts || {}
    const autoclose = opts.autoclose!==false?5000:false
    setConfirmation(confirmation)
    if(autoclose) setTimeout(()=>setConfirmation(''), 5000)
  }, [setConfirmation])

  const downloadAction = useCallback( fichier => {
    console.debug("Download fichier %O", fichier)
    const { 
      fuuid, mimetype, nom: filename, taille, 
      cle
    } = fichier
    let { cleSecrete, iv, tag, format } = cle || {}
    if(typeof(cleSecrete) === 'string') cleSecrete = base64.decode(cleSecrete)

    // Creer dict de cles avec info secrete pour dechiffrer le fichier
    transfertFichiers.down_ajouterDownload(fuuid, {mimetype, filename, taille, password: cleSecrete, iv, tag, format})
        .catch(err=>{console.error("Erreur debut download : %O", err)})

  }, [connexion, transfertFichiers, usager])

  const formatterMessagesCb = useCallback(messages=>formatterMessages(messages, colonnes, setListeMessages), [colonnes, setListeMessages])

  const getMessagesSuivants = useCallback(()=>{
    const { colonne, ordre } = colonnes.tri
    workers.connexion.getMessages({colonne, ordre, skip: listeMessages.length, limit: PAGE_LIMIT})
        .then( reponse => {
            console.debug("Messages suivant recus : %O", reponse)
            const messages = reponse.messages
            const nouveauMessagesParUuid = messages.reduce((acc, item)=>{ acc[item.uuid_transaction] = item; return acc }, {})
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
            setListeComplete(messages.length < PAGE_LIMIT)
        })
        .catch(err=>console.error("Erreur chargement messages suivant : %O", err))
  }, [colonnes, listeMessages, formatterMessagesCb, setListeComplete])

  // Chargement des proprietes et workers
  useEffect(()=>{
    Promise.all([
      importerWorkers(setWorkers),
      initDb(),
    ])
      .then(()=>{ console.debug("Chargement de l'application complete") })
      .catch(err=>{console.error("Erreur chargement application : %O", err)})
  }, [setWorkers])

  useEffect(()=>{
    setWorkersTraitementFichiers(workers)
    if(workers) {
      if(workers.connexion) {
        connecter(workers, setUsager, setEtatConnexion, setFormatteurPret)
          .then(infoConnexion=>{console.debug("Info connexion : %O", infoConnexion)})
          .catch(err=>{console.debug("Erreur de connexion : %O", err)})
      }
    }
  }, [workers, setUsager, setEtatConnexion, setFormatteurPret])

  useEffect(()=>{
      if(!etatAuthentifie) return 

      workers.chiffrage.getIdmgLocal()
        .then(idmg=>{
          console.debug("IDMG local chiffrage : %O", idmg)
          setIdmg(idmg)
        })
        .catch(err=>console.error("Erreur chargement idmg local : %O", err))

      workers.connexion.getClesChiffrage()
        .then(cles=>setCertificatMaitreDesCles(cles.certificat))
        .catch(err=>console.error("Erreur chargement cles chiffrage : %O", err))

      workers.connexion.getDomainesMessagerie()
        .then( info => chargerDnsMessagerie(info, setDnsMessagerie) )
        .catch(err=>console.error("Erreur chargement DNS messagerie : %O", err))

  }, [etatAuthentifie, setIdmg, setCertificatMaitreDesCles, setDnsMessagerie])
  
  useEffect(()=>{
    if(workers) setColonnes(preparerColonnes(workers))
  }, [workers, setColonnes])

  // Charger liste initiale
  useEffect(()=>{
    if(!workers || !etatConnexion || !etatAuthentifie) return

    if(colonnes) {
        const { colonne, ordre } = colonnes.tri
        workers.connexion.getMessages({colonne, ordre, limit: PAGE_LIMIT})
            .then( reponse => {
                const liste = reponse.messages
                setListeComplete(liste.length < PAGE_LIMIT)
                formatterMessagesCb(liste) 
            })
            .catch(err=>console.error("Erreur chargement contacts : %O", err))
    }
  }, [workers, etatConnexion, etatAuthentifie, colonnes, formatterMessagesCb, setListeComplete])

  // Messages listener
  useEffect(()=>{
    const { connexion } = workers
    if(connexion && etatAuthentifie, usager) {
      const cb = proxy(addEvenementMessage)
      const params = {}
      connexion.enregistrerCallbackEvenementMessages(params, cb)
        .catch(err=>console.error("Erreur enregistrement evenements messages : %O", err))
      return () => connexion.retirerCallbackEvenementMessages(params, cb)
        .catch(err=>console.debug("Erreur retrait evenements messages : %O", err))
    }
  }, [workers, etatAuthentifie, usager, addEvenementMessage])

  // Event handling
  useEffect(()=>{
    if(evenementMessage) {
      addEvenementMessage('')  // Clear event pour eviter cycle d'update
      traiterEvenementMessage(listeMessages, evenementMessage, formatterMessagesCb)
        .catch(err=>console.error("Erreur traitement evenement message : %O", err))
    }
  }, [evenementMessage, listeMessages, formatterMessagesCb, addEvenementMessage])

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

          <Alert show={confirmation?true:false} variant="success" onClose={()=>setConfirmation('')} dismissible>
            <Alert.Heading>Confirmation</Alert.Heading>
            <pre>{confirmation}</pre>
          </Alert>

          <Contenu 
            workers={workers} 
            usager={usager}
            etatConnexion={etatAuthentifie}
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
            getMessagesSuivants={getMessagesSuivants}
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

function initDb() {
  return ouvrirDB({upgrade: true})
}

function chargerDnsMessagerie(infoDns, setDnsMessagerie) {
  console.debug("Info domaines messagerie : %O", infoDns)
  const listeMessagerie = infoDns.filter(item=>item.application==='messagerie_web')
  if(listeMessagerie.length === 0) {
    throw new Error("Serveur de messagerie n'est pas installe ou demarre")
  } if(listeMessagerie.length === 1) {
    const item = listeMessagerie.shift()
    const url = new URL(item.url)
    const hostDns = url.host
    console.debug("Host dns messagerie local par defaut : %s", hostDns)
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
          if(data.dechiffre !== true) {
            const messageDechiffre = await dechiffrerMessage(workers, data)
            return {...data, ...messageDechiffre, dechiffre: true}
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

function formatterMessages(messages, colonnes, setMessagesFormattes) {
  // console.debug("formatterContacts colonnes: %O", colonnes)
  const {colonne, ordre} = colonnes.tri
  // let contactsTries = [...contacts]

  let messagesTries = messages.map(item=>{
      const certificat = item.certificat_message
      let from = ''
      if(certificat) {
          const cert = pki.certificateFromPem(certificat)
          const extensions = extraireExtensionsMillegrille(cert)
          from = cert.subject.getField('CN').value
      }

      const fileId = item.uuid_transaction
      // const adresse = item.adresses?item.adresses[0]:''
      return {...item, fileId, from}
  })

  // console.debug("Contacts a trier : %O", contactsTries)

  switch(colonne) {
      case 'from': messagesTries.sort(trierFrom); break
      case 'subject': messagesTries.sort(trierSubject); break
      default: messagesTries.sort(trierDate)
  }

  if(ordre < 0) messagesTries = messagesTries.reverse()

  setMessagesFormattes(messagesTries)
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

async function traiterEvenementMessage(listeMessages, evenementMessage, formatterMessagesCb) {
  console.debug("Evenement message : %O", evenementMessage)
  const action = evenementMessage.routingKey.split('.').pop()
  const message = evenementMessage.message

  // Mettre a jour les items de la liste de messages
  let trouve = false
  let listeMaj = [...listeMessages]
  if(action === 'nouveauMessage') {
    
    const { uuid_transaction } = message
    listeMaj = listeMaj.map(item=>{
      if(item.uuid_transaction === uuid_transaction) {
        trouve = true
        return message  // Remplacer message
      }
      return item
    })
    if(!trouve) {
      console.debug("Ajout nouveau message %O", message)
      listeMaj.push(message)
    }

  } else if(action === 'messageLu') {
    const lus = message.lus
    // Verifier le flag pour chaque message dans notre liste (struct message "lus: {uuid_transaction: bool}")
    listeMaj = listeMaj.map(item=>{
      const uuid_transaction = item.uuid_transaction
      if(lus[uuid_transaction] !== undefined) {
        return {...item, lu: lus[uuid_transaction]}
      }
      return item
    })
  }

  formatterMessagesCb(listeMaj)
}