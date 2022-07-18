import {useState, useEffect, useCallback} from 'react'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Dropdown from 'react-bootstrap/Dropdown'
import DropdownButton from 'react-bootstrap/DropdownButton'

import { usagerDao, VideoViewer } from '@dugrema/millegrilles.reactjs'

import {videoResourceLoader} from '@dugrema/millegrilles.reactjs/src/imageLoading'
import {trierLabelsVideos} from '@dugrema/millegrilles.reactjs/src/labelsRessources'

const PLAYER_VIDEORESOLUTION = 'player.videoResolution'

function AfficherVideo(props) {

    // console.debug("AfficherVideo PROPPIES : %O", props)

    const { workers, support, certificatMaitreDesCles, } = props,
          fichier = props.fichier || {},
          nomFichier = fichier.nom || '',
          version_courante = fichier.version_courante || fichier || {},
          videos = version_courante.video || version_courante || {}

    const [selecteur, setSelecteur] = useState('')
    const [srcVideo, setSrcVideo] = useState('')

    useEffect(()=>{
        console.debug("Support : %O", support)
        const { webm } = support

        const resolutionLocal = Number.parseInt(localStorage.getItem(PLAYER_VIDEORESOLUTION) || '320')

        const videoKeys = Object.keys(videos)
        let options = videoKeys
        options.sort(trierLabelsVideos)
        options = options.filter(item=>{
            const [mimetype, resolution, bitrate] = item.split(';')
            if(mimetype.endsWith('/webm')) {
                if(!webm) return false
            } else {
                if(webm) return false
            }
            return true
        })

        let optionsResolution = options.filter(item=>{
            const [mimetype, resolution, bitrate] = item.split(';')
            const resolutionInt = Number.parseInt(resolution)
            if(resolutionInt > resolutionLocal) return false
            return true
        })
        if(optionsResolution.length > 0) {
            optionsResolution.reverse()
            console.debug("Options selecteur : %O", optionsResolution)

            const optionSelectionnee = optionsResolution.pop()
            console.debug("Option selectionnee : %O", optionSelectionnee)
            setSelecteur(optionSelectionnee)
        } else {
            // Aucun format disponible en fonction de la resolution. Choisir la plus faible
            // resolution dans la liste.
            const optionSelectionnee = options.pop()
            console.debug("Option selectionnee (resolution plus grande que demandee) : %O", optionSelectionnee)
            setSelecteur(optionSelectionnee)
        }
    }, [support, videos, setSelecteur])

    useEffect(()=>{
        if(!selecteur) return setSrcVideo('')
        // console.debug("!!! Fichier selectionne (support: %O): %O", support, fichier)

        // Creer token de streaming
        const { connexion, chiffrage } = workers

        const creerToken = async fuuid => {
            const cleDechiffree = await usagerDao.getCleDechiffree(fuuid)
            const dictCle = {[fuuid]: Buffer.from(cleDechiffree.cleSecrete)}
            const clesChiffrees = await chiffrage.chiffrerSecret(dictCle, certificatMaitreDesCles, {DEBUG: false})
            const preuveAcces = { fuuid, cles: clesChiffrees.cles, partition: clesChiffrees.partition, domaine: 'GrosFichiers' }
            console.debug("Preuve acces : %O", preuveAcces)
        
            const reponse = await connexion.creerTokenStream(preuveAcces)
            return reponse.token
        }

        const videoLoader = videoResourceLoader(null, fichier.video, {supporteWebm: support.webm, baseUrl: '/messagerie/streams', creerToken})
        // console.debug("Video loader : %O", videoLoader)
        videoLoader.load(selecteur)
            .then(async src=>{
                console.debug("Source video : %O", src)
                setSrcVideo(src)
            })
            .catch(err=>{
                console.error("AfficherVideo erreur chargement video : %O", err)
            })
    }, [workers, fichier, selecteur, support, setSrcVideo])

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
                    {srcVideo?
                        <VideoViewer src={srcVideo} height='100%' width='100%' />
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
                    <p>Resolution</p>
                    <SelecteurResolution 
                        listeVideos={videos} 
                        support={support}
                        selecteur={selecteur} setSelecteur={setSelecteur} />
                </Col>

            </Row>

        </div>
    )
}

export default AfficherVideo

function SelecteurResolution(props) {
    const { listeVideos, support, selecteur, setSelecteur } = props

    const [listeOptions, setListeOptions] = useState([])

    useEffect(()=>{
        console.debug("Liste videos : %O", listeVideos)
        const { webm } = support

        const videoKeys = Object.keys(listeVideos)
        let options = videoKeys.filter(item=>{
            const [mimetype, resolution, bitrate] = item.split(';')
            if(mimetype.endsWith('/webm')) {
                if(!webm) return false
            } else {
                if(webm) return false
            }

            return true
        })
        options.sort(trierLabelsVideos)
        setListeOptions(options)

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