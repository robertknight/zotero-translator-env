var lodash = require('lodash');
var fetch = require('isomorphic-fetch');
var urlLib = require('url');

/*****************************/

/**
 * Extracts elements by XPath
 * @source https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/utilities.js#L1034
 *
 * @param {element|element[]} elements The element(s) to use as the context for the XPath
 * @param {String} xpath The XPath expression
 * @param {Object} [namespaces] An object whose keys represent namespace prefixes, and whose
 *                              values represent their URIs
 * @return {element[]} DOM elements matching XPath
 */
var XPathExtractor = exports.xpath = function XPathExtractor(elements, xpath, namespaces) {
    var nsResolver = null;

    if (namespaces) {
        nsResolver = function(prefix) {
            return namespaces[prefix] || null;
        };
    }

    if (!lodash.isArray(elements)) {
       elements = [elements];
    }

    return lodash.reduce(elements, function(results, element) {
		var root;
		if (element.ownerDocument) {
			root = element.ownerDocument;
		} else if (element.documentElement) {
			root = element;
		}

		var newElement;
        if (!root) {
            throw new Error('xpath: First argument must be either element(s) or document(s)');
        }

		var xpathObject = root.evaluate(xpath, element, nsResolver, 5 /*ORDERED_NODE_ITERATOR_TYPE*/, null);
		while (newElement = xpathObject.iterateNext()) {
			results.push(newElement);
		}

        return results;

    }, []);
}

/**
 * Generates a string from the content of nodes matching a given XPath
 * @source https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/utilities.js#L1121
 *
 * @param {element} node The node representing the document and context
 * @param {String} xpath The XPath expression
 * @param {Object} [namespaces] An object whose keys represent namespace prefixes, and whose
 *                              values represent their URIs
 * @param {String} [delimiter] The string with which to join multiple matching nodes
 * @return {String|null} DOM elements matching XPath, or null if no elements exist
 */
var XPathText = exports.xpathText = function XPathText(node, xpath, namespaces, delimiter) {
    var elements = XPathExtractor(node, xpath, namespaces);

    if (!elements.length) {
        return null;
    }

    return lodash.map(elements, function(element) {
        return (element.nodeType === 2 /*ATTRIBUTE_NODE*/ && 'value' in element) ? element.value
            : 'textContent' in element ? element.textContent
            : 'innerText' in element ? element.innerText
            : 'text' in element ? element.text
            : element.nodeValue;

    }).join(delimiter || ', ');
}

/**
 * Cleans whitespace off a string and replaces multiple spaces with one
 * @source https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/utilities.js#L230
 *
 * @param {String} s string that would be trimmed
 * @return {String} trimmed string
 */
var trimInternal = exports.trimInternal = function trimInternal(s) {
    if (typeof s !== 'string') {
        throw new Error('trimInternal: argument must be a string');
    }

    return lodash.trim(s.replace(/[\xA0\r\n\s]+/g, ' '));
}

/**
 * Cleans extraneous punctuation off a creator name and parse into first and last name
 * @source https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/utilities.js#L151
 *
 * @param {String} author Creator string
 * @param {String} type Creator type string (e.g., "author" or "editor")
 * @param {Boolean} useComma Whether the creator string is in inverted (Last, First) format
 * @return {Object} firstName, lastName, and creatorType
 */
var cleanAuthor = exports.cleanAuthor = function cleanAuthor(author, type, useComma) {
    var allCaps, allCapsRe, initialRe, splitNames, lastName, firstName,
        spaceIndex, newFirstName, names, i, n;

    allCaps = 'A-Z' +
              '\u0400-\u042f'; //cyrilic

    allCapsRe = new RegExp('^[' + allCaps + ']+$');
    initialRe = new RegExp('^-?[' + allCaps + ']$');

    if (typeof author !== 'string') {
        throw new Error('cleanAuthor: author must be a string');
    }

    author = author.replace(/^[\s\u00A0\.\,\/\[\]\:]+/, '')
                   .replace(/[\s\u00A0\.\,\/\[\]\:]+$/, '')
                   .replace(/[\s\u00A0]+/, ' ');

    if (useComma) {
        // Add spaces between periods
        author = author.replace(/\.([^ ])/, ". $1");
        splitNames = author.split(/, ?/);

        if (splitNames.length > 1) {
            lastName = splitNames[0];
            firstName = splitNames[1];
        } else {
            lastName = author;
        }

    } else {
        spaceIndex = author.lastIndexOf(" ");
        lastName = author.substring(spaceIndex+1);
        firstName = author.substring(0, spaceIndex);
    }

    if (firstName && allCapsRe.test(firstName) && firstName.length < 4 &&
        (firstName.length == 1 || lastName.toUpperCase() != lastName)) {

        // first name is probably initials
        newFirstName = '';
        for (i = 0; i < firstName.length; i++) {
            newFirstName += ' ' + firstName[i] + '.';
        }
        firstName = newFirstName.substr(1);
    }

    //add periods after all the initials
    if (firstName) {
      names = firstName.replace(/^[\s\.]+/,'')
                       .replace(/[\s\,]+$/,'')
                       //remove spaces surronding any dashes
                       .replace(/\s*([\u002D\u00AD\u2010-\u2015\u2212\u2E3A\u2E3B])\s*/,'-')
                       .split(/(?:[\s\.]+|(?=-))/);

      newFirstName = '';
      for (i = 0, n = names.length; i < n; i++) {
        newFirstName += names[i];
        if (initialRe.test(names[i])) {
            newFirstName += '.';
        }
        newFirstName += ' ';
      }
      firstName = newFirstName.replace(/ -/g,'-').trim();
    }

    return { firstName: firstName, lastName: lastName, creatorType: type };
}

// performs an async network GET request
exports.doGet = function(environment, relativeUrl, callback) {
	var absoluteUrl = urlLib.resolve(environment.context.currentUrl, relativeUrl);
	environment.context.beginRequest(absoluteUrl);
	return environment.fetch(absoluteUrl).then(function(response) {
		return response.text();
	}).then(function(body) {
		callback(body);
	}).catch(function(err) {
		console.error('Failed to fetch', absoluteUrl, err.toString(), err.stack);
		callback('');
	}).then(function() {
		environment.context.endRequest();
	});
}

