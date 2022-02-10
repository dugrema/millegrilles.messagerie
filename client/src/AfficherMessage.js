import { useState, useEffect } from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

import { pki } from '@dugrema/node-forge'
import { FormatterDate, forgecommon } from '@dugrema/millegrilles.reactjs'
const { extraireExtensionsMillegrille } = forgecommon

function AfficherMessage(props) {

    return (
        <>
            <p>Afficher message</p>
            <Button onClick={props.retour}>Retour</Button>
        </>
    )

}

export default AfficherMessage
