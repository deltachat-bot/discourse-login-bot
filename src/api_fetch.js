const fetch = require('node-fetch')
const path = require('path')
const config = require('config')

const notifierEnabled = () => {
  return config.get('notifier.enabled_contact_email_addresses').length > 0
}

if (notifierEnabled()) {
  // Check that required config options are set.
  for (key of ['notifier.discourse_base_url', 'notifier.api_key', 'notifier.api_username']) {
    if (!config.has(key) || !config.get(key)) {
      console.error(`\nError: required config option ${key} is not set.\n`)
      process.exit(1)
    }
  }
}

const apiFetch = async (path) => {
  if (! notifierEnabled()) {
    throw new Error("notifier is not enabled in config, this function is disabled")
  }
  // Avoid double slashes
  const base_url = config.get('notifier.discourse_base_url').replace(/\/$/, "")
  const url = base_url + path
  const response = await fetch(url, {
    headers: {
      'Api-Key': config.get('notifier.api_key'),
      'Api-Username': config.get('notifier.api_username'),
      'Accept': 'application/json'
    }
  })
    .catch((error) => {
      var err = new Error('A network error happend, could not fetch resource')
      err.error = error
      throw err
    })
  if (response.ok) {
    return await response.json()
  } else {
    var err = new Error('Response from API was not OK!')
    err.response = response
    throw err
  }
}

module.exports = { apiFetch, notifierEnabled }
