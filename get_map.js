/**
 * Create a server to handle requests to get geojson data and request to get the map with tweets 
 **/
var http = require('http');
var url = require('url');
var config = require('./config.js');
var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;

//Creates the server
http.createServer(function (req, res) {
	//get path requested
	var path = url.parse(req.url).pathname;
	switch(path){
		case "/tweets.geojson": //return data in geojson format
			
			//Creates a connection to mongodb
			MongoClient.connect(config.mongo_url + config.mongo_db, function(err, db) {
				if (err) throw err;
				console.log("Connected to database!");
				//get database
				var dbo = db.db(config.mongo_db);
				//get all the tweets stored
				dbo.collection("tweets").find().sort({"properties.id": -1}).toArray(function(err, results) {
					if (err) throw err;
					//get results in geojson format
					var geojson = {
						"type": "FeatureCollection",
						"features": results
					};
					//write http response
					res.writeHead(200, {
						'Content-Type': 'text/json',
						'Access-Control-Allow-Origin': '*',
						'X-Powered-By':'nodejs'
					});
					res.write(JSON.stringify(geojson));
					res.end();
					
					//close db connection
					db.close();
				});
			});
			
		break;
		default: //by default get the map
			
			//Read map data 
			fs.readFile("map.html", "utf8", function(error, data) {
				if (error) {
					console.log(error.message);
				}else{
					//replace configuration parameters
					data = data.replace("<ACCESS_TOKEN>",config.map_box_access_token);
					data = data.replace("<LATITUDE>",config.map_box_latitude);
					data = data.replace("<LONGITUDE>",config.map_box_longitude);
					data = data.replace("<RADIUS>",config.map_box_radius);
					//write response
					res.writeHead(200, {'Content-Type': 'text/html'});
					res.write(data);
					res.end();
				}
			});
		break;
	}
	
}).listen(8080);
console.log("Server running in localhost:8080");