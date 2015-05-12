NODE_BIN=./node_modules/.bin
BUILD_DIR=build/
JS_SRCS=$(wildcard src/*.js)
TS_SRCS=$(wildcard src/*.ts test/*.ts)
SRCS=$(JS_SRCS) $(TS_SRCS)
TSC_OPTS=--noImplicitAny --noEmitOnError -m commonjs --outDir $(BUILD_DIR)

all: build/server.js

build/server.js: typings/DefinitelyTyped $(SRCS)
	$(NODE_BIN)/tsc $(TSC_OPTS) $(TS_SRCS)
	cp $(wildcard src/*.js) $(BUILD_DIR)/src

typings/DefinitelyTyped: tsd.json
	$(NODE_BIN)/tsd reinstall
	touch typings/DefinitelyTyped

test: build/server.js
	iojs $(NODE_BIN)/mocha build/test/*.js

