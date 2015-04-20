import * as zotero from './zotero_types';

export class Item implements zotero.Item {
	itemType: string;
	creators: zotero.Creator[];
	notes: zotero.Note[];
	tags: string[];
	seeAlso: string[];
	attachments: zotero.Attachment[];

	context: any; // TranslationContext

	constructor(context: any, itemType: string) {
		this.itemType = itemType;
		this.creators = [];
		this.notes = [];
		this.tags = [];
		this.seeAlso = [];
		this.attachments = [];

		this.context = context;
	}

	complete() {
		this.context.saveItem(this);
	}
}


