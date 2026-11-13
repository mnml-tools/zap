import test from 'node:test'
import assert from 'node:assert/strict'
import { foreignKeyFor, referenceFrom, referenceFilters, referenceLabel, tableLabel } from '../src/lib/relations.ts'
const customer = { columns: [1], target: { schema: 'public', name: 'customers' }, targetColumns: ['id'] }
const line = { columns: [3, 2], target: { schema: '', name: 'order lines' }, targetColumns: ['number', 'tenant'] }
const page = { columns: ['id', 'customer_id', 'tenant', 'line'], foreignKeys: [customer, line] }
test('columns resolve to the foreign key that contains them', () => {
  assert.equal(foreignKeyFor(page, 1), customer)
  assert.equal(foreignKeyFor(page, 2), line)
  assert.equal(foreignKeyFor(page, 0), undefined)
})
test('composite references keep target column order and become eq filters', () => {
  const reference = referenceFrom(line, ['9', '5', '1', '42'])
  assert.deepEqual(reference.values, ['42', '1'])
  assert.deepEqual(
    referenceFilters(reference).map(({ column, operator, value, enabled }) => ({ column, operator, value, enabled })),
    [
      { column: 'number', operator: 'eq', value: '42', enabled: true },
      { column: 'tenant', operator: 'eq', value: '1', enabled: true }
    ]
  )
  assert.equal(referenceLabel(reference), 'number = 42, tenant = 1')
  assert.equal(tableLabel(line.target), 'order lines')
  assert.equal(tableLabel(customer.target), 'public.customers')
})
test('a NULL in any source column means there is no reference, while empty text is a value', () => {
  assert.equal(referenceFrom(customer, ['1', null]), null)
  assert.equal(referenceFrom(line, ['1', '2', '3', null]), null)
  assert.deepEqual(referenceFrom(customer, ['1', '']).values, [''])
})
