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

// export async function uploaderFichiers(workers, cuuid, acceptedFiles) {
//     console.debug("Uploader vers '%s' fichiers : %O", cuuid, acceptedFiles)

//     const { transfertFichiers, connexion } = workers

//     const params = {}
//     if(cuuid) params.cuuid = cuuid

//     // S'assurer d'avoir un certificat de maitre des cles
//     const cert = await connexion.getCertificatsMaitredescles()
//     const { certificat } = cert

//     try {
//         if(certificat) {
//             transfertFichiers.up_setCertificat(certificat)
//             const infoUploads = await transfertFichiers.up_ajouterFichiersUpload(acceptedFiles, params)
//             return infoUploads
//         } else {
//             console.error("Erreur getCertificatsMaitredescles - aucun certificat recu")
//         }
//     } catch(err) {
//         console.error("Erreur preparation upload fichiers : %O", err)
//     }
    
// }

export async function uploaderFichiers(workers, cuuid, acceptedFiles, opts) {
    opts = opts || {}
    const { erreurCb } = opts

    // Pre-validation des fichiers - certains navigateurs ne supportent pas des noms fichiers avec
    // characteres non ASCII (e.g. Brave sur Linux). Rapportent un nom de fichier vide ("").
    const fichiersOk = acceptedFiles.filter(item=>item.name)
    if(fichiersOk.length === 0) {
        if(erreurCb) erreurCb("Les noms des fichiers ne sont pas supportes par votre navigateur")
        else console.error("Erreur getCertificatsMaitredescles - aucun certificat recu")
        return
    } else if (fichiersOk.length < acceptedFiles.length) {
        const nomsFichiersOk = fichiersOk.map(item=>item.path).join(', ')
        if(erreurCb) erreurCb(`Les noms de certains fichiers ne sont pas supportes. Fichiers OK : ${nomsFichiersOk}`)
    }

    try {
        console.debug("Uploader vers '%s' fichiers : %O", cuuid, acceptedFiles)

        const { transfertFichiers, connexion } = workers

        const params = {}
        if(cuuid) params.cuuid = cuuid

        // S'assurer d'avoir un certificat de maitre des cles
        const cert = await connexion.getCertificatsMaitredescles()
        // console.debug("Certificat maitre des cles : %O", cert)
        const { certificat } = cert

        if(certificat) {
            transfertFichiers.up_setCertificat(certificat)

            // Mapper fichiers
            const acceptedFilesMapped = fichiersOk.map(item=>{
                const data = {}
                data.name = item.name
                data.type = item.type
                data.size = item.size
                data.path = item.path
                data.lastModified = item.lastModified
                data.object = item
                return data
            })

            const infoUploads = await transfertFichiers.up_ajouterFichiersUpload(acceptedFilesMapped, params)
            return infoUploads
        } else {
            if(erreurCb) erreurCb("Erreur durant la preparation d'upload du fichier - aucuns certificat serveur recu")
            else console.error("Erreur getCertificatsMaitredescles - aucun certificat recu")
        }
    } catch(err) {
        if(erreurCb) erreurCb(err, "Erreur durant la preparation d'upload du fichier")
        else console.error("Erreur durant la preparation d'upload du fichier : %O", err)
    }
    
}