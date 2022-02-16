import { 
    supporteFormatWebp, supporteFormatWebm, supporteFileStream, isTouchEnabled,
} from '@dugrema/millegrilles.reactjs'

export async function detecterSupport(setSupport) {
    const webp = await supporteFormatWebp()
    const webm = supporteFormatWebm()
    const fileStream = await supporteFileStream()
    const touch = isTouchEnabled()

    const support = {webp, webm, fileStream, touch}
    console.info("Support du navigateur : %O", support)
    setSupport(support)
}

export async function uploaderFichiers(workers, cuuid, acceptedFiles) {
    console.debug("Uploader vers '%s' fichiers : %O", cuuid, acceptedFiles)

    const { transfertFichiers, connexion } = workers

    const params = {}
    if(cuuid) params.cuuid = cuuid

    // S'assurer d'avoir un certificat de maitre des cles
    const cert = await connexion.getCertificatsMaitredescles()
    const { certificat } = cert

    if(certificat) {
        transfertFichiers.up_setCertificat(certificat)
        transfertFichiers.up_ajouterFichiersUpload(acceptedFiles, params)
            .catch(err=>{console.error("Erreur preparation upload fichiers : %O", err)})
    } else {
        console.error("Erreur getCertificatsMaitredescles - aucun certificat recu")
    }
    
}