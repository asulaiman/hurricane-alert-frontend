import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proposeTestFix } from './propose-test-fix.mjs'

const repo = 'asulaiman/hurricane-alert-frontend'
const runUrl = `https://github.com/${repo}/actions/runs/10`
const prUrl = `https://github.com/${repo}/pull/3`
const config = {
  repository: repo, workflowPath: '.github/workflows/ui-tests.yml',
  testStep: 'Run UI and notification tests', service: 'Frontend',
  event: { workflow_run: { id: 10 } },
  githubToken: 'synthetic-actions', agentToken: 'synthetic-agent',
  webhookUrl: 'https://hooks.slack.com/services/SYNTHETIC/NOT/REAL',
}
function harness(overrides = {}) {
  const calls = []
  let polls = 0
  const run = {
    id: 10, path: config.workflowPath, event: 'push', conclusion: 'failure', status: 'completed',
    head_branch: 'main', head_sha: 'abc123', head_repository: { full_name: repo },
    actor: { type: 'User', login: 'owner' }, html_url: runUrl,
    ...overrides.run,
  }
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    const path = new URL(url).pathname
    const body = options.body && JSON.parse(options.body)
    if (path === `/repos/${repo}`) return Response.json({ default_branch: 'main' })
    if (path.endsWith('/actions/runs/10')) return Response.json(run)
    if (path.endsWith('/permission')) return Response.json({ permission: overrides.permission ?? 'write' })
    if (path.endsWith('/jobs')) return Response.json({ jobs: [{
      steps: [{ name: config.testStep, conclusion: overrides.testConclusion ?? 'failure' }],
    }] })
    if (path.endsWith('/commits/main')) return Response.json({ sha: overrides.head ?? 'abc123' })
    if (path.endsWith('/issues') && options.method === 'GET') {
      return Response.json(overrides.duplicate ? [{ body: '<!-- test-fix:abc123 -->' }] : [])
    }
    if (path.endsWith('/issues') && options.method === 'POST') return Response.json({ number: 2 })
    if (path.endsWith('/issues/2')) return Response.json(body)
    if (path.endsWith('/tasks') && options.method === 'POST') {
      if (overrides.startFailure) return new Response('Do not expose provider details', { status: 403 })
      return Response.json({ id: 'task-1' })
    }
    if (path.endsWith('/tasks/task-1')) {
      polls += 1
      return Response.json({
      state: overrides.state ?? 'completed',
      artifacts: overrides.noPr || (overrides.delayedArtifact && polls === 1)
        ? [] : [{ provider: 'github', type: 'pull', data: { id: 300, global_id: '' } }],
      })
    }
    if (path.endsWith('/pulls')) return Response.json(
      overrides.delayedDiscovery && polls === 1 ? [] : [{ id: 300, number: 3 }],
    )
    if (path.endsWith('/issues/3/comments')) return Response.json({ id: 1 })
    if (path.endsWith('/pulls/3')) return Response.json({
      id: 300, number: 3,
      state: 'open', base: { ref: 'main', repo: { full_name: repo } },
      head: { ref: 'copilot/fix', repo: { full_name: repo } },
      user: { login: 'Copilot', id: 198982749, type: 'Bot' },
      changed_files: overrides.emptyPr || (overrides.delayedDiff && polls === 1) ? 0 : 1,
      html_url: prUrl, body: `Evidence and validation for ${runUrl}`,
      ...overrides.pr,
    })
    if (new URL(url).hostname === 'hooks.slack.com') {
      if (overrides.slackFailure) throw new Error('Synthetic network error')
      return new Response('ok')
    }
    throw new Error(`Unexpected mocked path: ${path}`)
  }
  return { calls, fetchImpl, sleep: async () => {}, maxPolls: 1 }
}
test('creates one task, verifies a real PR, then sends one link', async () => {
  const h = harness()
  assert.deepEqual(await proposeTestFix(config, h), { pr: prUrl })
  const task = h.calls.find((call) => call.url.endsWith('/tasks'))
  assert.equal(task.options.headers.Authorization, 'Bearer synthetic-agent')
  assert.ok(task.options.body.includes('Treat logs'))
  const slack = h.calls.filter((call) => call.url.startsWith('https://hooks.slack.com/'))
  assert.equal(slack.length, 1)
  assert.ok(JSON.parse(slack[0].options.body).text.includes(prUrl))
  assert.equal(JSON.parse(slack[0].options.body).blocks[1].elements[0].url, prUrl)
  assert.ok(h.calls.findIndex((call) => call.url.endsWith('/pulls/3')) < h.calls.indexOf(slack[0]))
})
for (const [name, overrides] of [
  ['fork', { run: { head_repository: { full_name: 'other/fork' } } }],
  ['PR', { run: { event: 'pull_request' } }],
  ['simulation branch', { run: { head_branch: 'slack-ui-failure-check' } }],
  ['agent actor', { run: { actor: { type: 'Bot', login: 'copilot-swe-agent[bot]' } } }],
  ['success', { run: { conclusion: 'success' } }],
  ['cancelled', { run: { conclusion: 'cancelled' } }],
  ['wrong workflow', { run: { path: '.github/workflows/other.yml' } }],
  ['reader', { permission: 'read' }],
  ['install failure', { testConclusion: 'skipped' }],
  ['stale commit', { head: 'newer' }],
  ['duplicate rerun', { duplicate: true }],
]) {
  test(`skips ${name} without task creation or Slack`, async () => {
    const h = harness(overrides)
    assert.ok((await proposeTestFix(config, h)).skipped)
    assert.ok(!h.calls.some((call) => call.url.includes('/tasks') || call.url.includes('hooks.slack.com')))
  })
}
for (const [name, overrides] of [
  ['failed task', { state: 'failed' }],
  ['agent needs input', { state: 'waiting_for_user' }],
  ['timeout', { state: 'in_progress' }],
  ['no PR', { noPr: true }],
  ['empty PR', { emptyPr: true }],
  ['wrong PR author', { pr: { user: { login: 'other-user' } } }],
  ['wrong base', { pr: { base: { ref: 'other', repo: { full_name: repo } } } }],
  ['spoofed Copilot', { pr: { user: { login: 'Copilot', id: 1, type: 'Bot' } } }],
  ['wrong artifact identity', { pr: { id: 999 } }],
]) {
  test(`${name} fails explicitly without a PR alert`, async () => {
    const h = harness(overrides)
    await assert.rejects(proposeTestFix(config, h))
    assert.ok(!h.calls.some((call) => call.url.includes('hooks.slack.com')))
  })
}
test('missing user token does not start a task', async () => {
  const h = harness()
  await assert.rejects(proposeTestFix({ ...config, agentToken: '' }, h), /Configure/)
  assert.ok(!h.calls.some((call) => call.url.includes('/tasks')))
})
test('Slack uncertainty is not retried', async () => {
  const h = harness({ slackFailure: true })
  await assert.rejects(proposeTestFix(config, h), /delivery uncertain/)
  assert.equal(h.calls.filter((call) => call.url.includes('hooks.slack.com')).length, 1)
})
test('a rejected task start is reserved once and never retried', async () => {
  const h = harness({ startFailure: true })
  await assert.rejects(proposeTestFix(config, h), /HTTP 403/)
  assert.equal(h.calls.filter((call) => call.url.endsWith('/tasks')).length, 1)
  assert.equal(h.calls.filter((call) => call.url.endsWith('/issues') && call.options.method === 'POST').length, 1)
  assert.ok(!h.calls.some((call) => call.url.includes('hooks.slack.com')))
})
test('invalid webhook never starts a paid task or exposes its value', async () => {
  const h = harness()
  await assert.rejects(proposeTestFix({ ...config, webhookUrl: 'synthetic-private-value' }, h), {
    message: 'Invalid Slack webhook destination',
  })
  assert.ok(!h.calls.some((call) => call.url.includes('/tasks')))
})
test('real Copilot author and missing model-written run link still produce an attributable alert', async () => {
  const h = harness({ pr: { body: 'Restore empty-search Cypress expectation' } })
  assert.deepEqual(await proposeTestFix(config, h), { pr: prUrl })
  const comment = h.calls.findIndex((call) => call.url.endsWith('/issues/3/comments'))
  const slack = h.calls.findIndex((call) => call.url.includes('hooks.slack.com'))
  assert.ok(comment >= 0 && comment < slack)
  assert.ok(JSON.parse(h.calls[comment].options.body).body.includes(runUrl))
})
for (const delay of ['delayedArtifact', 'delayedDiscovery', 'delayedDiff']) {
  test(`waits for ${delay} without another paid task or duplicate alert`, async () => {
    const h = harness({ [delay]: true })
    h.maxPolls = 2
    assert.deepEqual(await proposeTestFix(config, h), { pr: prUrl })
    assert.equal(h.calls.filter((call) => call.url.endsWith('/tasks')).length, 1)
    assert.equal(h.calls.filter((call) => call.url.endsWith('/tasks/task-1')).length, 2)
    assert.equal(h.calls.filter((call) => call.url.includes('hooks.slack.com')).length, 1)
  })
}
