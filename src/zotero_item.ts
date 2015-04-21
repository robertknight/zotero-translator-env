import * as zotero from './zotero_types';

interface Environment {
	context: {
		saveItem(item: zotero.Item): void;
	}
}

export class Item implements zotero.Item {
	itemType: string;
	creators: zotero.Creator[];
	notes: zotero.Note[];
	tags: string[];
	seeAlso: string[];
	attachments: zotero.Attachment[];

	environment: Environment;

	// item fields
	title: string;
	shortTitle: string;

	constructor(environment: Environment, itemType: string) {
		this.itemType = itemType;
		this.creators = [];
		this.notes = [];
		this.tags = [];
		this.seeAlso = [];
		this.attachments = [];
		this.environment = environment;
	}

	complete() {
		let subtitleIndex = this.title ? this.title.indexOf(':') : -1;
		if (!this.shortTitle && subtitleIndex !== -1) {
			this.shortTitle = this.title.slice(0, subtitleIndex);
		}
		this.environment.context.saveItem(this);
	}
}


