import { delay, DisconnectReason, makeWASocket } from '@itsliaaa/baileys'
import { Boom } from '@hapi/boom'
import qrCode from 'qrcode'
import phoneNumber from 'awesome-phonenumber'

import { cleanUpFolder, Sender } from './Utilities.js'

let restartScore = 0

export const Socket = (socketConfig = {}) => {
   const sock = makeWASocket(socketConfig)

   Sender(sock)

   sock.ev.on('connection.update', async (update) => {
      if (update.connection === 'connecting' && pairingCode && !sock.authState.creds.registered) {
         await delay(1_500)
         const code = await sock.requestPairingCode(phoneNumber('+' + (botNumber?.toString() || '').replace(/\D/g, '')).getNumber('e164').replace(/\D/g, ''))
         console.log('🔗 Pairing code', ':', code)
      }

      if (update.connection === 'close') {
         const reason = new Boom(update.lastDisconnect?.error)?.output?.statusCode
         switch (reason) {
            case DisconnectReason.connectionLost:
               console.error('❌ Connection to WhatsApp lost, restarting...')
               break
            case DisconnectReason.connectionClosed:
               console.error('❌ Connection to WhatsApp closed, restarting...')
               break
            case DisconnectReason.timedOut:
               console.error('❌ Connection timed out to WhatsApp, restarting...')
               break
            case DisconnectReason.badSession:
               await cleanUpFolder(authFolder)
               await sock.logout()
               console.error('❌ Invalid session, please re-pair')
               break
            case DisconnectReason.connectionReplaced:
               console.error('❌ Connection overlapping, restarting...')
               break
            case DisconnectReason.loggedOut:
               await cleanUpFolder(authFolder)
               console.error('❌ Device logged out, please re-pair')
               break
            case DisconnectReason.forbidden:
               await cleanUpFolder(authFolder)
               await client.logout()
               console.error('❌ Connection failed, please re-pair')
               break
            case DisconnectReason.multideviceMismatch:
               await cleanUpFolder(authFolder)
               await client.logout()
               console.error('❌ Please re-pair')
               break
            case DisconnectReason.restartRequired:
               console.log('✅ Successfully connected to WhatsApp')
               break
            default:
               await cleanUpFolder(authFolder)
               console.error('❌ Connection lost with unknown reason', ':', reason)
         }

         ++restartScore
         if (restartScore >= 3) {
            console.log('❌ The socket had to be stopped due to an unstable connection.')

            process.exit(0)
         }

         Socket(socketConfig)
      }

      if (update.connection === 'open')
         console.log('✅ Connected to WhatsApp as', botName)

      if (update.qr && !pairingCode)
         qrCode.toString(update.qr, {
            type: 'terminal',
            small: true
         }, (error, string) => {
            if (error || !string?.length || typeof string !== 'string')
               throw new Error('❌ There was a problem creating the QR code', {
                  message: error
               })

            console.log(string)
         })

      if (update.receivedPendingNotifications) {
         console.log(`🕒 Loading message, please wait a moment...`)
         sock.ev.flush()
      }
   })

   return sock
}