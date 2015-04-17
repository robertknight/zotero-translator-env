/// <reference path="../typings/tsd.d.ts" />

import * as express from 'express';
import * as fs from 'fs';

import * as fake_dom from './fake_dom';
import * as translator from './translator';

function loadTranslatorFromFile(path: string) {
	let src = fs.readFileSync(path).toString();
	return translator.loadTranslator(src);
}

let oupTranslator = loadTranslatorFromFile('../zotero-translators/Oxford University Press.js');
let OUP_TEST_URL = 'http://ukcatalogue.oup.com/product/9780195113679.do';

let fakeDocument = <Document><any>(new fake_dom.DOMElement());

console.log(oupTranslator.impl.detectWeb(fakeDocument, OUP_TEST_URL));
oupTranslator.impl.doWeb(fakeDocument, OUP_TEST_URL);
