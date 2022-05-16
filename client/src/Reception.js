import { useState, useCallback, useEffect } from 'react'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import Nav from 'react-bootstrap/Nav'

import { ListeFichiers } from '@dugrema/millegrilles.reactjs'
import { MenuContextuelAfficherMessages, onContextMenu } from './MenuContextuel'

function ListeMessages(props) {

    const { 
        workers, etatConnexion, etatAuthentifie, 
        messages, compteMessages, colonnes, enteteOnClickCb, setUuidMessage, setDossier,
        isListeComplete, getMessagesSuivants,
        supprimerMessagesCb, setAfficherNouveauMessage,
    } = props

    const [filtreMessage, setFiltreMessage] = useState('actifs')

    const afficherNouveauMessageCb = useCallback(() => setAfficherNouveauMessage(true), [setAfficherNouveauMessage])

    useEffect(()=>{
        if(filtreMessage === 'supprimes') setDossier('supprimes')
        else if (filtreMessage === 'envoyes') setDossier('envoyes')
        else setDossier('')
    }, [filtreMessage, setDossier])

    if(!messages) return <p>Aucun message disponible.</p>
    
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
        workers, etatConnexion, etatAuthentifie,
        messages, colonnes, setUuidMessage, 
        isListeComplete, getMessagesSuivants, enteteOnClickCb,
        supprimerMessagesCb,
    } = props

    const [selection, setSelection] = useState('')
    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})

    const onSelectionLignes = useCallback(selection=>{setSelection(selection)}, [setSelection])
    const fermerContextuel = useCallback(()=>setContextuel(false), [setContextuel])
    const onContextMenuCb = useCallback((event, value)=>onContextMenu(event, value, setContextuel), [])

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
