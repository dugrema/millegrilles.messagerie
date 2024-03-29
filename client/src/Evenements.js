import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { proxy as comlinkProxy } from 'comlink'

import useWorkers, {useEtatPret} from './WorkerContext'
import contactsAction from './redux/contactsSlice'
import messagerieAction from './redux/messagerieSlice'

export function EvenementsMessageHandler(_props) {

    const workers = useWorkers(),
          dispatch = useDispatch(),
          etatPret = useEtatPret()

    const { connexion } = workers

    const userId = useSelector(state=>state.contacts.userId)

    // Handler evenements messages
    const evenementMessageCb = useMemo(
        () => comlinkProxy( evenement => {
            traiterMessageEvenement(workers, dispatch, userId, evenement)
                .catch(err=>console.error("Erreur traitement evenement message ", err))
        }),
        [workers, userId, dispatch]
    )

    // Enregistrer changement de collection
    useEffect(()=>{
        if(!connexion || !etatPret) return  // Pas de connexion, rien a faire

        // Enregistrer listeners
        // console.debug("Enregistrer callback messages")
        connexion.enregistrerCallbackEvenementMessages({}, evenementMessageCb)
            .catch(err=>console.warn("Erreur enregistrement listeners messages : %O", err))

        // Cleanup listeners
        return () => {
            // console.debug("Retirer callback messages")
            connexion.retirerCallbackEvenementMessages({}, evenementMessageCb)
                .catch(err=>console.warn("Erreur retirer listeners messages : %O", err))
        }
    }, [connexion, etatPret, evenementMessageCb])
  
}

async function traiterMessageEvenement(workers, dispatch, userId, evenementMessage) {
    console.debug("traiterMessageEvenement ", evenementMessage)
    const { connexion, messagerieDao } = workers
  
    // Traiter message
    const routing = evenementMessage.routingKey,
            action = routing.split('.').pop()
    const message = evenementMessage.message
  
    if(action === 'nouveauMessage') {
        console.debug("traiterMessageEvenement Nouveau message ", message)
        const messageMaj = {
            message_id: message.message.id,
            user_id: userId, 
            message: message.message,
            dechiffre: 'false',
            fichiers: message.fichiers,
            fichiers_completes: message.fichiers_completes,
            date_reception: message.date_reception,
            date_envoi: message.date_envoi,
            lu: message.lu,
            supprime: message.supprime,
            certificat_message: message.certificat_message,
            millegrille_message: message.millegrille_message,
        }
  
        console.debug("traiterMessageEvenement majMessage ", messageMaj)
        await messagerieDao.updateMessage(messageMaj)
        dispatch(messagerieAction.mergeMessagesData(messageMaj))
        dispatch(messagerieAction.pushMessagesChiffres([messageMaj]))

    } else if(action === 'messageLu') {
        console.debug("traiterMessageEvenement Message lu ", message)

        for await (const message_id of Object.keys(message.lus)) {
            const flag_lu = message.lus[message_id]
            const messageMaj = {message_id, user_id: userId, lu: flag_lu?true:false}
            await messagerieDao.updateMessage(messageMaj)
            dispatch(messagerieAction.mergeMessagesData(messageMaj))
        }
    } else if(action === 'messagesSupprimes') {
        console.debug("traiterMessageEvenement Messages supprimes ", message)

        for await (const message_id of message.message_ids) {
            const messageSupprime = {message_id, user_id: userId, supprime: true}
            await messagerieDao.updateMessage(messageSupprime)
            dispatch(messagerieAction.supprimerMessages(messageSupprime))
        }

    } else {
        console.error("Recu evenement message de type inconnu : %O", evenementMessage)
    }
    
}

export function EvenementsContactHandler(_props) {

    const workers = useWorkers()
    const etatPret = useEtatPret()
    const dispatch = useDispatch()
    const userId = useSelector(state=>state.contacts.userId)

    const { connexion } = workers
    
    const evenementContactCb = useMemo(
        () => comlinkProxy( evenement => traiterContactEvenement(workers, dispatch, userId, evenement) ),
        [workers, dispatch]
    )

    // Enregistrer changement de collection
    useEffect(()=>{
        if(!connexion || !etatPret) return  // Pas de connexion, rien a faire

        // Enregistrer listeners
        console.debug("Enregistrer callback contacts")
        connexion.enregistrerCallbackEvenementContact({}, evenementContactCb)
            .catch(err=>console.warn("Erreur enregistrement listeners majCollection : %O", err))

        // Cleanup listeners
        return () => {
            console.debug("Retirer callback contacts")
            connexion.retirerCallbackEvenementContact({}, evenementContactCb)
                .catch(err=>console.warn("Erreur retirer listeners maj contenu favoris : %O", err))
        }
    }, [connexion, etatPret, evenementContactCb])

    return ''  // Aucun affichage
}

function traiterContactEvenement(workers, dispatch, userId, evenementContact) {
    console.debug("traiterContactEvenement ", evenementContact)
    const { messagerieDao } = workers

    // Traiter message
    const routing = evenementContact.routingKey,
            action = routing.split('.').pop()
    const message = evenementContact.message

    if(action === 'majContact') {
        // Conserver information de contact
        const date_modification = message['en-tete'].estampille
        const contactMaj = {...message, user_id: userId, date_modification, dechiffre: 'false'}
        delete contactMaj['en-tete']
        delete contactMaj['_certificat']
        delete contactMaj['_signature']

        console.debug("traiterContactEvenement majContact ", contactMaj)

        // Conserver maj de contact
        messagerieDao.mergeReferenceContacts(userId, [contactMaj])
            .then(()=>{
                dispatch(contactsAction.pushContactsChiffres([contactMaj]))
            })
            .catch(err=>console.error("Erreur maj contact sur evenement : %O", err))

    } else if(action === 'contactsSupprimes') {
        const uuid_contacts = message.uuid_contacts
        console.debug("traiterContactEvenement contactsSupprimes ", message)
        messagerieDao.supprimerContacts(uuid_contacts)
            .then(()=>{
                dispatch(contactsAction.supprimerContacts(uuid_contacts))
            })
            .catch(err=>console.error("Erreur supprimer contact sur evenement : %O", err))
    } else {
        console.error("Recu message contact de type inconnu : %O", evenementContact)
    }
    
}
