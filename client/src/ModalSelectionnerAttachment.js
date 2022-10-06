import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'
import Breadcrumb from 'react-bootstrap/Breadcrumb'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import ProgressBar from 'react-bootstrap/ProgressBar'

import { ListeFichiers, FormatteurTaille, FormatterDate } from '@dugrema/millegrilles.reactjs'

import useWorkers, {useEtatConnexion, WorkerProvider, useUsager, useEtatPret} from './WorkerContext'
import actionsNavigationSecondaire, {thunks as thunksNavigationSecondaire} from './redux/navigationSecondaireSlice'

import { mapDocumentComplet, estMimetypeMedia } from './mapperFichier'

function ModalSelectionnerAttachement(props) {
    const { titre, show, fermer, erreurCb, onSelect } = props
    
    const workers = useWorkers()
    const dispatch = useDispatch()
    const usager = useUsager()

    const nomRootLocal = 'Favoris'

    const [initComplete, setInitComplete] = useState(false)
    const [colonnes, setColonnes] = useState(preparerColonnes(workers))
    const [modeView, setModeView] = useState('liste')

    const listeBrute = useSelector(state=>state.navigationSecondaire.liste)
    const cuuid = useSelector(state=>state.navigationSecondaire.cuuid)
    const breadcrumb = useSelector((state) => state.navigationSecondaire.breadcrumb)
    const selection = useSelector(state=>state.navigationSecondaire.selection)

    const userId = useMemo(()=>{
        if(!usager || !usager.extensions) return
        return usager.extensions.userId
    }, [usager])

    const liste = useMemo(()=>{
        if(!show || !listeBrute) return []
        return listeBrute
          .map(item=>mapDocumentComplet(workers, item))
    }, [workers, show, listeBrute])

    const onSelectionLignes = useCallback(selection=>{
        console.debug("Selection ", selection)
        dispatch(actionsNavigationSecondaire.selectionTuuids(selection))
    }, [])

    const choisirHandler = useCallback(()=>{
        console.debug("Selection %O, liste fichiers %O", selection, liste)
        const selectionFichiers = liste.filter(item=>selection.includes(item.tuuid))
        console.debug("Choisir fichiers %O", selectionFichiers)
        onSelect(selectionFichiers)
        fermer()
    }, [selection, liste, onSelect, fermer])

    const naviguerCollection = useCallback( cuuid => {
        if(!cuuid) cuuid = ''
        try {
            if(cuuid) {
                dispatch(actionsNavigationSecondaire.breadcrumbPush({tuuid: cuuid}))
            } else {
                dispatch(actionsNavigationSecondaire.breadcrumbSlice())
            }
        } catch(err) {
            console.error("naviguerCollection Erreur dispatch breadcrumb : ", err)
        }
        try {
            dispatch(thunksNavigationSecondaire.changerCollection(workers, cuuid))
                .then(()=>console.debug("Succes changerCollection : ", cuuid))
                .catch(err=>erreurCb(err, 'Erreur changer collection'))
        } catch(err) {
            console.error("naviguerCollection Erreur dispatch changerCollection", err)
        }
    }, [dispatch, workers, erreurCb])

    const onDoubleClick = useCallback( (event, value) => {
        const dataset = event.currentTarget.dataset
        window.getSelection().removeAllRanges()
        
        const folderId = value.folderId || dataset.folderId
        const fileId = value.fileId || dataset.fileId

        console.debug("onDoubleClick dataset %O, folderId %o, fileId %O", dataset, folderId, fileId)

        if(folderId) {
            naviguerCollection(folderId)
        } else if(fileId) {
            choisirHandler()
        }

    }, [naviguerCollection, choisirHandler, liste])

    const handlerSliceBreadcrumb = useCallback(level => {
        let tuuid = ''
        if(level) {
            const collection = breadcrumb[level]
            tuuid = collection.tuuid
            dispatch(actionsNavigationSecondaire.breadcrumbSlice(level))
            try {
                Promise.resolve(naviguerCollection(tuuid))
                    .catch(err=>console.error("SectionBreadcrumb Erreur navigation ", err))
            } catch(err) {
                console.error("handlerSliceBreadcrumb Erreur naviguerCollection %s: ", tuuid, err)
            }
        } else {
            try {
                Promise.resolve(naviguerCollection())
                    .catch(err=>console.error("SectionBreadcrumb Erreur navigation vers favoris", err))
            } catch(err) {
                console.error("handlerSliceBreadcrumb Erreur naviguerCollection favoris : ", err)
            }
        }
    }, [dispatch, breadcrumb, naviguerCollection])

    useEffect(()=>{
        if(!show || initComplete) return
        // Charger position initiale (favoris)
        console.debug("ModalCopier Set collection favoris")
        Promise.resolve(naviguerCollection())
          .then(()=>setInitComplete(true))
          .catch(err=>console.error("CopierModal Erreur navigation ", err))
    }, [naviguerCollection, show, initComplete, setInitComplete])

    useEffect(()=>{
        if(!userId) return
        dispatch(actionsNavigationSecondaire.setUserId(userId))
    }, [userId])

    return (
        <Modal show={show} size="lg" onHide={fermer}>

            <Modal.Header closeButton={true}>
                {titre}
            </Modal.Header>

            <Row>
                <Col>
                    <SectionBreadcrumb 
                        nomRootLocal={nomRootLocal}
                        breadcrumb={breadcrumb}
                        toBreadrumbIdx={handlerSliceBreadcrumb}
                    />
                </Col>
                <Col xs={12} sm={9} md={8} lg={5} className="buttonbars">
                    <BoutonsFormat modeView={modeView} setModeView={setModeView} />
                </Col>
            </Row>
            <ListeFichiers 
                modeView={modeView}
                colonnes={colonnes}
                rows={liste} 
                onDoubleClick={onDoubleClick}
                onSelection={onSelectionLignes}
            />

            <Modal.Footer>
                <Button onClick={choisirHandler} disabled={breadcrumb.length === 0}>Choisir</Button>
            </Modal.Footer>

        </Modal>
    )    
}

function BoutonsFormat(props) {

    const { modeView, setModeView } = props

    const setModeListe = useCallback(()=>{ setModeView('liste') }, [setModeView])
    const setModeThumbnails = useCallback(()=>{ setModeView('thumbnails') }, [setModeView])

    let variantListe = 'secondary', variantThumbnail = 'outline-secondary'
    if( modeView === 'thumbnails' ) {
        variantListe = 'outline-secondary'
        variantThumbnail = 'secondary'
    }

    return (
        <ButtonGroup>
            <Button variant={variantListe} onClick={setModeListe}><i className="fa fa-list" /></Button>
            <Button variant={variantThumbnail} onClick={setModeThumbnails}><i className="fa fa-th-large" /></Button>
        </ButtonGroup>
    )
}

export default ModalSelectionnerAttachement

function trierNom(a, b) {
    const nomA = a.nom?a.nom:'',
          nomB = b.nom?b.nom:''
    if(nomA === nomB) return 0
    if(!nomA) return 1
    if(!nomB) return -1
    return nomA.localeCompare(nomB)
}

function preparerColonnes(workers) {

    const rowLoader = (item, idx) => mapDocumentComplet(workers, item, idx)

    const params = {
        ordreColonnes: ['nom', 'taille', 'mimetype', 'dateFichier', 'boutonDetail'],
        paramsColonnes: {
            'nom': {'label': 'Nom', showThumbnail: true, xs: 11, lg: 5},
            'taille': {'label': 'Taille', className: 'details', formatteur: FormatteurTaille, xs: 3, lg: 1},
            'mimetype': {'label': 'Type', className: 'details', xs: 3, lg: 2},
            'dateFichier': {'label': 'Date', className: 'details', formatteur: FormatterColonneDate, xs: 5, lg: 3},
            'boutonDetail': {label: ' ', className: 'details', showBoutonContexte: true, xs: 1, lg: 1},
        },
        tri: {colonne: 'nom', ordre: 1},
        rowLoader,
    }
    return params
}

function FormatterColonneDate(props) {
    const data = props.data || {}
    const { upload } = data
    if(upload) {
        if( upload.status === 1 ) {
            return <span>En attente</span>
        } else if( upload.status === 2 ) {
            const taille = data.size || data.taille
            const pct = Math.min(Math.round(upload.position / taille * 100)) || 0
            return <ProgressBar now={pct} label={pct + '%'} />
        } else {
            return <span>En cours de traitement</span>
        }
    } else {
        return <FormatterDate value={props.value} />   
    }
}

function SectionBreadcrumb(props) {

    const { nomRootLocal, breadcrumb, toBreadrumbIdx } = props

    const handlerSliceBreadcrumb = useCallback(event => {
        event.preventDefault()
        event.stopPropagation()

        const idx = event.currentTarget.dataset.idx
        Promise.resolve(toBreadrumbIdx(idx))
            .catch(err=>console.error("SectionBreadcrumb Erreur ", err))
    }, [breadcrumb, toBreadrumbIdx])

    return (
        <Breadcrumb>
            
            <Breadcrumb.Item onClick={handlerSliceBreadcrumb}>{nomRootLocal}</Breadcrumb.Item>
            
            {breadcrumb.map((item, idxItem)=>{
                // Dernier
                if(idxItem === breadcrumb.length - 1) {
                    return <span key={idxItem}>&nbsp; / {item.label}</span>
                }
                
                // Parents
                return (
                    <Breadcrumb.Item key={idxItem} onClick={handlerSliceBreadcrumb} data-idx={''+idxItem}>
                        {item.label}
                    </Breadcrumb.Item>
                )
            })}

        </Breadcrumb>
    )

}
