import { areJidsSameUser, delay, downloadContentFromMessage, getContentType, isJidGroup, isLidUser, isPnUser, jidNormalizedUser, normalizeMessageContent } from '@itsliaaa/baileys'

import { UserIdCache } from './Caches.js'
import { randomInteger } from './Utilities.js'

export const findChatId = (key) => {
   let remoteJid = key.remoteJidAlt || key.remoteJid
   if (isLidUser(remoteJid))
      remoteJid = key.senderPn || key.participantPn || key.participant

   return remoteJid
}

export const findUserJid = (sock, key) => {
   if (key.fromMe)
      return jidNormalizedUser(sock.user.id)

   let sender = key.remoteJidAlt || key.participantAlt
   if (!sender || isLidUser(sender))
      sender = key.participant || key.remoteJid

   return sender
}

export const findUserLid = (sock, key) => {
   if (key.fromMe)
      return jidNormalizedUser(sock.user.lid)

   let sender = key.participant || key.remoteJid
   if (!sender || isPnUser(sender))
      sender = key.participantAlt || key.remoteJidAlt

   return sender
}

export const cachedUserId = (id, { jid, lid } = {}) => {
   const cachedId = UserIdCache.get(id)
   if (cachedId)
      return cachedId

   if (jid && lid)
      UserIdCache.set(id, { jid, lid })

   return null
}

export const extractMessageBody = (message) => {
   const msg = message.msg || message
   const type = message.type

   return msg && (
      msg.text ||
      msg.caption ||
      msg.name ||
      msg.selectedId ||
      msg.selectedButtonId ||
      msg.singleSelectReply?.selectedRowId ||
      msg.body?.text ||
      (
         type === 'interactiveResponseMessage' &&
         JSON.parse(msg.nativeFlowResponseMessage.paramsJson).id
      ) ||
      (
         typeof msg === 'string' && msg
      ) ||
      '-'
   )
   .toString()
}

export const parseCommand = (body) => {
   if (!body)
      return { prefix: '', command: '', args: [] }

   body = body.trim()
   if (!body)
      return { prefix: '', command: '', args: [] }

   const prefix = body.charAt(0)

   const code = body.charCodeAt(1)
   if (code < 65 ||
      (code > 90 && code < 97) ||
      code > 122)
      return { prefix: '', command: '', args: [] }

   const rest = body.slice(1).trim()
   const spaceIndex = rest.indexOf(' ')

   let command,
      text,
      args
   if (spaceIndex === -1) {
      command = rest.toLowerCase()
      text = ''
      args = []
   } else {
      command = rest.slice(0, spaceIndex).toLowerCase()
      text = rest.slice(spaceIndex + 1)
      args = text.split(' ')
   }

   return { prefix, command, text, args }
}

export const shouldReadMessage = (message) => 
   !(message.key.fromMe ||
      message.encEventResponseMessage ||
      message.encReactionMessage ||
      message.pollUpdateMessage ||
      message.message?.protocolMessage ||
      message.message?.reactionMessage)

export const readMessage = async (sock, message) => {
   if (!onlineStatus)
      return

   await sock.presenceSubscribe(message.chat)
   await sock.sendPresenceUpdate('available', message.chat)
   await sock.readMessages([message.key])

   if (slowMode)
      await delay(randomInteger(100, 3000))
}

export const downloadAsBuffer = async (message, type) => {
   if (!message || !(message.url || message.directPath)) return Buffer.alloc(0)

   try {
      const stream = await downloadContentFromMessage(message, type)

      const chunks = []
      for await (const chunk of stream)
         chunks.push(chunk)

      return Buffer.concat(chunks)
   } catch {
      return Buffer.alloc(0)
   }
}

export const Serialize = (sock, message) => {
   if (!message.message)
      return

   let cachedSenderId,
      innerMessage

   if (message.key) {
      message.id = message.key.id
      message.chat = findChatId(message.key)

      const sender = findUserJid(sock, message.key)
      const senderLid = findUserLid(sock, message.key)

      cachedSenderId = cachedUserId(sender)
      message.sender = cachedSenderId?.jid || sender
      message.senderLid = cachedSenderId?.lid || senderLid

      message.fromMe = message.key.fromMe
      message.isGroup = isJidGroup(message.chat)
      message.isPrivate = isPnUser(message.chat)
   }

   innerMessage = normalizeMessageContent(message.message)

   if (innerMessage.protocolMessage?.editedMessage)
      innerMessage = normalizeMessageContent(innerMessage.protocolMessage.editedMessage)

   const messageType = getContentType(innerMessage)

   message.msg = innerMessage[messageType]
   message.type = messageType
   message.body = extractMessageBody(message)

   const { prefix, command, text, args } = parseCommand(message.body)
   message.prefix = prefix
   message.command = command
   message.text = text
   message.args = args

   message.pushName = message.fromMe ? botName : message.pushName || 'Somebody'

   const contextInfo = typeof message.msg !== 'string' ? message.msg?.contextInfo : null

   message.mentionedJid = contextInfo?.mentionedJid || []
   message.expiration = contextInfo?.expiration || 0
   message.quoted = contextInfo?.quotedMessage

   if (message.quoted) {
      const innerQuotedMessage = normalizeMessageContent(message.quoted)
      const quotedMessageType = getContentType(innerQuotedMessage)

      message.quoted = innerQuotedMessage[quotedMessageType]
      if (typeof message.quoted !== 'string') {
         const { quoted } = message
         const quotedContextInfo = quoted.contextInfo

         quoted.type = quotedMessageType
         quoted.body = extractMessageBody(quoted)

         const { prefix, command, text, args } = parseCommand(quoted.body)
         quoted.text = text
         quoted.prefix = prefix
         quoted.command = command
         quoted.args = args

         quoted.mentionedJid = quotedContextInfo?.mentionedJid || []
         quoted.expiration = quotedContextInfo?.expiration || 0
         quoted.id = contextInfo.stanzaId
         quoted.chat = contextInfo.remoteJid || message.chat

         const quotedUserId = cachedUserId(contextInfo.participant)
         quoted.sender = quotedUserId?.jid
         quoted.senderLid = quotedUserId?.lid

         quoted.fromMe = areJidsSameUser(jidNormalizedUser(sock.user.id), quoted.sender)
         quoted.isGroup = isJidGroup(quoted.chat)
         quoted.isPrivate = isPnUser(quoted.chat)
         quoted.key = {
            remoteJid: quoted.chat,
            fromMe: quoted.fromMe,
            id: quoted.id,
            participant: quoted.sender
         }

         if (quoted.directPath)
            quoted.download = async () =>
               downloadAsBuffer(quoted, quoted.type.replace('Message', ''))
      }
   }

   message.reply = (text) =>
      sock.sendText(message.chat, text, message)

   message.react = (text = '🥰') =>
      sock.sendMessage(message.chat, {
         react: {
            key: message.key,
            text
         }
      })

   if (message.msg.directPath)
      message.download = async () =>
         downloadAsBuffer(message.msg, message.type.replace('Message', ''))

   const isCacheableUserId = isPnUser(message.sender) &&
      isLidUser(message.senderLid) &&
      !cachedSenderId
   if (isCacheableUserId) {
      cachedUserId(message.sender, {
         jid: message.sender,
         lid: message.senderLid
      })

      cachedUserId(message.senderLid, {
         jid: message.sender,
         lid: message.senderLid
      })
   }
}