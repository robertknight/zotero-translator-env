$(function() {

    var endpoint = 'http://localhost:9876/metadata/extract'
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
      e.preventDefault();

      var accessToken = $('#access-token').val();

      extractedData.forEach(function (data) {
          save(data, accessToken);
      });
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
        success: function (data) {
            extractedData = data;

            $('#response').text(JSON.stringify(data, null, 2));
            $('#summary').show();
        }
    });
  });
});
