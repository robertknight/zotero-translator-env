NODE_BIN=./node_modules/.bin
BUILD_DIR=build/
SRCS=$(wildcard src/*.ts) $(wildcard src/*.js)

all: build/server.js

build/server.js: typings/DefinitelyTyped $(SRCS)
	$(NODE_BIN)/tsc --noImplicitAny --noEmitOnError -m commonjs --outDir $(BUILD_DIR) $(wildcard src/*.ts)
	cp $(wildcard src/*.js) $(BUILD_DIR)

typings/DefinitelyTyped: tsd.json
	$(NODE_BIN)/tsd reinstall
	touch typings/DefinitelyTyped


