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
const { apiFetch, notifierEnabled } = require('./api_fetch')

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
    }
  })
})

router.post('/webhook', async (req, res) => {
  if (! notifierEnabled()) {
    return res.send("OK")
  }

  // TODO: verify signature
  try {
    const payload = req.body
    if (! payload.notification) {
      return res.send("OK")
    }
    const notification = payload.notification
    // 6 is private message.
    // 9 is public post.
    // TODO: Find out which other notification_types could be used. See <https://github.com/discourse/discourse/blob/master/app/models/notification.rb#L88>.
    if ([6, 9].indexOf(notification.notification_type) == -1) {
      return res.send("OK")
    }

    // Find email address of the acting discourse user.
    const user_data = await apiFetch(`/admin/users/${notification.user_id}.json`)
    const username = user_data.username
    const associated_accounts_data = await apiFetch(`/users/${username}/emails.json`)
    const associated_accounts = associated_accounts_data.associated_accounts
    const relevant_account = associated_accounts.find((acc) => { return acc.name === 'oauth2_basic' })
    if (! relevant_account) { return res.send("OK") }

    // Find DC contact for fetched email address.
    const email = relevant_account.description
    const contact_ids = deltachat.getContacts(0, email)
    const contact_id = contact_ids.find((contact_id) => { 
      let contact = deltachat.getContact(contact_id)
      let contact_email_addr = contact.getAddress()
      let enabled_email_addresses = config.get('notifier.enabled_contact_email_addresses')
      return (contact_email_addr == email && enabled_email_addresses.indexOf(contact_email_addr) > -1)
    })
    if (! contact_id) { return res.send("OK") }

    // TODO: listen for replies in topic-chats and send them to discourse.

    const chat_name = `Forum: ${notification.fancy_title} (${notification.topic_id})`

    // Find the wanted chat.
    const chatlist = deltachat.getChatList(0, '', contact_id)
    var chat_id = 0
    for (let i=0; i < chatlist.getCount(); i++) {
      let id = chatlist.getChatId(i)
      let chat = deltachat.getChat(id)
      if (chat_name == chat.getName()) {
        chat_id = id
        break
      }
    }
    // If no matching chat exists, create it.
    if (chat_id === 0) {
      chat_id = deltachat.createUnverifiedGroupChat(chat_name)
      deltachat.addContactToChat(chat_id, contact_id)
    }

    // Send the message.
    const original_message_data = await apiFetch(`/posts/${notification.data.original_post_id}.json`)
    const original_message = original_message_data.raw
    const msg = `${notification.data.original_username} said: ${original_message}\n\n\nLink: https://support.delta.chat/t/${notification.slug}/${notification.topic_id}/${original_message_data.post_number}`
    log(`Sending message to ${email}`)
    deltachat.sendMessage(chat_id, msg)

  } catch (error) {
    log('ERROR: An error happend, cannot continue:')
    log(error)
  }

  return res.send('OK')
})

// Hook into the webApp. We could specify a sub-path here.
webApp.use('/', router)

module.exports = webApp
