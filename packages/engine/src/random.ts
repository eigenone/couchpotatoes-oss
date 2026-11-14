/**
 * Seeded, deterministic randomness.
 *
 * The engine never calls `Math.random()`. Every roll and shuffle comes from a
 * seeded generator, so the same seed plus the same sequence of moves always
 * produces the same game. That makes replays, tests and server-authoritative
 * multiplayer possible. See issue #3.
 */

export interface Random {
  /** Next unsigned 32-bit integer. */
  nextUint32(): number
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max], inclusive, without modulo bias. */
  int(min: number, max: number): number
  /** Roll a single six-sided die: 1-6. */
  d6(): number
  /** Roll `count` dice with `sides` sides each, e.g. `roll(2, 6)` for 2d6. */
  roll(count: number, sides: number): number[]
  /** Return a new array with the items shuffled (Fisher-Yates). The input is not modified. */
  shuffle<T>(items: readonly T[]): T[]
  /** Pick one item uniformly at random. Throws on an empty array. */
  pick<T>(items: readonly T[]): T
  /** Current internal state, so a generator can be saved and restored. */
  getState(): number
}

const UINT32 = 2 ** 32

/** Hash a string seed into a 32-bit integer (FNV-1a). */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Create a seeded generator. Uses mulberry32: tiny, fast and statistically
 * solid for games. It is not cryptographically secure.
 */
export function createRandom(seed: number | string, state?: number): Random {
  let s = state ?? (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0)

  const nextUint32 = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new RangeError(`int() needs integer bounds, got ${min} and ${max}`)
    }
    if (max < min) throw new RangeError(`int() max (${max}) is less than min (${min})`)
    const range = max - min + 1
    if (range > UINT32) throw new RangeError('int() range must fit in 32 bits')
    // Rejection sampling removes modulo bias.
    const limit = UINT32 - (UINT32 % range)
    let x = nextUint32()
    while (x >= limit) x = nextUint32()
    return min + (x % range)
  }

  return {
    nextUint32,
    next: () => nextUint32() / UINT32,
    int,
    d6: () => int(1, 6),
    roll(count, sides) {
      if (!Number.isInteger(count) || count < 0) throw new RangeError(`roll() count must be a non-negative integer, got ${count}`)
      if (!Number.isInteger(sides) || sides < 1) throw new RangeError(`roll() sides must be a positive integer, got ${sides}`)
      return Array.from({ length: count }, () => int(1, sides))
    },
    shuffle(items) {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i)
        ;[out[i], out[j]] = [out[j] as (typeof out)[number], out[i] as (typeof out)[number]]
      }
      return out
    },
    pick(items) {
      if (items.length === 0) throw new RangeError('pick() called on an empty array')
      return items[int(0, items.length - 1)] as (typeof items)[number]
    },
    getState: () => s,
  }
}
