package main

// import section
import (
	"errors"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"time"
)

// TODO: Change all print lines to log

// Data types section
type point struct {
	x, y      int
	total_pos int
}

type snake struct {
	head, tail point
}

type ladder struct {
	top, bottom point
}

type player struct {
	position point
	name     string
}

type entity interface {
	set_points(head point, tail point)
	generate_entities(num int)
	print()
}

// Global variables
var grid_size int
var num_players int
var snakes []snake
var ladders []ladder
var players []player
var player_turn int = 0

// Constants
const snakes_str string = "snake"
const ladder_str string = "ladder"
const minimum_grid_size int = 1
const minimum_number_of_players = 2
const initial_player_position_x = -1
const initial_player_position_y = -1
const intial_player_total_pos = -1
const exit_code_invalid_input int = -1

// main program
func main() {
	var exit_code int
	var err error
	defer func() {
		if err != nil {
			fmt.Println("Invalid setup: ", err)
			os.Exit(exit_code)
		}
	}()
	if exit_code, err = pre_setup(); err != nil {
		return
	}
	play_game()
	print_current_state()
}

// other functions
func pre_setup() (int, error) {
	fmt.Printf("Enter the size of the grid: ")
	fmt.Scanf("%d", &grid_size)
	if grid_size < minimum_grid_size {
		return exit_code_invalid_input, errors.New("Invalid grid size")
	}
	generate_entities(grid_size)
	fmt.Printf("Enter the number of players: ")
	fmt.Scanf("%d", &num_players)
	if num_players < minimum_number_of_players {
		return exit_code_invalid_input, errors.New("Show courtesy loner! Play with someone else")
	}
	if err := get_player_names(); err != nil {
		return exit_code_invalid_input, err
	}
	return 0, nil
}

// TODO: This may end up taking long time, add a recovery logic
func generate_entities(num int) {
	rand.Seed(time.Now().UnixNano())
	number_of_snakes := rand.Intn(num)
	for number_of_snakes == 0 {
		number_of_snakes = rand.Intn(num)
	}
	// fmt.Printf("[DEBUG]: Number of snakes %d\n", number_of_snakes)
	for idx := 0; idx < number_of_snakes; idx++ {
		snakes = append(snakes, snake{}.generate_entity(num))
	}
	number_of_ladders := rand.Intn(num)
	for number_of_ladders == 0 {
		number_of_ladders = rand.Intn(num)
	}
	// fmt.Printf("[DEBUG]: Number of ladders %d\n", number_of_ladders)
	for idx := 0; idx < number_of_ladders; idx++ {
		ladders = append(ladders, ladder{}.generate_entity(num))
	}
	// Remove snakes and ladders which collide
	for _, snake_entity := range snakes {
		for _, ladder_entity := range ladders {
			if !(snake_entity.head.can_exist_when(&ladder_entity.top) && snake_entity.tail.can_exist_when(&ladder_entity.bottom)) {
				fmt.Println("[DEBUG]: Found unexpected generation! Some operation will be performed")
				print_current_state()
				// remove either snake or ladder
				random_remover := rand.Intn(2) % 2
				if random_remover == 0 {
					snakes = snakes[:len(snakes)-1]
				} else {
					ladders = ladders[:len(ladders)-1]
				}
			}
		}
	}
	// Remove snakes which have head in winner's place
	for idx, snake_entity := range snakes {
		if !snake_entity.head.can_exist_when(&point{grid_size - 1, grid_size - 1, 0}) {
			snakes = append(snakes[:idx], snakes[idx+1])
		}
	}
}

func get_player_names() error {
	for idx := 0; idx < num_players; idx++ {
		fmt.Printf("Enter Player %d name: ", idx+1)
		var player_name string
		fmt.Scanf("%s", &player_name)
		for _, player_entity := range players {
			if strings.EqualFold(player_entity.name, player_name) {
				return errors.New("You are trying to be smart, No two players can have same name! Give me different names")
			}
		}
		player_entity := player{point{initial_player_position_x, initial_player_position_y, intial_player_total_pos}, player_name}
		players = append(players, player_entity)
	}
	return nil
}

func get_point(num int) *point {
	rand.Seed(time.Now().UnixNano())
	x := rand.Intn(num)
	y := rand.Intn(num)
	for y == x {
		y = rand.Intn(num)
	}
	// fmt.Printf("[DEBUG]: Point generated is %d %d\n", x, y)
	return &point{x, y, x*grid_size + y}
}

func print_current_state() {
	fmt.Println("Players and their positions in this game are")
	for _, ele := range players {
		ele.print()
	}
	fmt.Println("Snakes are as follows")
	for _, ele := range snakes {
		ele.print()
	}
	fmt.Println("Ladders are as follows")
	for _, ele := range ladders {
		ele.print()
	}
}

func generate_end_points(num int, entity_type string) (*point, *point) {
	first := get_point(num)
	second := get_point(num)
	// TODO: Make this very random and interesting
	for !(second.can_exist_when(first) && first.can_be_on_top(second) && entity_type_can_have(first, second, entity_type)) {
		first = get_point(num)
		second = get_point(num)
	}
	return first, second
}

func entity_type_can_have(first *point, second *point, entity_type string) bool {
	if entity_type == snakes_str {
		for _, ele := range ladders {
			if result := ele.bottom.can_exist_when(first); !result {
				return false
			}
		}
	}
	if entity_type == ladder_str {
		for _, ele := range snakes {
			if result := ele.head.can_exist_when(second); !result {
				return false
			}
		}
	}
	return true
}

func play_game() {
	var status bool = false
	var player_entity player
	status, player_entity = game_ended()
	for !status {
		fmt.Printf("Player %s roll your dice [Press '1' to roll]: ", players[player_turn].name)
		var number int
		var entered_char int8
		fmt.Scanf("%d", &entered_char)
		for entered_char != 1 {
			fmt.Printf("Try again to roll your dice properly [Press '1' to roll]: ")
			fmt.Scanf("%d", &entered_char)
		}
		number = rand.Intn(6) + 1
		if !players[player_turn].rolled_dice(number) {
			fmt.Println("Boo!!! Try again in next turn")
		}
		players[player_turn].print()
		status, player_entity = game_ended()
		player_turn = (player_turn + 1) % len(players)
	}
	fmt.Printf("Player %s has won the game\n", player_entity.name)
}

func hit_by_snake(num int) (bool, func() int) {
	for _, ele := range snakes {
		if ele.head.total_pos == num {
			fmt.Println("[DEBUG] Hit by Snake")
			print_current_state()
			return true, func() int {
				return ele.tail.total_pos
			}
		}
	}
	return false, nil
}

func got_elevated(num int) (bool, func() int) {
	for _, ele := range ladders {
		if ele.bottom.total_pos == num {
			fmt.Println("[DEBUG] Got elevated")
			print_current_state()
			return true, func() int {
				return ele.top.total_pos
			}
		}
	}
	return false, nil
}

func game_ended() (bool, player) {
	for _, player_entity := range players {
		if player_entity.position.total_pos == grid_size*grid_size-1 {
			fmt.Println("Game ended")
			return true, player_entity
		}
	}
	return false, player{}
}

// Interface implementations
func (s *snake) set_points(head *point, tail *point) {
	s.head = *head
	s.tail = *tail
}

func (l *ladder) set_points(top *point, bottom *point) {
	l.top = *top
	l.bottom = *bottom
}

func (s *snake) print() {
	fmt.Println("Head: ", s.head.print(), " Tail: ", s.tail.print())
}

func (l *ladder) print() {
	fmt.Println("Top: ", l.top.print(), " Bottom: ", l.bottom.print())
}

func (s snake) generate_entity(num int) snake {
	// assign generated values
	first, second := generate_end_points(num, snakes_str)
	s.set_points(first, second)
	return s
}

func (l ladder) generate_entity(num int) ladder {
	// assign generated values
	first, second := generate_end_points(num, ladder_str)
	l.set_points(first, second)
	return l
}

// TODO: Also needs to check against all existing snakes and ladders
// Implements anonymous interface
func (p *point) can_exist_when(another_point *point) bool {
	if p.x == another_point.x && p.y == another_point.y {
		return false
	}
	return true
}

// Implements anonymous interface
func (p *point) can_be_on_top(another_point *point) bool {
	if p.x <= another_point.x {
		return false
	}
	return true
}

// Implements anonymous interface
func (p *point) print() string {
	return fmt.Sprintf("(%d %d)", p.x, p.y)
}

// Implements anonymous interface
func (p *player) print() {
	fmt.Printf("Player's name: %s, Position is: %s\n", p.name, p.position.print())
}

// Implements anonymous interface
// Check new position of player, check if player finds ladder or snake
func (p *player) rolled_dice(num int) bool {
	fmt.Println("Rolled: ", num)
	var total_pos int
	if p.position.x != initial_player_position_x && p.position.y != initial_player_position_y {
		total_pos = p.position.x*grid_size + p.position.y + num
	} else {
		total_pos = num - 1
	}
	if total_pos >= grid_size*grid_size {
		return false
	}
	if status, returned_func := hit_by_snake(total_pos); status {
		total_pos = returned_func()
	}
	if status, returned_func := got_elevated(total_pos); status {
		total_pos = returned_func()
	}
	p.position.total_pos = total_pos
	p.position.x = total_pos / grid_size
	p.position.y = total_pos % grid_size
	return true
}
