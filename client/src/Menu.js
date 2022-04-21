import { useCallback } from 'react'

import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import NavDropdown from 'react-bootstrap/NavDropdown'
import Badge from 'react-bootstrap/Badge'

import { IconeConnexion } from '@dugrema/millegrilles.reactjs'

function Menu(props) {

    // console.debug("!!! Menu Proppys : %O", props)

    const { 
      setAfficherNouveauMessage, setAfficherContacts, setUuidSelectionne,
      showTransfertModal,
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

            <Nav.Item>
              <Nav.Link title="Upload/Download" onClick={showTransfertModal}>
                  <LabelTransfert {...props} />
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
          <NavDropdown.Item href="/millegrilles/authentification/fermer">
            <i className="fa fa-close" /> {' '} Deconnecter
          </NavDropdown.Item>
        </NavDropdown>
    )

}

function LabelTransfert(props) {

  const { etatTransfert } = props
  const download = etatTransfert.download || {}
  const downloads = download.downloads || []
  const pctDownload = download.pct || 100
  const upload = etatTransfert.upload || {}
  const uploadsCompletes = upload.uploadsCompletes || []
  const pctUpload = upload.pctTotal || 100

  const downloadsResultat = downloads.reduce((nb, item)=>{
    let {encours, succes, erreur} = nb
    if(item.status===3) succes++
    if(item.status===4) erreur++
    return {encours, succes, erreur}
  }, {encours: 0, succes: 0, erreur: 0})

  let variantDownload = 'primary'
  if(downloadsResultat.erreur>0) variantDownload = 'danger'
  else if(downloadsResultat.succes>0) variantDownload = 'success'

  const uploadsResultat = uploadsCompletes.reduce((nb, item)=>{
    let {encours, succes, erreur} = nb
    if(item.status===3) succes++
    if(item.status===4) erreur++
    return {encours, succes, erreur}
  }, {encours: 0, succes: 0, erreur: 0})
  if(upload.uploadEnCours) {
    uploadsResultat.encours = 1
  }

  let variantUpload = 'primary'
  if(uploadsResultat.erreur>0) variantUpload = 'danger'
  else if(uploadsResultat.succes>0) variantUpload = 'success'

  return (
    <div className="transfer-labels">

      <div>
        <i className="fa fa-upload" />
        {' '}
        <Badge pill bg={variantUpload}>{pctUpload}%</Badge>
      </div>

      {' '}

      <div>
        <i className="fa fa-download" />
        {' '}
        <Badge pill bg={variantDownload}>{pctDownload}%</Badge>
      </div>

    </div>
  )
}