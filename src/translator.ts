import * as vm from 'vm';
import * as util from 'util';

import * as fake_dom from './fake_dom';
import * as zotero from './translator_interfaces';

interface ZoteroUtilities {
	trimInternal(str: string): string;
	cleanAuthor(name: string, role: string): zotero.ZoteroCreator;
	xpathText(doc: Document, query: string): string;
}

interface ZoteroGlobal {
	Item: {
		new (type: string): zotero.ZoteroItem;
	}
}

interface TranslatorEnvironment {
	exports: zotero.TranslatorImpl;
	Zotero: ZoteroGlobal;
	ZU: ZoteroUtilities;
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

	constructor(itemType: string) {
		this.itemType = itemType;
		this.creators = [];
		this.notes = [];
		this.tags = [];
		this.seeAlso = [];
		this.attachments = [];
	}

	complete() {
		console.log('item completed', this);
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

	let testCaseSourceStart = source.indexOf('/** BEGIN TEST CASES **/');
	if (testCaseSourceStart === -1) {
		throw new Error('Failed to find test cases in translator source');
	}
	let testCaseDataStart = source.indexOf('[', testCaseSourceStart);
	let testCaseDataEnd = source.lastIndexOf(']');

	const testCaseDataSource = source.slice(testCaseDataStart, testCaseDataEnd+1);
	const testCases = <zotero.TestCase[]>(JSON.parse(testCaseDataSource));

	return {
		metadata: metadata,
		translatorCode: source.slice(metadataEnd + 1, testCaseSourceStart),
		testCases: testCases
	};
}

function loadTranslatorModule(source: string): zotero.TranslatorImpl {
	let exportedFuncs = ['detectWeb', 'doWeb'];

	for (name of exportedFuncs) {
		source = source.replace(`function ${name}`, `exports.${name} = function`);
	}

	let script = new (<any>vm).Script(source);
	let translatorGlobal: TranslatorEnvironment = {
		exports: <zotero.TranslatorImpl>{},
		ZU: ZoteroUtilitiesImpl,
		Zotero: {
			Item: ZoteroItem
		}
	};
	let translatorContext = vm.createContext(translatorGlobal);
	script.runInContext(translatorContext);
	
	return {
		detectWeb: translatorGlobal.exports.detectWeb,
		doWeb: translatorGlobal.exports.doWeb
	};
}

export function loadTranslator(source: string): zotero.Translator {
	// translators consist of three sections:
	//
	// 1. A JSON object containing metadata for the translator
	// 2. The source code for the translator
	// 3. Test cases for the translator

	const translatorSource = splitSource(source);

	return {
		metadata: translatorSource.metadata,
		impl: loadTranslatorModule(translatorSource.translatorCode),
		testCases: translatorSource.testCases
	};
}

