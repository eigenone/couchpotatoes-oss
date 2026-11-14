import { describe, expect, it } from 'vitest'
import { createGame, defineGame, invalid, replay, standardDeck, type Card } from '../src/index.js'

/** High Card: everyone draws one card; the highest rank wins (Ace high). Public domain. */
const highCard = defineGame({
  name: 'High Card',
  players: { min: 2, max: 6 },
  setup: ({ numPlayers, random }) => ({
    deck: random.shuffle(standardDeck()),
    hands: Array.from({ length: numPlayers }, () => [] as Card[]),
  }),
  moves: {
    draw: ({ state, player }) => {
      if (state.hands[player]!.length > 0) return invalid('You already drew a card')
      state.hands[player]!.push(state.deck.pop()!)
    },
    peek: ({ state }, index: number) => {
      if (index < 0 || index >= state.deck.length) return invalid('No card there')
    },
  },
  endIf: ({ state }) => {
    if (state.hands.some((h) => h.length === 0)) return undefined
    const value = (c: Card) => (c.rank === 1 ? 14 : c.rank)
    const best = Math.max(...state.hands.map((h) => value(h[0]!)))
    return { winners: state.hands.flatMap((h, seat) => (value(h[0]!) === best ? [seat] : [])) }
  },
})

describe('createGame', () => {
  it('sets up deterministically from the seed', () => {
    const a = createGame(highCard, { numPlayers: 3, seed: 'abc' })
    const b = createGame(highCard, { numPlayers: 3, seed: 'abc' })
    const c = createGame(highCard, { numPlayers: 3, seed: 'xyz' })
    expect(a.state).toEqual(b.state)
    expect(a.state.deck).not.toEqual(c.state.deck)
    expect(a.state.deck).toHaveLength(52)
  })

  it('passes the turn clockwise after each move', () => {
    const g = createGame(highCard, { numPlayers: 3, seed: 1 })
    expect([g.currentPlayer, g.turn]).toEqual([0, 1])
    expect(g.move('draw')).toEqual({ ok: true })
    expect([g.currentPlayer, g.turn]).toEqual([1, 2])
    g.move('draw')
    expect(g.currentPlayer).toBe(2)
  })

  it('supports counterclockwise order and several moves per turn', () => {
    const g = createGame(
      { ...highCard, turn: { order: 'counterclockwise', movesPerTurn: 2 } },
      { numPlayers: 3, seed: 1 },
    )
    g.move('peek', 0)
    expect(g.currentPlayer).toBe(0)
    g.move('peek', 1)
    expect(g.currentPlayer).toBe(2)
  })

  it('rejects invalid moves without changing state, turn or log', () => {
    const g = createGame(highCard, { numPlayers: 2, seed: 1 })
    const before = g.state
    expect(g.move('peek', 99)).toEqual({ ok: false, reason: 'No card there' })
    expect(g.state).toEqual(before)
    expect(g.currentPlayer).toBe(0)
    expect(g.log).toHaveLength(0)
  })

  it('rejects unknown moves', () => {
    const g = createGame(highCard, { numPlayers: 2, seed: 1 })
    // @ts-expect-error: "cheat" is not a move
    expect(g.move('cheat')).toEqual({ ok: false, reason: 'Unknown move "cheat"' })
  })

  it('ends the game and blocks further moves', () => {
    const g = createGame(highCard, { numPlayers: 2, seed: 'final' })
    g.move('draw')
    expect(g.result).toBeUndefined()
    g.move('draw')
    expect(g.result?.winners.length).toBeGreaterThan(0)
    expect(g.move('peek', 0)).toEqual({ ok: false, reason: 'The game is over' })
  })

  it('does not leak internal state', () => {
    const g = createGame(highCard, { numPlayers: 2, seed: 1 })
    const s = g.state
    s.deck.length = 0
    expect(g.state.deck).toHaveLength(52)
  })

  it('validates the player count', () => {
    expect(() => createGame(highCard, { numPlayers: 1, seed: 1 })).toThrow(/2-6 players/)
    expect(() => createGame(highCard, { numPlayers: 7, seed: 1 })).toThrow(RangeError)
  })
})

describe('replay', () => {
  it('reproduces a game exactly from its seed and log', () => {
    const original = createGame(highCard, { numPlayers: 4, seed: 2026 })
    for (let i = 0; i < 4; i++) original.move('draw')
    const copy = replay(highCard, { numPlayers: 4, seed: 2026, log: original.log })
    expect(copy.state).toEqual(original.state)
    expect(copy.result).toEqual(original.result)
  })

  it('reports where a tampered log diverges', () => {
    expect(() =>
      replay(highCard, { numPlayers: 2, seed: 1, log: [{ player: 1, move: 'draw', args: [] }] }),
    ).toThrow(/diverged at move 0/)
  })
})
