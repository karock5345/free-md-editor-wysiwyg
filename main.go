package main

import (
	"embed"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend
var assets embed.FS

func main() {
	var startupFile string
	if len(os.Args) > 1 {
		arg := os.Args[1]
		ext := strings.ToLower(filepath.Ext(arg))
		if ext == ".md" || ext == ".markdown" || ext == ".txt" {
			startupFile = arg
		}
	}

	app := NewApp(startupFile)

	err := wails.Run(&options.App{
		Title:         "Free MD Editor",
		Width:         1280,
		Height:        860,
		MinWidth:      960,
		MinHeight:     640,
		DisableResize: false,
		AssetServer:   &assetserver.Options{Assets: assets},
		OnStartup:     app.startup,
		OnDomReady:    app.domReady,
		Bind:          []interface{}{app},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
