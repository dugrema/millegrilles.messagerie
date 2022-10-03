import { useState, useCallback, useEffect } from 'react'
import { Provider as ReduxProvider, useDispatch, useSelector } from 'react-redux'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import Nav from 'react-bootstrap/Nav'

import { ListeFichiers } from '@dugrema/millegrilles.reactjs'
import { MenuContextuelAfficherMessages, onContextMenu } from './MenuContextuel'
import useWorkers, {useEtatConnexion, useEtatAuthentifie, useUsager} from './WorkerContext'

function ListeMessages(props) {

    const { 
        colonnes, enteteOnClickCb,
        supprimerMessagesCb,
    } = props

    const etatConnexion = useEtatConnexion(),
          etatAuthentifie = useEtatAuthentifie()

    const messages = useSelector(state=>state.messagerie.liste),
          compteMessages = messages?messages.length:0

    const [filtreMessage, setFiltreMessage] = useState('actifs')

    const afficherNouveauMessageCb = useCallback(() => {
        throw new Error("todo")
    }, [])

    // useEffect(()=>{
    //     if(filtreMessage === 'supprimes') setDossier('supprimes')
    //     else if (filtreMessage === 'envoyes') setDossier('envoyes')
    //     else setDossier('')
    // }, [filtreMessage, setDossier])

    if(!messages || messages.length === 0) return <p>Aucun message disponible.</p>
    
    return (
        <div>
            <h3>Messages</h3>

            <Row>
                <Col xs={12} md={3} className="buttonbar-left">
                    <Button onClick={afficherNouveauMessageCb}><i className="fa fa-send-o"/>{' '}Nouveau</Button>
                </Col>
                <Col xs={12} md={6} className="buttonbar-left">
                    <Nav variant="tabs" activeKey={filtreMessage} onSelect={setFiltreMessage}>
                        <Nav.Item>
                            <Nav.Link eventKey="actifs">Reception</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="envoyes">Envoyes</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="supprimes">Supprimes</Nav.Link>
                        </Nav.Item>
                    </Nav>
                </Col>
                <Col xs={12} md={3} className='buttonbar-right'><AfficherNombreMessages value={compteMessages} /></Col>
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

    if(compteMessages > 1) {
        return <p>{compteMessages} messages</p>
    } else if(compteMessages === 1) {
        return <p>1 message</p>
    } else {
        return <p>Aucuns messages</p>
    }
}

function AfficherListeMessages(props) {
    const { 
        colonnes, 
        enteteOnClickCb,
        supprimerMessagesCb,
    } = props

    const workers = useWorkers(),
          etatConnexion = useEtatConnexion(),
          etatAuthentifie = useEtatAuthentifie()

    const messages = useSelector(state=>state.messagerie.liste)

    const [selection, setSelection] = useState('')
    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})

    const onSelectionLignes = useCallback(selection=>{setSelection(selection)}, [setSelection])
    const fermerContextuel = useCallback(()=>setContextuel(false), [setContextuel])
    const onContextMenuCb = useCallback((event, value)=>onContextMenu(event, value, setContextuel), [])

    const ouvrir = useCallback(event=>{
        event.preventDefault()
        event.stopPropagation()

        throw new Error("to do: ouvrir")

        // console.debug("Ouvrir event : %O, selection: %O", event, selection)
        // if(selection.length > 0) {
        //     const uuid_message = selection[0]
        //     setUuidMessage(uuid_message)
        // }
    }, [selection])

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
            />

            <MenuContextuelMessages 
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

function MenuContextuelMessages(props) {
    const { contextuel } = props
    if(!contextuel.show) return ''
    return <MenuContextuelAfficherMessages {...props} />
}
