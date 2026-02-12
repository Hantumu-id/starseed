import { bratSticker, bratVideoSticker, isMimeImage, isMimeVideo } from '../lib/Utilities.js'

export default {
   command: ['sticker', 'brat', 'bratvid'],
   hidden: ['s', 'svid'],
   category: 'other',
   async run (m, {
      sock,
      command,
      text
   }) {
      if (command === 'brat')
         sock.sendMedia(m.chat, await bratSticker(text), '', m, { sticker: true })
      else if (command === 'bratvid')
         sock.sendMedia(m.chat, await bratVideoSticker(text), '', m, { sticker: true })
      else {
         const q = m.quoted?.url ? m.quoted : m
         const mimetype = (q.msg || q).mimetype
         if (
            isMimeImage(mimetype) ||
            isMimeVideo(mimetype)
         )
            sock.sendMedia(m.chat, await q.download(), '', m, { sticker: true })
         else
            m.reply('💭 Reply media to make it as sticker.')
      }
   },
   owner: false,
   admin: false,
   group: false,
   private: false,
   botAdmin: false,
   limit: 1
}