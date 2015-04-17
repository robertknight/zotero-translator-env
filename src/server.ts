/// <reference path="../typings/tsd.d.ts" />

import * as express from 'express';
import * as fs from 'fs';
import * as jsdom from 'jsdom';
import * as Q from 'q';

import * as fake_dom from './fake_dom';
import * as translator from './translator';
import * as zotero from './translator_interfaces';

var fetch = require('isomorphic-fetch');

function loadTranslatorFromFile(path: string) {
	let src = fs.readFileSync(path).toString();
	return translator.loadTranslator(src);
}

let oupTranslator = loadTranslatorFromFile('../zotero-translators/Oxford University Press.js');
let OUP_TEST_URL = 'http://ukcatalogue.oup.com/product/9780195113679.do';

function fetchItemsAtUrl(url: string) {
	return fetch(url).then(response => {
		return response.text();
	}).then(body => {
		let document = jsdom.jsdom(body);
		return Q.all(oupTranslator.processPage(document, url));
	});
}

function convertZoteroItemToMendeleyDocument(item: zotero.ZoteroItem) {
	let year: number;
	if (item.date) {
		let yearMatch = item.date.match(/[0-9]{4}/);
		if (yearMatch) {
			year = parseInt(yearMatch[0]);
		}
	}

	return {
		type: item.itemType,
		title: item.title,
		authors: item.creators,
		year: year,
		pages: item.numPages,
		publisher: item.publisher,
		abstract: item.abstractNote,
		keywords: item.tags,
		edition: item.edition
	};
}

function runServer() {
	let app = express();
	app.get('/metadata/extract', (req, res) => {
		let url = req.query.url;
		fetchItemsAtUrl(url).then(items => {
			let mendeleyDocs = items.map(item => convertZoteroItemToMendeleyDocument(item));
			res.send(mendeleyDocs);
		}).catch(err => {
			res.status(500).send({
				error: err.toString(),
				stack: err.stack
			});
		});
	});
	let server = app.listen(9876, () => {
		console.log('server ready');
	});
}

runServer();
