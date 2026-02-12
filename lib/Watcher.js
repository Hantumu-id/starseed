import { readdirSync, stat, statSync, watch } from 'fs'
import { join } from 'path'

import { FileCache, ModuleCache, CommandIndex } from './Caches.js'
import { toArray } from './Utilities.js'

const indexModule = (filePath, exports) => {
   for (const key of ['command', 'hidden'])
      for (const value of toArray(exports[key]))
         CommandIndex.set(value, exports)
}

const unindexModule = (filePath) => {
   const cached = ModuleCache.get(filePath)
   if (!cached) return

   for (const key of ['command', 'hidden'])
      for (const value of toArray(cached.exports[key]))
         CommandIndex.delete(value)

   ModuleCache.delete(filePath)
}

export const LoadModule = async (filePath) => {
   try {
      const url = new URL(`file://${join(process.cwd(), filePath)}?update=${Date.now()}`)
      const mod = await import(url.href)
      const exports = mod.default ?? mod

      ModuleCache.set(filePath, {
         module: mod,
         exports
      })

      indexModule(filePath, exports)

      return mod
   } catch (error) {
      console.error('❌ Failed to load', ':', filePath)
      console.error(error)
   }
}

export const ScanDirectory = async (dir) => {
   const entries = readdirSync(dir, { withFileTypes: true })

   for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
         await ScanDirectory(fullPath)
         continue
      } else if (entry.isFile() || fullPath.endsWith('.js')) {
         const stat = statSync(fullPath)

         FileCache.set(fullPath, {
            mtimeMs: stat.mtimeMs,
            size: stat.size
         })

         await LoadModule(fullPath)
      }
   }

   WatchDirectory(dir)
}

export const WatchDirectory = (dir) => {
   watch(dir, (event, filename) => {
      if (!filename) return

      handleChange(join(dir, filename))
   })

   for (const entry of readdirSync(dir, { withFileTypes: true }))
      if (entry.isDirectory())
         WatchDirectory(join(dir, entry.name))
}

export const handleChange = async (filePath) => {
   let stats

   try {
      stats = statSync(filePath)
   } catch {
      if (FileCache.has(filePath)) {
         FileCache.delete(filePath)
         ModuleCache.delete(filePath)
         unindexModule(filePath)

         console.log('🗑️ Deleted:', filePath)
      }
      return
   }

   if (!stats.isFile() ||
      !filePath.endsWith('.js'))
      return

   const cached = FileCache.get(filePath)

   if (!cached) {
      FileCache.set(filePath, {
         mtimeMs: stats.mtimeMs,
         size: stats.size
      })

      await LoadModule(filePath)
      console.log('➕ Added:', filePath)
      return
   }

   if (cached.mtimeMs !== stats.mtimeMs ||
      cached.size !== stats.size) {
      FileCache.set(filePath, {
         mtimeMs: stats.mtimeMs,
         size: stats.size
      })

      await LoadModule(filePath)
      console.log('🔔 Updated:', filePath)
   }
}