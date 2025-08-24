package game

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Core types (adapted from terminal version, without fmt prints on gameplay path)

type Point struct {
	x, y      int
	totalPos  int
}

type Snake struct {
	head, tail Point
}

type Ladder struct {
	top, bottom Point
}

type Player struct {
	Position Point  `json:"position"`
	Name     string `json:"name"`
}

type State struct {
	GridSize    int       `json:"gridSize"`
	Players     []Player  `json:"players"`
	Snakes      []Snake   `json:"snakes"`
	Ladders     []Ladder  `json:"ladders"`
	TurnIndex   int       `json:"turnIndex"`
	Winner      *string   `json:"winner,omitempty"`
	LastRoll    int       `json:"lastRoll"`
}

type Game struct {
	mu        sync.Mutex
	gridSize  int
	players   []Player
	snakes    []Snake
	ladders   []Ladder
	turnIndex int
	winner    *string
	lastRoll  int
	// SSE subscribers
	subscribers map[chan []byte]struct{}
}

func New(grid int) *Game {
	g := &Game{
		gridSize:   grid,
		players:    []Player{},
		turnIndex:  0,
		winner:     nil,
		lastRoll:   0,
		subscribers: make(map[chan []byte]struct{}),
	}
	g.generateEntities(grid)
	return g
}

// Public helpers
func (g *Game) GridSize() int { return g.gridSize }

func (g *Game) AddPlayer(name string) error {
	g.mu.Lock()
	if g.winner != nil {
		g.mu.Unlock()
		return errors.New("game already finished")
	}
	for _, p := range g.players {
		if strings.EqualFold(p.Name, name) {
			g.mu.Unlock()
			return errors.New("duplicate player name")
		}
	}
	g.players = append(g.players, Player{Position: Point{-1, -1, -1}, Name: name})
	g.mu.Unlock()
	g.broadcast()
	return nil
}

func (g *Game) RollDice() (int, *string, error) {
	g.mu.Lock()
	if len(g.players) < 2 {
		g.mu.Unlock()
		return 0, nil, errors.New("need at least 2 players")
	}
	if g.winner != nil {
		w := g.winner
		g.mu.Unlock()
		return 0, w, nil
	}
	n := rand.Intn(6) + 1
	g.lastRoll = n
	p := &g.players[g.turnIndex]
	moved := g.rolledDice(p, n)
	if !moved {
		// no move if overflow, but still advance turn
	}
	// check winner
	if p.Position.totalPos == g.gridSize*g.gridSize-1 {
		w := p.Name
		g.winner = &w
	}
	// advance turn
	g.turnIndex = (g.turnIndex + 1) % len(g.players)
	winner := g.winner
	g.mu.Unlock()
	g.broadcast()
	return n, winner, nil
}

func (g *Game) State() State {
	g.mu.Lock()
	defer g.mu.Unlock()
	return State{
		GridSize:  g.gridSize,
		Players:   append([]Player(nil), g.players...),
		Snakes:    append([]Snake(nil), g.snakes...),
		Ladders:   append([]Ladder(nil), g.ladders...),
		TurnIndex: g.turnIndex,
		Winner:    g.winner,
		LastRoll:  g.lastRoll,
	}
}

// SSE support
func (g *Game) Subscribe(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("streaming unsupported"))
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	ch := make(chan []byte, 8)
	g.mu.Lock()
	g.subscribers[ch] = struct{}{}
	g.mu.Unlock()

	// send initial state
	g.sendOn(ch)
	flusher.Flush()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			g.mu.Lock()
			delete(g.subscribers, ch)
			g.mu.Unlock()
			close(ch)
			return
		case msg := <-ch:
			_, _ = fmt.Fprintf(w, "data: %s\n\n", string(msg))
			flusher.Flush()
		}
	}
}

func (g *Game) broadcast() {
	// Snapshot state and subscribers under lock
	state := g.State() // obtains and releases lock internally
	payload, _ := json.Marshal(state)
	g.mu.Lock()
	subs := make([]chan []byte, 0, len(g.subscribers))
	for ch := range g.subscribers {
		subs = append(subs, ch)
	}
	g.mu.Unlock()
	for _, ch := range subs {
		select {
		case ch <- payload:
		default:
			// drop if slow
		}
	}
}

func (g *Game) sendOn(ch chan []byte) {
	payload, _ := json.Marshal(g.State())
	select {
	case ch <- payload:
	default:
	}
}

// Internal logic adapted from original
func (g *Game) generateEntities(num int) {
	rand.Seed(time.Now().UnixNano())
	// Choose counts with sensible minimums and near-equal distribution
	minCount := 3
	maxCount := num/2
	if maxCount < minCount { maxCount = minCount }
	base := rand.Intn(maxCount-minCount+1) + minCount
	// vary by at most 1 between snakes and ladders
	if base < minCount { base = minCount }
	nSnakes := base
	nLadders := base + (rand.Intn(3)-1) // -1,0,+1
	if nLadders < minCount { nLadders = minCount }
	if nLadders > maxCount { nLadders = maxCount }
	// Generate ladders first, enforcing uniqueness of bottoms (and tops for sanity)
	type key struct{ x, y int }
	ladderBottoms := make(map[key]struct{})
	ladderTops := make(map[key]struct{})
	attempts := 0
	for len(g.ladders) < nLadders && attempts < nLadders*200 {
		attempts++
		lad := g.genLadder(num)
		bKey := key{lad.bottom.x, lad.bottom.y}
		tKey := key{lad.top.x, lad.top.y}
		if _, ok := ladderBottoms[bKey]; ok { continue }
		if _, ok := ladderTops[tKey]; ok { continue }
		g.ladders = append(g.ladders, lad)
		ladderBottoms[bKey] = struct{}{}
		ladderTops[tKey] = struct{}{}
	}
	// Generate snakes: unique heads, not at any ladder top, and avoid ladder-bottom/snake-tail ping-pong
	snakeHeads := make(map[key]struct{})
	attempts = 0
	for len(g.snakes) < nSnakes && attempts < nSnakes*200 {
		attempts++
		sn := g.genSnake(num)
		hKey := key{sn.head.x, sn.head.y}
		tKey := key{sn.tail.x, sn.tail.y}
		if _, ok := snakeHeads[hKey]; ok { continue }
		if _, clash := ladderTops[hKey]; clash { continue } // no snake head on ladder top
		// avoid ladder starting at snake tail
		if _, clash := ladderBottoms[tKey]; clash { continue }
		g.snakes = append(g.snakes, sn)
		snakeHeads[hKey] = struct{}{}
	}
	// remove snakes with head at end
	end := Point{num-1, num-1, 0}
	sClean := []Snake{}
	for _, s := range g.snakes {
		if s.head.canExistWhen(&end) { sClean = append(sClean, s) }
	}
	g.snakes = sClean
}

func (g *Game) genSnake(num int) Snake {
	first, second := g.generateEndPoints(num, "snake")
	return Snake{head: *first, tail: *second}
}

func (g *Game) genLadder(num int) Ladder {
	first, second := g.generateEndPoints(num, "ladder")
	return Ladder{top: *first, bottom: *second}
}

func (g *Game) generateEndPoints(num int, entityType string) (*Point, *Point) {
	first := g.getPoint(num)
	second := g.getPoint(num)
	for !(second.canExistWhen(first) && first.canBeOnTop(second) && g.entityTypeCanHave(first, second, entityType)) {
		first = g.getPoint(num)
		second = g.getPoint(num)
	}
	return first, second
}

func (g *Game) getPoint(num int) *Point {
	rand.Seed(time.Now().UnixNano())
	x := rand.Intn(num)
	y := rand.Intn(num)
	for y == x { y = rand.Intn(num) }
	return &Point{x, y, x*g.gridSize + y}
}

func (g *Game) entityTypeCanHave(first *Point, second *Point, entityType string) bool {
	if entityType == "snake" {
		for _, l := range g.ladders {
			if res := l.bottom.canExistWhen(first); !res { return false }
		}
	}
	if entityType == "ladder" {
		for _, s := range g.snakes {
			if res := s.head.canExistWhen(second); !res { return false }
		}
	}
	return true
}

func (p *Point) canExistWhen(another *Point) bool {
	if p.x == another.x && p.y == another.y { return false }
	return true
}
func (p *Point) canBeOnTop(another *Point) bool {
	if p.x <= another.x { return false }
	return true
}

func (g *Game) hitBySnake(num int) (bool, func() int) {
	for _, s := range g.snakes {
		if s.head.totalPos == num {
			return true, func() int { return s.tail.totalPos }
		}
	}
	return false, nil
}
func (g *Game) gotElevated(num int) (bool, func() int) {
	for _, l := range g.ladders {
		if l.bottom.totalPos == num {
			return true, func() int { return l.top.totalPos }
		}
	}
	return false, nil
}

func (g *Game) rolledDice(p *Player, n int) bool {
	var total int
	if p.Position.x != -1 && p.Position.y != -1 {
		total = p.Position.x*g.gridSize + p.Position.y + n
	} else {
		total = n - 1
	}
	if total >= g.gridSize*g.gridSize { return false }
	// Apply chained effects: ladder->ladder, snake->snake, or mixed sequences
	// Continue until no more transitions apply, capped by a safe guard.
	for guard := 0; guard < g.gridSize*g.gridSize; guard++ {
		if ok, f := g.hitBySnake(total); ok {
			total = f()
			continue
		}
		if ok, f := g.gotElevated(total); ok {
			total = f()
			continue
		}
		break
	}
	p.Position.totalPos = total
	p.Position.x = total / g.gridSize
	p.Position.y = total % g.gridSize
	return true
}

// JSON helpers for client
func (p Point) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf("{\"x\":%d,\"y\":%d,\"total\":%d}", p.x, p.y, p.totalPos)), nil
}
func (s Snake) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf("{\"head\":{\"x\":%d,\"y\":%d},\"tail\":{\"x\":%d,\"y\":%d}}", s.head.x, s.head.y, s.tail.x, s.tail.y)), nil
}
func (l Ladder) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf("{\"top\":{\"x\":%d,\"y\":%d},\"bottom\":{\"x\":%d,\"y\":%d}}", l.top.x, l.top.y, l.bottom.x, l.bottom.y)), nil
}

// In-memory registry of games

type Registry struct {
	mu    sync.Mutex
	seq   int
	games map[string]*Game
}

func NewRegistry() *Registry { return &Registry{games: make(map[string]*Game)} }

func (r *Registry) Create(grid int) (string, *Game) {
	r.mu.Lock(); defer r.mu.Unlock()
	r.seq++
	id := strconv.Itoa(r.seq)
	g := New(grid)
	r.games[id] = g
	return id, g
}
func (r *Registry) Get(id string) (*Game, bool) {
	r.mu.Lock(); defer r.mu.Unlock()
	g, ok := r.games[id]
	return g, ok
}
