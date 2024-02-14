import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import Badge from 'react-bootstrap/Badge'
import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import NavDropdown from 'react-bootstrap/NavDropdown'

import { Menu as MenuMillegrilles, DropDownLanguage, ModalInfo } from '@dugrema/millegrilles.reactjs'

import { useInfoConnexion, useUsager } from './WorkerContext'

const CONST_COMPLET_EXPIRE = 2 * 60 * 60 * 1000  // Auto-cleanup apres 2 heures (millisecs) de l'upload
const ETAT_PREPARATION = 1,
      ETAT_PRET = 2,
      ETAT_UPLOADING = 3,
      ETAT_COMPLETE = 4,
      ETAT_ECHEC = 5,
      ETAT_CONFIRME = 6,
      ETAT_UPLOAD_INCOMPLET = 7

const CONST_ETATS_DOWNLOAD = {
  ETAT_PRET: 1,
  ETAT_EN_COURS: 2,
  ETAT_SUCCES: 3,
  ETAT_ECHEC: 4
}

function Menu(props) {

  const { 
    i18n, etatConnexion, manifest, onSelect, etatTransfert, 
    showTransfertModal,
  } = props
 
  const { t } = useTranslation()
  const infoConnexion = useInfoConnexion()
  const usager = useUsager()
  // console.debug("UseUsager usager ", usager)

  const idmg = infoConnexion.idmg

  const [showModalInfo, setShowModalInfo] = useState(false)
  const handlerCloseModalInfo = useCallback(()=>setShowModalInfo(false), [setShowModalInfo])

  const handlerChangerLangue = eventKey => {i18n.changeLanguage(eventKey)}

  const handlerSelect = eventKey => {
    console.debug("!handlerSelect ", eventKey)
    switch(eventKey) {
      case 'information': setShowModalInfo(true); break
      case 'portail': window.location = '/millegrilles'; break
      case 'deconnecter': window.location = '/millegrilles/authentification/fermer'; break
      default:
        onSelect(eventKey)
    }
  }

  const brand = (
    <Navbar.Brand>
        <Nav.Link title={t('titre')} onClick={()=>handlerSelect('')}>
            {t('titre')}
        </Nav.Link>
    </Navbar.Brand>
  )

  return (
    <>
      <MenuMillegrilles brand={brand} labelMenu="Menu" etatConnexion={etatConnexion} onSelect={handlerSelect}>

        <Nav.Link eventKey="contacts" title={t('menu.contacts')}>
            {t('menu.contacts')}
        </Nav.Link>

        <Nav.Link eventKey="information" title="Afficher l'information systeme">
            {t('menu.information')}
        </Nav.Link>

        <DropDownOptions onSelect={handlerSelect} />

        <DropDownLanguage title={t('menu.language')} onSelect={handlerChangerLangue}>
            <NavDropdown.Item eventKey="en-US">English</NavDropdown.Item>
            <NavDropdown.Item eventKey="fr-CA">Francais</NavDropdown.Item>
        </DropDownLanguage>

        <Nav.Link eventKey="portail" title={t('menu.portail')}>
            {t('menu.portail')}
        </Nav.Link>

        <Nav.Link eventKey="deconnecter" title={t('menu.deconnecter')}>
            {t('menu.deconnecter')}
        </Nav.Link>

      </MenuMillegrilles>

      <ModalInfo 
          show={showModalInfo} 
          fermer={handlerCloseModalInfo} 
          manifest={manifest} 
          idmg={idmg} 
          usager={usager} />
    </>
  )
}

export default Menu

function DropDownOptions(props) {

  const { onSelect } = props

  return (
      <NavDropdown title="Options" id="basic-nav-dropdown-options" drop="down" className="menu-item" onSelect={onSelect}>
        <NavDropdown.Item title="Notifications" eventKey='configurationNotifications'>
          <i className="fa fa-exclamation-circle" /> {' '} Notifications
        </NavDropdown.Item>
      </NavDropdown>
  )

}
