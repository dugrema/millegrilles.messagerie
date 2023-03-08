import { useState, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import {  FormatterDate } from '@dugrema/millegrilles.reactjs'

import useWorkers from './WorkerContext'
import ListeMessages from './ListeMessages'

function AfficherMessages(props) {

    const { showNouveauMessage } = props

    const workers = useWorkers()
    const dossierSource = useSelector(state=>state.messagerie.source)

    const [colonnes, setColonnes] = useState(preparerColonnes(workers))

    useEffect(()=>setColonnes(preparerColonnes(workers, {source: dossierSource})), [workers, dossierSource, setColonnes])

    const enteteOnClickCb = useCallback(colonne=>{
        // console.debug("Click entete nom colonne : %s", colonne)
        const triCourant = {...colonnes.tri}
        const colonnesCourant = {...colonnes}
        const colonneCourante = triCourant.colonne
        let ordre = triCourant.ordre || 1
        if(colonne === colonneCourante) {
            // Toggle direction
            ordre = ordre * -1
        } else {
            ordre = 1
        }
        colonnesCourant.tri = {colonne, ordre}
        // console.debug("Sort key maj : %O", colonnesCourant)
        setColonnes(colonnesCourant)
    }, [colonnes, setColonnes])    

    return (
        <AfficherListe 
            colonnes={colonnes}
            enteteOnClickCb={enteteOnClickCb} 
            showNouveauMessage={showNouveauMessage} />
    )

}

export default AfficherMessages

function AfficherListe(props) {

    const { colonnes, enteteOnClickCb, showNouveauMessage } = props

    const listeMessages = useSelector(state=>state.messagerie.liste),
          compteMessages = listeMessages?listeMessages.length:0

    return (
        <ListeMessages 
            titre='Reception'
            colonnes={colonnes}
            messages={listeMessages} 
            compteMessages={compteMessages}
            enteteOnClickCb={enteteOnClickCb}
            showNouveauMessage={showNouveauMessage} />
    )
}


export function preparerColonnes(workers, opts) {
    opts = opts || {}

    const source = opts.source

    const messages_envoyes = source === 'outbox'
    const colonne_date = messages_envoyes?'date_envoi':'date_reception',
          colonne_adresse = messages_envoyes?'to':'from'
  
    const params = {
        ordreColonnes: [
            colonne_date, colonne_adresse, 'subject', 
            // 'boutonDetail',
        ],
        paramsColonnes: {
            [colonne_date]: {'label': 'Date', formatteur: FormatterDate, xs: 6, md: 3, lg: 2},
            'from': {'label': 'Auteur', xs: 6, md: 4, lg: 4},
            'to': {'label': 'Destinataires', xs: 6, md: 4, lg: 4},
            'subject': {'label': 'Sujet', xs: 12, md: 5, lg: 6},
            // 'boutonDetail': {label: ' ', className: 'droite', showBoutonContexte: true, xs: 2, md: 1, lg: 1},
        },
        tri: {colonne: colonne_date, ordre: -1},
        // rowLoader: data => dechiffrerMessage(workers, data)
        idMapper: data => data.uuid_transaction,
        // rowLoader: async data => data,
        rowClassname: data => {
          if(data.lu !== true) return 'nouveau'
          return ''
        }
    }
  
    return params
  }