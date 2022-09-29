import { proxy } from 'comlink'

const CONST_APP_URL = 'messagerie/socket.io'

export async function connecter(workers, setUsagerState, setEtatConnexion, setEtatFormatteurMessage) {
    const { connexion } = workers
  
    // console.debug("Set callbacks connexion worker")
    const location = new URL(window.location.href)
    location.pathname = CONST_APP_URL
    console.info("Connecter a %O", location.href)

    // Preparer callbacks
    const setUsagerCb = proxy( usager => setUsager(workers, usager, setUsagerState) )
    const setEtatConnexionCb = proxy(setEtatConnexion)
    const setEtatFormatteurMessageCb = proxy(setEtatFormatteurMessage)
    await connexion.setCallbacks(setEtatConnexionCb, setUsagerCb, setEtatFormatteurMessageCb)

    try {
        const axiosImport = await import('axios')
        const axios = axiosImport.default
        await axios.get('/messagerie/initSession')
    } catch(err) {
        console.error("Erreur init session : %O", err)
    }

    return connexion.connecter(location.href)
}

async function setUsager(workers, nomUsager, setUsagerState, opts) {
    opts = opts || {}
    // console.debug("setUsager '%s'", nomUsager)
    const { usagerDao, forgecommon } = await import('@dugrema/millegrilles.reactjs')
    const { pki } = await import('@dugrema/node-forge')
    const { extraireExtensionsMillegrille } = forgecommon
    const usager = await usagerDao.getUsager(nomUsager)
    // console.debug("Usager info : %O", usager)
    
    if(usager && usager.certificat) {
        const { connexion, chiffrage, x509, transfertFichiers } = workers
        const fullchain = usager.certificat,
              caPem = usager.ca

        const certificatPem = fullchain.join('')

        // Initialiser le CertificateStore
        await chiffrage.initialiserCertificateStore(caPem, {isPEM: true, DEBUG: false})

        await x509.init(caPem)

        // Init cles privees
        await chiffrage.initialiserFormatteurMessage(certificatPem, usager.clePriveePem, {DEBUG: false})
        await connexion.initialiserFormatteurMessage(certificatPem, usager.clePriveePem, {DEBUG: false})
    
        const certForge = pki.certificateFromPem(fullchain[0])
        const extensions = extraireExtensionsMillegrille(certForge)

        await transfertFichiers.up_setCertificatCa(caPem)
        await transfertFichiers.down_setCertificatCa(caPem)

        const reponseAuthentifier = await workers.connexion.authentifier()
        // console.debug("Reponse authentifier : %O", reponseAuthentifier)
        if(!reponseAuthentifier || reponseAuthentifier.protege !== true) { // throw new Error("Echec authentification (protege=false)")
            console.error("Erreur authentification : reponseAuthentifier = %O", reponseAuthentifier)
            return
        }

        // setUsagerState({nomUsager, fullchain, extensions})
        await setUsagerState({...usager, nomUsager, extensions})

    } else {
        console.warn("Pas de certificat pour l'usager '%s'", usager)
    }

}
