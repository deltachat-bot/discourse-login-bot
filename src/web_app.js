/**
 * This app works as a oauth2 authentication provider for discourse. It allows
 * users to authenticate using their Delta Chat app.
 */
const { webApp, deltachat, ensureAuthenticated } = require('deltachat-node-webbot-base')
const { log } = require('deltachat-node-bot-base')
const oauthDB = require('./database')
const path = require('path')
const uuid = require('uuid/v4')
const express = require('express')
const session = require('express-session')
const config = require('config')

// On starting up check that required config options are set.
for (key of ['oauth.client_id', 'oauth.client_secret', 'oauth.redirect_uri']) {
  if (!config.has(key) || !config.get(key)) {
    console.error(`\nError: required config option ${key} is not set.\n`)
    process.exit(1)
  }
}

const router = express.Router()                                                                                                                                                                

router.get('/authorize', ensureAuthenticated, async (req, res) => {
  log("Request to /authorize")
  const params = Object.assign({}, req.body, req.query)

  // Allow only if the client_id is known.
  if (params.client_id !== config.get('oauth.client_id')) {
    log("Unknown client_id, denying access.")
    res.sendStatus(400)
    return
  }

  if (params.redirect_uri !== config.get('oauth.redirect_uri')) {
    log("Unknown redirect_uri, denying access.")
    res.sendStatus(400)
    return
  }

  // Generate and send an auth_code, that is stored alongside the contactId of
  // the authenticated user.
  const auth_code = uuid().replace(/-/g, '')
  log("Saving newly generated auth code to DB")
  await oauthDB.save(auth_code, req.session.contactId)
  log("Sending browser back to redirect_uri")
  res.redirect(`${params.redirect_uri}?state=${params.state}&code=${auth_code}`)
})

// Don't use the authenticating middleware here, this resource is requested
// non-interactively by the application, which authorizes by client_id,
// client_secret and authcode.
router.post('/token', async (req, res) => {
  log("Request to /token")
  var params = Object.assign({}, req.body, req.query)

  // Check that an auth-code is given. We can stop early if it is absent.
  if (!params.code) {
    log("Incoming code is blank, denying access")
    res.sendStatus(400)
    return
  }

  var credentials = {}
  // Extract client_id and client_secret from Basic-auth header.
  if (req.headers.authorization) {
    const auth = Buffer.from(
      req.headers.authorization.replace(/^Basic /, ""),
      'base64'
      ).toString('ASCII').split(':')
    credentials.client_id = auth[0]
    credentials.client_secret = auth[1]
  }

  // Check incoming client_id and client_secret.
  if (credentials.client_id !== config.get('oauth.client_id') || 
      credentials.client_secret !== config.get('oauth.client_secret') ) {
    log("Unknown client_id and/or client_secret, denying access")
    res.sendStatus(401)
    return
  }

  // Get deltachat contact that is associated with this auth-code and build a
  // response from its data.
  const dbData = await oauthDB.getByAuthCode(params.code)
  if (!dbData || dbData === {}) {
    log("Invalid incoming code, denying access")
    res.sendStatus(400)
    return
  }

  const user = deltachat.getContact(dbData.contactId)

  // Send a response that includes the user's email-address and maybe name
  // (if set).
  // It also includes the mandatory token-fields and the shortest expiry
  // possible. That is because the token is of no actual use in our case:
  // we don't provide an API to query with this token, we only provide the
  // user info in this response.
  res.json({
    access_token: uuid(),
    token_type: 'bearer',
    expires_in: 1,
    info: {
      username: user.getName(),
      email: user.getAddress()
      email_verified: true
    }
  })
})

// Hook into the webApp. We could specify a sub-path here.
webApp.use('/', router)

module.exports = webApp
