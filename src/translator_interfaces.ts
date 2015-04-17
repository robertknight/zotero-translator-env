// interfaces exposed by Zotero translators

export interface TranslatorImpl {
	detectWeb(doc: Document, url: string): string;
	doWeb(doc: Document, url: string): void;
	scrape?(doc: Document, url: string, title: string): void;
}

export interface Translator {
	metadata: TranslatorMetadata;
	impl: TranslatorImpl;
}

export interface TranslatorMetadata {
	translatorID: string;
	label: string;
	creator: string;
	target: string; // RegEx
	minVersion: string;
	maxVersion: string;
	priority: number;
	browserSupport: string;
	inRepository: boolean;
	translatorType: number;
	lastUpdated: string; // Date in YYYY-MM-DD HH:MM:SS format
}

export interface TestCase {
	type: string;
	url: string;
	items: ZoteroItem[];
}

// interfaces used by Zotero translators to
// create items
//
// Zotero.Utilities
// https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/utilities_translate.js
//
// Zotero Translator API
// https://github.com/zotero/zotero/tree/master/chrome/content/zotero/xpcom/translation
//
export interface ZoteroAttachment {
	url: string;
	title: string;
	mimeType: string;
}

export interface ZoteroCreator {
	firstName: string;
	lastName: string;
	creatorType: string;
}

export interface ZoteroNote {
	note: string;
}

// see https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/data/item.js
export interface ZoteroItem {
	itemType: string;

	creators: ZoteroCreator[];
	notes: ZoteroNote[],
	tags: string[],
	seeAlso: string[],
	attachments: ZoteroAttachment[];

	url?: string;
	publicationTitle?: string;
	title?: string;
	date?: string;
	section?: string;
	abstractNote?: string;
	libraryCatalog?: string;
	accessDate?: string;
	extra?: string;

	// TBD
	// extra (137)
	// pages (102)
	// DOI (87)
	// publisher (79)
	// place (74)
	// ISBN (72)
	// volume (62)
	// ISSN (60)
	// issue (59)
	// numPages (48)
	// language (44)
	// series (39)
	// journalAbbreviation (34)
	// itemID (29)
	// bookTitle (29)

	complete(): void;
}

