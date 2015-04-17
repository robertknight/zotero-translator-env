import * as vm from 'vm';
import * as util from 'util';
import * as Q from 'q';

var stack_trace = require('stack-trace');

import * as zotero from './translator_interfaces';
import * as translator_environment from './translator_environment';

function logTranslatorError(code: string, err: Error) {
	let trace = stack_trace.parse(err);
	let lines = code.split('\n');
	let errLine = lines[trace[0].getLineNumber()-1];
	console.error(`translator error on ${errLine}: ${err.toString()}`);
}

export class Translator {
	metadata: zotero.TranslatorMetadata;
	private translator: zotero.TranslatorImpl;
	private environment: translator_environment.TranslatorGlobal;

	constructor(metadata: zotero.TranslatorMetadata,
	            translator: zotero.TranslatorImpl,
				environment: translator_environment.TranslatorGlobal) {
		this.metadata = metadata;
		this.translator = translator;
		this.environment = environment;
	}

	detectAvailableItemType(document: Document, url: string): string {
		try {
			this.environment.Zotero.Utilities.currentUrl = url;
			return this.translator.detectWeb(document, url);
		} catch (err) {
			logTranslatorError(this.translator.code, err);
			return null;
		}
	}

	processPage(document: Document, url: string): Q.Promise<zotero.ZoteroItem>[] {
		savedItems = [];
		try {
			this.environment.Zotero.Utilities.currentUrl = url;
			this.translator.doWeb(document, url);
			return savedItems;
		} catch (err) {
			logTranslatorError(this.translator.code, err);
			return null;
		}
	}
}

interface TranslatorSource {
	metadata: zotero.TranslatorMetadata;
	translatorCode: string;
	testCases: zotero.TestCase[];
}

// Zotero translators are JS files split into three sections.
// splitSource() takes an input JS file, splits it into the three
// sections and parses the metadata and test cases.
//
// - Metadata (JSON object)
// - Translator source (JS code)
// - Test cases ('var testCases = <JS array>')
//
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
	
	let translatorGlobal = translator_environment.createEnvironment();
	let translatorContext = vm.createContext(translatorGlobal);
	script.runInContext(translatorContext);
	
	return {
		environment: translatorGlobal,
		impl: {
			code: source,
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
	return new Translator(translatorSource.metadata,
	                      translator.impl,
	                      translator.environment);
}

