NODE_BIN=./node_modules/.bin

all:
	$(NODE_BIN)/tsc -m commonjs --outDir build $(wildcard src/*.ts)
