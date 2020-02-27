const { deltachat, log } = require('deltachat-node-webbot-base')
const oauthDB = require('./database')
const webApp = require('./web_app')
const config = require('config')

const dc_started = deltachat.start((_, _) => {})

// Setup the web app.
const server = require('http').createServer(webApp)
const port = config.get('http_port')

// When the deltachat setup is done, run the web-app.
// If we would start the web-app earlier, deltachat e.g. might not be ready yet to generate QR-codes.
dc_started.then(() => {
  server.listen(port, '127.0.0.1', () => {
    log(`Listening on http://127.0.0.1:${port}`)
  })
}).catch(console.error)
