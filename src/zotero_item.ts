import * as zotero from './translator_interfaces';

export class Item implements zotero.ZoteroItem {
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
		global.addItem(this.result.promise);
	}

	complete() {
		this.result.resolve(this);
	}
}


