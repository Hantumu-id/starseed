import { delay, isJidGroup, S_WHATSAPP_NET, WA_DEFAULT_EPHEMERAL } from '@itsliaaa/baileys'
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type'
import { once } from 'events'
import { spawn } from 'child_process'
import { createWriteStream, existsSync, readFileSync, writeFileSync } from 'fs'
import { lstat, unlink, readdir, rm } from 'fs/promises'
import { join, resolve } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import WebP from 'node-webpmux'
import PQueue from 'p-queue'

import { BRAT_GIF_ARGS, FFMPEG_CONCAT_ARGS, WEBP_EXIF_HEADER, IMAGE_TO_WEBP, VIDEO_TO_WEBP, AUDIO_TO_MPEG, AUDIO_TO_OPUS } from './Constants.js'

const FFMPEG_QUEUE = new PQueue({
   concurrency: ffmpegConcurrency
})

export const isMimeImage = (mime) =>
   mime?.startsWith('image')

export const isMimeVideo = (mime) =>
   mime?.startsWith('video')

export const isMimeGif = (mime) =>
   mime?.endsWith('gif')

export const isMimeWebp = (mime) =>
   mime?.endsWith('webp')

export const isMimeAudio = (mime) =>
   mime?.startsWith('audio')

export const isEmptyObject = (object) => {
   for (const _ in object) return false
   return true
}

export const createFileName = () =>
   `${process.pid}_${performance.now().toString().replace('.', '')}`

export const parseMentions = (text) => {
   if (typeof text !== 'string')
      return []

   return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + S_WHATSAPP_NET)
}

export const cleanUpFolder = async (path) => {
   try {
      const stat = await lstat(target)
      if (stat.isFile()) {
         await unlink(target)
         return
      }

      const entries = await readdir(target)
      await Promise.all(
         entries.map(name =>
            rm(join(target, name), { recursive: true, force: true })
         )
      )
   } catch (error) {
      console.error('❌ ', error.message)
   }
}

export const fetchAsBuffer = async (url) => {
   if (Buffer.isBuffer(url))
      return url

   if (typeof url !== 'string')
      return null

   if (existsSync(url))
      return readFileSync(url)

   try {
      const response = await fetch(url)
      if (!response.ok) {
         response.body?.cancel()
         throw new Error(response.statusText)
      }

      return Buffer.from(await response.arrayBuffer())
   } catch (error) {
      console.error('❌ ', error.message)
      return null
   }
}

export const ffmpeg = async (inputPath, inputArgs = [], outputArgs = [], extension) =>
   FFMPEG_QUEUE.add(async () => {
      if (Buffer.isBuffer(inputPath))
         inputPath = await saveBufferAsFile(inputPath, extension)

      if (!existsSync(inputPath))
         throw new Error(`File not found at path: ${inputPath}`)

      if (!extension) {
         extension = await fileTypeFromFile(inputPath)
         if (!extension?.ext)
            throw new TypeError('Invalid media type')
         extension = extension.ext
      }

      const fileName = createFileName() + '.' + extension
      const outputPath = join(process.cwd(), temporaryFolder, fileName)

      const ff = spawn('ffmpeg', [
         '-y',
         '-loglevel', 'error',
         ...inputArgs,
         '-i', inputPath,
         ...outputArgs,
         outputPath
      ], {
         stdio: ['ignore', 'ignore', 'pipe']
      })

      let errorLog = ''
      ff.stderr.on('data', chunk => {
         errorLog += chunk.toString()
      })

      const [code] = await once(ff, 'close')

      if (code !== 0)
         throw new Error(`FFmpeg failed (${code}): ${errorLog}`)

      return outputPath
   })

export const saveBufferAsFile = async (buffer, extension) => {
   if (!Buffer.isBuffer(buffer))
      throw new TypeError('Expected a Buffer')

   if (!extension) {
      const type = await fileTypeFromBuffer(buffer)
      extension = type?.ext
   } else {
      extension = 'txt'
   }

   const fileName = createFileName() + '.' + extension
   const filePath = join(process.cwd(), temporaryFolder, fileName)

   const readable = Readable.from(buffer)

   await pipeline(
      readable,
      createWriteStream(filePath)
   )

   return filePath
}

export const writeExif = async (media, options = {}) => {
   if (Buffer.isBuffer(media))
      media = await saveBufferAsFile(media)

   let mimeType = options.mimeType
   if (!mimeType) {
      const check = await fileTypeFromFile(media)
      mimeType = check?.mime
   }

   const muxer = new WebP.Image()

   if (isMimeVideo(mimeType) || isMimeGif(mimeType))
      media = await videoToWebp(media)
   else if (isMimeImage(mimeType))
      media = await imageToWebp(media)
   else
      throw new Error('Invalid media input')

   await muxer.load(media)

   const jsonBuffer = Buffer.from(
      JSON.stringify({
         'sticker-pack-id': 'itsliaaa',
         'sticker-pack-name': options.stickerPackName || stickerPackName,
         'sticker-pack-publisher': options.stickerPackPublisher || stickerPackPublisher,
         'emojis': ['✨'],
         'accessibility-text': botName
      })
   )

   const concatExif = Buffer.concat([
      WEBP_EXIF_HEADER,
      jsonBuffer
   ])

   concatExif.writeUIntLE(jsonBuffer.length, 14, 4)

   muxer.exif = concatExif
   return await muxer.save(null)
}

export const bratSticker = async (text = 'Hi') =>
   fetchAsBuffer(`https://aqul-brat.hf.space/?text=${encodeURIComponent(text)}`)

export const bratVideoSticker = async (text = 'Hi') => {
   const texts = text.split(' ')
   const tempDir = resolve(process.cwd(), temporaryFolder)

   const files = await Promise.all(
      texts.map((_, i) => 
         fetchAsBuffer(`https://aqul-brat.hf.space/?text=${encodeURIComponent(texts.slice(0, i + 1).join(' '))}`)
            .then(buf => saveBufferAsFile(buf, 'png'))
      )
   )

   const list = files.map(f => `file '${resolve(tempDir, f)}'\nduration 0.4`).join('\n') 
      + `\nfile '${resolve(tempDir, files[files.length - 1])}'\nduration 3\n`

   const listPath = resolve(tempDir, `${createFileName()}.txt`)
   writeFileSync(listPath, list)

   return await ffmpeg(listPath, FFMPEG_CONCAT_ARGS, BRAT_GIF_ARGS, 'gif')
}

export const messageLogger = (message) =>
   console.log(
      '\n' +
      `🔔 Received ${message.type} from ${message.sender?.split('@')[0] || '-'} (${message.pushName || message.verifiedBizName}) in ${message.chat}` +
      '\n' +
      message.body
   )

export const applySchema = (target, schema) => {
   for (const key in schema)
      if (!(key in target))
         target[key] = schema[key]
}

export const toArray = (value) =>
   typeof value === 'string'
      ? [value]
      : Array.isArray(value)
         ? value
         : []

export const randomInteger = (min, max) =>
   Math.floor(
      Math.random() * (max - min + 1)
   ) + min

export const fetchThumbnail = async () =>
   fetchAsBuffer(botThumbnail)

export const imageToWebp = async (media) =>
   ffmpeg(
      media,
      [],
      IMAGE_TO_WEBP,
      'webp'
   )

export const videoToWebp = async (media) =>
   ffmpeg(
      media,
      [],
      VIDEO_TO_WEBP,
      'webp'
   )

export const toAudio = async (media) =>
   ffmpeg(
      media,
      [],
      AUDIO_TO_MPEG,
      'mp3'
   )

export const toPTT = async (media) =>
   ffmpeg(
      media,
      [],
      AUDIO_TO_OPUS,
      'opus'
   )

export const Sender = (sock) => {
   sock.sendText = async (jid, text = '', quoted, options = {}, extra = {}) => {
      await sock.sendPresenceUpdate('composing', jid)

      text = typeof text === 'string' ?
         text :
         JSON.stringify(text, null, 3)

      const ephemeralExpiration = !isJidGroup(jid) && WA_DEFAULT_EPHEMERAL

      const message = await sock.sendMessage(jid, {
         ...options,
         text,
         mentions: parseMentions(text)
      }, {
         ephemeralExpiration,
         ...extra,
         quoted
      })

      return message
   }

   sock.sendMedia = async (jid, source, caption = '', quoted, options = {}, extra = {}) => {
      if (Buffer.isBuffer(source))
         source = await saveBufferAsFile(source)

      await sock.sendPresenceUpdate('composing', jid)

      caption = typeof caption === 'string' ?
         caption :
         JSON.stringify(caption, null, 3)

      let media,
         mimetype
      if (options.sticker) {
         source = await writeExif(source)

         media = source
         mimetype = 'image/webp'
      }
      else if (options.audio) {
         source = await toAudio(source)

         media = { url: source }
         mimetype = 'audio/mpeg'
      }
      else if (options.ptt) {
         await sock.sendPresenceUpdate('recording', jid)

         source = await toPTT(source)
         media = { url: source }
         mimetype = 'audio/ogg; codecs=opus'
      }
      else {
         const type = await fileTypeFromFile(source)

         media = { url: source }
         mimetype = type?.mime || 'text/plain'
      }

      const method = options.document ?
         'document' :
         options.sticker ?
            'sticker' :
            isMimeAudio(mimetype) ?
               'audio' :
               isMimeImage(mimetype) ?
                  'image' :
                  isMimeVideo(mimetype) ?
                     'video' :
                      'document'

      const ephemeralExpiration = !isJidGroup(jid) && WA_DEFAULT_EPHEMERAL

      delete options.audio
      delete options.document
      delete options.sticker

      const message = await sock.sendMessage(jid, {
         ...options,
         [method]: media,
         caption,
         mimetype,
         gifPlayback: isMimeGif(mimetype),
         mentions: parseMentions(caption)
      }, {
         ephemeralExpiration,
         ...extra,
         quoted
      })

      return message
   }
}