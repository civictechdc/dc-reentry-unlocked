import { fireEvent, render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'
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

function filtersWith(partial: Partial<FilterState>): FilterState {
  return { ...defaultFilters(), ...partial }
}

function checkbox(label: string): HTMLInputElement {
  return screen.getByRole('checkbox', { name: label }) as HTMLInputElement
}

/** Last FilterState payload passed to onchange (fails the test when absent). */
function lastPayload(onchange: ReturnType<typeof vi.fn>): FilterState {
  expect(onchange).toHaveBeenCalled()
  return onchange.mock.calls.at(-1)![0] as FilterState
}

/**
 * The number binding updates its draft on `input`; the panel commits on
 * `change` (blur/Enter). jsdom sanitizes number-input values mid-typing, so
 * completed entries are simulated directly — the same sequence a real
 * blur/Enter produces.
 */
async function commitBeds(value: string): Promise<void> {
  const input = screen.getByLabelText('Minimum beds / units')
  await fireEvent.input(input, { target: { value } })
  await fireEvent.change(input)
}

describe('FilterPanel', () => {
  describe('option groups', () => {
    it('renders all six groups with the full option lists', () => {
      renderPanel()
      const expected: readonly (readonly [string, number])[] = [
        ['Classification', 4],
        ['Housing category', 13],
        ['Ward', 9],
        ['Gender served', 4],
        ['Household type', 4],
        ['Rent / program cost', 4],
      ]
      for (const [legend, count] of expected) {
        const group = screen.getByRole('group', { name: legend })
        expect(group.querySelectorAll('input[type="checkbox"]')).toHaveLength(count)
      }
    })

    it('labels options in human-readable form and offers no citywide ward', () => {
      renderPanel()
      expect(checkbox('General housing — reentry access possible')).toBeInTheDocument()
      expect(checkbox('Verified reentry housing')).toBeInTheDocument()
      expect(checkbox('Permanent supportive')).toBeInTheDocument()
      expect(checkbox('Emergency shelter')).toBeInTheDocument()
      expect(checkbox('SRO')).toBeInTheDocument()
      const wardGroup = screen.getByRole('group', { name: 'Ward' })
      expect(within(wardGroup).getByRole('checkbox', { name: 'Ward 3' })).toBeInTheDocument()
      expect(
        within(wardGroup).getByRole('checkbox', { name: 'Not listed / unknown' }),
      ).toBeInTheDocument()
      expect(checkbox('All genders')).toBeInTheDocument()
      expect(checkbox('Individuals and families')).toBeInTheDocument()
      expect(checkbox('Income based')).toBeInTheDocument()
      // 'citywide' is a record value, never a ward selection.
      expect(screen.queryByRole('checkbox', { name: /citywide/i })).not.toBeInTheDocument()
    })

    it('starts with nothing checked and empty text inputs', () => {
      renderPanel()
      for (const box of screen.getAllByRole('checkbox')) {
        expect(box).not.toBeChecked()
      }
      expect(screen.getByLabelText('Search programs')).toHaveValue('')
      // jest-dom parses empty number-input values to null, so assert the raw
      // DOM value for "genuinely blank".
      expect((screen.getByLabelText('Minimum beds / units') as HTMLInputElement).value).toBe('')
    })
  })

  describe('checkbox commits', () => {
    it('commits the complete draft with the checked option included', async () => {
      const { onchange } = renderPanel()
      await userEvent.click(checkbox('Permanent supportive'))

      expect(onchange).toHaveBeenCalledTimes(1)
      expect(onchange).toHaveBeenCalledWith({
        classifications: [],
        housingCategories: ['permanent-supportive'],
        wards: [],
        gendersServed: [],
        householdTypes: [],
        rentCostCategories: [],
        searchText: '',
        minBedsUnits: null,
      })
    })

    it('removes an option from the payload when unchecked', async () => {
      const { onchange } = renderPanel(filtersWith({ wards: [3, 5] }))
      expect(checkbox('Ward 3').checked).toBe(true)

      await userEvent.click(checkbox('Ward 3'))

      expect(lastPayload(onchange).wards).toEqual([5])
    })

    it('supports multiple selections within one group', async () => {
      const { onchange } = renderPanel()

      await userEvent.click(checkbox('Free'))
      await userEvent.click(checkbox('Income based'))

      expect(lastPayload(onchange).rentCostCategories).toEqual(['free', 'income-based'])
    })

    it('commits immediately with the newly toggled value (no stale binding state)', async () => {
      const { onchange } = renderPanel()
      const box = checkbox('Ward 4')

      await userEvent.click(box) // check → committed payload contains it
      expect(onchange).toHaveBeenCalledTimes(1)
      expect(lastPayload(onchange).wards).toContain(4)

      await userEvent.click(box) // uncheck → committed payload drops it
      expect(onchange).toHaveBeenCalledTimes(2)
      expect(lastPayload(onchange).wards).not.toContain(4)
    })

    it('clear-wards deselects every ward and commits the empty selection', async () => {
      const { onchange } = renderPanel(filtersWith({ wards: [2, 7] }))

      await userEvent.click(screen.getByRole('button', { name: 'Clear wards' }))

      expect(lastPayload(onchange).wards).toEqual([])
      expect(checkbox('Ward 2').checked).toBe(false)
      expect(checkbox('Ward 7').checked).toBe(false)
    })
  })

  describe('search', () => {
    it('does not commit per keystroke — only on change', async () => {
      const { onchange } = renderPanel()
      const input = screen.getByLabelText('Search programs')

      await userEvent.type(input, 'shelter')
      expect(onchange).not.toHaveBeenCalled()

      await fireEvent.change(input)
      expect(onchange).toHaveBeenCalledTimes(1)
      expect(lastPayload(onchange).searchText).toBe('shelter')
      // Raw passthrough: the payload equals the input's value.
      expect(lastPayload(onchange).searchText).toBe((input as HTMLInputElement).value)
    })

    it('passes search text through raw; trimming is the filters’ job', async () => {
      const { onchange } = renderPanel()
      const input = screen.getByLabelText('Search programs')

      await userEvent.type(input, '  some ')
      await fireEvent.change(input)

      expect(lastPayload(onchange).searchText).toBe('  some ')
    })

    it('commits on Enter', async () => {
      const { onchange } = renderPanel()

      await userEvent.type(screen.getByLabelText('Search programs'), 'sober living{Enter}')

      expect(onchange).toHaveBeenCalledTimes(1)
      expect(lastPayload(onchange).searchText).toBe('sober living')
    })
  })

  describe('minimum beds / units', () => {
    it('commits a valid count as a number', async () => {
      const { onchange } = renderPanel()

      await commitBeds('5')

      expect(lastPayload(onchange).minBedsUnits).toBe(5)
    })

    it('commits an emptied input as null (unrestricted)', async () => {
      const { onchange } = renderPanel(filtersWith({ minBedsUnits: 5 }))
      const input = screen.getByLabelText('Minimum beds / units')
      expect(input).toHaveValue(5)

      await userEvent.clear(input)
      await fireEvent.change(input)

      expect(lastPayload(onchange).minBedsUnits).toBe(null)
    })

    it.each(['-2', '1.5'])('rejects %s without committing and shows an error', async (value) => {
      const { onchange } = renderPanel()

      await commitBeds(value)

      expect(screen.getByRole('alert')).toHaveTextContent(/whole number/i)
      expect(onchange).not.toHaveBeenCalled()
    })

    it('rejects unparseable text (abc) without committing', async () => {
      const { onchange } = renderPanel()
      const input = screen.getByLabelText('Minimum beds / units') as HTMLInputElement

      // jsdom sanitizes number-input values ('abc' → ''), so the raw text is
      // injected at the property level — what a real browser sees before
      // sanitization. The binding then reads the unparseable value (NaN).
      let raw: string | number = 'abc'
      Object.defineProperty(input, 'value', {
        configurable: true,
        get: () => raw,
        set: (next: string | number) => {
          raw = next
        },
      })

      await fireEvent.input(input)
      await fireEvent.change(input)

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(onchange).not.toHaveBeenCalled()
    })

    it('an invalid beds draft blocks a simultaneous checkbox commit', async () => {
      const { onchange } = renderPanel()

      await commitBeds('1.5')
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(onchange).not.toHaveBeenCalled()

      await userEvent.click(checkbox('Transitional'))
      expect(onchange).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  describe('prop resync and reset', () => {
    it('resyncs drafts when the parent passes updated filters', async () => {
      const onchange = vi.fn()
      const onreset = vi.fn()
      const { rerender } = render(FilterPanel, {
        props: { filters: defaultFilters(), onchange, onreset },
      })

      await userEvent.click(checkbox('Ward 3'))
      expect(checkbox('Ward 3').checked).toBe(true)

      await rerender({
        filters: filtersWith({
          wards: [5],
          housingCategories: ['sro'],
          searchText: 'sober',
          minBedsUnits: 12,
        }),
        onchange,
        onreset,
      })
      await tick()

      expect(checkbox('Ward 3').checked).toBe(false)
      expect(checkbox('Ward 5').checked).toBe(true)
      expect(checkbox('SRO').checked).toBe(true)
      expect(screen.getByLabelText('Search programs')).toHaveValue('sober')
      expect(screen.getByLabelText('Minimum beds / units')).toHaveValue(12)
    })

    it('reset clears every draft, the error, and calls onreset', async () => {
      const { onreset } = renderPanel()
      await userEvent.click(checkbox('Ward 2'))
      await userEvent.click(checkbox('Men'))
      await commitBeds('1.5')
      expect(screen.getByRole('alert')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }))

      expect(onreset).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      for (const box of screen.getAllByRole('checkbox')) {
        expect(box).not.toBeChecked()
      }
      expect(screen.getByLabelText('Search programs')).toHaveValue('')
      expect((screen.getByLabelText('Minimum beds / units') as HTMLInputElement).value).toBe('')
    })

    it('associates the validation error via role="alert" and aria-describedby', async () => {
      renderPanel()

      await commitBeds('1.5')

      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('id', 'filter-error')
      const beds = screen.getByLabelText('Minimum beds / units')
      expect(beds).toHaveAttribute('aria-invalid', 'true')
      expect(beds).toHaveAttribute('aria-describedby', 'filter-error')
    })
  })
})
