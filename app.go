package main

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx         context.Context
	currentFile string
	startupFile string
}

type DocumentPayload struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	Content   string `json:"content"`
	Cancelled bool   `json:"cancelled"`
}

func NewApp(startupFile string) *App {
	return &App{startupFile: startupFile}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	go registerFileAssociation()
}

// GetStartupFile returns the file passed as a CLI argument (e.g. by double-clicking a .md file).
func (a *App) GetStartupFile() (DocumentPayload, error) {
	path := strings.TrimSpace(a.startupFile)
	if path == "" {
		return DocumentPayload{Cancelled: true}, nil
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return DocumentPayload{}, fmt.Errorf("failed to read startup file: %w", err)
	}
	a.currentFile = path
	a.startupFile = "" // consume once
	return DocumentPayload{
		Name:    filepath.Base(path),
		Path:    path,
		Content: string(raw),
	}, nil
}
func (a *App) OpenExternalURL(url string) error {
	if a.ctx == nil {
		return errors.New("application context not ready")
	}
	runtime.BrowserOpenURL(a.ctx, url)
	return nil
}
func (a *App) domReady(ctx context.Context) {}

// ReadFileAsDataURL reads a local file and returns it as a base64-encoded data URL
// so the WebView can display images that are not reachable via http.
func (a *App) ReadFileAsDataURL(path string) (string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("cannot read image: %w", err)
	}
	ext := strings.ToLower(filepath.Ext(path))
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		mimeType = "image/png"
	}
	if idx := strings.Index(mimeType, ";"); idx != -1 {
		mimeType = strings.TrimSpace(mimeType[:idx])
	}
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(raw), nil
}

func (a *App) NewDocument() DocumentPayload {
	a.currentFile = ""
	return DocumentPayload{
		Name:    "Untitled.md",
		Path:    "",
		Content: "",
	}
}

func (a *App) OpenMarkdownFile() (DocumentPayload, error) {
	if a.ctx == nil {
		return DocumentPayload{}, errors.New("application context not ready")
	}

	selected, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Markdown File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Markdown Files (*.md;*.markdown;*.txt)",
				Pattern:     "*.md;*.markdown;*.txt",
			},
			{
				DisplayName: "All Files (*.*)",
				Pattern:     "*.*",
			},
		},
	})
	if err != nil {
		return DocumentPayload{}, err
	}
	if strings.TrimSpace(selected) == "" {
		return DocumentPayload{Cancelled: true}, nil
	}

	raw, err := os.ReadFile(selected)
	if err != nil {
		return DocumentPayload{}, fmt.Errorf("failed to read file: %w", err)
	}

	a.currentFile = selected
	return DocumentPayload{
		Name:    filepath.Base(selected),
		Path:    selected,
		Content: string(raw),
	}, nil
}

func (a *App) SaveMarkdownFile(content string) (DocumentPayload, error) {
	if strings.TrimSpace(a.currentFile) == "" {
		return a.SaveMarkdownFileAs(content)
	}

	if err := os.WriteFile(a.currentFile, []byte(content), 0o644); err != nil {
		return DocumentPayload{}, fmt.Errorf("failed to save file: %w", err)
	}

	return DocumentPayload{
		Name:    filepath.Base(a.currentFile),
		Path:    a.currentFile,
		Content: content,
	}, nil
}

func (a *App) SaveMarkdownFileAs(content string) (DocumentPayload, error) {
	if a.ctx == nil {
		return DocumentPayload{}, errors.New("application context not ready")
	}

	defaultName := "Untitled.md"
	if strings.TrimSpace(a.currentFile) != "" {
		defaultName = filepath.Base(a.currentFile)
	}

	selected, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Markdown File",
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Markdown Files (*.md)",
				Pattern:     "*.md",
			},
			{
				DisplayName: "Text Files (*.txt)",
				Pattern:     "*.txt",
			},
		},
	})
	if err != nil {
		return DocumentPayload{}, err
	}
	if strings.TrimSpace(selected) == "" {
		return DocumentPayload{Cancelled: true}, nil
	}

	if filepath.Ext(selected) == "" {
		selected += ".md"
	}

	if err := os.WriteFile(selected, []byte(content), 0o644); err != nil {
		return DocumentPayload{}, fmt.Errorf("failed to save file: %w", err)
	}

	a.currentFile = selected
	return DocumentPayload{
		Name:    filepath.Base(selected),
		Path:    selected,
		Content: content,
	}, nil
}
