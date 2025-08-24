package game

import "testing"

func ptFromTotal(N, total int) Point {
	return Point{x: total / N, y: total % N, totalPos: total}
}

func TestChainedLadders(t *testing.T) {
	N := 10
	g := New(N)
	// deterministic layout: two ladders chaining
	g.snakes = nil
	g.ladders = []Ladder{
		{top: ptFromTotal(N, 23), bottom: ptFromTotal(N, 5)},  // 6th square -> 24th
		{top: ptFromTotal(N, 47), bottom: ptFromTotal(N, 23)}, // 24th -> 48th
	}
	_ = g.AddPlayer("A")
	_ = g.AddPlayer("B")
	p := &g.players[0]
	// from start, roll 6 to land at total=5 (zero-based). Expect chain to 47.
	moved := g.rolledDice(p, 6)
	if !moved { t.Fatalf("expected move") }
	if p.Position.totalPos != 47 {
		t.Fatalf("expected chained ladder end at 47, got %d (x=%d y=%d)", p.Position.totalPos, p.Position.x, p.Position.y)
	}
}

func TestChainedSnakes(t *testing.T) {
	N := 10
	g := New(N)
	// deterministic layout: two snakes chaining
	g.ladders = nil
	g.snakes = []Snake{
		{head: ptFromTotal(N, 30), tail: ptFromTotal(N, 12)}, // 31st -> 13th
		{head: ptFromTotal(N, 12), tail: ptFromTotal(N, 3)},  // 13th -> 4th
	}
	_ = g.AddPlayer("A")
	_ = g.AddPlayer("B")
	p := &g.players[0]
	// place pawn at total=29 (30th), roll 1 to hit snake at 30 and chain to 3
	p.Position = ptFromTotal(N, 29)
	moved := g.rolledDice(p, 1)
	if !moved { t.Fatalf("expected move") }
	if p.Position.totalPos != 3 {
		t.Fatalf("expected chained snake end at 3, got %d (x=%d y=%d)", p.Position.totalPos, p.Position.x, p.Position.y)
	}
}
