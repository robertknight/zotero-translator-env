// translator_environment provides the environment (DOM APIs,
// Zotero and Zotero.Utilities APIs) that the translators need
// for extract items from the page.
//
// This includes APIs for performing additional network requests,
// usually to fetch a version of the article on the page in an
// easier-to-parse form.

// Zotero.Utilities
// https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/utilities_translate.js
//
// Zotero Translator API
// https://github.com/zotero/zotero/tree/master/chrome/content/zotero/xpcom/translation

import * as jsdom from 'jsdom';
import * as rx from 'rx-lite';

import * as zotero from './zotero_types';
import {Item} from './zotero_item';

var fetch = require('isomorphic-fetch');
var xpath = require('jsdom/lib/jsdom/level3/xpath');
var ZoteroUtilities = require('./ZoteroUtilities');

/** Context holds state related to an invocation
  * of a translator for a given URL. This includes the 
  * set of items extracted so far, whether the processing of
  * the URL is complete and the URL of the current document.
  */
interface Context {
	currentUrl: string;
	items: rx.Observable<zotero.Item>;

	saveItem(item: zotero.Item): void;
	beginRequest(url: string): void;
	endRequest(): void;
	complete(): void;
}

/** API for the 'ZU'/'Zotero.Utilities' interface
  * exposed to translators.
  */
export interface ZoteroUtilities {
	trimInternal(str: string): string;
	cleanAuthor(name: string, role: string): zotero.Creator;
	xpathText(doc: Document, query: string): string;
	doGet(context: any, relativeUrl: string, callback: (content: string) => void): void;
}

/** API for the 'Z'/'Zotero' interface exposed
  * to translators.
  */
export interface ZoteroGlobal {
	Item: {
		new (type: string): zotero.Item;
	},
	Utilities: ZoteroUtilities
	debug(message: any): void;
}

interface FetchResponse {
	json(): Q.Promise<Object>;
	text(): Q.Promise<string>;
}

/** API for the global object exposed to translators
  * in the sandboxed environment in which they run.
  */
export interface TranslatorGlobal {
	// APIs used by translator environment
	exports: zotero.TranslatorImpl;
	context: Context;

	fetch(url: string): FetchResponse;

	// APIs exposed to Zotero translators
	Zotero: ZoteroGlobal;
	Z: ZoteroGlobal;
	ZU: ZoteroUtilities;
}

// jsdom 5.0 does not provide the DOMParser
// API on the 'window' object. A Node implementation is available in the 'xmldom' package
// but that does not support xpath.
class DOMParser {
	parseFromString(source: string, type: string) {
		let parseMode = 'auto';
		if (type === 'text/xml') {
			parseMode = 'xml';
		}
		return jsdom.jsdom(source, {
			parsingMode: parseMode
		});
	}
}

export class ContextImpl {
	items: rx.Observable<zotero.Item>;
	currentUrl: string;

	private translatorName: string;
	private done: boolean;
	private observer: rx.Observer<zotero.Item>;
	private requestsInFlight: number;
	private pendingItems: zotero.Item[];

	constructor(translatorName: string, currentUrl: string) {
		this.translatorName = translatorName;
		this.items = rx.Observable.create<zotero.Item>((observer) => {
			this.observer = observer;
			this.pendingItems.forEach(item => {
				observer.onNext(item);
			});
			this.signalIfCompleted();
		});
		this.currentUrl = currentUrl;
		this.requestsInFlight = 0;
		this.done = false;
		this.pendingItems = [];
		this.observer = null;
	}

	saveItem(item: zotero.Item) {
		item.libraryCatalog = this.translatorName;

		if (this.observer) {
			this.observer.onNext(item);
		} else {
			this.pendingItems.push(item);
		}
	}

	beginRequest(url: string) {
		++this.requestsInFlight;
	}

	endRequest() {
		--this.requestsInFlight;
		this.signalIfCompleted();
	}

	complete() {
		this.done = true;
		this.signalIfCompleted();
	}

	private signalIfCompleted() {
		// if Item.complete() has been called and there are no
		// network requests in flight, signal the end of the
		// translation
		if (this.done && this.observer && this.requestsInFlight === 0) {
			this.observer.onCompleted();
		}
	}
}

export function createEnvironment(translatorName: string) {
	let zoteroGlobal: ZoteroGlobal = {
		Item: null /* bound later */,
		Utilities: {
			xpath: ZoteroUtilities.xpath,
			xpathText: ZoteroUtilities.xpathText,
			trimInternal: ZoteroUtilities.trimInternal,
			cleanAuthor: ZoteroUtilities.cleanAuthor,
			doGet: null /* bound later */
		},
		debug: () => {
			// ignored
		},
		selectItems(items: zotero.Item[]) {
			return items;
		}
	};

	let translatorGlobal: TranslatorGlobal = {
		ZU: zoteroGlobal.Utilities,
		Zotero: zoteroGlobal,
		Z: zoteroGlobal,
		
		exports: <zotero.TranslatorImpl>{},

		context: null,

		fetch: fetch,

		// DOM APIs
		console: console,
		XPathResult: xpath.XPathResult,
		DOMParser: DOMParser
	};

	// give Zotero APIs access to the current translator
	// environment
	zoteroGlobal.Item = Item.bind(null, translatorGlobal);
	zoteroGlobal.Utilities.doGet = ZoteroUtilities.doGet.bind(null, translatorGlobal);

	return translatorGlobal;
}

