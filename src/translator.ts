import * as vm from 'vm';
import * as util from 'util';
import * as rx from 'rx-lite';
import * as Q from 'q';

var stack_trace = require('stack-trace');

import * as zotero from './zotero_types';
import * as translator_environment from './translator_environment';

interface CallStackEntry {
	getTypeName(): string;
	getFunctionName(): string;
	getMethodName(): string;
	getFileName(): string;
	getLineNumber(): number;
	getColumnNumber(): number;
	isNative(): boolean;
}

function logTranslatorError(code: string, err: Error) {
	let trace = stack_trace.parse(err);

	// find the line in the translator source where the
	// error occurred. The file name of the translator source
	// is set when the Script() object for it is created
	let lines = code.split('\n');
	let errLine = '';
	trace.forEach((entry: CallStackEntry) => {
		if (entry.getFileName().match(/<translator/)) {
			errLine = lines[entry.getLineNumber()-1].trim();
		}
	});

	console.error(`translator error at "${errLine}": ${err.toString()}
  ${(<any>err).stack}`);
}

/** Wraps a Zotero translator and provides methods to invoke
  * the translator's functions to detect available items
  * on a page and import them.
  */
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

	/** Detect the type of item available to import on the given
	  * page.
	  */
	detectAvailableItemType(document: Document, url: string): string {
		try {
			this.environment.context.currentUrl = url;
			return this.translator.detectWeb(document, url);
		} catch (err) {
			logTranslatorError(this.translator.code, err);
			return null;
		}
	}

	/** Process the given page and return all items found. */
	processPage(document: Document, url: string): rx.Observable<zotero.Item> {
		try {
			this.environment.context.reset(url);
			this.translator.doWeb(document, url);
			this.environment.context.complete();
			return this.environment.context.items;
		} catch (err) {
			logTranslatorError(this.translator.code, err);
			return rx.Observable.from([]);
		}
	}
}

/** Output of parsing a Zotero Translator source file. */
interface TranslatorSource {
	metadata: zotero.TranslatorMetadata;

	/** The JavaScript source code for the translator.
	  * In order to eval() this, a suitable global context
	  * needs to be created which provides the APIs that
	  * the translators expect to find.
	  */
	translatorCode: string;

	/** The set of translator test cases embedded in the translator
	  * source file.
	  */
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
	let translatorCodeEnd: number;

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

function loadTranslatorModule(name: string, source: string) {
	let exportedFuncs = ['detectWeb', 'doWeb'];

	for (let name of exportedFuncs) {
		source = source + '\n' + `exports.${name} = ${name}`;
	}

	let script = new (<any>vm).Script(source, {
		// spaces in the name are replaced here to work around
		// a bug in the 'stack-trace' module's parsing of file names
		filename: `<translator:${name.replace(/\s/g,'-')}>`
	});
	let savedItems: Q.Promise<zotero.Item>[] = [];
	
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

/** Load a translator from a given JS source file.
  * The format of the translator source files should match those in
  * the Zotero Translators repository - see github.com/zotero/translators
  */
export function loadTranslator(source: string): Translator {
	// translators consist of three sections:
	//
	// 1. A JSON object containing metadata for the translator
	// 2. The source code for the translator
	// 3. Test cases for the translator

	const translatorSource = splitSource(source);

	let translator = loadTranslatorModule(translatorSource.metadata.label,
	                                      translatorSource.translatorCode);
	return new Translator(translatorSource.metadata,
	                      translator.impl,
	                      translator.environment);
}

