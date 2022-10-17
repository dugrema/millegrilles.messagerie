import { useState, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import Nav from 'react-bootstrap/Nav'

import { ListeFichiers } from '@dugrema/millegrilles.reactjs'
import { MenuContextuelAfficherMessages, onContextMenu } from './MenuContextuel'
import useWorkers, {useEtatConnexion, useEtatAuthentifie, useUsager} from './WorkerContext'
import messagerieActions from './redux/messagerieSlice'

function ListeMessages(props) {

    const { 
        colonnes, enteteOnClickCb,
        supprimerMessagesCb,
        showNouveauMessage,
    } = props

    const etatConnexion = useEtatConnexion(),
          etatAuthentifie = useEtatAuthentifie()

    const messages = useSelector(state=>state.messagerie.liste),
          compteMessages = messages?messages.length:0,
          syncEnCours = useSelector(state=>state.messagerie.syncEnCours)

    const [filtreMessage, setFiltreMessage] = useState('actifs')

    // useEffect(()=>{
    //     if(filtreMessage === 'supprimes') setDossier('supprimes')
    //     else if (filtreMessage === 'envoyes') setDossier('envoyes')
    //     else setDossier('')
    // }, [filtreMessage, setDossier])

    if(!messages || messages.length === 0) return <p>Aucun message disponible.</p>
    
    const titre = props.titre || 'Messages'

    return (
        <div>
            <Row className="liste-header">
                <Col xs={12} md={8} className="buttonbar-left">
                    <Button onClick={showNouveauMessage}><i className="fa fa-send-o"/>{' '}Nouveau</Button>
                </Col>
                <Col xs={12} md={4} className='buttonbar-right'>
                    <AfficherNombreMessages value={compteMessages} chargementEnCours={syncEnCours} />
                </Col>
            </Row>

            <AfficherListeMessages 
                colonnes={colonnes}
                enteteOnClickCb={enteteOnClickCb}
                etatConnexion={etatConnexion}
                etatAuthentifie={etatAuthentifie}
                supprimerMessagesCb={supprimerMessagesCb}
            />
        </div>
    )

}

export default ListeMessages

function AfficherNombreMessages(props) {
    const compteMessages = props.value

    let flagSyncEnCours = ''
    if(props.chargementEnCours) {
        flagSyncEnCours = <i className="fa fa-spinner fa-spin"/>
    }

    let labelMessages = ''

    if(compteMessages > 1) {
        labelMessages = <span>{compteMessages} messages</span>
    } else if(compteMessages === 1) {
        labelMessages = <span>1 message</span>
    } else {
        labelMessages = <span>Aucuns messages</span>
    }

    return <p>{flagSyncEnCours} {labelMessages}</p>
}

function AfficherListeMessages(props) {
    const { 
        colonnes, 
        enteteOnClickCb,
        supprimerMessagesCb,
    } = props

    const workers = useWorkers(),
          dispatch = useDispatch(),
          etatConnexion = useEtatConnexion(),
          etatAuthentifie = useEtatAuthentifie(),
          selection = useSelector(state=>state.messagerie.selection),
          userId = useSelector(state=>state.contacts.userId)

    const messages = useSelector(state=>state.messagerie.liste)

    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})

    const onSelectionLignes = useCallback(selection=>{
        // console.debug("Selection ", selection)
        dispatch(messagerieActions.selectionMessages(selection))
    }, [])
    const fermerContextuel = useCallback(()=>setContextuel(false), [setContextuel])
    const onContextMenuCb = useCallback((event, value)=>onContextMenu(event, value, setContextuel), [])

    const ouvrir = useCallback(event=>{
        event.preventDefault()
        event.stopPropagation()

        console.debug("Ouvrir event : %O, selection: %O", event, selection)
        if(selection.length === 1) {
            const uuid_message = selection[0]
            dispatch(messagerieActions.setUuidMessageActif(uuid_message))
        }
    }, [dispatch, selection])

    const supprimerMessages = useCallback( ()=>{
        const { connexion, messagerieDao } = workers
        new Promise(async (resolve, reject) => {
            try {
                await connexion.supprimerMessages(selection)
                dispatch(messagerieActions.supprimerMessages(selection))
                for await (const uuid_transaction of selection) {
                    const messageSupprime = {uuid_transaction, user_id: userId, supprime: true}
                    await messagerieDao.updateMessage(messageSupprime)
                }
                resolve()
            } catch(err) {
                console.error("AfficherListeMessages supprimerMessages Erreur ", err)
                reject(err)
            }
        })
    }, [workers, dispatch, userId, selection])

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
            />

            <MenuContextuelMessages 
                workers={workers}
                contextuel={contextuel} 
                fermerContextuel={fermerContextuel}
                messages={messages}
                //selection={selection}
                etatConnexion={etatConnexion}
                etatAuthentifie={etatAuthentifie}
                supprimerMessagesCb={supprimerMessages}
            />
        </>
    )

}

function MenuContextuelMessages(props) {
    const { contextuel } = props
    if(!contextuel.show) return ''
    return <MenuContextuelAfficherMessages {...props} />
}
