import { useCallback } from 'react'
import Breadcrumb from 'react-bootstrap/Breadcrumb'

import ListeMessages from './Reception'

function Accueil(props) {

    const { 
        workers, setUuidMessage,
        colonnes, setColonnes, listeMessages, compteMessages, getMessagesSuivants, isListeComplete, setDossier,
        supprimerMessagesCb, setAfficherNouveauMessage,
     } = props

    const enteteOnClickCb = useCallback(colonne=>{
        // console.debug("Click entete nom colonne : %s", colonne)
        const triCourant = {...colonnes.tri}
        const colonnesCourant = {...colonnes}
        const colonneCourante = triCourant.colonne
        let ordre = triCourant.ordre || 1
        if(colonne === colonneCourante) {
            // Toggle direction
            ordre = ordre * -1
        } else {
            ordre = 1
        }
        colonnesCourant.tri = {colonne, ordre}
        // console.debug("Sort key maj : %O", colonnesCourant)
        setColonnes(colonnesCourant)
    }, [colonnes, setColonnes])    

    return (
        <>
            <BreadcrumbMessages />

            <ListeMessages 
                workers={workers} 
                messages={listeMessages} 
                compteMessages={compteMessages}
                colonnes={colonnes}
                isListeComplete={isListeComplete}
                getMessagesSuivants={getMessagesSuivants}
                enteteOnClickCb={enteteOnClickCb}
                setUuidMessage={setUuidMessage}  
                supprimerMessagesCb={supprimerMessagesCb} 
                setAfficherNouveauMessage={setAfficherNouveauMessage} 
                setDossier={setDossier} />
        </>
    )

}

export default Accueil

function BreadcrumbMessages(props) {
    return (
        <Breadcrumb>
            <Breadcrumb.Item active>Messages</Breadcrumb.Item>
        </Breadcrumb>
    )
}
