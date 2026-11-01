import { defineConfig } from 'cypress'

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    baseUrl: 'http://127.0.0.1:5174',
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.js',
  },
  video: false,
})
