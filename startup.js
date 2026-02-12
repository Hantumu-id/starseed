import './config.js'
import './error.js'

import { areJidsSameUser, isJidGroup, isJidMetaAI, isJidNewsletter, jidNormalizedUser, useMultiFileAuthState } from '@itsliaaa/baileys'
import { existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs'
import { join } from 'path'
import pino from 'pino'
import cron from 'node-cron'

import { CommandIndex } from './lib/Caches.js'
import { SCHEMA } from './lib/Constants.js'
import { Database, Store } from './lib/Database.js'
import { readMessage, Serialize, shouldReadMessage } from './lib/Serialize.js'
import { Socket } from './lib/Socket.js'
import { applySchema, isEmptyObject, messageLogger } from './lib/Utilities.js'
import { ScanDirectory } from './lib/Watcher.js'

const temporaryFolderPath = join(process.cwd(), temporaryFolder)
const databasePath = join(process.cwd(), databaseFilename)
const storePath = join(process.cwd(), storeFilename)
const logger = pino({ level: 'silent' })

const Start = async () => {
   const { state, saveCreds } = await useMultiFileAuthState(authFolder)

   const db = Database(databasePath)
   const store = Store(storePath)

   if (existsSync(databasePath))
      db.readFromFile()

   if (existsSync(storePath))
      store.readFromFile()

   if (!existsSync(temporaryFolder))
      mkdirSync(temporaryFolderPath, { recursive: true })

   const sock = Socket({
      logger,
      cachedGroupMetadata: (jid) =>
         store.getGroup(jid),
      shouldIgnoreJid: (jid) =>
         jid && (isJidMetaAI(jid) || isJidNewsletter(jid)),
      getMessage: (key) => {
         const message = store.getMessage(key.remoteJid, key.id)
         console.log('getMessage', message)
         return message
      },
      auth: state
   })

   ScanDirectory(pluginsFolder)

   sock.ev.on('creds.update', saveCreds)

   sock.ev.on('groups.upsert', (groups) => {
      for (const group of groups)
         store.setGroup(group.id, group)
   })

   sock.ev.on('groups.update', (groups) => {
      for (const group of groups)
         if (store.hasGroup(group.id)) {
            store.setGroup(
               group.id,
               Object.assign(
                  store.getGroup(group.id) || {},
                  group
               )
            )
         } else
            store.setGroup(group.id, group)
   })

   sock.ev.on('group-participants.update', async ({ id, author, participants, action }) => {
      const metadata = store.getGroup(id) || await sock.groupMetadata(id)

      const authorId = await sock.findUserId(author)
      if (!authorId?.phoneNumber) return

      for (const participant of participants) {
         if (action === 'add') {
            metadata.participants.push(participant)
         }
         else if (action === 'promote') {
            metadata.participants.find(x => x.id === participant.id).admin = 'admin'
         }
         else if (action === 'demote') {
            metadata.participants.find(x => x.id === participant.id).admin = false
         }
         else if (action === 'remove') {
            metadata.participants = metadata.participants.filter(x => x.id !== participant.id)
         }
         store.setGroup(id, metadata)
      }
   })

   sock.ev.on('presence.update', async ({ id, presences }) => {
      for (const presence in presences) {
         if (isJidGroup(presence)) continue

         const userId = await sock.findUserId(presence)
         if (!userId.phoneNumber ||
            areJidsSameUser(
               jidNormalizedUser(sock.user.id),
               userId.phoneNumber
            )
         ) continue

         const userData = db.getUser(userId.phoneNumber)
         if (!userData) continue

         const condition = presences[presence]
         if (
            (
               condition.lastKnownPresence === 'composing' ||
               condition.lastKnownPresence === 'recording'
            ) &&
            !isEmptyObject(userData.afkContext)
         ) {
            await sock.sendText(id, `✨ AFK Reason: ${userData.afkReason}`, userData.afkContext)
            userData.afkReason = ''
            userData.afkContext = {}
            userData.afkTimestamp = -1
         }
      }
   })

   sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const message of messages) {
         if (!message.message) continue

         Serialize(sock, message)
         messageLogger(message)

         const {
            body,
            prefix: isPrefix,
            command,
            text,
            args
         } = message

         let groupMetadata = store.getGroup(message.chat)

         let user = db.getUser(message.sender)
         let group = db.getGroup(message.chat)
         let setting = db.getSetting()

         store.setMessage(message)

         if (isEmptyObject(setting))
            Object.assign(setting, SCHEMA.Setting)
         else
            applySchema(setting, SCHEMA.Setting)

         if (!user) {
            user = {
               ...SCHEMA.User,
               jid: message.sender,
               lid: message.senderLid,
               name: message.pushName
            }

            db.updateUser(message.sender, user)
         }
         else {
            user.name = message.pushName
            applySchema(user, SCHEMA.User)
         }

         if (message.isGroup) {
            if (!groupMetadata) {
               store.setGroup(message.chat, await sock.groupMetadata(message.chat))
               groupMetadata = store.getGroup(message.chat)
            }

            if (!group) {
               group = {
                  ...SCHEMA.Group,
                  id: message.chat,
                  name: store.getGroup(message.chat).subject
               }

               db.updateGroup(message.chat, group)
            }
            else {
               group.name = store.getGroup(message.chat).subject
               applySchema(group, SCHEMA.Group)
            }
         }

         if (shouldReadMessage(message))
            await readMessage(sock, message)

         const isOwner = message.sender.startsWith(ownerNumber)
         const isAdmin = message.isGroup &&
            groupMetadata.participants.some(p =>
               (
                  p.id === message.sender ||
                  p.id === message.senderLid
               ) && p.admin
            )
         const isBotAdmin = message.isGroup &&
            groupMetadata.participants.some(p =>
               p.id === jidNormalizedUser(sock.user.lid) && p.admin
            )

         const plugin = CommandIndex.get(command)

         if (db.database.settings.prefixes.includes(isPrefix) && plugin?.run) {
            if (plugin.owner && !isOwner)
               return message.reply('⚠️ This command only for owner.')

            if (plugin.group && !message.isGroup)
               return message.reply('⚠️ This command will only work in group.')

            if (plugin.private && !message.isPrivate)
               return message.reply('⚠️ This command will only work in private chat.')

            if (plugin.admin && !isAdmin)
               return message.reply('⚠️ This command only for group admin.')

            if (plugin.botAdmin && !isBotAdmin)
               return message.reply('⚠️ This command will work when bot become an admin.')

            if (plugin.limit && !isOwner) {
               if (user.limit > 0)
                  user.limit -= plugin.limit === true ? 1 : plugin.limit
               else
                  return message.reply(`⚠️ You reached the game limit and will be reset at 00.00 or try command \`${isPrefix}claim\` command for claim limit.`)
            }

            plugin.run(message, {
               sock,
               db,
               store,
               user,
               group,
               setting,
               body,
               isOwner,
               isAdmin,
               isBotAdmin,
               isPrefix,
               command,
               text,
               args
            })
         }
      }
   })

   cron.schedule('0 0 * * *', () => {
      for (const user of db.database.users.values())
         user.limit = defaultLimit

      const setting = db.getSetting()
      setting.lastReset = Date.now()

      db.writeToFile()
   }, {
      timezone: localTimezone
   })

   const check = setInterval(async () => {
      await db.writeToFile()
      await store.writeToFile()

      if (process.memoryUsage().rss >= rssLimit) {
         clearInterval(check)
         process.send('reset')
      }
   }, dataInterval)

   setInterval(() => {
      try {
         const temporaryFiles = readdirSync(temporaryFolderPath)
         if (temporaryFiles.length)
            for (const file of temporaryFiles) {
               const filePath = join(temporaryFolderPath, file)
               unlinkSync(filePath)
            }
      } catch { }
   }, temporaryFileInterval)
}

Start()