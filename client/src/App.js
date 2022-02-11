import { lazy, useState, useEffect, useCallback, Suspense } from 'react'
import { proxy } from 'comlink'

import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

import { LayoutApplication, HeaderApplication, FooterApplication } from '@dugrema/millegrilles.reactjs'
import { ouvrirDB } from './idbCollections'
import { setWorkers as setWorkersTraitementFichiers } from './workers/traitementFichiers'

import stylesCommuns from '@dugrema/millegrilles.reactjs/dist/index.css'
import './App.css'

import Menu from './Menu'

const Accueil = lazy(() => import('./Accueil'))
const AfficherMessage = lazy(() => import('./AfficherMessage'))
const NouveauMessage = lazy(() => import('./NouveauMessage'))

function App() {
  
  const [workers, setWorkers] = useState('')
  const [usager, setUsager] = useState('')
  const [etatConnexion, setEtatConnexion] = useState(false)
  const [idmg, setIdmg] = useState('')
  const [certificatMaitreDesCles, setCertificatMaitreDesCles] = useState('')

  const { connexion, transfertFichiers } = workers

  // Selecteurs de page
  const [afficherNouveauMessage, setAfficherNouveauMessage] = useState(false)
  const [uuidSelectionne, setUuidSelectionne] = useState('')

  const downloadAction = useCallback( fichier => {
    //console.debug("Download fichier %O", fichier)
    const { fuuid, mimetype, nom: filename, taille } = fichier

    connexion.getClesFichiers([fuuid], usager)
      .then(reponseCle=>{
        // console.debug("REPONSE CLE pour download : %O", reponseCle)
        if(reponseCle.code === 1) {
          // Permis
          const {cle, iv, tag, format} = reponseCle.cles[fuuid]
          transfertFichiers.down_ajouterDownload(fuuid, {mimetype, filename, taille, passwordChiffre: cle, iv, tag, format})
              .catch(err=>{console.error("Erreur debut download : %O", err)})
          } else {
              console.warn("Cle refusee/erreur (code: %s) pour %s", reponseCle.code, fuuid)
          }
      })
      .catch(err=>{
        console.error("Erreur declenchement download fichier : %O", err)
      })

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
        connecter(workers, setUsager, setEtatConnexion)
          .then(infoConnexion=>{console.debug("Info connexion : %O", infoConnexion)})
          .catch(err=>{console.debug("Erreur de connexion")})
      }
    }
  }, [workers, setUsager, setEtatConnexion])

  useEffect(()=>{
      if(!etatConnexion) return 
      // workers.connexion.enregistrerCallbackMajFichier(proxy(data=>{
      //   // console.debug("callbackMajFichier data: %O", data)
      //   setEvenementFichier(data)
      // }))
      //   .catch(err=>{console.error("Erreur enregistrerCallbackMajFichier : %O", err)})
      // workers.connexion.enregistrerCallbackMajCollection(proxy(data=>{
      //   // console.debug("callbackMajCollection data: %O", data)
      //   setEvenementCollection(data)
      // }))
      //   .catch(err=>{console.error("Erreur enregistrerCallbackMajCollection : %O", err)})

      workers.chiffrage.getIdmgLocal().then(idmg=>{
        console.debug("IDMG local chiffrage : %O", idmg)
        setIdmg(idmg)
      })

      workers.connexion.getClesChiffrage()
        .then(cles=>{
          console.debug("Cles chiffrage recues : %O", cles)
          setCertificatMaitreDesCles(cles.certificat)
        })
        .catch(err=>{console.error("Erreur chargement cles chiffrage : %O", err)})
  }, [etatConnexion, setIdmg, setCertificatMaitreDesCles])
  
  return (
    <LayoutApplication>
      
      <HeaderApplication>
        <Menu 
          workers={workers} 
          usager={usager} 
          etatConnexion={etatConnexion} 
          setAfficherNouveauMessage={setAfficherNouveauMessage}
          setUuidSelectionne={setUuidSelectionne}
        />
      </HeaderApplication>

      <Container>
        <Suspense fallback={<Attente />}>
          <Contenu 
            workers={workers} 
            usager={usager}
            etatConnexion={etatConnexion} 
            downloadAction={downloadAction}
            certificatMaitreDesCles={certificatMaitreDesCles}
            afficherNouveauMessage={afficherNouveauMessage}
            setAfficherNouveauMessage={setAfficherNouveauMessage}
            uuidSelectionne={uuidSelectionne}
            setUuidSelectionne={setUuidSelectionne}
          />
        </Suspense>
      </Container>

      <FooterApplication>
        <Footer workers={workers} idmg={idmg} />
      </FooterApplication>

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

async function connecter(workers, setUsager, setEtatConnexion) {
  const { connecter: connecterWorker } = await import('./workers/connecter')
  return connecterWorker(workers, setUsager, setEtatConnexion)
}

function initDb() {
  return ouvrirDB({upgrade: true})
}

function Contenu(props) {
  if(!props.workers) return <Attente />

  const { afficherNouveauMessage, uuidSelectionne } = props

  // Selection de la page a afficher
  let Page
  if(afficherNouveauMessage) {
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