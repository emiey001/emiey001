package blowfishlib

import (
	"encoding/base64"
	"encoding/json"
	"errors"

	"golang.org/x/crypto/blowfish"
	"github.com/andreburgaud/crypt2go/ecb"
	"github.com/andreburgaud/crypt2go/padding"
)

var key = []byte("rahimizulaiha99")

// Encrypt JSON string -> base64
func Encrypt(data string) (string, error) {
	c, err := blowfish.NewCipher(key)
	if err != nil {
		return "", err
	}
	padder := padding.NewPkcs5Padding()
	padded, err := padder.Pad([]byte(data))
	if err != nil {
		return "", err
	}
	enc := make([]byte, len(padded))
	ecb.NewECBEncrypter(c).CryptBlocks(enc, padded)
	return base64.StdEncoding.EncodeToString(enc), nil
}

// Decrypt base64 -> JSON string
func Decrypt(b64 string) (string, error) {
	cipherText, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", err
	}
	c, err := blowfish.NewCipher(key)
	if err != nil {
		return "", err
	}
	plain := make([]byte, len(cipherText))
	ecb.NewECBDecrypter(c).CryptBlocks(plain, cipherText)

	unpadded, err := padding.NewPkcs5Padding().Unpad(plain)
	if err != nil {
		return "", err
	}
	// optional: validate it's valid JSON
	var js json.RawMessage
	if err := json.Unmarshal(unpadded, &js); err != nil {
		return "", errors.New("not valid JSON")
	}
	return string(unpadded), nil
}
