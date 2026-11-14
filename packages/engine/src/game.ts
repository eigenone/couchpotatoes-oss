/**
 * Core game definition and runtime.
 *
 * This is an initial skeleton. The state model (#1), turns and phases (#2) and
 * move validation (#4) are still open RFCs, so expect these APIs to change.
 */
import { createRandom, type Random } from './random.js'

/** Returned from a move to reject it. The state is left untouched. */
export interface InvalidMove {
  readonly invalid: true
  readonly reason: string
}

/** Reject a move with a human-readable reason. */
export function invalid(reason: string): InvalidMove {
  return { invalid: true, reason }
}

function isInvalid(value: unknown): value is InvalidMove {
  return typeof value === 'object' && value !== null && (value as InvalidMove).invalid === true
}

export interface MoveContext<S> {
  /** A working copy of the state. Mutate it freely; it is committed only if the move succeeds. */
  state: S
  /** Seat index of the player making the move (0-based). */
  player: number
  numPlayers: number
  random: Random
}

export type MoveFn<S> = (ctx: MoveContext<S>, ...args: any[]) => void | InvalidMove

export type MoveArgs<F> = F extends (ctx: never, ...args: infer A) => unknown ? A : never

export interface GameResult {
  /** Winning seats. Empty for a draw. */
  winners: number[]
}

export interface TurnConfig {
  order?: 'clockwise' | 'counterclockwise'
  /** Moves each player makes before the turn passes. Defaults to 1. */
  movesPerTurn?: number
}

export interface GameDefinition<S, M extends Record<string, MoveFn<S>>> {
  name: string
  players: { min: number; max: number }
  setup(ctx: { numPlayers: number; random: Random }): S
  moves: M
  turn?: TurnConfig
  /** Checked after every successful move. Return a result to end the game. */
  endIf?(ctx: { state: S; numPlayers: number }): GameResult | undefined
}

/** Identity function that gives you full type inference for a game definition. */
export function defineGame<S, M extends Record<string, MoveFn<S>>>(def: GameDefinition<S, M>): GameDefinition<S, M> {
  return def
}

export interface LogEntry {
  player: number
  move: string
  args: unknown[]
}

export type MoveResult = { ok: true } | { ok: false; reason: string }

export interface GameOptions {
  numPlayers: number
  seed: number | string
}

export interface Game<S, M extends Record<string, MoveFn<S>>> {
  /** A copy of the current state. Mutating it does not affect the game. */
  readonly state: S
  readonly currentPlayer: number
  /** Turn number, starting at 1. */
  readonly turn: number
  readonly numPlayers: number
  /** Every successful move, in order. Together with the seed, this replays the game exactly. */
  readonly log: readonly LogEntry[]
  readonly result: GameResult | undefined
  /** Make a move as the current player. */
  move<K extends keyof M & string>(name: K, ...args: MoveArgs<M[K]>): MoveResult
}

export function createGame<S, M extends Record<string, MoveFn<S>>>(
  def: GameDefinition<S, M>,
  options: GameOptions,
): Game<S, M> {
  const { numPlayers, seed } = options
  if (!Number.isInteger(numPlayers) || numPlayers < def.players.min || numPlayers > def.players.max) {
    throw new RangeError(`${def.name} needs ${def.players.min}-${def.players.max} players, got ${numPlayers}`)
  }

  const movesPerTurn = def.turn?.movesPerTurn ?? 1
  const step = def.turn?.order === 'counterclockwise' ? -1 : 1
  if (!Number.isInteger(movesPerTurn) || movesPerTurn < 1) {
    throw new RangeError(`turn.movesPerTurn must be a positive integer, got ${movesPerTurn}`)
  }

  let rngState = createRandom(seed).getState()
  const setupRandom = createRandom(seed, rngState)
  let state = def.setup({ numPlayers, random: setupRandom })
  rngState = setupRandom.getState()

  let currentPlayer = 0
  let turn = 1
  let movesThisTurn = 0
  let result: GameResult | undefined
  const log: LogEntry[] = []

  const fail = (reason: string): MoveResult => ({ ok: false, reason })

  return {
    get state() { return structuredClone(state) },
    get currentPlayer() { return currentPlayer },
    get turn() { return turn },
    get numPlayers() { return numPlayers },
    get log() { return log.map((e) => ({ ...e, args: structuredClone(e.args) })) },
    get result() { return result && { winners: [...result.winners] } },

    move(name, ...args) {
      if (result) return fail('The game is over')
      if (!Object.hasOwn(def.moves, name)) return fail(`Unknown move "${name}"`)
      const moveFn = def.moves[name] as MoveFn<S>

      // Run the move against copies so a rejected move leaves no trace.
      const draft = structuredClone(state)
      const random = createRandom(seed, rngState)
      const outcome = moveFn({ state: draft, player: currentPlayer, numPlayers, random }, ...args)
      if (isInvalid(outcome)) return fail(outcome.reason)

      state = draft
      rngState = random.getState()
      log.push({ player: currentPlayer, move: name, args: structuredClone(args) })

      result = def.endIf?.({ state: structuredClone(state), numPlayers })
      if (!result && ++movesThisTurn >= movesPerTurn) {
        movesThisTurn = 0
        currentPlayer = (((currentPlayer + step) % numPlayers) + numPlayers) % numPlayers
        turn++
      }
      return { ok: true }
    },
  }
}

/**
 * Rebuild a game from its seed and move log. Because all randomness is seeded,
 * the result is identical to the original game.
 */
export function replay<S, M extends Record<string, MoveFn<S>>>(
  def: GameDefinition<S, M>,
  options: GameOptions & { log: readonly LogEntry[] },
): Game<S, M> {
  const game = createGame(def, options)
  for (const [i, entry] of options.log.entries()) {
    if (entry.player !== game.currentPlayer) {
      throw new Error(`Replay diverged at move ${i}: expected player ${game.currentPlayer}, log says ${entry.player}`)
    }
    const res = (game.move as (name: string, ...args: unknown[]) => MoveResult)(entry.move, ...entry.args)
    if (!res.ok) throw new Error(`Replay failed at move ${i} (${entry.move}): ${res.reason}`)
  }
  return game
}
