# Publicar Chanchito en Google Play

Pasos que sólo puede hacer el dueño de la cuenta. La clave de subida **nunca** va al repo ni al chat.

## 1. Cuenta de desarrollador

1. Crear la cuenta en <https://play.google.com/console/signup> (cuenta personal, pago único de USD 25 y
   verificación de identidad).
2. Las cuentas personales nuevas tienen que hacer una **prueba cerrada con al menos 12 testers durante 14 días
   seguidos** antes de poder publicar en producción. Conviene juntar los testers (sus mails de Google) ya.

## 2. Clave de subida

Con Play App Signing, Google guarda la clave con la que se firma la app que baja la gente; vos sólo tenés la
**clave de subida**. Si la perdés, se pide un reseteo desde Play Console (no se pierde la app).

En la PC (`keytool` viene con Java; si no lo tenés, con Android Studio o con el JDK de Temurin):

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore chanchito-upload.jks -alias upload `
  -keyalg RSA -keysize 2048 -validity 10000
```

Guardá `chanchito-upload.jks` y las contraseñas en un lugar seguro (gestor de contraseñas + copia aparte).

## 3. Secrets en GitHub

En el repo: Settings → Secrets and variables → Actions → New repository secret.

| Secret                           | Valor                                                          |
| -------------------------------- | -------------------------------------------------------------- |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | el `.jks` en base64 (comando abajo)                            |
| `ANDROID_UPLOAD_STORE_PASSWORD`  | la contraseña del almacén                                      |
| `ANDROID_UPLOAD_KEY_ALIAS`       | `upload`                                                       |
| `ANDROID_UPLOAD_KEY_PASSWORD`    | la contraseña de la clave (con PKCS12 es la misma del almacén) |

Para el base64 en PowerShell (queda copiado en el portapapeles):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("chanchito-upload.jks")) | Set-Clipboard
```

Con los secrets cargados, cada corrida de `build` en GitHub Actions genera además el artifact
`chanchito-android-aab` (el `.aab` firmado con la clave de subida). El `versionCode` son los minutos desde 2026-01-01,
así que siempre sube.

## 4. Prueba cerrada

1. En Play Console: Crear app → nombre "Chanchito", idioma español (Argentina), app gratis.
2. Completar lo que pide el panel (política de privacidad, clasificación de contenido, público objetivo,
   seguridad de los datos: la app no recolecta ni comparte datos).
3. Pruebas → Prueba cerrada → crear un track, cargar la lista de testers y subir el `.aab`.
4. Mandar el link de la prueba a los testers: tienen que aceptar y tener la app instalada durante los 14 días.

La ficha (descripciones, capturas, respuestas de seguridad de los datos y clasificación) está lista para
copiar en la carpeta del proyecto `chanchito/play/ficha-play.md`.

## 5. Publicar una versión

1. Subir `version` en `app.json` (lo que ve la gente, ej. `1.0.1`). El `versionCode` lo pone CI solo.
2. Crear y pushear el tag: `git tag android-v1.0.1 && git push origin android-v1.0.1`.
3. El workflow `release-android` firma el `.apk` y el `.aab`, crea el release en GitHub con el `.apk`
   (notas en `RELEASE_NOTES.md`) y deja los dos en el artifact `chanchito-android-release`.
4. Subir ese `.aab` a Play Console (prueba cerrada o producción).

El `.apk` de GitHub está firmado con la clave de subida y el de Play con la de Google: son instalaciones
distintas y no se actualizan una a la otra.
