import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'

const driveMock = vi.fn()
const destroyMock = vi.fn()
const driverMock = vi.fn(() => ({ drive: driveMock, destroy: destroyMock }))
vi.mock('driver.js', () => ({ driver: (cfg) => driverMock(cfg) }))
vi.mock('driver.js/dist/driver.css', () => ({}))

import GuidedTour, { buildSteps, tourSeen } from '../GuidedTour'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('buildSteps', () => {
  it('includes the sandhya slot step for male users, anchored to the real element', () => {
    const steps = buildSteps(true)
    expect(steps).toHaveLength(3)
    expect(steps[1].element).toBe('[data-tour="sandhya-slots"]')
    expect(steps[1].popover.description).toMatch(/Prathakala.*Madhyanika.*Saayamkala/)
    expect(steps[2].element).toBe('[data-tour="add-practice"]')
  })

  it('omits the sandhya step when Sandhyavandhanam does not apply', () => {
    const steps = buildSteps(false)
    expect(steps).toHaveLength(2)
    expect(steps.some(s => s.element === '[data-tour="sandhya-slots"]')).toBe(false)
  })

  it('reworded welcome no longer mentions the deepam line', () => {
    expect(buildSteps(false)[0].popover.description).toBe(
      'Track your daily anushtanams here. Mark each one done every day to grow your streak.'
    )
  })
})

describe('GuidedTour', () => {
  it('drives the tour on first run when ready', () => {
    render(<GuidedTour ready={true} showSandhya={false} />)
    expect(driverMock).toHaveBeenCalledOnce()
    expect(driveMock).toHaveBeenCalledOnce()
  })

  it('does not run before the page is ready', () => {
    render(<GuidedTour ready={false} showSandhya={true} />)
    expect(driveMock).not.toHaveBeenCalled()
  })

  it('does not run again once seen', () => {
    localStorage.setItem('nk_tour_seen_v1', '1')
    render(<GuidedTour ready={true} showSandhya={true} />)
    expect(driveMock).not.toHaveBeenCalled()
  })

  it('drops the sandhya step when the element is absent even for male users', () => {
    render(<GuidedTour ready={true} showSandhya={true} />) // no [data-tour="sandhya-slots"] in DOM
    expect(driverMock.mock.calls[0][0].steps).toHaveLength(2)
  })

  it('marks itself seen through the driver onDestroyed callback', () => {
    render(<GuidedTour ready={true} showSandhya={false} />)
    const cfg = driverMock.mock.calls[0][0]
    expect(tourSeen()).toBe(false)
    cfg.onDestroyed()
    expect(tourSeen()).toBe(true)
  })
})
