import {useState, useEffect, useMemo} from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

function AfficherAudio(props) {

    const { support, showInfoModalOuvrir } = props

    const fichier = useMemo(()=>props.fichier || {}, [props.fichier])
    const nomFichier = fichier.nom || '',
          version_courante = fichier.version_courante || {}

    const timeStamp = 0

    const audioTimeUpdateHandler = param => console.debug("audio update ", param)

    return (
        <div>
            <Row>
                
                <Col md={12} lg={8}>
                    <AudioPlayer 
                        fichier={fichier}
                        onTimeUpdate={audioTimeUpdateHandler} />
                </Col>

                <Col>
                    <h3>{nomFichier}</h3>
                    
                    <Button onClick={props.fermer}>Retour</Button>

                </Col>

            </Row>

        </div>        
    )

}

export default AfficherAudio

function AudioPlayer(props) {

    const { fichier } = props

    useEffect(()=>{
        console.debug("AfficherAudio proppies : %O", props)
    }, [props])

    const [audioFile, setAudioFile] = useState('')

    const urlAudio = useMemo(()=>{
        if(audioFile) return audioFile.src
        return ''
    }, [audioFile])

    const mimetype = useMemo(()=>{
        if(audioFile) return audioFile.mimetype
        return ''
    }, [audioFile])

    useEffect(()=>{
        const audioLoader = fichier.audioLoader
        if(audioLoader) {
            console.debug("Audio loader : %O", audioLoader)
            audioLoader.load().then(fichiers=>{
                console.debug("Fichiers audio : ", fichiers)
                const fichierAudio = fichiers.pop()
                console.debug("Fichier audio : ", fichierAudio)
                setAudioFile(fichierAudio)
            })
            .catch(err=>console.error("Erreur chargement URL audio ", err))
            return audioLoader.unload
        }
    }, [fichier, setAudioFile])

    return (
        <div>
            <div>Audio player</div>
            {urlAudio?
                <audio controls>
                    <source src={urlAudio} type={mimetype} />
                    Your browser does not support the audio element.
                </audio>
            :''}
        </div>
    )
}
