import { useState, useEffect } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'


function NouveauMessage(props) {

    return (
        <>
            <p>Nouveau message</p>
            <Button>Envoyer</Button><Button>Annuler</Button>

            <p></p>
        </>
    )

}

export default NouveauMessage
