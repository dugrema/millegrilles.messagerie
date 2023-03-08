import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Breadcrumb from 'react-bootstrap/Breadcrumb'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import ProgressBar from 'react-bootstrap/ProgressBar'

import { ListeFichiers, FormatterDate } from '@dugrema/millegrilles.reactjs'

import useWorkers, {useUsager} from './WorkerContext'
import actionsNavigationSecondaire, {thunks as thunksNavigationSecondaire} from './redux/navigationSecondaireSlice'

import { mapDocumentComplet } from './mapperFichier'

function ModalSelectionnerAttachement(props) {
    const { titre, show, fermer, erreurCb, onSelect } = props
    
    const workers = useWorkers()
    const dispatch = useDispatch()
    const usager = useUsager()

    const nomRootLocal = 'Favoris',
          modeView = 'liste'

    const [initComplete, setInitComplete] = useState(false)

    const colonnes = useMemo(()=>preparerColonnes(workers), [workers])

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
            .filter(item=>!item.mimetype)  // Retirer fichiers, garder collections
            .map(item=>mapDocumentComplet(workers, item))
    }, [workers, show, listeBrute])

    const onSelectionLignes = useCallback(selection=>{
        console.debug("Selection ", selection)
        dispatch(actionsNavigationSecondaire.selectionTuuids(selection))
    }, [])

    const choisirHandler = useCallback(()=>{
        console.debug("Selection %O, cuuid %O", selection, cuuid)
        let cuuidChoisi = cuuid
        if(selection && selection.length === 1) {
            cuuidChoisi = selection[0]
        }
        if(cuuidChoisi) {
            onSelect(cuuidChoisi)
            fermer()
        }
    }, [selection, cuuid, onSelect, fermer])

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

    const onOpenHandler = useCallback( item => {
        console.debug("open ", item)
        window.getSelection().removeAllRanges()
        
        // const folderId = value.folderId || dataset.folderId
        // const fileId = value.fileId || dataset.fileId

        // console.debug("onDoubleClick dataset %O, folderId %o, fileId %O", dataset, folderId, fileId)

        // if(folderId) {
        //     naviguerCollection(folderId)
        // } else if(fileId) {
        //     choisirHandler()
        // }

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

    let collectionSelectionnee = breadcrumb.length > 0
    if(!collectionSelectionnee && selection) collectionSelectionnee = selection.length > 0

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
            </Row>
            <ListeFichiers 
                modeView={modeView}
                colonnes={colonnes}
                rows={liste} 
                onOpen={onOpenHandler}
                selection={selection}
                onSelect={onSelectionLignes}
            />

            <Modal.Footer>
                <Button onClick={choisirHandler} disabled={!collectionSelectionnee}>Choisir</Button>
            </Modal.Footer>

        </Modal>
    )    
}

export default ModalSelectionnerAttachement

function preparerColonnes(workers) {

    const rowLoader = (item, idx) => mapDocumentComplet(workers, item, idx)

    const params = {
        ordreColonnes: ['nom', 'dateFichier', 'boutonDetail'],
        paramsColonnes: {
            'nom': {'label': 'Nom', showThumbnail: true, xs: 12, lg: 8},
            'dateFichier': {'label': 'Date', className: 'details', formatteur: FormatterColonneDate, xs: 11, lg: 3},
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


// Vieux

// import { useState, useEffect, useCallback } from 'react'
// import Modal from 'react-bootstrap/Modal'
// import Button from 'react-bootstrap/Button'
// import Container from 'react-bootstrap/Container'
// import Breadcrumb from 'react-bootstrap/Breadcrumb'
// import Row from 'react-bootstrap/Row'
// import Col from 'react-bootstrap/Col'
// import ButtonGroup from 'react-bootstrap/ButtonGroup'

// import { ListeFichiers, FormatteurTaille, FormatterDate } from '@dugrema/millegrilles.reactjs'

// import { mapper } from './mapperFichier'

// function ModalSelectionnerCollection(props) {

//     // console.debug("ModalSelectionnerCollection proppys : %O", props)

//     const { workers, show, fermer, etatConnexion, selectionner } = props

//     const [favoris, setFavoris] = useState('')
//     const [liste, setListe] = useState([])
//     const [breadcrumb, setBreadcrumb] = useState([])
//     const [colonnes, setColonnes] = useState('')
//     const [modeView, setModeView] = useState('')
//     const [cuuidCourant, setCuuidCourant] = useState('')
//     // const [selection, setSelection] = useState('')
//     const selectionnerCb = useCallback(()=>{ 
//         // Extraire info detaillee des fichiers
//         // console.debug("Liste a filtrer : %O", liste)
//         selectionner(cuuidCourant)
//         fermer()
//     }, [cuuidCourant, selectionner, fermer])

//     const onDoubleClick = useCallback((event, value)=>{
//         window.getSelection().removeAllRanges()
//         // console.debug("Ouvrir %O (liste courante: %O)", value, liste)
//         if(value.folderId) {
//             const folderItem = liste.filter(item=>item.folderId===value.folderId).pop()
//             setBreadcrumb([...breadcrumb, folderItem])
//             setCuuidCourant(value.folderId)
//         } else {
//             // Determiner le type de fichier
//             //showPreviewAction(value.fileId)
//             console.debug("!!! Preview action fichier TODO !!! %O", value)
//         }
//     }, [liste, setCuuidCourant, breadcrumb, setBreadcrumb])

//     const onSelectionLignes = useCallback(selection=>{
//         console.debug("!!! FIX, selection %O", selection)
//         // setSelection(selection)
//     // }, [setSelection])
//     }, [])

//     const setBreadcrumbIdx = useCallback( idx => {
//         // Tronquer la breadcrumb pour revenir a un folder precedent
//         const breadcrumbTronquee = breadcrumb.filter((_, idxItem)=>idxItem<=idx)
//         setBreadcrumb(breadcrumbTronquee)

//         // Set nouveau cuuid courant
//         if(idx >= 0) setCuuidCourant(breadcrumbTronquee[idx].folderId)
//         else setCuuidCourant('')  // Racine des favoris
//     }, [breadcrumb, setBreadcrumb, setCuuidCourant])

//     useEffect(()=>{
//         if(favoris) return  // Empecher boucle
//         if(show) {
//             workers.connexion.getFavoris()
//                 .then(reponse=>{
//                     console.debug("Favoris grosfichiers : %O", reponse)
//                     setFavoris(reponse.favoris)
//                 })
//                 .catch(err=>console.error("Erreur chargement favoris grosfichiers : %O", err))
//         }
//     }, [workers, favoris, setFavoris, show])

//     // Preparer format des colonnes
//     useEffect(()=>{ setColonnes(preparerColonnes()) }, [setColonnes])

//     // Preparer donnees a afficher dans la liste
//     useEffect(()=>{
//         if(!etatConnexion || !show) return  // Rien a faire
//         if(!cuuidCourant) {
//             if(favoris) {
//                 // Utiliser liste de favoris
//                 console.debug("Set liste protege avec favoris: %O", favoris)
//                 setListe( preprarerDonnees(favoris, workers, {trier: trierNom}) )
//             }
//         } else {
//             console.debug("Set liste avec cuuidCourant %s", cuuidCourant)
//             chargerCollection(workers, cuuidCourant, setListe)
//         }
//     }, [show, workers, etatConnexion, favoris, setListe, cuuidCourant])

//     return (
//         <Modal show={show} size="lg">
//             <Modal.Header>
//                 Selectionner attachement
//             </Modal.Header>

//             <Container>

//                 <Row>
//                     <Col xs={12} lg={7}>
//                         <SectionBreadcrumb value={breadcrumb} setIdx={setBreadcrumbIdx} />
//                     </Col>

//                     <Col xs={12} lg={5} className="buttonbars">
//                         <BoutonsFormat modeView={modeView} setModeView={setModeView} />
//                         {/* <BoutonsUpload 
//                             cuuid={cuuidCourant}
//                             uploaderFichiersAction={uploaderFichiersAction} 
//                             setShowCreerRepertoire={setShowCreerRepertoire}
//                         /> */}
//                     </Col>
//                 </Row>

//                 <ListeFichiers 
//                     modeView={modeView}
//                     colonnes={colonnes}
//                     rows={liste} 
//                     // onClick={onClick} 
//                     onDoubleClick={onDoubleClick}
//                     // onContextMenu={(event, value)=>onContextMenu(event, value, setContextuel)}
//                     onSelection={onSelectionLignes}
//                     onClickEntete={colonne=>{
//                         // console.debug("Entete click : %s", colonne)
//                     }}
//                 />
//             </Container>

//             <Modal.Footer>
//                 <Button variant="secondary" onClick={selectionnerCb}>Choisir</Button>
//                 <Button variant="secondary" onClick={fermer}>Annuler</Button>
//             </Modal.Footer>
//         </Modal>
//     )
// }

// export default ModalSelectionnerCollection

// function preparerColonnes() {
//     const params = {
//         ordreColonnes: ['nom', 'taille', 'mimetype', 'dateAjout', 'boutonDetail'],
//         paramsColonnes: {
//             'nom': {'label': 'Nom', showThumbnail: true, xs: 11, lg: 5},
//             'taille': {'label': 'Taille', className: 'details', formatteur: FormatteurTaille, xs: 3, lg: 1},
//             'mimetype': {'label': 'Type', className: 'details', xs: 3, lg: 2},
//             'dateAjout': {'label': 'Date ajout', className: 'details', formatteur: FormatterDate, xs: 5, lg: 2},
//             'boutonDetail': {label: ' ', className: 'details', showBoutonContexte: true, xs: 1, lg: 1},
//         },
//         tri: {colonne: 'nom', ordre: 1},
//     }
//     return params
// }

// function trierNom(a, b) {
//     const nomA = a.nom?a.nom:'',
//           nomB = b.nom?b.nom:''
//     if(nomA === nomB) return 0
//     if(!nomA) return 1
//     if(!nomB) return -1
//     return nomA.localeCompare(nomB)
// }

// function preprarerDonnees(liste, workers, opts) {
//     opts = opts || {}
//     const listeMappee = liste.map(item=>mapper(item, workers))

//     if(opts.trier) {
//         listeMappee.sort(opts.trier)
//     }

//     return listeMappee
// }

// async function chargerCollection(workers, cuuid, setListe, usager) {
//     // console.debug("Charger collection %s", cuuid)
//     const { connexion } = workers
//     const reponse = await connexion.getCollection(cuuid)
//     console.debug("!!! Reponse collection %s = %O", cuuid, reponse)
//     const { documents } = reponse

//     // Precharger les cles des images thumbnails, small et posters
//     const fuuidsImages = documents.map(item=>{
//         const { version_courante } = item
//         if(version_courante && version_courante.images) {
//             const fuuidsImages = Object.keys(version_courante.images)
//                 .filter(item=>['thumb', 'thumbnail', 'poster', 'small'].includes(item))
//                 .map(item=>version_courante.images[item].hachage)
//                 .reduce((arr, item)=>{arr.push(item); return arr}, [])
//             return fuuidsImages
//         }
//         return []
//     }).reduce((arr, item)=>{
//         return [...arr, ...item]
//     }, [])
//     console.debug("Fuuids images : %O", fuuidsImages)

//     // // Verifier les cles qui sont deja connues
//     // let fuuidsInconnus = []
//     // for await (const fuuid of fuuidsImages) {
//     //     const cleFichier = await getCleDechiffree(fuuid)
//     //     if(!cleFichier) fuuidsInconnus.push(fuuid)
//     // }

//     // if(fuuidsInconnus.length > 0) {
//     //     connexion.getClesFichiers(fuuidsInconnus, usager)
//     //         .then(async reponse=>{
//     //             // console.debug("Reponse dechiffrage cles : %O", reponse)

//     //             for await (const fuuid of Object.keys(reponse.cles)) {
//     //                 const cleFichier = reponse.cles[fuuid]
//     //                 // console.debug("Dechiffrer cle %O", cleFichier)
//     //                 const cleSecrete = await workers.chiffrage.preparerCleSecreteSubtle(cleFichier.cle, cleFichier.iv)
//     //                 cleFichier.cleSecrete = cleSecrete
//     //                 // console.debug("Cle secrete fichier %O", cleFichier)
//     //                 saveCleDechiffree(fuuid, cleSecrete, cleFichier)
//     //                     .catch(err=>{
//     //                         console.warn("Erreur sauvegarde cle dechiffree %s dans la db locale", err)
//     //                     })
//     //             }
            
//     //         })
//     //         .catch(err=>{console.error("Erreur chargement cles fichiers %O : %O", fuuidsInconnus, err)})
//     // } else {
//     //     // console.debug("Toutes les cles sont deja chargees")
//     // }

//     if(documents) {
//         const donnees = preprarerDonnees(documents, workers)
//         console.debug("chargerCollection donnees : %O", donnees)
//         setListe( donnees )
//     }
// }

// function SectionBreadcrumb(props) {

//     const { value, setIdx } = props

//     return (
//         <Breadcrumb>
            
//             <Breadcrumb.Item onClick={()=>setIdx(-1)}>Favoris</Breadcrumb.Item>
            
//             {value.map((item, idxItem)=>{
//                 return (
//                     <Breadcrumb.Item key={idxItem} onClick={()=>setIdx(idxItem)} >
//                         {item.nom}
//                     </Breadcrumb.Item>
//                 )
//             })}

//         </Breadcrumb>
//     )

// }

// function BoutonsFormat(props) {

//     const { modeView, setModeView } = props

//     const setModeListe = useCallback(()=>{ setModeView('liste') }, [setModeView])
//     const setModeThumbnails = useCallback(()=>{ setModeView('thumbnails') }, [setModeView])

//     let variantListe = 'secondary', variantThumbnail = 'outline-secondary'
//     if( modeView === 'thumbnails' ) {
//         variantListe = 'outline-secondary'
//         variantThumbnail = 'secondary'
//     }

//     return (
//         <ButtonGroup>
//             <Button variant={variantListe} onClick={setModeListe}><i className="fa fa-list" /></Button>
//             <Button variant={variantThumbnail} onClick={setModeThumbnails}><i className="fa fa-th-large" /></Button>
//         </ButtonGroup>
//     )
// }