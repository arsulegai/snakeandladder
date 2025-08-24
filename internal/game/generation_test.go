package game

import (
	"testing"
)

// These tests validate generation constraints.

func TestNoDuplicateLadderBottoms(t *testing.T) {
	g := New(10)
	st := g.State()
	seen := map[int]struct{}{}
	for _, l := range st.Ladders {
		key := l.bottom.x*st.GridSize + l.bottom.y
		if _, ok := seen[key]; ok { t.Fatalf("duplicate ladder bottoms detected (two ladders from same place)") }
		seen[key] = struct{}{}
	}
}

func TestNoDuplicateSnakeHeads(t *testing.T) {
	g := New(10)
	st := g.State()
	seen := map[int]struct{}{}
	for _, s := range st.Snakes {
		key := s.head.x*st.GridSize + s.head.y
		if _, ok := seen[key]; ok { t.Fatalf("duplicate snake heads detected") }
		seen[key] = struct{}{}
	}
}

func TestNoSnakeHeadAtLadderTop(t *testing.T) {
	g := New(10)
	st := g.State()
	tops := map[int]struct{}{}
	for _, l := range st.Ladders { tops[l.top.x*st.GridSize + l.top.y] = struct{}{} }
	for _, s := range st.Snakes {
		if _, clash := tops[s.head.x*st.GridSize + s.head.y]; clash {
			t.Fatalf("snake head placed on ladder top (immediate bite after climb)")
		}
	}
}

func TestEndpointsValidAndOrdered(t *testing.T) {
	g := New(10)
	st := g.State()
	// all ladder.top above ladder.bottom; all snake.head above snake.tail; endpoints are inside board
	for _, l := range st.Ladders {
		if !(l.top.x > l.bottom.x) { t.Fatalf("ladder top must be above bottom: %+v", l) }
		if l.top.x < 0 || l.top.y < 0 || l.bottom.x < 0 || l.bottom.y < 0 { t.Fatalf("ladder endpoints outside board") }
		if l.top.x >= st.GridSize || l.top.y >= st.GridSize || l.bottom.x >= st.GridSize || l.bottom.y >= st.GridSize { t.Fatalf("ladder endpoints outside board") }
	}
	for _, s := range st.Snakes {
		if !(s.head.x > s.tail.x) { t.Fatalf("snake head must be above tail: %+v", s) }
		if s.head.x < 0 || s.head.y < 0 || s.tail.x < 0 || s.tail.y < 0 { t.Fatalf("snake endpoints outside board") }
		if s.head.x >= st.GridSize || s.head.y >= st.GridSize || s.tail.x >= st.GridSize || s.tail.y >= st.GridSize { t.Fatalf("snake endpoints outside board") }
	}
}
