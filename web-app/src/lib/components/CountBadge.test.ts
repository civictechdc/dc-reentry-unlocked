import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import CountBadge from './CountBadge.svelte'

describe('CountBadge', () => {
  it('renders the count with plural programs', () => {
    render(CountBadge, { props: { count: 5 } })

    expect(screen.getByText('5 programs')).toBeInTheDocument()
  })

  it('uses singular for one program', () => {
    render(CountBadge, { props: { count: 1 } })

    expect(screen.getByText('1 program')).toBeInTheDocument()
  })

  it('announces updates politely', () => {
    render(CountBadge, { props: { count: 3 } })

    expect(screen.getByText('3 programs')).toHaveAttribute('aria-live', 'polite')
  })
})
