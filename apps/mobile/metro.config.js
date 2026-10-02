// Metro con la lógica compartida de packages/core (alias @core y @shared, por tsconfig paths).
const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const coreRoot = path.resolve(projectRoot, '../../packages/core')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [coreRoot]

// expo-sqlite en web (sólo para la vista previa) carga SQLite como wasm.
config.resolver.assetExts.push('wasm')

// Los paquetes que importa core (zod, date-fns) se resuelven como si los importara la app: así hay
// una sola copia y nunca se toma nada del node_modules de la PC (la raíz del repo).
const fromApp = path.join(projectRoot, 'package.json')
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isPackage = !moduleName.startsWith('.') && !path.isAbsolute(moduleName)
  if (isPackage && context.originModulePath.startsWith(coreRoot + path.sep)) {
    return context.resolveRequest({ ...context, originModulePath: fromApp }, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
