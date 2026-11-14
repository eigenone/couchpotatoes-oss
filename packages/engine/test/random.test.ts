import { describe, expect, it } from 'vitest'
import { createRandom } from '../src/index.js'

describe('createRandom', () => {
  it('is deterministic for the same numeric or string seed', () => {
    const seq = (seed: number | string) => {
      const r = createRandom(seed)
      return Array.from({ length: 20 }, () => r.nextUint32())
    }
    expect(seq(42)).toEqual(seq(42))
    expect(seq('game-night')).toEqual(seq('game-night'))
    expect(seq(42)).not.toEqual(seq(43))
  })

  it('can be saved and restored mid-sequence', () => {
    const a = createRandom(7)
    a.next(); a.next()
    const b = createRandom(7, a.getState())
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(Array.from({ length: 5 }, () => a.next()))
  })

  it('next() stays in [0, 1)', () => {
    const r = createRandom(1)
    for (let i = 0; i < 10_000; i++) {
      const x = r.next()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('int() covers the inclusive range and nothing outside it', () => {
    const r = createRandom(99)
    const seen = new Set<number>()
    for (let i = 0; i < 5_000; i++) {
      const x = r.int(-2, 3)
      expect(x).toBeGreaterThanOrEqual(-2)
      expect(x).toBeLessThanOrEqual(3)
      seen.add(x)
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2, 3])
  })

  it('d6() is roughly uniform', () => {
    const r = createRandom('dice')
    const counts = [0, 0, 0, 0, 0, 0]
    const n = 60_000
    for (let i = 0; i < n; i++) counts[r.d6() - 1]!++
    for (const c of counts) expect(Math.abs(c - n / 6)).toBeLessThan(n / 6 * 0.05)
  })

  it('roll() returns the requested number of dice', () => {
    const dice = createRandom(3).roll(4, 8)
    expect(dice).toHaveLength(4)
    for (const d of dice) {
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(8)
    }
  })

  it('shuffle() returns a permutation and leaves the input alone', () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const out = createRandom(5).shuffle(input)
    expect(out).not.toBe(input)
    expect([...out].sort((a, b) => a - b)).toEqual([...input])
    expect(out).not.toEqual([...input])
  })

  it('pick() picks from the array', () => {
    expect(['a', 'b', 'c']).toContain(createRandom(1).pick(['a', 'b', 'c']))
  })

  it('rejects bad arguments', () => {
    const r = createRandom(1)
    expect(() => r.int(5, 1)).toThrow(RangeError)
    expect(() => r.int(1.5, 3)).toThrow(RangeError)
    expect(() => r.roll(-1, 6)).toThrow(RangeError)
    expect(() => r.roll(1, 0)).toThrow(RangeError)
    expect(() => r.pick([])).toThrow(RangeError)
  })
})
