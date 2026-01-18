package conf

import (
	"log"

	"github.com/BurntSushi/toml"
)

type Config struct {
	InputFile string `toml:"input_file"`
	Server    Server
}

type Server struct {
	Port int
}

var Cfg Config

func init() {
	if _, err := toml.DecodeFile("config/Config.toml", &Cfg); err != nil {
		log.Fatalf("Failed to parse config file: %v", err)
	}
}
