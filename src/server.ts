/// <reference path="../typings/tsd.d.ts" />

import * as express from 'express';
import * as fs from 'fs';

import * as translator from './translator';

function loadTranslatorFromFile(path: string) {
	let src = fs.readFileSync(path).toString();
	return translator.loadTranslator(src);
}

let oupTranslator = loadTranslatorFromFile('../zotero-translators/Oxford University Press.js');
console.log(oupTranslator.impl.detectWeb(null, 'foo'));
console.log('loaded translator');
