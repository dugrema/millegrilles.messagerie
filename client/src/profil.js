export async function chargerProfilUsager(workers, infoUsager, opts) {
    opts = opts || {}
    console.debug("Charger profil usager")
    const { connexion } = workers
    const { usager, dnsMessagerie } = infoUsager

    let profil = await connexion.getProfil()
    console.debug("Profil charge : %O", profil)
    if(profil.ok === false && profil.code === 404) {
        console.info("Profil inexistant, on en initialize un nouveau pour usager %O", usager)

        const adresse = `@${usager.nomUsager}/${dnsMessagerie}`

        profil = await connexion.initialiserProfil(adresse)
    }

    return profil
}
