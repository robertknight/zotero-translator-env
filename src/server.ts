/// <reference path="../typings/tsd.d.ts" />

import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
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

let SUPPORTED_TRANSLATORS = ['Oxford University Press'];

function loadTranslators() {
	let translators: translator.Translator[] = [];

	SUPPORTED_TRANSLATORS.forEach(name => {
		const translatorPath = path.resolve(`${__dirname}/../translators/${name}.js`);
		const translator = loadTranslatorFromFile(translatorPath);
		translators.push(translator);
	});

	return translators;
}

function fetchItemsAtUrl(url: string, translators: translator.Translator[]) {
	return fetch(url).then(response => {
		return response.text();
	}).then(body => {
		for (let translator of translators) {
			let translatorRegex = new RegExp(translator.metadata.target);
			if (!url.match(translatorRegex)) {
				continue;
			}
			let document = jsdom.jsdom(body);
			return Q.all(translator.processPage(document, url));
		}
		throw new Error(`No matching translator found for ${url}`);
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
	let translators = loadTranslators();
	app.get('/auth/login', (req, res) => {
		const CLIENT_ID = 1725;
		const REDIRECT_URI = 'http://localhost:9876/auth/done';
		res.redirect(`https://api.mendeley.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=all`);
	});
	app.get('/auth/done', (req, res) => {
		res.send('Zotero translation server login complete');
	});
	app.get('/metadata/extract', (req, res) => {
		let url = req.query.url;
		fetchItemsAtUrl(url, translators).then(items => {
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
