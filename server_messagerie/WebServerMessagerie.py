import asyncio
import logging

from typing import Optional

from millegrilles_web.WebServer import WebServer

from server_messagerie import Constantes as ConstantesCollections
from server_messagerie.SocketIoMessagerieHandler import SocketIoMessagerieHandler


class WebServerMessagerie(WebServer):

    def __init__(self, etat, commandes):
        self.__logger = logging.getLogger(__name__ + '.' + self.__class__.__name__)
        super().__init__(ConstantesCollections.WEBAPP_PATH, etat, commandes)

        self.__semaphore_web_verifier = asyncio.BoundedSemaphore(value=5)

    def get_nom_app(self) -> str:
        return ConstantesCollections.APP_NAME

    async def setup(self, configuration: Optional[dict] = None, stop_event: Optional[asyncio.Event] = None):
        await super().setup(configuration, stop_event)

    async def setup_socketio(self):
        """ Wiring socket.io """
        # Utiliser la bonne instance de SocketIoHandler dans une sous-classe
        self._socket_io_handler = SocketIoMessagerieHandler(self, self._stop_event)
        await self._socket_io_handler.setup()

    async def _preparer_routes(self):
        self.__logger.info("Preparer routes WebServerMessagerie sous /messagerie")
        await super()._preparer_routes()

    async def run(self):
        """
        Override pour ajouter thread reception fichiers
        :return:
        """
        tasks = [
            super().run(),
        ]
        await asyncio.gather(*tasks)
