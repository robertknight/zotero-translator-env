export class DOMElement {
	textContent: string;

	constructor(text?: string) {
		this.textContent = text || '';
	}

	getElementsByClassName(className: string) {
		return [new DOMElement(`child with class ${className}`)];
	}

	getElementsByTagName(tagName: string) {
		return [new DOMElement(`child with tag ${tagName}`)];
	}
}


