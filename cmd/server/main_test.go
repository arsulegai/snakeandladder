package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/arsulegai/snakeandladder/internal/game"
)

type createResp struct{ ID string `json:"id"` }

func TestCreateGameAndAddPlayers(t *testing.T) {
	reg := game.NewRegistry()
	ts := httptest.NewServer(BuildMux(reg))
	defer ts.Close()

	// create game
	resp, err := http.Post(ts.URL+"/api/games?grid=10", "application/json", nil)
	if err != nil { t.Fatalf("create game request err: %v", err) }
	if resp.StatusCode != http.StatusCreated { t.Fatalf("create game code=%d", resp.StatusCode) }
	var cr createResp
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil { t.Fatalf("decode id: %v", err) }
	resp.Body.Close()
	if cr.ID == "" { t.Fatal("empty game id") }

	// add players (should complete quickly)
	add := func(name string) {
		body := bytes.NewBufferString("{\"name\":\""+name+"\"}")
		c := http.Client{ Timeout: 2 * time.Second }
		r, err := c.Post(ts.URL+"/api/games/"+cr.ID+"/players", "application/json", body)
		if err != nil { t.Fatalf("add %s err: %v", name, err) }
		if r.StatusCode != http.StatusCreated { t.Fatalf("add %s code=%d", name, r.StatusCode) }
		io.Copy(io.Discard, r.Body)
		r.Body.Close()
	}
	add("Arun")
	add("Megha")
}

func TestSSEInitialEvent(t *testing.T) {
	reg := game.NewRegistry()
	ts := httptest.NewServer(BuildMux(reg))
	defer ts.Close()

	// create game
	resp, _ := http.Post(ts.URL+"/api/games?grid=10", "application/json", nil)
	var cr createResp
	json.NewDecoder(resp.Body).Decode(&cr)
	resp.Body.Close()

	// subscribe
	req, _ := http.NewRequest("GET", ts.URL+"/api/games/"+cr.ID+"/stream", nil)
	client := http.Client{ Timeout: 2 * time.Second }
	r, err := client.Do(req)
	if err != nil { t.Fatalf("sse subscribe err: %v", err) }
	defer r.Body.Close()
	if ct := r.Header.Get("Content-Type"); !strings.Contains(ct, "text/event-stream") {
		t.Fatalf("unexpected content-type: %s", ct)
	}

	// read at least one event line
	br := bufio.NewReader(r.Body)
	deadline := time.Now().Add(1500 * time.Millisecond)
	for time.Now().Before(deadline) {
		line, err := br.ReadString('\n')
		if err != nil { t.Fatalf("reading sse: %v", err) }
		if strings.HasPrefix(line, "data: ") { return }
	}
	t.Fatal("no SSE data line received in time")
}
