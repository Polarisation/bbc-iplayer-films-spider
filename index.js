const request = require("request");
const cheerio = require("cheerio");
const Bottleneck = require("bottleneck");

const BASE_URL = "https://www.bbc.co.uk";

function loadFilms(uri = "https://www.bbc.co.uk/iplayer/categories/films/all?sort=atoz", films = {}) {
	return new Promise((resolve, reject) => {
		console.log("Fetching "+uri);
		console.time("Fetched "+uri);
		request({
			uri: uri
		}, function (error, response, body) {
			if(error)
				reject(error);

			console.timeEnd("Fetched "+uri);

			let $ = cheerio.load(body);

			let baseUrl = response.request.uri.protocol + "//" + response.request.uri.host;

			let filmPromises = [];
			$(".programme, .episode").each(function() {
				let $programme = $(this);

				let uri = baseUrl + $programme.find("a.list-item-link").attr('href');
				films[uri] = {
					title: $programme.find(".top-title").text(),
					subtitle: $programme.find(".subtitle").text(),
					uri: uri,
					synopsis: $programme.find('.synopsis').text(),
					duration: parseInt($programme.find('.duration').text().trim().match(/[0-9]+/)[0]),
				};

				let $viewMoreLink = $programme.find('.view-more-grid a.avail');
				if($viewMoreLink.length) {
					let moreUrl =	baseUrl + $viewMoreLink.attr('href');
					filmPromises.push(loadFilms(moreUrl, films));
				}
			});

			Promise.all(filmPromises).then((allFilms) => {
				let filmsFromPage = allFilms.reduce((accumArray, curArray) => Object.assign(accumArray, curArray), films)
				let $next = $(".next.txt a");
				if($next.length) {
					let nextUrl = baseUrl + $next.attr('href');
					resolve(loadFilms(nextUrl, filmsFromPage));
				} else
					resolve(filmsFromPage);
			});
		});
	});
}

function fetchFilmDetails(film) {
	return new Promise((resolve, reject) => {
		console.log("Fetching "+film.uri);
		console.time("Fetched "+film.uri);
		request(film.uri, function(error, response, body) {
			if(error)
				reject(error);

			console.timeEnd("Fetched "+film.uri);

			let $ = cheerio.load(body);

			$('.synopsis__large button').remove();
			film.description = $('.synopsis__large').text();

			resolve(film);
		});
	})
}

let limiter = new Bottleneck(1, 0);
function addFilmDetails(films) {
	let filmPromises = Object.keys(films).map(k => limiter.schedule(fetchFilmDetails, films[k]));
	return Promise.all(filmPromises);
}

loadFilms()
.then((films) => addFilmDetails(films))
.then((films) => {
	// console.log(films);
	Object.keys(films).forEach(k => console.log(films[k].title + " " + films[k].subtitle))
	console.log(Object.keys(films).length + " films found");
})
.catch((error) => console.error(error));
