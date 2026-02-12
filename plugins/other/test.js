export default {
   command: ['ping', 'ram', 'script'],
   hidden: 'sc',
   category: 'other',
   async run (m, {
      command
   }) {
      if (command === 'ping') {
         const old = performance.now()
         await m.react('🔥')
         m.reply(
            '🚀 *Latency*: ' +
            Math.floor(
               performance.now() - old
            ) +
            'ms'
         )
      }
      else if (command === 'ram')
         m.reply(
            '💾 *RSS Usage*: ' +
            Math.floor(
               process.memoryUsage().rss / 1024 / 1024
            ) +
            ' MB'
         )
      else if (command === 'script' || command === 'sc')
         m.reply(`🧩 *Source Code*: https://github.com/itsliaaa/starseed#readme *[WIP]*`)
   }
}