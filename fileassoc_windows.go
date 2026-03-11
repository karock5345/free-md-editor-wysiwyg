//go:build windows

package main

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

// registerFileAssociation registers .md and .markdown files to open with this
// executable. Keys are written under HKCU so no administrator rights are needed.
func registerFileAssociation() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	exe, _ = filepath.Abs(exe)

	const progID = "FreeMdEditor.md"

	set := func(path, value string) {
		k, _, err := registry.CreateKey(registry.CURRENT_USER, path, registry.SET_VALUE)
		if err != nil {
			return
		}
		defer k.Close()
		_ = k.SetStringValue("", value)
	}

	set(`Software\Classes\.md`, progID)
	set(`Software\Classes\.markdown`, progID)
	set(`Software\Classes\`+progID, "Markdown File")
	set(`Software\Classes\`+progID+`\DefaultIcon`, `"`+exe+`",0`)
	set(`Software\Classes\`+progID+`\shell\open\command`, `"`+exe+`" "%1"`)
}
