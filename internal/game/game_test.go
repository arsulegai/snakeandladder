package game

import (
	"testing"
	"time"
)

func TestAddPlayersAndState(t *testing.T) {
	g := New(10)

	// add players should not deadlock and should finish quickly
	done := make(chan struct{})
	go func() {
		if err := g.AddPlayer("Arun"); err != nil { t.Errorf("add player 1: %v", err) }
		if err := g.AddPlayer("Megha"); err != nil { t.Errorf("add player 2: %v", err) }
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("AddPlayer calls timed out (possible deadlock)")
	}

	st := g.State()
	if st.GridSize != 10 { t.Fatalf("expected grid 10, got %d", st.GridSize) }
	if len(st.Players) != 2 { t.Fatalf("expected 2 players, got %d", len(st.Players)) }
}

func TestRollDiceAdvancesTurn(t *testing.T) {
	g := New(10)
	_ = g.AddPlayer("Arun")
	_ = g.AddPlayer("Megha")

	roll, winner, err := g.RollDice()
	if err != nil { t.Fatalf("roll error: %v", err) }
	if roll < 1 || roll > 6 { t.Fatalf("roll out of range: %d", roll) }
	if winner != nil { t.Fatalf("unexpected winner at start: %v", *winner) }

	st := g.State()
	if st.TurnIndex != 1 { t.Fatalf("expected turn index 1, got %d", st.TurnIndex) }
	if st.LastRoll != roll { t.Fatalf("last roll mismatch: %d vs %d", st.LastRoll, roll) }
}
