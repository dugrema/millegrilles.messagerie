import { useCallback } from 'react'

import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import NavDropdown from 'react-bootstrap/NavDropdown'

import { IconeConnexion } from '@dugrema/millegrilles.reactjs'

function Menu(props) {

    // console.debug("!!! Menu Proppys : %O", props)

    const { 
      setAfficherNouveauMessage, setAfficherContacts, setUuidSelectionne,
    } = props

    const afficherReception = useCallback(()=>{
      setAfficherNouveauMessage(false)
      setUuidSelectionne('')
    }, [setAfficherNouveauMessage])

    const afficherNouveauMessage = useCallback(()=>{
      setAfficherNouveauMessage(true)
      setAfficherContacts(false)
    }, [setAfficherNouveauMessage, setAfficherContacts])

    const afficherContacts = useCallback(()=>{
      setAfficherContacts(true)
    }, [setAfficherContacts])

    return (
      <Navbar collapseOnSelect expand="md">
        
        <Navbar.Brand>
          <Nav.Link onClick={afficherReception} title="Accueil MilleGrilles Collections">
              Messagerie
          </Nav.Link>
        </Navbar.Brand>

        <Navbar.Collapse id="responsive-navbar-menu">

            <Nav.Item>
                <Nav.Link title="Nouveau" onClick={afficherNouveauMessage}>
                    Nouveau
                </Nav.Link>
            </Nav.Item>

            <Nav.Item>
                <Nav.Link title="Contacts" onClick={afficherContacts}>
                    Contacts
                </Nav.Link>
            </Nav.Item>

            <DropDownUsager {...props} />

        </Navbar.Collapse>

        <Nav><Nav.Item><IconeConnexion connecte={props.etatConnexion} /></Nav.Item></Nav>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />

      </Navbar>
    )
}

export default Menu

function DropDownUsager(props) {

    const nomUsager = props.usager?props.usager.nomUsager:''
  
    let linkUsager = <><i className="fa fa-user-circle-o"/> {nomUsager}</>
    if(!nomUsager) linkUsager = 'Parametres'

    return (
        <NavDropdown title={linkUsager} id="basic-nav-dropdown" drop="down" className="menu-item">
          <NavDropdown.Item>
            <i className="fa fa-language" /> {' '} Changer Langue
          </NavDropdown.Item>
          <NavDropdown.Item href="/millegrilles">
            <i className="fa fa-home" /> {' '} Portail
          </NavDropdown.Item>
          <NavDropdown.Item href="/fermer">
            <i className="fa fa-close" /> {' '} Deconnecter
          </NavDropdown.Item>
        </NavDropdown>
    )

}
