import { useState, useEffect, useCallback } from 'react'
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'
import Breadcrumb from 'react-bootstrap/Breadcrumb'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import ButtonGroup from 'react-bootstrap/ButtonGroup'

import { ListeFichiers, FormatteurTaille, FormatterDate } from '@dugrema/millegrilles.reactjs'

import { mapper } from './mapperFichier'

function ModalSelectionnerAttachement(props) {

    // console.debug("ModalSelectionnerAttachement proppys : %O", props)

    const { workers, show, fermer, etatConnexion, selectionner } = props

    const [favoris, setFavoris] = useState('')
    const [liste, setListe] = useState([])
    const [breadcrumb, setBreadcrumb] = useState([])
    const [colonnes, setColonnes] = useState('')
    const [modeView, setModeView] = useState('')
    const [cuuidCourant, setCuuidCourant] = useState('')
    const [selection, setSelection] = useState('')
    const selectionnerCb = useCallback(()=>{ 

        // Extraire info detaillee des fichiers
        console.debug("Liste a filtrer : %O", liste)
        const detailSelection = liste.filter(item=>selection.includes(item.fileId))

        selectionner(detailSelection)
        fermer()
    }, [selection, selectionner, liste, fermer])

    const onDoubleClick = useCallback((event, value)=>{
        window.getSelection().removeAllRanges()
        // console.debug("Ouvrir %O (liste courante: %O)", value, liste)
        if(value.folderId) {
            const folderItem = liste.filter(item=>item.folderId===value.folderId).pop()
            setBreadcrumb([...breadcrumb, folderItem])
            setCuuidCourant(value.folderId)
        } else {
            // Determiner le type de fichier
            //showPreviewAction(value.fileId)
            console.debug("!!! Preview action fichier TODO !!! %O", value)
        }
    }, [liste, setCuuidCourant, breadcrumb, setBreadcrumb])

    const onSelectionLignes = useCallback(selection=>{setSelection(selection)}, [setSelection])

    const setBreadcrumbIdx = useCallback( idx => {
        // Tronquer la breadcrumb pour revenir a un folder precedent
        const breadcrumbTronquee = breadcrumb.filter((_, idxItem)=>idxItem<=idx)
        setBreadcrumb(breadcrumbTronquee)

        // Set nouveau cuuid courant
        if(idx >= 0) setCuuidCourant(breadcrumbTronquee[idx].folderId)
        else setCuuidCourant('')  // Racine des favoris
    }, [breadcrumb, setBreadcrumb, setCuuidCourant])

    useEffect(()=>{
        if(favoris) return  // Empecher boucle
        if(show) {
            workers.connexion.getFavoris()
                .then(reponse=>{
                    console.debug("Favoris grosfichiers : %O", reponse)
                    setFavoris(reponse.favoris)
                })
                .catch(err=>console.error("Erreur chargement favoris grosfichiers : %O", err))
        }
    }, [workers, favoris, setFavoris, show])

    // Preparer format des colonnes
    useEffect(()=>{ setColonnes(preparerColonnes()) }, [setColonnes])

    // Preparer donnees a afficher dans la liste
    useEffect(()=>{
        if(!etatConnexion || !show) return  // Rien a faire
        if(!cuuidCourant) {
            if(favoris) {
                // Utiliser liste de favoris
                console.debug("Set liste protege avec favoris: %O", favoris)
                setListe( preprarerDonnees(favoris, workers, {trier: trierNom}) )
            }
        } else {
            console.debug("Set liste avec cuuidCourant %s", cuuidCourant)
            chargerCollection(workers, cuuidCourant, setListe)
        }
    }, [show, workers, etatConnexion, favoris, setListe, cuuidCourant])

    return (
        <Modal show={show} size="lg">
            <Modal.Header>
                Selectionner attachement
            </Modal.Header>

            <Container>

                <Row>
                    <Col xs={12} lg={7}>
                        <SectionBreadcrumb value={breadcrumb} setIdx={setBreadcrumbIdx} />
                    </Col>

                    <Col xs={12} lg={5} className="buttonbars">
                        <BoutonsFormat modeView={modeView} setModeView={setModeView} />
                        {/* <BoutonsUpload 
                            cuuid={cuuidCourant}
                            uploaderFichiersAction={uploaderFichiersAction} 
                            setShowCreerRepertoire={setShowCreerRepertoire}
                        /> */}
                    </Col>
                </Row>

                <ListeFichiers 
                    modeView={modeView}
                    colonnes={colonnes}
                    rows={liste} 
                    // onClick={onClick} 
                    onDoubleClick={onDoubleClick}
                    // onContextMenu={(event, value)=>onContextMenu(event, value, setContextuel)}
                    onSelection={onSelectionLignes}
                    onClickEntete={colonne=>{
                        // console.debug("Entete click : %s", colonne)
                    }}
                />
            </Container>

            <Modal.Footer>
                <Button variant="secondary" onClick={selectionnerCb}>Choisir</Button>
                <Button variant="secondary" onClick={fermer}>Annuler</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default ModalSelectionnerAttachement

function preparerColonnes() {
    const params = {
        ordreColonnes: ['nom', 'taille', 'mimetype', 'dateAjout', 'boutonDetail'],
        paramsColonnes: {
            'nom': {'label': 'Nom', showThumbnail: true, xs: 11, lg: 5},
            'taille': {'label': 'Taille', className: 'details', formatteur: FormatteurTaille, xs: 3, lg: 1},
            'mimetype': {'label': 'Type', className: 'details', xs: 3, lg: 2},
            'dateAjout': {'label': 'Date ajout', className: 'details', formatteur: FormatterDate, xs: 5, lg: 2},
            'boutonDetail': {label: ' ', className: 'details', showBoutonContexte: true, xs: 1, lg: 1},
        },
        tri: {colonne: 'nom', ordre: 1},
    }
    return params
}

function trierNom(a, b) {
    const nomA = a.nom?a.nom:'',
          nomB = b.nom?b.nom:''
    if(nomA === nomB) return 0
    if(!nomA) return 1
    if(!nomB) return -1
    return nomA.localeCompare(nomB)
}

function preprarerDonnees(liste, workers, opts) {
    opts = opts || {}
    const listeMappee = liste.map(item=>{
        const itemMappe = mapper(item, workers)
        return {...itemMappe, pret: true}
    })

    if(opts.trier) {
        listeMappee.sort(opts.trier)
    }

    return listeMappee
}

async function chargerCollection(workers, cuuid, setListe, usager) {
    // console.debug("Charger collection %s", cuuid)
    const { connexion } = workers
    const reponse = await connexion.getCollection(cuuid)
    console.debug("!!! Reponse collection %s = %O", cuuid, reponse)
    const { documents } = reponse

    // Precharger les cles des images thumbnails, small et posters
    const fuuidsImages = documents.map(item=>{
        const { version_courante } = item
        if(version_courante && version_courante.images) {
            const fuuidsImages = Object.keys(version_courante.images)
                .filter(item=>['thumb', 'thumbnail', 'poster', 'small'].includes(item))
                .map(item=>version_courante.images[item].hachage)
                .reduce((arr, item)=>{arr.push(item); return arr}, [])
            return fuuidsImages
        }
        return []
    }).reduce((arr, item)=>{
        return [...arr, ...item]
    }, [])
    console.debug("Fuuids images : %O", fuuidsImages)

    // // Verifier les cles qui sont deja connues
    // let fuuidsInconnus = []
    // for await (const fuuid of fuuidsImages) {
    //     const cleFichier = await getCleDechiffree(fuuid)
    //     if(!cleFichier) fuuidsInconnus.push(fuuid)
    // }

    // if(fuuidsInconnus.length > 0) {
    //     connexion.getClesFichiers(fuuidsInconnus, usager)
    //         .then(async reponse=>{
    //             // console.debug("Reponse dechiffrage cles : %O", reponse)

    //             for await (const fuuid of Object.keys(reponse.cles)) {
    //                 const cleFichier = reponse.cles[fuuid]
    //                 // console.debug("Dechiffrer cle %O", cleFichier)
    //                 const cleSecrete = await workers.chiffrage.preparerCleSecreteSubtle(cleFichier.cle, cleFichier.iv)
    //                 cleFichier.cleSecrete = cleSecrete
    //                 // console.debug("Cle secrete fichier %O", cleFichier)
    //                 saveCleDechiffree(fuuid, cleSecrete, cleFichier)
    //                     .catch(err=>{
    //                         console.warn("Erreur sauvegarde cle dechiffree %s dans la db locale", err)
    //                     })
    //             }
            
    //         })
    //         .catch(err=>{console.error("Erreur chargement cles fichiers %O : %O", fuuidsInconnus, err)})
    // } else {
    //     // console.debug("Toutes les cles sont deja chargees")
    // }

    if(documents) {
        const donnees = preprarerDonnees(documents, workers)
        console.debug("chargerCollection donnees : %O", donnees)
        setListe( donnees )
    }
}

function SectionBreadcrumb(props) {

    const { value, setIdx } = props

    return (
        <Breadcrumb>
            
            <Breadcrumb.Item onClick={()=>setIdx(-1)}>Favoris</Breadcrumb.Item>
            
            {value.map((item, idxItem)=>{
                return (
                    <Breadcrumb.Item key={idxItem} onClick={()=>setIdx(idxItem)} >
                        {item.nom}
                    </Breadcrumb.Item>
                )
            })}

        </Breadcrumb>
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