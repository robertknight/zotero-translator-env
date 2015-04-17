import * as vm from 'vm';
import * as util from 'util';
import * as Q from 'q';

import * as fake_dom from './fake_dom';
import * as zotero from './translator_interfaces';

var ZoteroUtilities = require('./ZoteroUtilities');
var xpath = require('jsdom/lib/jsdom/level3/xpath');

let savedItems: Q.Promise<zotero.ZoteroItem>[] = [];
let addItem = (item: Q.Promise<zotero.ZoteroItem>) => {
	savedItems.push(item);
};

interface ZoteroUtilities {
	trimInternal(str: string): string;
	cleanAuthor(name: string, role: string): zotero.ZoteroCreator;
	xpathText(doc: Document, query: string): string;
}

export class Translator {
	metadata: zotero.TranslatorMetadata;
	private translator: zotero.TranslatorImpl;

	constructor(metadata: zotero.TranslatorMetadata,
	            translator: zotero.TranslatorImpl) {
		this.metadata = metadata;
		this.translator = translator;
	}

	detectAvailableItemType(document: Document, url: string): string {
		return this.translator.detectWeb(document, url);
	}

	processPage(document: Document, url: string): Q.Promise<zotero.ZoteroItem>[] {
		savedItems = [];
		this.translator.doWeb(document, url);
		return savedItems;
	}
}

interface ZoteroGlobal {
	Item: {
		new (type: string): zotero.ZoteroItem;
	},
	Utilities: ZoteroUtilities
}

interface TranslatorEnvironment {
	exports: zotero.TranslatorImpl;
	Zotero: ZoteroGlobal;
	ZU: ZoteroUtilities;
	addItem(item: Q.Promise<zotero.ZoteroItem>);
}

class ZoteroUtilitiesImpl {
	static trimInternal(str: string) {
		return str.trim();
	}

	static cleanAuthor(name: string, role: string) {
		let nameParts = name.split(' ');
		return {
			lastName: nameParts[name.length-1],
			firstName: nameParts.slice(0, nameParts.length-1).join(' '),
			creatorType: role
		};
	}

	static xpathText(doc: Document, query: string) {
		return `<xpath value for query ${query}`;
	}

	static xpath(doc: Document, query: string) {
		return [new fake_dom.DOMElement(`<xpath value for query ${query}`)];
	}
}

class ZoteroItem implements zotero.ZoteroItem {
	itemType: string;
	creators: zotero.ZoteroCreator[];
	notes: zotero.ZoteroNote[];
	tags: string[];
	seeAlso: string[];
	attachments: zotero.ZoteroAttachment[];

	result: Q.Deferred<zotero.ZoteroItem>;

	constructor(itemType: string) {
		this.itemType = itemType;
		this.creators = [];
		this.notes = [];
		this.tags = [];
		this.seeAlso = [];
		this.attachments = [];

		this.result = Q.defer<zotero.ZoteroItem>();
		addItem(this.result.promise);
	}

	complete() {
		this.result.resolve(this);
	}
}

interface TranslatorSource {
	metadata: zotero.TranslatorMetadata;
	translatorCode: string;
	testCases: zotero.TestCase[];
}

function splitSource(source: string): TranslatorSource {
	const metadataStart = source.indexOf('{');
	const metadataEnd = source.indexOf('}', metadataStart);
	if (metadataStart === -1) {
		throw new Error('Failed to find start of translator metadata');
	}
	if (metadataEnd === -1) {
		throw new Error('Failed to find end of translator metadata');
	}

	const metadataJsonStr = source.slice(metadataStart, metadataEnd+1);
	let metadata = <zotero.TranslatorMetadata>JSON.parse(metadataJsonStr);

	let testCases: zotero.TestCase[];
	let translatorCodeEnd;

	let testCaseSourceStart = source.indexOf('/** BEGIN TEST CASES **/');
	if (testCaseSourceStart !== -1) {
		translatorCodeEnd = testCaseSourceStart;
		let testCaseDataStart = source.indexOf('[', testCaseSourceStart);
		let testCaseDataEnd = source.lastIndexOf(']');
		let testCaseDataSource = source.slice(testCaseDataStart, testCaseDataEnd+1);
		testCases = <zotero.TestCase[]>(JSON.parse(testCaseDataSource));
	} else {
		translatorCodeEnd = source.length;
	}

	return {
		metadata: metadata,
		translatorCode: source.slice(metadataEnd + 1, translatorCodeEnd),
		testCases: testCases
	};
}

function loadTranslatorModule(source: string) {
	let exportedFuncs = ['detectWeb', 'doWeb'];

	for (name of exportedFuncs) {
		source = source + '\n' + `exports.${name} = ${name}`;
	}

	let script = new (<any>vm).Script(source);
	let savedItems: Q.Promise<zotero.ZoteroItem>[] = [];
	let translatorGlobal: TranslatorEnvironment = {
		exports: <zotero.TranslatorImpl>{},
		ZU: ZoteroUtilities,
		Zotero: {
			Item: ZoteroItem,
			Utilities: ZoteroUtilities
		},
		addItem: addItem,

		// DOM APIs
		console: console,
		XPathResult: xpath.XPathResult
	};
	let translatorContext = vm.createContext(translatorGlobal);
	script.runInContext(translatorContext);
	
	return {
		environment: translatorGlobal,
		impl: {
			detectWeb: translatorGlobal.exports.detectWeb,
			doWeb: translatorGlobal.exports.doWeb
		}
	};
}

export function loadTranslator(source: string): Translator {
	// translators consist of three sections:
	//
	// 1. A JSON object containing metadata for the translator
	// 2. The source code for the translator
	// 3. Test cases for the translator

	const translatorSource = splitSource(source);

	let translator = loadTranslatorModule(translatorSource.translatorCode);
	return new Translator(translatorSource.metadata, translator.impl);
}

