import {useState, useEffect, useCallback} from 'react'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Dropdown from 'react-bootstrap/Dropdown'
import DropdownButton from 'react-bootstrap/DropdownButton'
import Form from 'react-bootstrap/Form'

import { usagerDao, VideoViewer } from '@dugrema/millegrilles.reactjs'

import {videoResourceLoader} from '@dugrema/millegrilles.reactjs/src/imageLoading'
import {trierLabelsVideos} from '@dugrema/millegrilles.reactjs/src/labelsRessources'

const PLAYER_VIDEORESOLUTION = 'player.videoResolution'

function AfficherVideo(props) {

    console.debug("AfficherVideo PROPPIES : %O", props)

    const { workers, support, certificatMaitreDesCles, } = props,
          fichier = props.fichier || {},
          nomFichier = fichier.nom || '',
          version_courante = fichier.version_courante || fichier || {},
          videos = version_courante.video || version_courante || {}

    const [selecteur, setSelecteur] = useState('faible')
    const [srcVideo, setSrcVideo] = useState('')
    const [posterObj, setPosterObj] = useState('')
    // const [genererToken, setGenererToken] = useState(false)

    // const genererTokenToggle = useCallback(()=>{
    //     console.debug("Toggle check de %O", genererToken)
    //     setGenererToken(!genererToken)
    // }, [genererToken, setGenererToken])

    useEffect(()=>{
        const loaderImage = fichier.imageLoader
        let imageChargee = null
        loaderImage.load()
            .then(image=>{
                imageChargee = image
                console.debug("Image poster chargee : %O", image)
                setPosterObj(image)
            })
            .catch(err=>console.error("Erreur chargement poster : %O", err))
        
        return () => {
            console.debug("Revoking blob %O", imageChargee)
            URL.revokeObjectURL(imageChargee)
        }
    }, [fichier, setPosterObj])

    useEffect(()=>{
        if(!selecteur) return setSrcVideo('')
        console.debug("Video utiliser selecteur %s", selecteur)
        fichier.videoLoader.load(selecteur, {genererToken: true})
            .then(src=>{
                console.debug("Source video : %O", src)
                setSrcVideo(src)
            })
            .catch(err=>{
                console.error("AfficherVideo erreur chargement video : %O", err)
            })
    }, [fichier, selecteur, setSrcVideo])


    if(!srcVideo) return (
        <>
            <h3>{nomFichier}</h3>
            <p>Video non disponible.</p>
            <p>Votre navigateur ne supporte pas le format de ce video.</p>
            <Button onClick={props.fermer}>Retour</Button>
        </>
    )

    return (
        <div>
            <Row>
                
                <Col md={12} lg={8}>
                    {posterObj&&srcVideo?
                        <VideoViewer videos={srcVideo} poster={posterObj} height='100%' width='100%' />
                    :(
                        <div>
                            <p>
                                    <i className="fa fa-spinner fa-spin"/> ... Chargement en cours ...
                            </p>
                        </div>
                    )}
                </Col>

                <Col>
                    <h3>{nomFichier}</h3>
                    
                    <Button onClick={props.fermer}>Retour</Button>

                    <h3>Afficher</h3>
                    <SelecteurResolution 
                        listeVideos={videos} 
                        support={support}
                        selecteur={selecteur} setSelecteur={setSelecteur} 
                        videoLoader={fichier.videoLoader} />
                </Col>

            </Row>

        </div>
    )
}

export default AfficherVideo

function SelecteurResolution(props) {
    const { listeVideos, support, selecteur, setSelecteur, videoLoader } = props

    const [listeOptions, setListeOptions] = useState([])

    useEffect(()=>{
        console.debug("Liste videos : %O, selecteurs: %O", listeVideos, videoLoader.getSelecteurs())
        const { webm } = support

        const videoKeys = videoLoader.getSelecteurs()  // Object.keys(listeVideos)
        videoKeys.sort(trierLabelsVideos)
        setListeOptions(videoKeys)

    }, [listeVideos, setListeOptions])

    const changerSelecteur = useCallback(value=>{
        console.debug("Valeur : %O", value)
        setSelecteur(value)
        const [mimetype, resolution, bitrate] = value.split(';')
        localStorage.setItem(PLAYER_VIDEORESOLUTION, ''+resolution)
    }, [setSelecteur])

    return (
        <>
            <p>Selecteur</p>
            <DropdownButton title={selecteur} variant="secondary" onSelect={changerSelecteur}>
                {listeOptions.map(item=>{
                    if(item === selecteur) {
                        return <Dropdown.Item eventKey={item} active>{item}</Dropdown.Item>
                    } else {
                        return <Dropdown.Item eventKey={item}>{item}</Dropdown.Item>
                    }
                })}
            </DropdownButton>
        </>
    )
}
