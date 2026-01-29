package main

import (
	"flag"
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"tilt-tui/internal/tilt"
	"tilt-tui/internal/tui"
)

func main() {
	// Parse command line flags
	host := flag.String("host", "localhost", "Tilt server host")
	port := flag.Int("port", 10350, "Tilt server port")
	flag.Parse()

	// Create Tilt client
	client := tilt.NewClient(*host, *port)

	// Create TUI model
	model := tui.New(tui.WithClient(client))

	// Create and run the program
	p := tea.NewProgram(
		model,
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running TUI: %v\n", err)
		os.Exit(1)
	}
}
