import test from 'node:test'
import assert from 'node:assert/strict'
import { createStagingBudget } from '../lib/staging-budget.mjs'

test('staging budget fires once when the polling measurement exceeds the cap', () => {
  let exceed = 0
  const errors = []
  const budget = createStagingBudget({
    staging: '/tmp/staging',
    maxBytes: 10,
    measure: () => ({ bytes: 11 }),
    onExceed: (error) => { exceed += 1; errors.push(error) },
  })
  budget.start()
  budget.tickNow()
  budget.tickNow()
  assert.equal(exceed, 1)
  assert.equal(errors[0].code, 'E_IO')
  assert.equal(budget.exceeded, true)
  budget.stop()
})

test('staging budget treats a measurement failure as an abort', () => {
  let exceed = 0
  const errors = []
  const budget = createStagingBudget({
    staging: '/tmp/staging',
    maxBytes: 10,
    measure: () => { throw new Error('gone') },
    onExceed: (error) => { exceed += 1; errors.push(error) },
  })
  budget.start()
  budget.tickNow()
  assert.equal(exceed, 1)
  assert.equal(errors[0].code, 'E_IO')
  assert.equal(budget.exceeded, true)
  budget.stop()
})
