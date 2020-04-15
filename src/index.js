const { deltachat, log } = require('deltachat-node-webbot-base')
const oauthDB = require('./database')
const webApp = require('./web_app')
const { apiFetch, notifierEnabled } = require('./api_fetch')
const config = require('config')

const dc_started = deltachat.start(async (chat, message) => {
  if (! notifierEnabled()) {
    return false
  }

  if (! message.isInfo()) {
    log("Message is informational, ignoring it.")
  }

  const message_text = message.getText()
  if (! message_text) {
    log("Message does not contain text content, ignoring it.")
    return false
  }

  const chat_name = chat.getName()
  log(`Received new message in chat '${chat_name}'`)
  const topic_matches = chat_name.match(/.*\((\d+)\)$/)
  if (!topic_matches || ! topic_matches[1]) {
    log(`Can't parse topic-ID from '${chat_name}', ignoring message.`)
    return false
  }
  const topic_id = topic_matches[1]

  const contact = deltachat.getContact(message.getFromId())
  const contact_email_addr = contact.getAddress()
  const discourse_user_data = await apiFetch(`/admin/users/list/active.json?filter=${contact_email_addr}`)
  const discourse_user = discourse_user_data[0]

  const topic_data = await apiFetch(`/t/${topic_id}.json`)
  var ok = false
  switch (topic_data.archetype) {
    case 'regular':
      ok = true
      break;
    case 'private_message':
      const allowed_users = topic_data.details.allowed_users
      const allowed_user = allowed_users.find((user) => {
        return user.id === discourse_user.id
      })
      ok = !!allowed_user
      break;
    default:
      log(`Unknown topic archetype: ${topic_data.archetype}`)
  }

  if (ok !== true) {
    log("contact is not allowed to post to this topic")
    return false
  }

  const payload = JSON.stringify({
    topic_id: topic_id,
    raw: message_text
  })
  log(`Posting message as user ${discourse_user.username} to topic #${topic_id}`)
  apiFetch('/posts.json', payload, discourse_user.username)
})

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
