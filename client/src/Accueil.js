import { useState, useEffect, useCallback } from 'react'

import ListeMessages from './Reception'

function Accueil(props) {

    const { workers, etatConnexion, usager, downloadAction, setUuidSelectionne } = props

    const [listeMessages, setListeMessages] = useState([])

    useEffect( () => { 
        if(!etatConnexion) return
        workers.connexion.getMessages({}).then(async messages=>{
            // console.debug("Messages recus : %O", messages)
            setListeMessages(messages.messages)
        })
    }, [workers, etatConnexion, setListeMessages])

    const ouvrirMessage = useCallback(event=>{
        let uuidMessage = event
        if(event.currentTarget) uuidMessage = event.currentTarget.value
        // console.debug("Ouvrir message : %O", uuidMessage)
        setUuidSelectionne(uuidMessage)
    }, [setUuidSelectionne])

    // let contenu = ''
    // if(uuidSelectionne) {
    //     // Afficher message
    //     const message = listeMessages.filter(item=>item.uuid_transaction===uuidSelectionne).shift()
    //     // console.debug("Ouvrir message : %O", message)
    //     contenu = <AfficherMessage 
    //                 workers={workers} 
    //                 message={message} 
    //                 retour={retour} />
    // } else {
    //     // Afficher liste Reception
    //     contenu = <ListeMessages 
    //                 workers={workers} 
    //                 messages={listeMessages} 
    //                 ouvrirMessage={ouvrirMessage} />
    // }

    return (
        <>
            <h1>Messagerie</h1>
            <ListeMessages 
                    workers={workers} 
                    messages={listeMessages} 
                    ouvrirMessage={ouvrirMessage} />
        </>
    )

}

export default Accueil
