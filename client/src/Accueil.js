import { useState, useEffect, useCallback } from 'react'
import Breadcrumb from 'react-bootstrap/Breadcrumb'

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

    return (
        <>
            <BreadcrumbMessages />

            <ListeMessages 
                workers={workers} 
                messages={listeMessages} 
                ouvrirMessage={ouvrirMessage} />
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
