/// <reference path="../typings/tsd.d.ts" />

import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as jsdom from 'jsdom';
import * as Q from 'q';
import * as rx from 'rx-lite';

import * as translator from './translator';
import * as zotero from './zotero_types';

var fetch = require('isomorphic-fetch');

function loadTranslatorFromFile(path: string) {
	let src = fs.readFileSync(path).toString();
	return translator.loadTranslator(src);
}

let SUPPORTED_TRANSLATORS = ['Oxford University Press', 'The Times UK', 'Google Books'];

function loadTranslators() {
	let translators: translator.Translator[] = [];

	SUPPORTED_TRANSLATORS.forEach(name => {
		const translatorPath = path.resolve(`${__dirname}/../translators/${name}.js`);
		const translator = loadTranslatorFromFile(translatorPath);
		translators.push(translator);
	});

	return translators;
}

interface ScoredTranslator {
	translator: translator.Translator;
	score: number;
}

function findBestTranslator(url: string, document: Document, translators: translator.Translator[]) {
	let scoredTranslators: ScoredTranslator[] = [];
	console.log('finding translator for', url);
	translators.forEach(tr => {
		if (tr.metadata.target) {
			let targetRegEx = new RegExp(tr.metadata.target);
			if (!url.match(targetRegEx)) {
				console.log(`${tr.metadata.label} does not match ${tr.metadata.target}`);
				return;
			}
		}
		let itemType = tr.detectAvailableItemType(document, url);
		if (!itemType) {
			console.log(`${tr.metadata.label} did not find an item type for ${url}`);
			return;
		}
		scoredTranslators.push({
			translator: tr,
			score: tr.metadata.priority
		});
	});
	scoredTranslators.sort((a, b) => {
		if (a.score < b.score) {
			return -1;
		} else if (a.score === b.score) {
			return 0;
		} else {
			return 1;
		}
	});

	if (scoredTranslators.length > 0) {
		return scoredTranslators[0].translator;
	} else {
		return null;
	}
}

function fetchItemsAtUrl(url: string, translators: translator.Translator[]): Q.Promise<zotero.Item[]> {
	console.log(`Fetching ${url}`);
	return fetch(url).then((response: any) => {
		return response.text();
	}).then((body: string) => {
		// setup fake DOM environment.
		// By default jsdom.jsdom() will fetch and execute any <script>
		// tags that are referenced. For performance and security, we
		// disable this.
		let document = jsdom.jsdom(body, {
			features: {
				FetchExternalResources: [],
				ProcessExternalResources: false
			}
		});

		let translator = findBestTranslator(url, document, translators);
		if (!translator) {
			throw new Error(`No matching translator found for ${url}`);
		}
		
		console.log(`Processing ${url} with translator ${translator.metadata.label}`);
		let items = translator.processPage(document, url);

		return items.toArray().toPromise();
	});
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
		fetchItemsAtUrl(url, translators).then(items => {
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
