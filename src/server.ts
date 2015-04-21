/// <reference path="../typings/tsd.d.ts" />

import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';

import * as translator from './translator';
import * as zotero from './zotero_types';

function loadTranslatorFromFile(path: string) {
	let src = fs.readFileSync(path).toString();
	return translator.loadTranslator(src);
}

let SUPPORTED_TRANSLATORS = ['Oxford University Press', 'The Times UK', 'Google Books'];

function loadTranslators() {
	let translators: translator.Translator[] = [];

	SUPPORTED_TRANSLATORS.forEach(name => {
		const translatorPath = path.resolve(`${__dirname}/../../translators/${name}.js`);
		const translator = loadTranslatorFromFile(translatorPath);
		translators.push(translator);
	});

	return translators;
}

let ZOTERO_TYPE_MAPPINGS: {[zoteroType: string]: string} = {
	'book': 'book'
};

function convertZoteroItemToMendeleyDocument(item: zotero.Item) {
	let year: number;
	if (item.date) {
		let yearMatch = item.date.match(/[0-9]{4}/);
		if (yearMatch) {
			year = parseInt(yearMatch[0]);
		}
	}

	let type = 'generic';
	if (ZOTERO_TYPE_MAPPINGS.hasOwnProperty(item.itemType)) {
		type = ZOTERO_TYPE_MAPPINGS[item.itemType];
	}

	return {
		type: type,
		title: item.title,
		authors: item.creators.map((author) => {
			return { first_name: author.firstName, last_name: author.lastName };
		}),
		year: year,
		pages: item.numPages,
		publisher: item.publisher,
		abstract: item.abstractNote,
		keywords: item.tags,
		edition: item.edition,
		identifiers: {
			doi: item.DOI,
			isbn: item.ISBN,
			issn: item.ISSN
		},
		volume: item.volume,
		issue: item.issue
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
		translator.fetchItemsAtUrl(url, translators).then(items => {
			let mendeleyDocs = items.map(item => convertZoteroItemToMendeleyDocument(item));
			res.send(mendeleyDocs);
		}).catch(err => {
			console.error(`Extracting metadata for ${url} failed: ${err.toString()}, ${err.stack}`);
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
