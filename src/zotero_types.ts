// interfaces exposed by Zotero translators

export interface TranslatorImpl {
	code: string;

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
	items: Item[];
}

// interfaces used by Zotero translators to
// create items
export interface Attachment {
	url: string;
	title: string;
	mimeType: string;
}

export interface Creator {
	firstName: string;
	lastName: string;
	creatorType: string;
}

export interface Note {
	note: string;
}

// see https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/data/item.js
export interface Item {
	itemType: string;

	creators: Creator[];
	notes: Note[],
	tags: string[],
	seeAlso: string[],
	attachments: Attachment[];

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
	DOI?: string;
	publisher?: string;
	// place (74)
	ISBN?: string;
	volume?: string;
	ISSN?: string;
	issue?: string;
	numPages?: string;
	edition?: string;
	// language (44)
	// series (39)
	// journalAbbreviation (34)
	// itemID (29)
	// bookTitle (29)

	complete(): void;
}

