// Zotero.Utilities
// https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/utilities_translate.js
//
// Zotero Translator API
// https://github.com/zotero/zotero/tree/master/chrome/content/zotero/xpcom/translation

import * as jsdom from 'jsdom';
import * as rx from 'rx-lite';

import * as zotero from './zotero_types';
import {Item} from './zotero_item';

var xpath = require('jsdom/lib/jsdom/level3/xpath');
var ZoteroUtilities = require('./ZoteroUtilities');

interface TranslationContext {
	currentUrl: string;
	items: rx.Observable<zotero.Item>;

	reset(currentUrl: string): void;
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

/** API for the global object exposed to translators
  * in the sandboxed environment in which they run.
  */
export interface TranslatorGlobal {
	// APIs used by translator environment
	exports: zotero.TranslatorImpl;
	context: TranslationContext;

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

class TranslationContextImpl {
	items: rx.Observable<zotero.Item>;
	currentUrl: string;

	private translatorName: string;
	private done: boolean;
	private observer: rx.Observer<zotero.Item>;
	private requestsInFlight: number;
	private pendingItems: zotero.Item[];

	constructor(translatorName: string) {
		this.translatorName = translatorName;
		this.reset('');
	}

	reset(url: string) {
		this.items = rx.Observable.create<zotero.Item>((observer) => {
			this.observer = observer;
			this.pendingItems.forEach(item => {
				observer.onNext(item);
			});
			if (this.done && this.requestsInFlight === 0) {
				observer.onCompleted();
			}
		});
		this.currentUrl = '';
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
		if (this.done && this.requestsInFlight === 0) {
			this.observer.onCompleted();
		}
	}

	complete() {
		this.done = true;
		if (this.observer && this.requestsInFlight === 0) {
			this.observer.onCompleted();
		}
	}
}

export function createEnvironment(translatorName: string) {
	let context = new TranslationContextImpl(translatorName);
	let zoteroGlobal = {
		Item: Item.bind(null, context),
		Utilities: {
			xpath: ZoteroUtilities.xpath,
			xpathText: ZoteroUtilities.xpathText,
			trimInternal: ZoteroUtilities.trimInternal,
			cleanAuthor: ZoteroUtilities.cleanAuthor,
			doGet: ZoteroUtilities.doGet.bind(null, context)
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

		context: context,

		// DOM APIs
		console: console,
		XPathResult: xpath.XPathResult,
		DOMParser: DOMParser
	};

	return translatorGlobal;
}

