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

function postProcessItems(items: zotero.Item[]) {
	items.forEach(item => {
		item.tags.sort();
		delete (<any>item).context;
	});
	return items;
}

TEST_TRANSLATORS.forEach(translatorName => {
	describe(translatorName, function() {
		this.timeout(30000);

		const translatorPath = path.resolve(`${__dirname}/../../translators/${translatorName}.js`);
		const translatorInstance = loadTranslatorFromFile(translatorPath);

		translatorInstance.testCases.map(testCase => {
			it(`should import from ${testCase}`, () => {
				return translator.fetchItemsAtUrl(testCase.url, [translatorInstance]).then(items => {
					expect(postProcessItems(items)).to.deep.equal(testCase.items);
				});
			});
		});
	});
});

