package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
)

func main() {
	secret, err := generateSecret(32)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating secret: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Generated JWT Secret:")
	fmt.Println(secret)
	fmt.Println()
	fmt.Println("Add to config/Config.toml:")
	fmt.Printf("jwt_secret = \"%s\"\n", secret)
	fmt.Println()
	fmt.Println("Or set as environment variable:")
	fmt.Printf("export JWT_SECRET=\"%s\"\n", secret)
}

func generateSecret(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}
