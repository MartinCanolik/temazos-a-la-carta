/**
 * Script de uso único para obtener el refresh_token de Spotify.
 * Requiere Node 18+. Sin dependencias externas.
 *
 * Levanta un servidor HTTP en localhost:3000, abre la URL de autorización en
 * el browser y captura el code automáticamente cuando Spotify redirige.
 *
 * PASO PREVIO: registrar http://127.0.0.1:3000/callback en el Spotify Dashboard
 * (tu app → Settings → Redirect URIs → Add).
 *
 * Uso:
 *   PowerShell:
 *     $env:SPOTIFY_CLIENT_ID="xxx"; $env:SPOTIFY_CLIENT_SECRET="xxx"; node scripts/get-spotify-refresh-token.mjs
 *   bash:
 *     SPOTIFY_CLIENT_ID="xxx" SPOTIFY_CLIENT_SECRET="xxx" node scripts/get-spotify-refresh-token.mjs
 */

import http from 'node:http'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const REDIRECT_URI = 'http://127.0.0.1:3000/callback'
const PORT = 3000
const SCOPES = ['playlist-read-private', 'playlist-read-collaborative'].join(' ')

// ─── Validar credenciales ─────────────────────────────────────────────────────
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    '\nFaltan variables de entorno.\n\n' +
      'PowerShell:\n' +
      '  $env:SPOTIFY_CLIENT_ID="xxx"; $env:SPOTIFY_CLIENT_SECRET="xxx"; node scripts/get-spotify-refresh-token.mjs\n\n' +
      'bash:\n' +
      '  SPOTIFY_CLIENT_ID="xxx" SPOTIFY_CLIENT_SECRET="xxx" node scripts/get-spotify-refresh-token.mjs\n',
  )
  process.exit(1)
}

// ─── URL de autorización ──────────────────────────────────────────────────────
const authUrl =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
  }).toString()

// ─── Intercambiar code por tokens ─────────────────────────────────────────────
async function exchangeCode(code) {
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }).toString(),
  })
  return resp.json()
}

// ─── Abrir el browser ─────────────────────────────────────────────────────────
async function openBrowser(url) {
  const platform = process.platform
  try {
    if (platform === 'win32') await execAsync(`start "" "${url}"`)
    else if (platform === 'darwin') await execAsync(`open "${url}"`)
    else await execAsync(`xdg-open "${url}"`)
  } catch {
    console.log('No se pudo abrir el browser automáticamente.')
    console.log('Abrí esta URL manualmente:\n', url)
  }
}

// ─── Servidor local que captura el callback ───────────────────────────────────
const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`)

    if (url.pathname !== '/callback') {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const error = url.searchParams.get('error')
    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h2>Error: ' + error + '</h2><p>Podés cerrar esta pestaña.</p>')
      server.close()
      reject(new Error(`Spotify devolvió error: ${error}`))
      return
    }

    const authCode = url.searchParams.get('code')
    if (!authCode) {
      res.writeHead(400)
      res.end('Falta el code')
      server.close()
      reject(new Error('No se recibió el code en el callback'))
      return
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
      <html><body style="font-family:sans-serif;padding:2rem;background:#1a1a1a;color:#fff">
        <h2 style="color:#1db954">¡Autorización exitosa!</h2>
        <p>Podés cerrar esta pestaña y volver al script.</p>
      </body></html>
    `)
    server.close()
    resolve(authCode)
  })

  server.listen(PORT, '127.0.0.1', async () => {
    console.log(`\nServidor escuchando en http://127.0.0.1:${PORT}`)
    console.log('Abriendo el browser para que autorices la app...\n')
    await openBrowser(authUrl)
    console.log('Esperando que aceptes los permisos en Spotify...')
    console.log('(Si el browser no abrió, abrí esta URL manualmente:)')
    console.log(authUrl + '\n')
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      reject(
        new Error(
          `El puerto ${PORT} ya está en uso. ` +
            'Cerrá la app que lo usa y volvé a correr el script.',
        ),
      )
    } else {
      reject(err)
    }
  })

  // Timeout de 3 minutos
  setTimeout(() => {
    server.close()
    reject(new Error('Timeout: no se recibió el callback en 3 minutos.'))
  }, 3 * 60 * 1000)
})

// ─── Intercambiar code por tokens ─────────────────────────────────────────────
console.log('\nIntercambiando code por tokens...')
const data = await exchangeCode(code)

if (data.error) {
  console.error('\nError al intercambiar el code:')
  console.error(JSON.stringify(data, null, 2))
  console.error(
    data.error === 'invalid_grant'
      ? '\nEl code expiró (~10 minutos). Volvé a correr el script.\n'
      : '',
  )
  process.exit(1)
}

// ─── Output final ─────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────────────────')
console.log('ÉXITO')
console.log('─────────────────────────────────────────────────────────')
console.log('scope         :', data.scope)
console.log('refresh_token :', data.refresh_token)
console.log('─────────────────────────────────────────────────────────')

console.log('\nPASO FINAL — Cargá el secret en Supabase (PowerShell):')
console.log(`  $env:SUPABASE_ACCESS_TOKEN="sbp_xxxxxxxx"`)
console.log(`  supabase secrets set SPOTIFY_REFRESH_TOKEN="${data.refresh_token}" --project-ref ipyticieruuqvxlwidcp`)
console.log('\nO desde el Dashboard: Settings → Edge Functions → Secrets')
console.log(`  Nombre: SPOTIFY_REFRESH_TOKEN`)
console.log(`  Valor:  ${data.refresh_token}`)
console.log('─────────────────────────────────────────────────────────\n')
