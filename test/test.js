process.env.NODE_ENV = 'test'

const http = require('http')
const chai = require('chai')
const expect = require('chai').expect
chai.use(require('chai-http'))
const sinon = require('sinon')

const client_id = 'aRandomString'
const client_secret = 'verySecure'
const redirect_uri = 'http://localhost/callback'

// Mock the interactive authentication.
const dcExports = require('deltachat-node-webbot-base')
sinon.stub(dcExports, 'ensureAuthenticated').callsFake((req, res, callback) => { req.session.contactId = contact_id; callback() })

// After setting up the mock, load the other parts.
const oauthDB = require('../src/database')
const app = require('../src/web_app')
const server = require('http').createServer(app)

var contact_id = null

describe("HTTP request", () => {
  before(() => {
    // Return the promise so mocha waits for it.
    var dc_started = dcExports.deltachat.start()
    dc_started.then(() => {
        contact_id = dcExports.deltachat.createContact('Test', 'test@example.net')
      })
    return dc_started
  })

  it('to /authorize responds with redirect if client_id and redirect_uri are valid', () => {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await chai.request(server)
          .get(`/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}`)
          .redirects(0) // don't follow redirects

        const db_data = await oauthDB.getByContactId(contact_id)

        expect(response.status).to.eql(302)
        expect(response.header.location).to.include(redirect_uri)
        let match = response.header.location.match(/code=(\w+)/)
        expect(match[1]).to.eql(db_data.authcode)

        resolve()
      } catch(error) {
        reject(error)
      }
    })
  })

  it('to /authorize responds with client error if client_id is invalid', () => {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await chai.request(server)
          .get(`/authorize?client_id=somethingInvalid&redirect_uri=${redirect_uri}`)
          .redirects(0) // don't follow redirects
        
        expect(response.status).to.eql(400)
        expect(response.headers).to.not.have.any.keys('location')

        resolve()
      } catch(error) {
        reject(error)
      }
    })
  })

  it('to /authorize responds with client error if redirect_uri is invalid', () => {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await chai.request(server)
          .get(`/authorize?client_id=${client_id}&redirect_uri=http://example.net/invalid`)
          .redirects(0) // don't follow redirects

        expect(response.status).to.eql(400)
        expect(response.headers).to.not.have.any.keys('location')

        resolve()
      } catch(error) {
        reject(error)
      }
    })
  })

  it('to /token responds with success if auth_code and authorization is valid', () => {
    return new Promise(async (resolve, reject) => {
      try {
        const auth_code = 'Thanks,Edward'
        await oauthDB.save(auth_code, contact_id)

        const response = await chai.request(server)
          .get(`/token?code=${auth_code}`)
          .auth(client_id, client_secret)
          .redirects(0) // don't follow redirects

        expect(response.status).to.eql(200)
        expect(response.headers).to.not.have.any.keys('location')
        expect(response.body).to.have.all.keys('access_token', 'expires_in', 'token_type', 'info')
        expect(response.body.access_token).to.have.lengthOf('36')
        expect(response.body.token_type).to.eql('bearer')
        expect(response.body.info).to.be.an('object')
        expect(response.body.info).to.have.all.keys('userid', 'username', 'email')
        expect(response.body.info.userid).to.not.be.empty
        expect(response.body.info.email).to.not.be.empty

        resolve()
      } catch(error) {
        reject(error)
      }
    })
  })

  it('to /token responds with client error if auth_code is valid but authorization is invalid', () => {
    return new Promise(async (resolve, reject) => {
      try {
        const auth_code = 'Thanks,Edward'
        await oauthDB.save(auth_code, contact_id)

        const response = await chai.request(server)
          .get(`/token?code=${auth_code}`)
          .auth(client_id, 'invalid')
          .redirects(0) // don't follow redirects

        expect(response.status).to.eql(401)
        expect(response.headers).to.not.have.any.keys('location')
        expect(response.body).to.eql({})

        resolve()
      } catch(error) {
        reject(error)
      }
    })
  })

  it('to /token responds with success if auth_code is invalid, even if the authorization is valid', () => {
    return new Promise(async (resolve, reject) => {
      try {
        const auth_code = 'Thanks,Edward'
        await oauthDB.save(auth_code, contact_id)

        const response = await chai.request(server)
          .get(`/token?code=invalid`)
          .auth(client_id, client_secret)
          .redirects(0) // don't follow redirects

        expect(response.status).to.eql(400)
        expect(response.headers).to.not.have.any.keys('location')
        expect(response.body).to.eql({})

        resolve()
      } catch(error) {
        reject(error)
      }
    })
  })
})
