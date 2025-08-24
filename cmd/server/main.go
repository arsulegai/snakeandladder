package main

import (
	"encoding/json"
	"log"
	"net/http"
	"path"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/arsulegai/snakeandladder/internal/game"
)

// BuildMux constructs the HTTP handler for the API and static SPA.
func BuildMux(reg *game.Registry) http.Handler {
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/games", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		grid := 10
		if v := r.URL.Query().Get("grid"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 1 {
				grid = n
			}
		}
		id, _ := reg.Create(grid)
		log.Printf("created game id=%s grid=%d", id, grid)
		writeJSON(w, http.StatusCreated, map[string]string{"id": id})
	})

	mux.HandleFunc("/api/games/", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		// paths: /api/games/{id}/players, /api/games/{id}/roll, /api/games/{id}/state, /api/games/{id}/stream
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/games/"), "/")
		if len(parts) < 1 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		id := parts[0]
		g, ok := reg.Get(id)
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "game not found"})
			return
		}
		if len(parts) == 1 {
			if r.Method == http.MethodGet {
				writeJSON(w, http.StatusOK, g.State())
				return
			}
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		switch parts[1] {
		case "players":
			if r.Method != http.MethodPost {
				writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
				return
			}
			var body struct{ Name string `json:"name"` }
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" {
				log.Printf("add player invalid body: %v", err)
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
				return
			}
			if err := g.AddPlayer(body.Name); err != nil {
				log.Printf("add player error: %v", err)
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			log.Printf("added player '%s' to game %s", body.Name, id)
			writeJSON(w, http.StatusCreated, g.State())
		case "roll":
			if r.Method != http.MethodPost {
				writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
				return
			}
			roll, winner, err := g.RollDice()
			if err != nil {
				log.Printf("roll error: %v", err)
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			resp := map[string]interface{}{"roll": roll}
			if winner != nil { resp["winner"] = *winner }
			writeJSON(w, http.StatusOK, resp)
		case "state":
			writeJSON(w, http.StatusOK, g.State())
		case "stream":
			log.Printf("client subscribed to stream for game %s", id)
			g.Subscribe(w, r)
		default:
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		}
	})

	// Static frontend
	staticDir := filepath.FromSlash("web")
	mux.Handle("/", spaHandler(staticDir))

	return withCORS(mux)
}

func main() {
	reg := game.NewRegistry()
	handler := BuildMux(reg)
	addr := ":8080"
	log.Printf("Snake & Ladder server listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		if r.Method == http.MethodOptions { w.WriteHeader(http.StatusNoContent); return }
		next.ServeHTTP(w, r)
	})
}

func spaHandler(staticDir string) http.Handler {
	fs := http.FileServer(http.Dir(staticDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean(r.URL.Path)
		if p == "/" || strings.HasPrefix(p, "/assets/") || strings.HasSuffix(p, ".css") || strings.HasSuffix(p, ".js") || strings.HasSuffix(p, ".png") || strings.HasSuffix(p, ".svg") {
			fs.ServeHTTP(w, r)
			return
		}
		// fallback to index
		r.URL.Path = "/"
		fs.ServeHTTP(w, r)
	})
}
