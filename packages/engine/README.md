# @couchpotatoes/engine

The core game engine for [CouchPotatoes](https://couchpotatoes.eigen1.com): game state, turns, moves, validation and seeded randomness.

> ⚠️ **Early skeleton (v0.0.0).** The APIs below are a starting point for the open RFCs: state model ([#1](https://github.com/eigenone/couchpotatoes-oss/issues/1)), turns and phases ([#2](https://github.com/eigenone/couchpotatoes-oss/issues/2)), randomness ([#3](https://github.com/eigenone/couchpotatoes-oss/issues/3)) and move validation ([#4](https://github.com/eigenone/couchpotatoes-oss/issues/4)). Expect breaking changes. Feedback is very welcome.

## Example

```ts
import { createGame, defineGame, invalid, standardDeck, type Card } from '@couchpotatoes/engine'

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
  },

  endIf: ({ state }) => {
    if (state.hands.some((h) => h.length === 0)) return undefined
    const best = Math.max(...state.hands.map((h) => h[0]!.rank))
    return { winners: state.hands.flatMap((h, seat) => (h[0]!.rank === best ? [seat] : [])) }
  },
})

const game = createGame(highCard, { numPlayers: 2, seed: 'game-night' })
game.move('draw') // player 0
game.move('draw') // player 1
console.log(game.result) // { winners: [...] }
```

## Concepts

- **`defineGame(def)`** describes a game: player count, `setup`, `moves`, optional `turn` config and `endIf`.
- **Moves** receive a working copy of the state and mutate it. Return `invalid(reason)` to reject a move; a rejected move leaves no trace.
- **Turns** pass automatically after `turn.movesPerTurn` moves (default 1), `clockwise` (default) or `counterclockwise`.
- **Seeded randomness**: `random.d6()`, `random.roll(2, 6)`, `random.shuffle(items)`, `random.pick(items)`. The engine never uses `Math.random()`.
- **Replays**: `replay(def, { numPlayers, seed, log })` rebuilds a game exactly from its seed and move log.

## License

MIT
