package store

import "errors"

var (
	ErrNotFound  = errors.New("not_found")
	ErrConflict  = errors.New("conflict")
	ErrBadInput  = errors.New("bad_input")
	ErrForbidden = errors.New("forbidden")
)

