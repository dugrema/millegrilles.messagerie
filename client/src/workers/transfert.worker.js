import { expose } from 'comlink'
import * as FiletransferDownloadClient from '@dugrema/millegrilles.reactjs/src/filetransferDownloadClient'
import * as FiletransferUploadClient from '@dugrema/millegrilles.reactjs/src/filetransferUploadClient'

// Configuration pour messagerie
FiletransferDownloadClient.down_setNomIdb('messagerie')

expose({
    ...FiletransferDownloadClient,
    ...FiletransferUploadClient
})