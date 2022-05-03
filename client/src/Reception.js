import { useState, useCallback } from 'react'
import { FormatterDate, forgecommon, ListeFichiers } from '@dugrema/millegrilles.reactjs'
import { MenuContextuelAfficherMessages, onContextMenu } from './MenuContextuel'

function ListeMessages(props) {

    const { 
        workers, etatConnexion, etatAuthentifie, usager, 
        messages, colonnes, enteteOnClickCb, setUuidMessage,
        isListeComplete, getMessagesSuivants,
        supprimerMessagesCb,
    } = props

    if(!messages) return <p>Aucun message disponible.</p>

    return (
        <div>
            <h3>Messages</h3>
            
            <AfficherListeMessages 
                workers={workers}
                colonnes={colonnes}
                messages={messages} 
                setUuidMessage={setUuidMessage} 
                getMessagesSuivants={getMessagesSuivants}
                isListeComplete={isListeComplete} 
                enteteOnClickCb={enteteOnClickCb}
                etatConnexion={etatConnexion}
                etatAuthentifie={etatAuthentifie}
                supprimerMessagesCb={supprimerMessagesCb}
            />
        </div>
    )

}

export default ListeMessages

function AfficherListeMessages(props) {
    const { 
        workers, etatConnexion, etatAuthentifie,
        messages, colonnes, setUuidMessage, 
        isListeComplete, getMessagesSuivants, enteteOnClickCb,
        supprimerMessagesCb,
    } = props

    const [selection, setSelection] = useState('')
    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})

    const onSelectionLignes = useCallback(selection=>{setSelection(selection)}, [setSelection])
    const fermerContextuel = useCallback(()=>setContextuel(false), [setContextuel])
    const onContextMenuCb = useCallback((event, value)=>onContextMenu(event, value, setContextuel))

    const ouvrir = useCallback(event=>{
        event.preventDefault()
        event.stopPropagation()

        // console.debug("Ouvrir event : %O, selection: %O", event, selection)
        if(selection.length > 0) {
            const uuid_message = selection[0]
            setUuidMessage(uuid_message)
        }
    }, [selection, setUuidMessage])

    const supprimerMessages = useCallback( ()=>{ 
        supprimerMessagesCb(selection)
    }, [supprimerMessagesCb, selection])

    if( !messages ) return ''

    return (
        <>
            <ListeFichiers 
                modeView='liste'
                colonnes={colonnes}
                rows={messages} 
                // onClick={onClick} 
                onDoubleClick={ouvrir}
                onContextMenu={onContextMenuCb}
                onSelection={onSelectionLignes}
                onClickEntete={enteteOnClickCb}
                suivantCb={isListeComplete?'':getMessagesSuivants}
            />

            <MenuContextuelFavoris 
                workers={workers}
                contextuel={contextuel} 
                fermerContextuel={fermerContextuel}
                messages={messages}
                selection={selection}
                etatConnexion={etatConnexion}
                etatAuthentifie={etatAuthentifie}
                supprimerMessagesCb={supprimerMessages}
            />            
        </>
    )

}

function MenuContextuelFavoris(props) {

    const { contextuel, fichiers, selection } = props

    if(!contextuel.show) return ''

    // console.debug("!!! Selection : %s, FICHIERS : %O", selection, fichiers)

    return <MenuContextuelAfficherMessages {...props} />
}
