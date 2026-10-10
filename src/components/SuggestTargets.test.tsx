import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TargetsSettingsPage from '../pages/TargetsSettingsPage'
import { renderWithApp } from '../test/renderWithApp'
import { DEFAULT_GOALS, DEFAULT_META } from '../storage/repository'

const reply = (text: string, status = 200) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status })

const SUGGESTION = JSON.stringify({
  goals: { kcal: 2100, fat: 70, satFat: 21, carbs: 210, fibre: 30, protein: 125, salt: 6 },
  rationale: 'Maintenance around 2500 kcal, 15% under for a steady loss.',
  caveat: 'Assumed moderate activity.',
})

const renderTargets = (geminiApiKey?: string) =>
  renderWithApp(<TargetsSettingsPage />, {
    path: '/settings/targets',
    route: '/settings/targets',
    state: { goals: DEFAULT_GOALS, meta: { ...DEFAULT_META, geminiApiKey } },
  })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('suggesting targets', () => {
  it('stays out of the way until it is asked for', () => {
    renderTargets('key')
    expect(screen.queryByLabelText('About you')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suggest targets for me' })).toBeInTheDocument()
    // The boxes are still there to type into, which is still the normal way.
    expect(screen.getByLabelText(/Calories/)).toHaveValue(DEFAULT_GOALS.kcal)
  })

  it('fills the boxes in from a description, without saving anything', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(SUGGESTION)))
    const user = userEvent.setup()
    renderTargets('key')

    await user.click(screen.getByRole('button', { name: 'Suggest targets for me' }))
    await user.type(screen.getByLabelText('About you'), '38, 178cm, 82kg, desk job')
    await user.click(screen.getByRole('button', { name: 'Suggest targets' }))

    expect(await screen.findByText(/Filled in below/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Calories/)).toHaveValue(2100)
    expect(screen.getByLabelText(/^Protein/)).toHaveValue(125)
    // Still only a suggestion: Save is what commits it.
    expect(screen.getByRole('button', { name: /Save/ })).toBeInTheDocument()
  })

  it('shows the reasoning and anything it had to assume', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(SUGGESTION)))
    const user = userEvent.setup()
    renderTargets('key')

    await user.click(screen.getByRole('button', { name: 'Suggest targets for me' }))
    await user.type(screen.getByLabelText('About you'), 'anything')
    await user.click(screen.getByRole('button', { name: 'Suggest targets' }))

    expect(await screen.findByText(/Maintenance around 2500 kcal/)).toBeInTheDocument()
    expect(screen.getByText('Assumed moderate activity.')).toBeInTheDocument()
  })

  it('says where to get a key instead of failing silently', async () => {
    const user = userEvent.setup()
    renderTargets(undefined)

    await user.click(screen.getByRole('button', { name: 'Suggest targets for me' }))
    await user.type(screen.getByLabelText('About you'), 'anything')
    await user.click(screen.getByRole('button', { name: 'Suggest targets' }))

    expect(await screen.findByText(/Gemini API key in Settings/)).toBeInTheDocument()
  })

  it('leaves the existing targets alone when the suggestion is unsafe', async () => {
    const unsafe = JSON.stringify({
      goals: { kcal: 800, fat: 20, satFat: 6, carbs: 60, fibre: 20, protein: 60, salt: 3 },
      rationale: 'As requested.',
      caveat: null,
    })
    vi.stubGlobal('fetch', vi.fn(async () => reply(unsafe)))
    const user = userEvent.setup()
    renderTargets('key')

    await user.click(screen.getByRole('button', { name: 'Suggest targets for me' }))
    await user.type(screen.getByLabelText('About you'), 'crash diet please')
    await user.click(screen.getByRole('button', { name: 'Suggest targets' }))

    expect(await screen.findByText(/No sensible targets/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Calories/)).toHaveValue(DEFAULT_GOALS.kcal)
  })

  it('will not send an empty description', async () => {
    const user = userEvent.setup()
    renderTargets('key')

    await user.click(screen.getByRole('button', { name: 'Suggest targets for me' }))
    expect(screen.getByRole('button', { name: 'Suggest targets' })).toBeDisabled()
  })
})
