import * as vm from 'vm';
import * as util from 'util';

import * as zotero from './translator_interfaces';

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
	let translatorGlobal = {
		exports: <zotero.TranslatorImpl>{}
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

