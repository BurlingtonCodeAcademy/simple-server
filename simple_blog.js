const fs = require('fs');
const http = require('http');
const $path = require('path');

const Assistant = require('./lib/assistant');
const publicDir = $path.resolve('./public');
const port = process.env.PORT || 5000;

http.createServer(function (request, response) {
  let url = new URL(request.url, 'http://localhost:5000/') // require('url').parse(request.url);
  let path = url.pathname;
  let queryParams = url.searchParams;

  console.log('Finding ' + path);

  let assistant = new Assistant(request, response);
  let pathParams = parsePath(path);
  let articlesDir = $path.join(publicDir, "articles");

  console.log(pathParams)

  // routing
  if (pathParams.action === 'articles') {
    if (request.method === 'GET') {
      getArticles();
    } 
    else if (request.method === 'POST') {
      postArticles();
    }
  }
  else if (pathParams.action === 'search') {
    handleSearch();
  }
  else {
    assistant.handleFileRequest();
  }

  function getArticles() {
    if (pathParams.id) {
      sendArticle(pathParams);
    }
    else if (pathParams.format === 'json') {
      sendArticleList();
    }
    else {
      assistant.sendFile($path.join(publicDir, 'articles.html'));
    }
  }

  function handleSearch() {
    if (pathParams.format === 'json') {
      sendSearchResults()
    } else {
      assistant.sendFile($path.join(publicDir, 'search.html'));
    }
  }

  function sendArticle(pathParams) {
    let articleDataFile = $path.join(articlesDir, pathParams.id + ".json");
    if (pathParams.format === 'json') {
      // if it's asking for json, send it the json file
      assistant.sendFile(articleDataFile);
    } else {
      // if it's asking for HTML, send it the article.html file
      if (fs.existsSync(articleDataFile)) {
        let htmlFile = $path.join(publicDir, "article.html");
        assistant.sendFile(htmlFile);
      } else {
        assistant.sendError(404, `Article ${pathParams.id} not found`);
      }
    }
  }

  function allArticles() {
    return fs.readdirSync(articlesDir)
      .filter(file => file.endsWith('.json'))
      .map(file => JSON.parse(fs.readFileSync($path.join(articlesDir, file))));
  }

  function sendArticleList() {
    let data = JSON.stringify(allArticles());
    assistant.finishResponse('text/json', data);
  }

  function sendSearchResults() {
    let results = allArticles().filter((article) => {
      if (queryParams.get('author')) {
        let articleAuthor = article.author.toLowerCase();
        let targetAuthor = queryParams.get('author').toLowerCase();
        return articleAuthor.includes(targetAuthor);
      }
    });
    let data = JSON.stringify(results);
    assistant.finishResponse('text/json', data);
  }

  function parsePath(path) {
    let format;
    if (path.endsWith('.json')) {
      path = path.substring(0, path.length - 5);
      format = 'json';
    }
    let pathParts = path.slice(1).split('/');
    let action = pathParts.shift();
    let id = pathParts.shift();
    let pathParams = { action: action, id: id, format: format };
    return pathParams;
  }

  function postArticles() {
    let articles = allArticles();
    if (pathParams.id) {
      sendError(500, "TODO: update article")
    } else {
      // find the highest id...
      let id = articles.reduce((topId, article) => {
        console.log(article.id);
        return Math.max(topId, article.id);
      }, 1);
      // ...and pick a higher one
      let newId = id + 1;
      assistant.parsePostParams((params) => {
        console.log(params);
        let article = {
          id: newId,
          author: params.author,
          title: params.title,
          body: params.body
        }
        let articleDataFile = $path.join(articlesDir, newId + ".json");
        fs.writeFile(articleDataFile, JSON.stringify(article), (err) => {
          if (err) {
            assistant.sendError(500, err);
          } else {
            assistant.sendRedirect('/articles');
          }
        })
        console.log(article);
      });
    }
  }

}).listen(port);

console.log("Listening on port " + port);
