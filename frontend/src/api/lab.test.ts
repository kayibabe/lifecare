import { beforeEach, describe, expect, it, vi } from 'vitest'
import client from './client'
import { labApi, type LabOrderCreate, type LabResultCreate } from './lab'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

const mockedClient = vi.mocked(client)

describe('lab API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an order for an encounter without a client-supplied ordering user', () => {
    const order: LabOrderCreate = {
      patient_id: 'patient-1',
      encounter_id: 'encounter-1',
      items: [{ test_id: 'test-1', priority: 'routine' }],
    }

    labApi.createOrder(order)

    expect(mockedClient.post).toHaveBeenCalledWith('/lab/orders', order)
    expect(order).not.toHaveProperty('ordered_by')
  })

  it('sends status updates in the backend request shape', () => {
    labApi.updateStatus('order-1', 'processing')

    expect(mockedClient.put).toHaveBeenCalledWith('/lab/orders/order-1/status', {
      status: 'processing',
    })
  })

  it('records flat result fields and the result flag', () => {
    const result: LabResultCreate = {
      result_value: '14.2',
      result_unit: 'g/dL',
      reference_range: '12.0-16.0',
      result_flag: 'normal',
    }

    labApi.recordResult('order-1', 'item-1', result)

    expect(mockedClient.post).toHaveBeenCalledWith(
      '/lab/orders/order-1/results/item-1',
      result,
    )
  })
})
