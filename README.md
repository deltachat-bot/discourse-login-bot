# Delta Chat Discourse Login Bot

This Delta Chat bot allows people to authenticate at a Discourse instance using their Delta Chat app.

To authenticate users that want to login at your Discourse instance will be redirected to this bot's webinterface. There they must scan a QR-code using their Delta Chat app. That makes their Delta Chat email address known to the bot, which sends this email address (and the Delta Chat profile name, if present) back to the Discourse instance, where the users will be logged in without entering any credentials.

## Requirements

* NPM and NodeJS >= 7.6.
* An email account for the bot.

## Setup

1. Install the dependencies by running `npm install`.
2. Configure your Discourse instance to use the oauth2 provider this bot provides. Generate a random `client_id` and a random `client_secret` for it.
2. Configure the bot by writing its email-address and password, and the oauth related information, into `config/local.json` like this:
```json
{
  "email_address": "bot@example.net",
  "email_password": "secretandsecure",
  "oauth": {
    "client_id": "theRandomIdForYourDiscourseInstance",
    "client_secret": "somethingSecure",
    "redirect_uris": ["callbackOfYourDiscourseInstance"]
  }
}
```
3. Optionally configure the `http_port` (that the bot should serve the web interface on) in `config/local.js` (default: 3000).
4. Setup a HTTP daemon to reverse-proxy the bot, e.g. nginx.

## Run

Run the bot with `npm start`.
