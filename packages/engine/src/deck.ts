export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
/** 1 = Ace, 11 = Jack, 12 = Queen, 13 = King. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

export interface Card {
  suit: Suit
  rank: Rank
}

const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

/** A fresh, ordered 52-card deck. Shuffle it with `random.shuffle()`. */
export function standardDeck(): Card[] {
  return SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, i) => ({ suit, rank: (i + 1) as Rank })))
}
