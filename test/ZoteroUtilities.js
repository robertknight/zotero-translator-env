var jsdom = require('jsdom'),
    utils = require('../src/ZoteroUtilities.js'),
    assert = require('assert');

describe('Zotero Utilities', function() {
    describe('xpath', function() {
      var extractor = utils.xpath;

      it('should extract elements by XPath', function(next) {
          jsdom.env('http://iojs.org/en/index.html', function(error, window) {
              if (error) {
                  return next(error);
              }
              var url = extractor(window.document, '/html/body/div/div[1]/a/img')[0].src;

              assert.equal(url, 'https://iojs.org/images/1.0.0.png');

              return next();
          });
      });
    });

    describe('xpathText', function() {
      var text = utils.xpathText;

      it('should extract text from elements using XPath', function(next) {
          jsdom.env('http://iojs.org/en/index.html', function(error, window) {
              if (error) {
                  return next(error);
              }
              var url = text(window.document, '/html/body/footer/nav[1]/a');

              assert.equal(url, 'Releases, GitHub Issues, GitHub Org, IRC Chat, Logs, Governance');

              return next();
          });
      });
    });
});
