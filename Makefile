# Simple Makefile to run the Snake & Ladder web app and auto-open the browser

PORT ?= 8080
URL  ?= http://localhost:$(PORT)/

.PHONY: run build open test

build:
	@echo "Building (no binary needed, runs via go run)"

# Starts the server, waits for it to be ready, then opens your default browser.
run:
	@echo "Starting server on $(URL) ..."
	go run ./cmd/server

test:
	@echo "Running unit and integration tests..."
	go test ./... -run . -count=1 -v
