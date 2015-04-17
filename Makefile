NODE_BIN=./node_modules/.bin
BUILD_DIR=build/

all:
	$(NODE_BIN)/tsc -m commonjs --outDir $(BUILD_DIR) $(wildcard src/*.ts)
	cp $(wildcard src/*.js) $(BUILD_DIR)
