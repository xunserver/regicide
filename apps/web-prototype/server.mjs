import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const sharedFixture = join(directory, '..', '..', 'prototypes', 'active-table-fixtures.json')
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/prototype/active-table': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  try {
    if (pathname === '/prototypes/active-table-fixtures.json') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(await readFile(sharedFixture))
      return
    }
    const file = files[pathname]
    if (!file) {
      const safePath = normalize(pathname).replace(/^\.\.(\/|\\|$)/, '')
      const candidate = join(directory, safePath)
      const body = await readFile(candidate)
      response.writeHead(200, {
        'content-type': mime[extname(candidate)] ?? 'application/octet-stream',
      })
      response.end(body)
      return
    }
    response.writeHead(200, { 'content-type': file[1] })
    response.end(await readFile(join(directory, file[0])))
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Prototype asset not found')
  }
})

function listen(port) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      listen(port + 1)
      return
    }
    throw error
  })
  server.listen(port, '127.0.0.1', () => {
    console.log(`PROTOTYPE UI: http://localhost:${port}/prototype/active-table?variant=A`)
  })
}

listen(Number(process.env.PROTOTYPE_PORT ?? 4173))
