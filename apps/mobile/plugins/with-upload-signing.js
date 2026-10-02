// Firma de release para Google Play (clave de subida) y versionCode desde CI.
//
// Si están las variables CHANCHITO_UPLOAD_STORE_FILE, CHANCHITO_UPLOAD_STORE_PASSWORD,
// CHANCHITO_UPLOAD_KEY_ALIAS y CHANCHITO_UPLOAD_KEY_PASSWORD, el release se firma con esa clave; si no,
// con la de debug (sirve sólo para probar). CHANCHITO_VERSION_CODE pisa el versionCode de app.json
// (Play exige uno mayor en cada subida). La clave nunca va al repo: en CI sale de los secrets.
const { withAppBuildGradle } = require('expo/config-plugins')

const MARK = '// chanchito: upload signing'

const SIGNING = `
        upload {
            ${MARK}
            def storeFilePath = System.getenv('CHANCHITO_UPLOAD_STORE_FILE')
            if (storeFilePath) {
                storeFile file(storeFilePath)
                storePassword System.getenv('CHANCHITO_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('CHANCHITO_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('CHANCHITO_UPLOAD_KEY_PASSWORD')
            }
        }`

function patch(gradle) {
  if (gradle.includes(MARK)) return gradle
  let out = gradle.replace(/signingConfigs \{\n/, (m) => `${m}${SIGNING.slice(1)}\n`)
  out = out.replace(
    /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
    "$1signingConfig System.getenv('CHANCHITO_UPLOAD_STORE_FILE') ? signingConfigs.upload : signingConfigs.debug",
  )
  out = out.replace(
    /versionCode (\d+)/,
    "versionCode((System.getenv('CHANCHITO_VERSION_CODE') ?: '$1').toInteger())",
  )
  if (!out.includes('signingConfigs.upload') || !out.includes('CHANCHITO_VERSION_CODE')) {
    throw new Error(
      'with-upload-signing: cambió el build.gradle de la plantilla; revisar el plugin',
    )
  }
  return out
}

module.exports = function withUploadSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patch(cfg.modResults.contents)
    return cfg
  })
}
module.exports.patch = patch
