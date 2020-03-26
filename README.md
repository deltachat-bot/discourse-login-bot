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
    "redirect_uri": "https://your.discourse.instance/callback"
  }
}
```
3. Optionally configure the `http_port` (that the bot should serve the web interface on) in `config/local.js` (default: 3000).
4. Setup a HTTP daemon to reverse-proxy the bot, e.g. nginx.

### Configure Discourse

First install the oauth2 plugin by adding the following line to
`/var/discourse/containers/app.yml` and rebuilding the container:

```
          - git clone https://github.com/discourse/discourse-oauth2-basic.git
```

#### OAuth2 Settings

Then new settings show up in the admin settings. These settings need to be
configured according to your needs. On the rights, our example configuration
for support.delta.chat/login.testrun.org:

```
oauth2 enabled: 			true
oauth2 client id: 			secret
oauth2 client secret: 			secret
oauth2 authorize url:			https://login.testrun.org/oauth2/authorize
oauth2 token url:			https://login.testrun.org/oauth2/token
oauth2 token url method:		POST
oauth2 callback user id path:		params.info.userid
oauth2 callback user info paths:	name:params.info.username
					email:params.info.email
oauth2 fetch user details:		false
oauth2 email verified:			true
oauth2 button title:			with Delta Chat
oauth2 allow association change:	true
```

## Run

Run the bot with `npm start`.
