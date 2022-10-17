import {useState, useEffect, useCallback, useMemo} from 'react'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Dropdown from 'react-bootstrap/Dropdown'
import DropdownButton from 'react-bootstrap/DropdownButton'
import Form from 'react-bootstrap/Form'

import { VideoViewer } from '@dugrema/millegrilles.reactjs'

import {trierLabelsVideos} from '@dugrema/millegrilles.reactjs/src/labelsRessources'


// const PLAYER_VIDEORESOLUTION = 'player.videoResolution'

function AfficherVideo(props) {

    // console.debug("AfficherVideo PROPPIES : %O", props)

    const { support, showInfoModalOuvrir } = props

    const fichier = useMemo(()=>props.fichier || {}, [props.fichier])
    const nomFichier = fichier.nom || '',
          version_courante = fichier.version_courante || {},
          videoLoader = fichier.videoLoader

    const videos = useMemo(()=>version_courante.video || {}, [version_courante.video])

    const [selecteur, setSelecteur] = useState('')
    const [srcVideo, setSrcVideo] = useState('')
    const [posterObj, setPosterObj] = useState('')
    const [genererToken, setGenererToken] = useState(false)
    const [timeStamp, setTimeStamp] = useState(0)

    useEffect(()=>{
        if(selecteur || !videoLoader) return  // Deja initialise
        // Identifier un selecteur initial
        const selecteurs = videoLoader.getSelecteurs()
        if(!selecteurs) {
            return setSelecteur('original')
        } else if(selecteurs.includes('faible')) {
            return setSelecteur('faible')
        } else if(selecteurs.includes('medium')) {
            return setSelecteur('medium')
        } else if(selecteurs.includes('haute')) {
            return setSelecteur('haute')
        } else if(selecteurs.includes('original')) {
            // Selectionner l'original, c'est le seul format disponible
            return setSelecteur('original')
        } else {
            console.error("Aucuns format video n'est disponible dans le selecteur")
        }
    }, [selecteur, videoLoader, setSelecteur])

    const genererTokenToggle = useCallback(event => {
        // console.debug("Toggle check de %O", genererToken)
        setGenererToken(!genererToken)
    }, [genererToken, setGenererToken])

    const videoTimeUpdateHandler = useCallback(event=>{
        // console.debug("Video time update event : %O", event)
        const currentTime = event.target.currentTime
        setTimeStamp(currentTime)
    }, [setTimeStamp])

    useEffect(()=>{
        const loaderImage = fichier.imageLoader
        let imageChargee = null
        loaderImage.load()
            .then(image=>{
                imageChargee = image
                // console.debug("Image poster chargee : %O", image)
                setPosterObj(image)
            })
            .catch(err=>console.error("Erreur chargement poster : %O", err))
        
        return () => {
            // console.debug("Revoking blob %O", imageChargee)
            URL.revokeObjectURL(imageChargee)
        }
    }, [fichier, setPosterObj])

    useEffect(()=>{
        if(!selecteur || !fichier.videoLoader) return setSrcVideo('')
        // console.debug("Video utiliser selecteur %s", selecteur)
        fichier.videoLoader.load(selecteur, {genererToken})
            .then(src=>{
                // console.debug("Source video : %O", src)
                setSrcVideo(src)
            })
            .catch(err=>{
                console.error("AfficherVideo erreur chargement video : %O", err)
            })
    }, [fichier, selecteur, genererToken, setSrcVideo])

    return (
        <div>
            <Row>
                
                <Col md={12} lg={8}>
                    {posterObj&&srcVideo?
                        <VideoViewer videos={srcVideo} poster={posterObj} height='100%' width='100%' 
                            selecteur={selecteur} 
                            onTimeUpdate={videoTimeUpdateHandler} 
                            timeStamp={timeStamp} />
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

                    <h3>Operation</h3>
                    <Row>
                        <Col>
                            <Button variant="secondary" onClick={showInfoModalOuvrir}>Convertir</Button>
                        </Col>
                    </Row>
                    <Row>
                        <Col>
                            <Form.Check type="switch" id="token-switch" label="Generer token" 
                                checked={genererToken?true:false} 
                                onChange={genererTokenToggle} />
                        </Col>
                    </Row>

                    <h3>Afficher</h3>
                    <SelecteurResolution 
                        listeVideos={videos} 
                        support={support}
                        selecteur={selecteur} setSelecteur={setSelecteur} 
                        videoLoader={fichier.videoLoader} />
                </Col>

            </Row>

            <AfficherLiensVideo srcVideo={srcVideo} show={!!genererToken} />

        </div>
    )
}

export default AfficherVideo

function SelecteurResolution(props) {
    const { listeVideos, /*support,*/ selecteur, setSelecteur, videoLoader } = props

    const [listeOptions, setListeOptions] = useState([])

    useEffect(()=>{
        // console.debug("Liste videos : %O", listeVideos)
        if(!listeVideos || !videoLoader) return
        // const { webm } = support

        // const videoKeys = Object.keys()
        //  let options = videoKeys.filter(item=>{
        //     const [mimetype, codecVideo, resolution, bitrate] = item.split(';')
        //     if(mimetype.endsWith('/webm')) {
        //         if(!webm) return false
        //     } 
        //     // else {
        //     //     if(webm) return false
        //     // }

        //     return true
        // })
        const options = videoLoader.getSelecteurs()
        options.sort(trierLabelsVideos)

        setListeOptions(options)

    }, [listeVideos, setListeOptions, videoLoader])

    const changerSelecteur = useCallback(value=>{
        // console.debug("Valeur : %O", value)
        setSelecteur(value)
        // const [mimetype, resolution, bitrate] = value.split(';')
        // localStorage.setItem(PLAYER_VIDEORESOLUTION, ''+resolution)
    }, [setSelecteur])

    return (
        <>
            <p>Selecteur</p>
            <DropdownButton title={selecteur} variant="secondary" onSelect={changerSelecteur}>
                {listeOptions.map(item=>{
                    if(item === selecteur) {
                        return <Dropdown.Item key={item} eventKey={item} active>{item}</Dropdown.Item>
                    } else {
                        return <Dropdown.Item key={item} eventKey={item}>{item}</Dropdown.Item>
                    }
                })}
            </DropdownButton>
        </>
    )
}

function AfficherLiensVideo(props) {
    const { show, srcVideo } = props

    if(!show) return ''

    // console.debug("VIDEOS : %O", srcVideo)

    return (
        <div>
            <h3>Liens video</h3>
            {srcVideo.map(item=>{
                return <LienVideo key={item.fuuid||item.label} video={item} /> 
            })}
        </div>
    )
}

function LienVideo(props) {
    const video = props.video
    const nomVideo = video.codecVideo || video.mimetype || video.src
    return (
        <Row>
            <Col>
                <a href={video.src} target="_top">{nomVideo}</a>
            </Col>
        </Row>
    )
}