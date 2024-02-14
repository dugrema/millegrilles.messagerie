import asyncio
import json
import logging

from millegrilles_messages.messages import Constantes
from millegrilles_web.SocketIoHandler import SocketIoHandler, ErreurAuthentificationMessage
from server_messagerie import Constantes as ConstantesMessagerie


class SocketIoMessagerieHandler(SocketIoHandler):

    def __init__(self, app, stop_event: asyncio.Event):
        self.__logger = logging.getLogger(__name__ + '.' + self.__class__.__name__)
        super().__init__(app, stop_event)

    async def _preparer_socketio_events(self):
        await super()._preparer_socketio_events()

        # Requetes
        self._sio.on('getDocuments', handler=self.requete_documents)

        # Commandes
        self._sio.on('creerCollection', handler=self.creer_collection)

        # Listeners
        self._sio.on('enregistrerCallbackMajCollection', handler=self.ecouter_maj_collection)
        self._sio.on('retirerCallbackMajCollection', handler=self.retirer_maj_collection)

    @property
    def exchange_default(self):
        return ConstantesMessagerie.EXCHANGE_DEFAUT

    async def requete_documents(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessagerie.NOM_DOMAINE, 'documentsParTuuid')

    # Commandes

    async def creer_collection(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'nouvelleCollection')

    # Listeners

    async def ecouter_maj_collection(self, sid: str, message: dict):
        async with self._sio.session(sid) as session:
            try:
                enveloppe = await self.authentifier_message(session, message)
            except ErreurAuthentificationMessage as e:
                return self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, {'ok': False, 'err': str(e)})[0]

        contenu = json.loads(message['contenu'])
        cuuid = contenu['cuuid']
        contact_id = contenu.get('contact_id')
        user_id = enveloppe.get_user_id

        # Verifier si l'usager a un acces au cuuid demande via le partage
        requete = {'tuuids': [cuuid], 'contact_id': contact_id, 'user_id': user_id}
        action = 'verifierAccesTuuids'
        domaine = Constantes.DOMAINE_GROS_FICHIERS

        user_id_subscribe = user_id

        try:
            producer = await asyncio.wait_for(self.etat.producer_wait(), timeout=2)
        except asyncio.TimeoutError:
            # MQ non disponible, abort
            raise ErreurAuthentificationMessage('Acces refuse au repertoire partage (erreur temporaire)')
        else:
            reponse = await producer.executer_requete(requete, domaine=domaine, action=action,
                                                      exchange=Constantes.SECURITE_PRIVE)
            if reponse.parsed.get('ok') is False:
                raise ErreurAuthentificationMessage('Acces refuse au repertoire partage (erreur requete)')

            if reponse.parsed.get('acces_tous') is not True:
                raise ErreurAuthentificationMessage('Acces refuse au repertoire partage (contact_id/cuuid refuse')

            # # User effectif (via contact_id)
            user_id_subscribe = reponse.parsed['user_id']

        exchanges = [Constantes.SECURITE_PRIVE]
        routing_keys = [f'evenement.GrosFichiers.{cuuid}.majCollection']
        self.__logger.debug("ecouter_maj_collection sur %s" % routing_keys)
        reponse = await self.subscribe(sid, message, routing_keys, exchanges, enveloppe=enveloppe)
        reponse_signee, correlation_id = self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, reponse)

        return reponse_signee

    async def retirer_maj_collection(self, sid: str, message: dict):
        async with self._sio.session(sid) as session:
            try:
                enveloppe = await self.authentifier_message(session, message)
            except ErreurAuthentificationMessage as e:
                return self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, {'ok': False, 'err': str(e)})[0]

        contenu = json.loads(message['contenu'])
        cuuid = contenu['cuuid']

        exchanges = [Constantes.SECURITE_PRIVE]
        routing_keys = [f'evenement.GrosFichiers.{cuuid}.majCollection']
        self.__logger.debug("retirer_maj_collection sur %s" % routing_keys)
        reponse = await self.unsubscribe(sid, message, routing_keys, exchanges)
        reponse_signee, correlation_id = self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, reponse)

        return reponse_signee

