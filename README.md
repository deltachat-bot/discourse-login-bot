# Delta Chat Discourse Login Bot

> ⚠️  This project is deprecated in favor of the Rust rewrite: https://github.com/deltachat-bot/deltachat-loginbot

This Delta Chat bot allows people to authenticate at a Discourse instance using their Delta Chat app.

To authenticate users that want to login at your Discourse instance will be redirected to this bot's webinterface. There they must scan a QR-code using their Delta Chat app. That makes their Delta Chat email address known to the bot, which sends this email address (and the Delta Chat profile name, if present) back to the Discourse instance, where the users will be logged in without entering any credentials.

## Requirements

* NPM and NodeJS >= 7.6.
* An email account for the bot.

## Setup

1. Install the dependencies by running `npm install`.
2. Install the [OAuth2 Plugin](https://github.com/discourse/discourse-oauth2-basic) to your Discourse instance - find out how on [meta.discourse.org](https://meta.discourse.org/t/install-plugins-in-discourse/19157)
3. Configure your Discourse instance to use the oauth2 provider this bot provides. Choose two random strings for `client_id` and `client_secret`. More details on the Discourse settings below.
4. Configure the bot by writing its email-address and password, and the oauth related information, into `config/local.json` like this:
```json
{
  "email_address": "bot@example.net",
  "email_password": "secretandsecure",
  "oauth": {
    "client_id": "theRandomIdForYourDiscourseInstance",
    "client_secret": "somethingSecure",
    "redirect_uri": "https://your.discourse.instance/callback"
  }
}
```
5. Optionally configure the `http_port` (that the bot should serve the web interface on) in `config/local.js` (default: 3000).
6. Setup a HTTP daemon to reverse-proxy the bot, e.g. nginx.

### Discourse Plugin Settings

After you installed the Discourse plugin in step 2, new settings show up in the
admin settings. These settings need to be configured according to your needs.
On the rights, our example configuration for
support.delta.chat/login.testrun.org:

```
oauth2 enabled: 			true
oauth2 client id: 			secret
oauth2 client secret: 			secret
oauth2 authorize url:			https://login.testrun.org/oauth2/authorize
oauth2 token url:			https://login.testrun.org/oauth2/token
oauth2 token url method:		POST
oauth2 callback user id path:		params.info.email
oauth2 callback user info paths:	name:params.info.username
					email:params.info.email
oauth2 fetch user details:		false
oauth2 email verified:			true
oauth2 button title:			with Delta Chat
oauth2 allow association change:	true
```


### Notifier

Optionally you can let users that authenticated via this bot receive discourse activity notifications as Delta Chat messages. Extend the main object in the config file with a block like this one:

```json
  "notifier": {
    "enabled_contact_email_addresses": ["you@example.net", "someone@example.org"],
    "discourse_base_url": "https://your-discourse-domain.example.org",
    "api_key": "get_this_from_the_discourse_settings",
    "api_username": "user_that_owns_the_api_key"
  }
```

Generate an API key in your discourse instance at `/admin/api/keys`.

To let the bot receive the notifications, set up a webhook in your discourse instance at `/admin/api/webhooks`. Use these values to configure it:

* `Payload URL`: https://your-bot-domain.example.org/webhook
* `Content Type`: application/json
* `Select individual events`: Notification Event

You probably want to check `Check TLS certificate of payload url` and `Active`, too.

## Run

Run the bot with `npm start`.


## Background: Data flow

This bot implements a minimal variant of [oauth2](https://en.wikipedia.org/wiki/OAuth#OAuth_2.0), an <q>open standard for access delegation</q>.

In order to be transparent for admins and users, here's a short explanation of what that means:

1. When you click on "Login with Delta Chat", your Browser is redirected to this bot (to `/authorize`).
2. After this bot verified your email address, it hands your browser a token and redirects it back to discourse.
3. Your discourse instance takes this token, its `client_id`, and its `client_secret`, and itself sends a request to this bot (`/token`).
4. This bot verifies the input and responds with a few details, including your email address and your "display name" from Delta Chat. E.g.
```json
{
  access_token: a-random-UUID,
  token_type: 'bearer',
  expires_in: 1,
  info: {
    username: YourDisplayName,
    email: YourEmailAddress
  }
}
```
`access_token`, `token_type`, and `expires_in` are mandatory fields in this response, they don't matter to us.
5. That's it.
