import asyncio
import json
import logging

from millegrilles_messages.messages import Constantes
from millegrilles_messages.messages.ValidateurCertificats import CertificatInconnu
from millegrilles_web.SocketIoHandler import SocketIoHandler, ErreurAuthentificationMessage
from server_messagerie import Constantes as ConstantesMessagerie


class SocketIoMessagerieHandler(SocketIoHandler):

    def __init__(self, app, stop_event: asyncio.Event):
        self.__logger = logging.getLogger(__name__ + '.' + self.__class__.__name__)
        super().__init__(app, stop_event)

    async def _preparer_socketio_events(self):
        await super()._preparer_socketio_events()

        # Requetes
        self._sio.on('getProfil', handler=self.requete_profil)
        self._sio.on('getMessages', handler=self.requete_messages)
        self._sio.on('getReferenceMessages', handler=self.requete_reference_messages)
        self._sio.on('getMessagesAttachments', handler=self.requete_messages_attachments)
        self._sio.on('getPermissionMessages', handler=self.requete_permission_messages)
        self._sio.on('getClesChiffrage', handler=self.requete_cles_chiffrage)
        self._sio.on('getReferenceContacts', handler=self.requete_reference_contacts)
        self._sio.on('getCollectionUpload', handler=self.requete_collection_upload)
        self._sio.on('getClepubliqueWebpush', handler=self.requete_cle_publique_webpush)

        # Commandes
        self._sio.on('initialiserProfil', handler=self.initialiser_profil)

        self._sio.on('majContact', handler=self.maj_contact)
        self._sio.on('marquerLu', handler=self.lu)
        self._sio.on('posterMessage', handler=self.poster_message)
        self._sio.on('copierFichierTiers', handler=self.copier_fichiers_tiers)
        self._sio.on('conserverClesAttachments', handler=self.conserver_cles_attachments)
        self._sio.on('supprimerMessages', handler=self.supprimer_messages)
        self._sio.on('supprimerContacts', handler=self.supprimer_contacts)
        self._sio.on('sauvegarderUsagerConfigNotifications', handler=self.sauvegarder_usager_config_notifications)
        self._sio.on('sauvegarderSubscriptionWebpush', handler=self.sauvegarder_subscription_webpush)
        self._sio.on('retirerSubscriptionWebpush', handler=self.retirer_subscription_webpush)

        # Listeners
        self._sio.on('enregistrerCallbackEvenementMessages', handler=self.ecouter_evenement_messages)
        self._sio.on('retirerCallbackEvenementMessages', handler=self.retirer_evenement_messages)

    @property
    def exchange_default(self):
        return ConstantesMessagerie.EXCHANGE_DEFAUT

    async def requete_profil(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessagerie.NOM_DOMAINE, 'getProfil')

    async def requete_messages(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessagerie.NOM_DOMAINE, 'getMessages')

    async def requete_reference_messages(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessagerie.NOM_DOMAINE, 'getReferenceMessages')

    async def requete_messages_attachments(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessagerie.NOM_DOMAINE, 'getMessagesAttachments')

    async def requete_permission_messages(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessagerie.NOM_DOMAINE, 'getPermissionMessages')

    async def requete_cles_chiffrage(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessagerie.NOM_DOMAINE, 'getClesChiffrage')

    async def requete_contacts(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessagerie.NOM_DOMAINE, 'getContacts')

    async def requete_reference_contacts(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessagerie.NOM_DOMAINE, 'getReferenceContacts')

    async def requete_collection_upload(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessagerie.NOM_DOMAINE, 'getCollectionUpload')

    async def requete_cle_publique_webpush(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessagerie.NOM_DOMAINE, 'getClepubliqueWebpush')


    # Commandes

    async def initialiser_profil(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'initialiserProfil')

    async def maj_contact(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'majContact')

    async def lu(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'lu')

    async def poster_message(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'posterMessage')

    async def copier_fichiers_tiers(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'copierFichierTiers')

    async def conserver_cles_attachments(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'conserverClesAttachments')

    async def supprimer_messages(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'supprimerMessages')

    async def supprimer_contacts(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'supprimerContacts')

    async def sauvegarder_usager_config_notifications(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'sauvegarderUsagerConfigNotifications')

    async def sauvegarder_subscription_webpush(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'sauvegarderSubscriptionWebpush')

    async def retirer_subscription_webpush(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessagerie.NOM_DOMAINE, 'retirerSubscriptionWebpush')

    # Listeners

    async def ecouter_evenement_messages(self, sid: str, message: dict):
        async with self._sio.session(sid) as session:
            try:
                enveloppe = await self.authentifier_message(session, message)
                user_id = enveloppe.get_user_id
            except ErreurAuthentificationMessage as e:
                return self.etat.formatteur_message.signer_message(
                    Constantes.KIND_REPONSE, {'ok': False, 'err': str(e)})[0]

        exchanges = [Constantes.SECURITE_PRIVE]
        routing_keys = [
            f'evenement.Messagerie.{user_id}.nouveauMessage',
            f'evenement.Messagerie.{user_id}.messageLu',
            f'evenement.Messagerie.{user_id}.messagesSupprimes',
        ]

        reponse = await self.subscribe(sid, message, routing_keys, exchanges, enveloppe=enveloppe)
        reponse_signee, correlation_id = self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, reponse)

        return reponse_signee

    # retirerCallbackEvenementMessages
    async def retirer_evenement_messages(self, sid: str, message: dict):
        async with self._sio.session(sid) as session:
            try:
                enveloppe = await self.authentifier_message(session, message)
                user_id = enveloppe.get_user_id
            except (CertificatInconnu, ErreurAuthentificationMessage) as e:
                return self.etat.formatteur_message.signer_message(
                    Constantes.KIND_REPONSE, {'ok': False, 'err': str(e)})[0]

        exchanges = [Constantes.SECURITE_PRIVE]
        routing_keys = [
            f'evenement.Messagerie.{user_id}.nouveauMessage',
            f'evenement.Messagerie.{user_id}.messageLu',
            f'evenement.Messagerie.{user_id}.messagesSupprimes',
        ]

        reponse = await self.unsubscribe(sid, message, routing_keys, exchanges)
        reponse_signee, correlation_id = self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, reponse)

        return reponse_signee

    # enregistrerCallbackEvenementContact
    # retirerCallbackEvenementContact
    # enregistrerCallbackMajFichier
    # retirerCallbackMajFichier

    # async def ecouter_maj_collection(self, sid: str, message: dict):
    #     async with self._sio.session(sid) as session:
    #         try:
    #             enveloppe = await self.authentifier_message(session, message)
    #         except ErreurAuthentificationMessage as e:
    #             return self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, {'ok': False, 'err': str(e)})[0]
    #
    #     contenu = json.loads(message['contenu'])
    #     cuuid = contenu['cuuid']
    #     contact_id = contenu.get('contact_id')
    #     user_id = enveloppe.get_user_id
    #
    #     # Verifier si l'usager a un acces au cuuid demande via le partage
    #     requete = {'tuuids': [cuuid], 'contact_id': contact_id, 'user_id': user_id}
    #     action = 'verifierAccesTuuids'
    #     domaine = Constantes.DOMAINE_GROS_FICHIERS
    #
    #     user_id_subscribe = user_id
    #
    #     try:
    #         producer = await asyncio.wait_for(self.etat.producer_wait(), timeout=2)
    #     except asyncio.TimeoutError:
    #         # MQ non disponible, abort
    #         raise ErreurAuthentificationMessage('Acces refuse au repertoire partage (erreur temporaire)')
    #     else:
    #         reponse = await producer.executer_requete(requete, domaine=domaine, action=action,
    #                                                   exchange=Constantes.SECURITE_PRIVE)
    #         if reponse.parsed.get('ok') is False:
    #             raise ErreurAuthentificationMessage('Acces refuse au repertoire partage (erreur requete)')
    #
    #         if reponse.parsed.get('acces_tous') is not True:
    #             raise ErreurAuthentificationMessage('Acces refuse au repertoire partage (contact_id/cuuid refuse')
    #
    #         # # User effectif (via contact_id)
    #         user_id_subscribe = reponse.parsed['user_id']
    #
    #     exchanges = [Constantes.SECURITE_PRIVE]
    #     routing_keys = [f'evenement.GrosFichiers.{cuuid}.majCollection']
    #     self.__logger.debug("ecouter_maj_collection sur %s" % routing_keys)
    #     reponse = await self.subscribe(sid, message, routing_keys, exchanges, enveloppe=enveloppe)
    #     reponse_signee, correlation_id = self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, reponse)
    #
    #     return reponse_signee
    #
    # async def retirer_maj_collection(self, sid: str, message: dict):
    #     async with self._sio.session(sid) as session:
    #         try:
    #             enveloppe = await self.authentifier_message(session, message)
    #         except ErreurAuthentificationMessage as e:
    #             return self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, {'ok': False, 'err': str(e)})[0]
    #
    #     contenu = json.loads(message['contenu'])
    #     cuuid = contenu['cuuid']
    #
    #     exchanges = [Constantes.SECURITE_PRIVE]
    #     routing_keys = [f'evenement.GrosFichiers.{cuuid}.majCollection']
    #     self.__logger.debug("retirer_maj_collection sur %s" % routing_keys)
    #     reponse = await self.unsubscribe(sid, message, routing_keys, exchanges)
    #     reponse_signee, correlation_id = self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, reponse)
    #
    #     return reponse_signee
    #
