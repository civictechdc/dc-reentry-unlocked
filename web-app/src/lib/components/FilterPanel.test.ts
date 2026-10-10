import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defaultFilters } from '../filters'
import type { FilterState } from '../filters'
import FilterPanel from './FilterPanel.svelte'

function renderPanel(filters: FilterState = defaultFilters()) {
  const onchange = vi.fn()
  const onreset = vi.fn()
  const result = render(FilterPanel, { props: { filters, onchange, onreset } })
  return { onchange, onreset, ...result }
}

/**
 * The panel commits on `change` (blur/Enter), not per keystroke. Svelte's
 * number binding updates its draft on `input`, so tests fire input (to set
 * the draft) followed by change (to commit) — the same sequence a real
 * blur/Enter produces. Used where jsdom's number-input sanitization makes
 * character-by-character typing unreliable (e.g. `-5`).
 */
async function commitValue(input: HTMLElement, value: string): Promise<void> {
  await fireEvent.input(input, { target: { value } })
  await fireEvent.change(input)
}

describe('FilterPanel', () => {
  it('renders labeled controls with current values', () => {
    renderPanel({ minPrice: 100_000, maxPrice: 500_000, minBedrooms: 2, type: 'condo' })

    expect(screen.getByLabelText('Min price')).toHaveValue(100_000)
    expect(screen.getByLabelText('Max price')).toHaveValue(500_000)
    expect(screen.getByLabelText('Min bedrooms')).toHaveValue(2)
    expect(screen.getByLabelText('Property type')).toHaveValue('condo')
  })

  it('does not commit while typing — only on change (blur/Enter)', async () => {
    const { onchange } = renderPanel()
    const input = screen.getByLabelText('Min price')

    await userEvent.type(input, '500000')
    expect(onchange).not.toHaveBeenCalled()

    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledTimes(1)
    expect(onchange).toHaveBeenLastCalledWith(
      expect.objectContaining({ minPrice: 500_000 }),
    )
  })

  it('valid price change fires onchange with the parsed number', async () => {
    const { onchange } = renderPanel()

    await userEvent.type(screen.getByLabelText('Min price'), '500000')
    await fireEvent.change(screen.getByLabelText('Min price'))

    expect(onchange).toHaveBeenLastCalledWith(
      expect.objectContaining({ minPrice: 500_000 }),
    )
  })

  it('clearing a price input commits null (unbounded)', async () => {
    const { onchange } = renderPanel({ ...defaultFilters(), minPrice: 500_000 })
    const input = screen.getByLabelText('Min price')

    await userEvent.clear(input)
    await fireEvent.change(input)

    expect(onchange).toHaveBeenLastCalledWith(
      expect.objectContaining({ minPrice: null }),
    )
  })

  it('min greater than max shows an error and does not fire onchange', async () => {
    const { onchange } = renderPanel({ ...defaultFilters(), minPrice: 900_000 })

    await commitValue(screen.getByLabelText('Max price'), '100')

    expect(screen.getByRole('alert')).toHaveTextContent('must not exceed')
    expect(onchange).not.toHaveBeenCalledWith(
      expect.objectContaining({ maxPrice: 100 }),
    )
  })

  it('typing a negative price and committing shows an error without firing onchange', async () => {
    const { onchange } = renderPanel()

    // jsdom sanitizes number-input values mid-typing (a lone '-' becomes ''),
    // so the completed '-5' entry is simulated directly; the change event is
    // what blur/Enter would fire.
    await commitValue(screen.getByLabelText('Min price'), '-5')

    expect(screen.getByRole('alert')).toHaveTextContent('non-negative')
    expect(onchange).not.toHaveBeenCalled()
  })

  it('typing a fractional bedroom count and committing shows an error without firing onchange', async () => {
    const { onchange } = renderPanel()

    await commitValue(screen.getByLabelText('Min bedrooms'), '2.5')

    expect(screen.getByRole('alert')).toHaveTextContent('non-negative integer')
    expect(onchange).not.toHaveBeenCalled()
  })

  it('type select fires onchange with the chosen type', async () => {
    const { onchange } = renderPanel()

    await userEvent.selectOptions(screen.getByLabelText('Property type'), 'condo')

    expect(onchange).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'condo' }),
    )
  })

  it('reset button fires onreset and clears errors', async () => {
    const { onreset } = renderPanel({ ...defaultFilters(), minPrice: 900_000 })
    await commitValue(screen.getByLabelText('Max price'), '100')
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }))

    expect(onreset).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
