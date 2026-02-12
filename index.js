import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

const file = fileURLToPath(
   new URL('./startup.js', import.meta.url)
)

function start() {
   const p = spawn(process.execPath, [
      ...process.execArgv,
      file,
      ...process.argv.slice(2)
   ], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
   })

   p.once('message', data => {
      if (data === 'leak' || data === 'reset') {
         console[data === 'leak' ? 'warn' : 'log'](
            data === 'leak'
               ? '⚠️ RAM limit reached, restarting...'
               : '🔃 Restarting...'
         )
         p.kill('SIGTERM')
      }
   })

   p.once('exit', code => {
      console.error(`⚠️ Exited with code ${code}`)

      if (code !== 0)
         setTimeout(start, 1000)
   })
}

start()