// Package conf handles application configuration loading from TOML files.
package conf

import (
	"fmt"

	"github.com/BurntSushi/toml"
)

type Config struct {
	InputFile string  `toml:"input_file"`
	UseDB     bool    `toml:"use_db"`
	DBPath    string  `toml:"db_path"`
	LogFile   string  `toml:"log_file"`
	Fetcher   Fetcher `toml:"fetcher"`
	Server    Server
}

type Fetcher struct {
	Enabled  bool   `toml:"enabled"`
	DataDir  string `toml:"data_dir"`
	RawDir   string `toml:"raw_dir"`
	BaseURL  string `toml:"base_url"`
	FromDate string `toml:"from_date"`
	ToDate   string `toml:"to_date"`
}

type Server struct {
	Port int
}

var Cfg Config

// Load reads and parses the configuration file at the given path.
// It validates the configuration after loading to ensure all required fields are set.
// Returns an error if the file cannot be read, parsed, or validation fails.
func Load(path string) error {
	if _, err := toml.DecodeFile(path, &Cfg); err != nil {
		return fmt.Errorf("failed to parse config file: %w", err)
	}
	return validate()
}

func validate() error {
	if Cfg.Server.Port < 1 || Cfg.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d (must be 1-65535)", Cfg.Server.Port)
	}
	if Cfg.UseDB && Cfg.DBPath == "" {
		return fmt.Errorf("db_path is required when use_db is true")
	}
	if !Cfg.UseDB && Cfg.InputFile == "" {
		return fmt.Errorf("input_file is required when use_db is false")
	}
	return nil
}

func init() {
	// Load default config for backward compatibility
	if err := Load("config/Config.toml"); err != nil {
		panic(err)
	}
}
