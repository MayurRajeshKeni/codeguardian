# CodeGuardian Root Makefile

all: build

build:
	$(MAKE) -C compiler_core all

test:
	$(MAKE) -C compiler_core test

clean:
	$(MAKE) -C compiler_core clean

.PHONY: all build test clean
