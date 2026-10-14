# CodeGuardian Master Makefile
# Unified build & test targets across all subsystems

all: build

# 1. Build Compiler Core
build:
	$(MAKE) -C compiler_core all

# 2. Install all Node.js dependencies
install:
	cd security_engine && npm install
	cd dashboard && npm install

# 3. Run all tests
test:
	$(MAKE) -C compiler_core test
	cd security_engine && npm test

# 4. Master end-to-end verification
verify:
	bash scripts/verify_all.sh

# 5. Launch HTTP Gateway server (port 8787)
engine:
	cd security_engine && npm start

# 6. Launch Vite React Dashboard (port 5173)
dashboard:
	cd dashboard && npm run dev

# 7. Clean all build artifacts
clean:
	$(MAKE) -C compiler_core clean
	rm -rf dashboard/dist

.PHONY: all build install test verify engine dashboard clean
