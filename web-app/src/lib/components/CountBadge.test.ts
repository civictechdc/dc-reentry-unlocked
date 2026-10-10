import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import CountBadge from './CountBadge.svelte'

describe('CountBadge', () => {
  it('renders the count with plural houses', () => {
    render(CountBadge, { props: { count: 5 } })

    expect(screen.getByText('5 houses')).toBeInTheDocument()
  })

  it('uses singular for one house', () => {
    render(CountBadge, { props: { count: 1 } })

    expect(screen.getByText('1 house')).toBeInTheDocument()
  })

  it('announces updates politely', () => {
    render(CountBadge, { props: { count: 3 } })

    expect(screen.getByText('3 houses')).toHaveAttribute('aria-live', 'polite')
  })
})
