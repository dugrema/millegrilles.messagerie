import { useState, useCallback } from 'react'
import Button from 'react-bootstrap/Button'

function EditerContact(props) {

    const { show, setUuidContactSelectionne } = props

    const retour = useCallback(()=>setUuidContactSelectionne(''), [setUuidContactSelectionne])

    if(!show) return ''

    return (
        <>
            <p>Editer contact</p>
            <Button variant="secondary" onClick={retour}>Retour</Button>
        </>
    )
}

export default EditerContact
