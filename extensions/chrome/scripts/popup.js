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

      if (localStorage.accessToken == null) {
          localStorage.accessToken = $('#access-token').val();

          $('#access-token').hide();
          $('#access-token-value').text(localStorage.accessToken);
      }

      extractedData.forEach(function (data) {
          save(data, localStorage.accessToken);
      });
    });

    $('#clear-token').on('click', function(e) {
      e.preventDefault();

      localStorage.removeItem('accessToken');

      $('#access-token').show();
      $('#access-token-value').text('');

    });

  chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    currentUrl = tabs[0].url;
    currentTitle = tabs[0].title;

    if (localStorage.accessToken != null) {
        $('#access-token').hide();
        $('#access-token-value').text(localStorage.accessToken);
    }

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

            $('#response').html(renderInfo(data[0]));
            $('#summary').show();
        }
    });
  });
});

function renderInfo(data) {
    return '' +

    '<div><strong>Title:</strong> <p>' + data.title + '</p><div>' +
    '<div><strong>Authors:</strong> <p>' + convertAuthors(data.authors) + '</p><div>' +
    '<div><strong>Abstract:</strong> <p>' + data.abstract + '</p><div>';

}

function convertAuthors(authors) {
    return authors.map(function (author) {
        return (author.last_name || '') + ' ' + (author.first_name && author.first_name[0] || '');
    }).join(', ');
}
