var sqlite3 = require('sqlite3')
const path = require('path')

const init_db = () => {
  let db = new sqlite3.Database(path.join(process.cwd(), 'discourse-login-bot.sqlite'))
  db.run("CREATE TABLE IF NOT EXISTS oauth2_authcodes (authcode TEXT PRIMARY KEY,contactId INTEGER)")
  return db
}

const oauthDB = init_db()

process.on('exit', () => oauthDB.close())

const getSingleValue = async (sql, args) => {
  return await new Promise((resolve, reject) => {
    oauthDB.get(sql, args,
      (err, result) => {
        if (err) {
          reject(err)
        } else {
          resolve(result)
        }
      }
    )
  })
}

oauthDB.getByAuthCode = async (authcode) => {
  return await getSingleValue('SELECT contactId FROM oauth2_authcodes WHERE authcode = $authcode', {$authcode: authcode})
}

oauthDB.getByContactId = async (contactId) => {
  return await getSingleValue('SELECT authcode FROM oauth2_authcodes WHERE contactId = $contactId', {$contactId: contactId})
}

oauthDB.save = async (authcode, contactId) => {
  return await new Promise((resolve, reject) => {
    // Delete previous authentication data from this contact.
    oauthDB.run("DELETE FROM oauth2_authcodes WHERE contactId = $contactId",
      { $contactId: contactId },
      (err) => {
        if (err) {
          reject(err)
        } else {
          oauthDB.run("INSERT INTO oauth2_authcodes (authcode, contactId) VALUES ($authcode, $contactId)",
            { $authcode: authcode, $contactId: contactId },
            (err) => {
              if (err) {
                reject(err)
              } else {
                resolve()
              }
            }
          )
        }
      })
  })
}

module.exports = oauthDB
