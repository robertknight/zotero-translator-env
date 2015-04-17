$(function() {

    var endpoint = 'http://localhost:9876/meta/extract'
    var currentUrl = null;
    var currentTitle = null;
    var extractedData = null;

    var save = function(data, accessToken) {
      $.ajax({
      url: 'https://api.mendeley.com/documents',
      type: 'POST',
      contentType: 'application/vnd.mendeley-document.1+json',
      data: JSON.stringify(data),
      rocessData: false,
      dataType: 'json',
      headers: {
        Authorization: 'Bearer ' + accessToken
      },
      success: function() {
        $('#save').hide();
        $('#view').show();
      }
      });
    };

    $('#save').on('click', function(e) {
      var accessToken = $('#access-token').val();
      // mock data
      var mockData = {
        title: currentTitle,
        type: "web_page",
        websites: [currentUrl]
      };
      save(mockData, accessToken);
      // save(extractedData, accessToken)
      e.preventDefault();
    });

  chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    currentUrl = tabs[0].url;
    currentTitle = tabs[0].title;

    $('#response').text('Fetching data...');

    // query Translation Service to populate extractedData
    $.ajax({
        url: endpoint,
        type: 'GET',
        data: {
            url: currentUrl
        },
        dataType: 'text',
        success: function (json) {
            $('#response').text(json);
        };
    });
  });
});
