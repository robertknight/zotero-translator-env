import * as fs from 'fs';
import * as path from 'path';
import * as Q from 'q';
import {expect} from 'chai';

import * as translator from '../src/translator';
import * as zotero from '../src/zotero_types';

// list of translators to test

let TEST_TRANSLATORS = [
  'Oxford University Press',
  'Google Books'
];

function loadTranslatorFromFile(path: string) {
	let src = fs.readFileSync(path).toString();
	return translator.loadTranslator(src);
}

// 'sanitize' translated items to match the form expected
// by the test case results:
// - Sort tags alphabetically
// - Ignore attachment URLs
//
// See https://github.com/zotero/zotero/blob/f2fb6e2e9c876408699944ec7be50987f5ca90bf/chrome/content/zotero/tools/testTranslators/translatorTester.js#L204
//
function sanitizeItems(items: zotero.Item[]) {
	const IGNORED_PROPS = ['environment'];
	return items.map(item => {
		let resultItem: zotero.Item = <zotero.Item>{};
		for (let k in item) {
			// ignore private fields in zotero_item.Item() class.
			// Possibly look into using TS decorators to mark fields
			// which are not part of the public zotero.Item type
			// definition.
			if (item.hasOwnProperty(k) && IGNORED_PROPS.indexOf(k) === -1) {
				let value = (<any>item)[k];
				if (typeof value !== 'undefined' && value !== null) {
					(<any>resultItem)[k] = value;
				}
			}
		}

		// sort tags alphabetically
		resultItem.tags.sort();

		// remove URLs from attachments
		for (let i=0; i < resultItem.attachments.length; i++) {
			delete resultItem.attachments[i].url;
		}

		return resultItem;
	});
}

TEST_TRANSLATORS.forEach(translatorName => {
	describe(translatorName, function() {
		this.timeout(30000);

		const translatorPath = path.resolve(`${__dirname}/../../translators/${translatorName}.js`);
		const translatorInstance = loadTranslatorFromFile(translatorPath);

		translatorInstance.testCases.map(testCase => {
			it(`should import from ${testCase.url}`, () => {
				return translator.fetchItemsAtUrl(testCase.url, [translatorInstance]).then(items => {
					let sanitizedItems = sanitizeItems(items);
					expect(sanitizedItems).to.deep.equal(testCase.items);
				});
			});
		});
	});
});

