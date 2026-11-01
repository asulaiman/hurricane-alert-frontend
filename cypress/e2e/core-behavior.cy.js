const forecastUrl = 'http://127.0.0.1:3002/api/forecast*'
const searchUrl = 'https://geocoding-api.open-meteo.com/v1/search*'
const apiOrigin = 'http://127.0.0.1:3002'
const miami = {
  id: 1,
  name: 'Miami',
  admin1: 'Florida',
  country: 'United States',
  latitude: 25.7617,
  longitude: -80.1918,
}
const locationLabel = 'Miami, Florida, United States'

function forecast({ wind = 10, gust = 15, rain = 0, advisory = {} } = {}) {
  return {
    timezone: 'UTC',
    current: {
      time: '2026-11-01T03:00',
      windSpeed: wind,
      windGusts: gust,
      precipitation: 0,
      surfacePressure: 1000,
    },
    advisory: {
      level: 0,
      label: 'No Advisory',
      description: 'Pressure has dropped 4.0 hPa in the last 3 hours.',
      color: '#2f9e44',
      maxSustainedWind: { value: wind, time: '2026-11-01T03:00' },
      maxGust: { value: gust, time: '2026-11-01T03:00' },
      next24hPrecipitation: rain,
      flashFloodRisk: false,
      pressureDropLast3h: 4,
      ...advisory,
    },
  }
}

function stubForecast(options = {}, responseOptions = {}) {
  cy.intercept('GET', forecastUrl, { ...apiReply(forecast(options)), ...responseOptions }).as('forecast')
}

function apiReply(body, statusCode = 200, delay = 0) {
  return { statusCode, body, delay, headers: { 'access-control-allow-origin': '*' } }
}

function visit({ geolocation = 'success', push = false } = {}) {
  cy.visit('/', {
    onBeforeLoad(win) {
      if (geolocation === 'unsupported') {
        delete win.navigator.geolocation
        // Geolocation normally lives on Navigator's prototype.
        delete Object.getPrototypeOf(win.navigator).geolocation
      } else {
        cy.stub(win.navigator.geolocation, 'getCurrentPosition')
          .callsFake((success, error) => {
            win.setTimeout(() => {
              if (geolocation === 'denied') {
                error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
              } else {
                success({ coords: { latitude: miami.latitude, longitude: miami.longitude } })
              }
            }, 100)
          })
          .as('locate')
      }
      if (push) {
        const subscription = {
          endpoint: 'https://push.example.test/subscription',
          keys: { p256dh: 'test-public-key', auth: 'test-auth' },
        }
        const registration = {
          pushManager: {
            subscribe: cy.stub().resolves({ toJSON: () => subscription }).as('pushManagerSubscribe'),
          },
        }
        Object.defineProperty(win.navigator, 'serviceWorker', {
          configurable: true,
          value: {
            register: cy.stub().resolves(registration).as('registerServiceWorker'),
            ready: Promise.resolve(registration),
          },
        })
        Object.defineProperty(win, 'PushManager', { configurable: true, value: function PushManager() {} })
      } else {
        delete win.PushManager
      }
    },
  })
}

function useLocation() {
  cy.contains('button', 'Use My Location').click()
  cy.wait('@forecast')
}

function search(query = 'Miami') {
  cy.get('input[placeholder="Search city, e.g. Miami, FL"]').clear().type(query)
  cy.contains('button', /^Search$/).click()
  cy.wait('@search')
}

function selectMiami() {
  search()
  cy.contains('.search-results button', locationLabel).click()
  cy.wait('@forecast')
}

function consent() {
  cy.get('.consent-row input').check()
}

function emailSignup() {
  cy.get('input[type=email]').type('tester@example.test')
  consent()
  cy.contains('button', /^Subscribe$/).click()
}

beforeEach(() => {
  cy.intercept('GET', searchUrl, { body: { results: [miami] } }).as('search')
  // Unexpected routes fail locally rather than touching a database or delivery service.
  cy.intercept(`${apiOrigin}/api/**`, apiReply({ error: 'Unexpected API request' }, 500))
  cy.intercept('OPTIONS', `${apiOrigin}/api/**`, {
    ...apiReply('', 204),
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  })
  cy.intercept('GET', `${apiOrigin}/api/alerts*`, apiReply({ alerts: [] })).as('alerts')
  stubForecast()
})

describe('Location and forecast flows', () => {
  it('requires a location before showing results or subscription controls', () => {
    visit()
    cy.contains('h1', 'Hurricane Alert').should('be.visible')
    cy.get('.advisory-banner, .alert-signup').should('not.exist')
    cy.contains('button', /^Search$/).click()
    cy.get('.search-results').should('not.exist')
  })

  it('searches, selects a city, and sends its coordinates to weather and API services', () => {
    visit()
    selectMiami()
    cy.get('@search').its('request.query.name').should('eq', 'Miami')
    cy.get('@forecast').its('request.query').should('include', {
      lat: '25.7617',
      lon: '-80.1918',
    })
    cy.wait('@alerts').its('request.query').should('include', { lat: '25.7617', lon: '-80.1918' })
    cy.contains('.current-location', locationLabel).should('be.visible')
    cy.get('.search-results').should('not.exist')
    cy.get('input[placeholder="Search city, e.g. Miami, FL"]').should('have.value', '')
    cy.contains('h3', 'Right Now').should('be.visible')
    cy.contains('h3', 'Next 48 Hours').should('be.visible')
  })

  it('shows search loading and no-result states', () => {
    cy.intercept('GET', searchUrl, { body: { results: [] }, delay: 300 }).as('search')
    visit()
    cy.get('input[placeholder="Search city, e.g. Miami, FL"]').type('Unknown')
    cy.contains('button', /^Search$/).click()
    cy.contains('button', 'Searching…').should('be.disabled')
    cy.wait('@search')
    cy.contains('No matching locations found.').should('be.visible')
  })

  it('lets a failed location search be retried', () => {
    cy.intercept('GET', searchUrl, { statusCode: 503 }).as('search')
    visit()
    search()
    cy.contains('Location search failed. Try again.').should('be.visible')
    cy.intercept('GET', searchUrl, { body: { results: [miami] } }).as('search')
    selectMiami()
    cy.contains('Location search failed.').should('not.exist')
  })

  it('uses successful geolocation and shows locating and forecast loading states', () => {
    stubForecast({}, { delay: 300 })
    visit()
    cy.contains('button', 'Use My Location').click()
    cy.contains('button', 'Locating…').should('be.disabled')
    cy.contains('Loading forecast…').should('be.visible')
    cy.wait('@forecast')
    cy.get('@locate').should('have.been.calledOnce')
    cy.contains('.current-location', 'Current Location').should('be.visible')
    cy.contains('.current-location', '(25.76, -80.19)').should('be.visible')
  })

  it('recovers from denied geolocation through manual search', () => {
    visit({ geolocation: 'denied' })
    cy.contains('button', 'Use My Location').click()
    cy.contains('Location access was denied. Search for a location manually instead.').should('be.visible')
    selectMiami()
    cy.contains('Location access was denied.').should('not.exist')
    cy.contains('h2', 'No Advisory').should('be.visible')
  })

  it('explains unsupported geolocation', () => {
    visit({ geolocation: 'unsupported' })
    cy.contains('button', 'Use My Location').click()
    cy.contains('Geolocation is not supported by this browser.').should('be.visible')
  })

  it('shows forecast failure and retries through Refresh', () => {
    cy.intercept('GET', forecastUrl, apiReply({ error: 'Unavailable' }, 503)).as('forecast')
    visit()
    useLocation()
    cy.contains('Could not load forecast data. Try refreshing.').should('be.visible')
    cy.get('.advisory-banner').should('not.exist')
    stubForecast()
    cy.contains('button', 'Refresh').click()
    cy.wait('@forecast')
    cy.contains('Could not load forecast data.').should('not.exist')
    cy.contains('h2', 'No Advisory').should('be.visible')
  })
})

describe('Backend-provided advisory presentation', () => {
  const cases = [
    [0, 'No Advisory', '#2f9e44'],
    [1, 'Strong Wind / Heavy Rain Advisory', '#e8a400'],
    [2, 'Tropical-Storm-Force Conditions Advisory', '#e8590c'],
    [3, 'Hurricane-Force Conditions Advisory', '#c92a2a'],
  ]

  for (const [level, label, color] of cases) {
    it(`renders backend advisory level ${level} without recalculating it`, () => {
      stubForecast({ advisory: { level, label, color } })
      visit()
      useLocation()
      cy.get('.advisory-banner h2').should('have.text', label)
      cy.get('.flag').should('not.exist')
    })
  }

  it('renders the backend flash flood flag and explanation', () => {
    stubForecast({ rain: 3, advisory: {
      level: 1, label: 'Strong Wind / Heavy Rain Advisory', flashFloodRisk: true,
      description: 'Heavy rainfall risk: 3.0 in forecast over the next 24 hours.',
    } })
    visit()
    useLocation()
    cy.contains('.flag', 'Flash flood risk').should('be.visible')
    cy.contains('.advisory-banner', '3.0 in forecast over the next 24 hours').should('be.visible')
  })

  it('renders forecast values, units, and pressure trend', () => {
    stubForecast({ wind: 39, gust: 60, rain: 1.5 })
    visit()
    useLocation()
    cy.get('.detail-card').first().within(() => {
      cy.contains('dt', 'Sustained Wind').next().should('have.text', '39 mph')
      cy.contains('dt', 'Gusts').next().should('have.text', '60 mph')
      cy.contains('dt', 'Pressure').next().should('have.text', '1000 hPa')
    })
    cy.contains('dt', 'Next 24h Rainfall').next().should('contain.text', '1.5 in')
    cy.contains('dt', 'Pressure Trend (3h)').next().should('have.text', '−4.0 hPa')
    cy.contains('.advisory-banner', 'Pressure has dropped 4.0 hPa').should('be.visible')
  })
})

describe('Official alerts', () => {
  it('renders official warnings and their full-details links', () => {
    cy.intercept('GET', `${apiOrigin}/api/alerts*`, apiReply({
      alerts: [{
        source: 'NWS',
        id: 'nws-1',
        title: 'Hurricane Warning',
        severity: 'Extreme',
        headline: 'Follow local evacuation guidance',
        description: 'Official warning',
        effective: null,
        expires: null,
        url: 'https://weather.example.test/alerts/nws-1',
      }],
    })).as('alerts')
    visit()
    useLocation()
    cy.wait('@alerts')
    cy.contains('h3', 'Official Alerts').should('be.visible')
    cy.contains('.official-alert-item', 'NWS').should('be.visible')
    cy.contains('.official-alert-item', 'Hurricane Warning').should('be.visible')
    cy.contains('.official-alert-item', 'Extreme').should('be.visible')
    cy.contains('a', 'Full details')
      .should('have.attr', 'href', 'https://weather.example.test/alerts/nws-1')
      .and('have.attr', 'target', '_blank')
  })

  for (const [name, response] of [
    ['empty official alerts', apiReply({ alerts: [] })],
    ['failed official alerts', apiReply({ error: 'Upstream unavailable' }, 502)],
  ]) {
    it(`${name} do not block forecast or signup`, () => {
      cy.intercept('GET', `${apiOrigin}/api/alerts*`, response).as('alerts')
      visit()
      useLocation()
      cy.wait('@alerts')
      cy.get('.official-alerts').should('not.exist')
      cy.contains('h2', 'No Advisory').should('be.visible')
      cy.contains('h3', 'Get Notified').should('be.visible')
    })
  }
})

describe('Subscription flows', () => {
  it('requires consent and a channel, and disables unsupported push', () => {
    visit()
    useLocation()
    cy.contains('button', /^Subscribe$/).should('be.disabled')
    cy.contains('.signup-row', 'Browser push notifications')
      .find('input').should('be.disabled')
    consent()
    cy.contains('button', /^Subscribe$/).should('be.disabled')
    cy.get('input[type=email]').type('tester@example.test')
    cy.contains('button', /^Subscribe$/).should('be.enabled')
    cy.get('.consent-row input').uncheck()
    cy.contains('button', /^Subscribe$/).should('be.disabled')
  })

  it('uses browser email validation before submitting', () => {
    let requests = 0
    cy.intercept('POST', `${apiOrigin}/api/subscribe`, () => { requests += 1 })
    visit()
    useLocation()
    cy.get('input[type=email]').type('not-an-email')
    consent()
    cy.contains('button', /^Subscribe$/).click()
    cy.get('input[type=email]').then(($input) => {
      expect($input[0].validity.typeMismatch).to.equal(true)
      expect(requests).to.equal(0)
    })
    cy.get('.signup-success').should('not.exist')
  })

  it('submits saved coordinates and consent, then prompts email verification', () => {
    cy.intercept('POST', `${apiOrigin}/api/subscribe`, apiReply({
      subscriptionId: 42, requiresEmailVerification: true,
    }, 201, 300)).as('signup')
    visit()
    selectMiami()
    emailSignup()
    cy.contains('button', 'Subscribing…').should('be.disabled')
    cy.wait('@signup').its('request.body').should('include', {
      latitude: miami.latitude,
      longitude: miami.longitude,
      label: locationLabel,
      email: 'tester@example.test',
      wantsPush: false,
    }).its('consentText').should('contain', 'I can unsubscribe at any time.')
    cy.contains('.signup-success', 'Check your inbox to confirm your email.').should('be.visible')
    cy.get('form.alert-signup').should('not.exist')
  })

  it('displays server errors and allows resubmission', () => {
    cy.intercept('POST', `${apiOrigin}/api/subscribe`,
      apiReply({ error: 'Too many verification emails sent recently. Try again later.' }, 429)).as('signup')
    visit()
    useLocation()
    emailSignup()
    cy.wait('@signup')
    cy.contains('.alert-signup .error-text', 'Too many verification emails').should('be.visible')
    cy.intercept('POST', `${apiOrigin}/api/subscribe`, apiReply({
      subscriptionId: 42, requiresEmailVerification: false,
    }, 201)).as('signup')
    cy.contains('button', /^Subscribe$/).click()
    cy.wait('@signup')
    cy.contains('.signup-success', "You're subscribed.").should('be.visible')
  })

  it('displays a generic status error for a non-JSON failure', () => {
    cy.intercept('POST', `${apiOrigin}/api/subscribe`, apiReply('Unavailable', 503)).as('signup')
    visit()
    useLocation()
    emailSignup()
    cy.wait('@signup')
    cy.contains('.alert-signup .error-text', 'Signup failed (503)').should('be.visible')
  })

  it('registers browser push and saves it against the created subscription', () => {
    cy.intercept('POST', `${apiOrigin}/api/subscribe`, apiReply({
      subscriptionId: 42, requiresEmailVerification: false,
    }, 201)).as('signup')
    cy.intercept('POST', `${apiOrigin}/api/push/subscribe`, apiReply({ ok: true })).as('pushSignup')
    visit({ push: true })
    useLocation()
    cy.contains('.signup-row', 'Browser push notifications').find('input').check()
    consent()
    cy.contains('button', /^Subscribe$/).click()
    cy.wait('@signup').its('request.body.wantsPush').should('eq', true)
    cy.wait('@pushSignup').its('request.body').should('deep.equal', {
      subscriptionId: 42,
      pushSubscription: {
        endpoint: 'https://push.example.test/subscription',
        keys: { p256dh: 'test-public-key', auth: 'test-auth' },
      },
    })
    cy.get('@registerServiceWorker').should('have.been.calledWith', '/sw.js')
    cy.get('@pushManagerSubscribe').should('have.been.calledOnce')
    cy.contains('.signup-success', 'Browser push is active.').should('be.visible')
  })

  it('does not claim success when saving browser push fails', () => {
    cy.intercept('POST', `${apiOrigin}/api/subscribe`, apiReply({
      subscriptionId: 42, requiresEmailVerification: false,
    }, 201)).as('signup')
    cy.intercept('POST', `${apiOrigin}/api/push/subscribe`,
      apiReply({ error: 'Unavailable' }, 503)).as('pushSignup')
    visit({ push: true })
    useLocation()
    cy.contains('.signup-row', 'Browser push notifications').find('input').check()
    consent()
    cy.contains('button', /^Subscribe$/).click()
    cy.wait('@pushSignup')
    cy.contains('.alert-signup .error-text', 'Could not save push subscription.').should('be.visible')
    cy.get('.signup-success').should('not.exist')
  })
})
