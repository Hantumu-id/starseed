const rejectionIgnore = [
   'Timed',
   'Error',
   'TypeError',
   'SessionError',
   'ENOENT',
   'Device logged out',
   'Connection Closed',
   'bad-request',
   'forbidden'
]

const patchConsole = (method, { ignore = [], transform } = {}) => {
   const original = console[method]

   console[method] = (...args) => {
      const first = args?.[0]
      const message = String(first?.message || first || '')

      if (ignore.some(pattern => message.includes(pattern)))
         return

      if (typeof transform === 'function') {
         const result = transform(message, args)
         if (result === false) return
         if (typeof result === 'string')
            return original(result)
      }

      original(...args)
   }
}

patchConsole('info', {
   ignore: [
      'Closing session:',
      'Opening session:',
      'Removing old closed session:',
      'Migrating session to:'
   ]
})

patchConsole('warn', {
   ignore: [
      'Closing stale',
      'Closing open session'
   ]
})

patchConsole('error', {
   ignore: [
      'Bad MAC',
      'Session error:'
   ],
   transform: (message) => {
      if (message.includes('Failed to decrypt'))
         return `🔐 ${message}`
   }
})

process.on('warning', (warning) => {
   if (warning?.name === 'MaxListenersExceededWarning')
      console.warn('⚠️ Potential memory leak detected.')
})

process.on('uncaughtException', (error) => {
   if (error?.code === 'ENOMEM') {
      console.error('❌ Out of memory')
   } else {
      console.error('❌ Uncaught Exception', ':', error)
   }

   process.exit(1)
})

process.on('unhandledRejection', (reason) => {
   const message = String(reason?.message || reason || '')

   if (rejectionIgnore.some(p => message.includes(p)))
      return

   console.error('❌ Unhandled Rejection', ':', reason)
   process.exit(1)
})