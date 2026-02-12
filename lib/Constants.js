export const MAX_MESSAGES = 512

export const OWNER_VCARD =
   'BEGIN:VCARD' +
   '\nVERSION:3.0' +
   `\nFN:${ownerName}` +
   `\nORG:Starfall Co. Ltd.;` +
   `\nTEL;type=CELL;type=VOICE;waid=${ownerNumber}:${ownerNumber}` +
   '\nEND:VCARD'

export const WEBP_EXIF_HEADER = Buffer.from([
   0x49, 0x49, 0x2A,
   0x00, 0x08, 0x00,
   0x00, 0x00, 0x01,
   0x00, 0x41, 0x57,
   0x07, 0x00, 0x00,
   0x00, 0x00, 0x00,
   0x16, 0x00, 0x00,
   0x00
])

export const IMAGE_TO_WEBP = [
   '-an', '-sn',
   '-vf', 'scale=512:512:force_original_aspect_ratio=decrease:flags=fast_bilinear,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000',
   '-c:v', 'libwebp',
   '-q:v', '75',
   '-lossless', '0',
   '-method', '0',
   '-frames:v', '1',
   '-compression_level', '1',
   '-map_metadata', '-1',
   '-preset', 'picture',
   '-pix_fmt', 'yuva420p',
   '-f', 'webp'
]

export const VIDEO_TO_WEBP = [
   '-ss', '00:00:00',
   '-t', '00:00:05',
   '-an', '-sn',
   '-vf', 'scale=512:512:force_original_aspect_ratio=decrease:flags=fast_bilinear,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=10',
   '-c:v', 'libwebp',
   '-q:v', '65',
   '-lossless', '0',
   '-method', '0',
   '-compression_level', '1',
   '-map_metadata', '-1',
   '-preset', 'picture',
   '-pix_fmt', 'yuva420p',
   '-f', 'webp'
]

export const AUDIO_TO_MPEG = [
   '-vn',
   '-c:a', 'libmp3lame',
   '-q:a', '4',
   '-ar', '48000',
   '-ac', '2',
   '-f', 'mp3'
]

export const AUDIO_TO_OPUS = [
   '-vn',
   '-c:a', 'libopus',
   '-b:a', '32k',
   '-ar', '48000',
   '-ac', '1',
   '-application', 'voip',
   '-frame_duration', '20',
   '-f', 'opus'
]

export const BRAT_GIF_ARGS = [
   '-an', '-sn',
   '-vf', 'scale=512:512:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=single[p];[s1][p]paletteuse=dither=none',
   '-f', 'gif'
]

export const FFMPEG_CONCAT_ARGS = [
   '-f', 'concat',
   '-safe', '0'
]

export const SCHEMA = {
   User: {
      jid: null,
      lid: null,
      name: null,
      limit: defaultLimit,
      afkReason: '',
      afkContext: {},
      afkTimestamp: -1
   },
   Group: {
      id: null,
      name: null,
      left: true,
      welcome: true,
      leftMessage: '',
      welcomeMessage: ''
   },
   Setting: {
      menuMessage: 'I am +botname, a simple WhatsApp bot 🌱',
      prefixes: ['.', '/', '!', '#'],
      lastReset: 0
   }
}