const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { DEFAULT_HOOKS_POOL, hooksPool, serveArgs } = require('../../scripts/env')

describe('scripts/env — pool de VMs do JS no serve', () => {
  it('usa 60 por padrão (o do PocketBase é 15)', () => {
    assert.equal(DEFAULT_HOOKS_POOL, 60)
    assert.equal(hooksPool({}), 60)
    assert.deepEqual(serveArgs({}), ['--hooksPool=60'])
  })

  it('KAMBAN_HOOKS_POOL ajusta; valor inválido ou fora de 1–500 volta ao padrão', () => {
    assert.equal(hooksPool({ KAMBAN_HOOKS_POOL: '30' }), 30)
    assert.deepEqual(serveArgs({ KAMBAN_HOOKS_POOL: '120' }), ['--hooksPool=120'])
    ;['', 'abc', '0', '-5', '2.5', '501'].forEach((value) => assert.equal(hooksPool({ KAMBAN_HOOKS_POOL: value }), 60, value))
  })
})
