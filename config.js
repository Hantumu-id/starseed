Object.assign(global, {
   // Owner name
   ownerName: 'Lia Wynn',

   // Owner phone number
   ownerNumber: '081111111111',

   // Bot name
   botName: 'Starseed',

   // Bot phone number
   botNumber: '081111111111',

   // Daily limit
   defaultLimit: 15,

   // Pairing using code method (set to false to use QR)
   pairingCode: false,

   // --- ADVANCED SETTINGS --- //

   // Bot thumbnail (must be 1:1, can be a URL or local path)
   botThumbnail: './lib/Media/thumbnail.jpg',

   // Sticker pack name
   stickerPackName: '📦 Starseed Sticker',

   // Sticker pack publisher
   stickerPackPublisher: 'GitHub: itsliaaa',

   // Auth state folder name (optional)
   authFolder: 'session',

   // Temporary folder name (optional)
   temporaryFolder: 'temp',

   // Plugins folder name (optional)
   pluginsFolder: 'plugins',

   // Store file name (optional)
   storeFilename: 'store.json',

   // Database file name (optional)
   databaseFilename: 'database.json',

   // Local timezone (optional)
   localTimezone: 'Asia/Jakarta',

   // Interval to clean temporary files (ms)
   temporaryFileInterval: 300_000,

   // Persist database to file interval (ms)
   dataInterval: 120_000,

   // RSS limit (mb)
   rssLimit: 800 * 1024 * 1024,

   // FFmpeg max concurrent processes (min: 1)
   ffmpegConcurrency: 3,

   // Read messages
   onlineStatus: true,

   // Slow mode (important to avoid being banned by Meta)
   slowMode: false
})