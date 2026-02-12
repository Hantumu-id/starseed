module.exports = {
   apps: [{
      name: 'bot',
      script: './index.js',
      node_args: '--max-old-space-size=1024',
      env: {
         NODE_ENV: 'bot'
      }
   }]
}