import { randomInteger } from '../lib/Utilities.js'

export default {
   command: 'claim',
   hidden: 'claimlimit',
   category: 'user info',
   async run (m, {
      user
   }) {
      if (user.limit > 0) return m.reply('❌ You can\'t claim limit right now.')

      const reward = randomInteger(1, defaultLimit)

      user.limit += reward
      m.reply(`🎉 You've got ${reward} limit.`)
   }
}