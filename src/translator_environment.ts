// Zotero.Utilities
// https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/utilities_translate.js
//
// Zotero Translator API
// https://github.com/zotero/zotero/tree/master/chrome/content/zotero/xpcom/translation

import * as jsdom from 'jsdom';

import * as zotero from './translator_interfaces';
import {Item} from './zotero_item';

var xpath = require('jsdom/lib/jsdom/level3/xpath');
var ZoteroUtilities = require('./ZoteroUtilities');

let savedItems: Q.Promise<zotero.ZoteroItem>[] = [];
let addItem = (item: Q.Promise<zotero.ZoteroItem>) => {
	savedItems.push(item);
};

/** API for the 'ZU'/'Zotero.Utilities' interface
  * exposed to translators.
  */
export interface ZoteroUtilities {
	trimInternal(str: string): string;
	cleanAuthor(name: string, role: string): zotero.ZoteroCreator;
	xpathText(doc: Document, query: string): string;

	// the current URL is exposed for use in the network
	// fetch methods
	currentUrl: string;
	doGet(relativeUrl: string, callback: (content: string) => void): void;
}

/** API for the 'Z'/'Zotero' interface exposed
  * to translators.
  */
export interface ZoteroGlobal {
	Item: {
		new (type: string): zotero.ZoteroItem;
	},
	Utilities: ZoteroUtilities
	debug(message: any);
}

/** API for the global object exposed to translators
  * in the sandboxed environment in which they run.
  */
export interface TranslatorGlobal {
	// APIs used by translator environment
	exports: zotero.TranslatorImpl;
	addItem(item: Q.Promise<zotero.ZoteroItem>);

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

export function createEnvironment() {
	let zoteroGlobal = {
		Item: Item,
		Utilities: ZoteroUtilities,
		debug: message => {
			// ignored
		}
	};

	let translatorGlobal: TranslatorGlobal = {
		ZU: ZoteroUtilities,
		Zotero: zoteroGlobal,
		Z: zoteroGlobal,
		
		exports: <zotero.TranslatorImpl>{},
		addItem: addItem,
		currentUrl: '',

		// DOM APIs
		console: console,
		XPathResult: xpath.XPathResult,
		DOMParser: DOMParser
	};

	return translatorGlobal;
}

