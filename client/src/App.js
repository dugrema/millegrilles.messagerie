import { lazy, useState, useEffect, useCallback, Suspense } from 'react'
import { base64 } from "multiformats/bases/base64"

import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

import { LayoutApplication, HeaderApplication, FooterApplication } from '@dugrema/millegrilles.reactjs'
import { ouvrirDB } from './idbCollections'
import { setWorkers as setWorkersTraitementFichiers } from './workers/traitementFichiers'

import stylesCommuns from '@dugrema/millegrilles.reactjs/dist/index.css'
import './App.css'

import Menu from './Menu'
import TransfertModal from './TransfertModal'
import { Alert } from 'react-bootstrap'

const Accueil = lazy(() => import('./Accueil'))
const AfficherMessage = lazy(() => import('./AfficherMessage'))
const Contacts = lazy(() => import('./Contacts'))
const NouveauMessage = lazy(() => import('./NouveauMessage'))

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

  const { connexion, transfertFichiers } = workers
  const etatAuthentifie = usager && formatteurPret

  // Selecteurs de page
  const [afficherContacts, setAfficherContacts] = useState(false)
  const [afficherNouveauMessage, setAfficherNouveauMessage] = useState(false)
  const [uuidSelectionne, setUuidSelectionne] = useState('')

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
        .then(cles=>{
          console.debug("Cles chiffrage recues : %O", cles)
          setCertificatMaitreDesCles(cles.certificat)
        })
        .catch(err=>console.error("Erreur chargement cles chiffrage : %O", err))

      workers.connexion.getDomainesMessagerie()
        .then( info => chargerDnsMessagerie(info, setDnsMessagerie) )
        .catch(err=>console.error("Erreur chargement DNS messagerie : %O", err))

  }, [etatAuthentifie, setIdmg, setCertificatMaitreDesCles, setDnsMessagerie])
  
  return (
    <LayoutApplication>
      
      <HeaderApplication>
        <Menu 
          workers={workers} 
          usager={usager} 
          etatConnexion={etatConnexion} 
          etatTransfert={etatTransfert}
          setAfficherNouveauMessage={setAfficherNouveauMessage}
          setUuidSelectionne={setUuidSelectionne}
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
            uuidSelectionne={uuidSelectionne}
            setUuidSelectionne={setUuidSelectionne}
            dnsMessagerie={dnsMessagerie}
            afficherContacts={afficherContacts}
            setAfficherContacts={setAfficherContacts}
            showConfirmation={showConfirmation}
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

  const { afficherNouveauMessage, afficherContacts, uuidSelectionne } = props

  // Selection de la page a afficher
  let Page
  if(afficherContacts) {
    Page = Contacts
  } else if(afficherNouveauMessage) {
    Page = NouveauMessage
  } else if(uuidSelectionne) {
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
