/**
* Get tweets geolocated from Twitter
* To retrieve the tweets the query is limited to a coordinates and a radius
* Data is stored in a database to be extracted by the presentation process
**/
//Initialize variables and objects
var Twit = require('twit');
var config = require('./config.js');
var sleep = require('system-sleep');
var MongoClient = require('mongodb').MongoClient;
var bigInt = require("big-integer");

var twitter = new Twit(config);
var hasNext = true;
var iteration = 1;

//database object
var dbo;

//Initialize parameters to search by: latitude, longitude, radius(km)
var params = {
	q: "", 
	geocode: config.map_box_longitude + "," + config.map_box_latitude + "," + config.map_box_radius + "km",
	count: 100,
	since_id: null
};

//Creates a connection to mongodb
MongoClient.connect(config.mongo_url + config.mongo_db, function(err, db) {
	if (err) throw err;
	console.log("Connected to database!");
	//get database
	dbo = db.db(config.mongo_db);
	
	//get the max tweet id inserted (if any) to set as since_id value
	dbo.collection("tweets").find().sort({"properties.id": -1}).limit(1).toArray(function(err, result) {
		if (err) throw err;
		if(result.length > 0){
			params.since_id = bigInt(result[0].properties.id).add(1).toString();
		}
	});
	  
	//Get tweets from latest id to since_id (if present)
	twitter.get('search/tweets', params, results);
  
	//get results from twitter search API
	function results(err, data, response){
		console.log("Iteration Number: " + iteration);
		console.log("max_id: " + params.max_id + ", since_id: " + params.since_id);
		iteration++;
		if(err != undefined){
			//If error exist, usually max number of requests reached, print error and sleep to go on later
			console.log("Error: " + err);
			sleep(360000);
			//try again
			twitter.get('search/tweets', params,results);
		}else{
			//filter results and write to DB
			formatResults(data.statuses);
			//check if hasNext and since_id > 0 to search for recent results I already have
			if(hasNext){
				//search again in recursive way
				twitter.get('search/tweets', params,results);
			}else{
				if(params.since_id != null){
					//try to get older tweets than I already have
					console.log("Getting older tweets!");
					params.since_id = null;
					hasNext = true;
					//get the older tweet
					dbo.collection("tweets").find().sort({"properties.id": 1}).limit(1).toArray(function(err, result) {
						if (err) throw err;
						if(result.length > 0){
							//set the older as max_id
							params.max_id = bigInt(result[0].properties.id).minus(1).toString();
							//search again in recursive way
							twitter.get('search/tweets', params,results);
						}
					});
				}else{
					//No more results close the db connection
					db.close();
					console.log("Done!");
				}
			}
		}
	}
	
	//Format the results in geocode format and filter tweets only with tweets with geolocation enable
	function formatResults(data){
		//Iterate results
		for(var i=0;i<data.length;i++){
			//check if coordinates exist
			if(data[i].coordinates != null){
				//define object properties 
				var line = {
					type: "Feature",
					properties: {
						created_at: data[i].created_at,
						id: data[i].id_str,
						relevance: "1" //relevance value is prepared for interpolate result if a relevance factor is defined
					},
					geometry: data[i].coordinates
				};
				//insert in DB
				dbo.collection("tweets").insertOne(line,function(err, res) {
					if (err) throw err;
				});
			}
		}
		if(data.length > 0){
			//I had got results set max_id and iterate again
			params.max_id = bigInt(data[data.length - 1].id_str).minus(1).toString();
		}else{
			//I didn't have results
			hasNext = false;
		}
	}
	
	//If the process stopped then close db connection
	//This is a workaround for windows operating systems
	if (process.platform === "win32") {
		var rl = require("readline").createInterface({
			input: process.stdin,
			output: process.stdout
		});
		rl.on("SIGINT", function () {
			process.emit("SIGINT");
		});
	}
	//Detect process stop
	process.on("SIGINT", function () {
		//If process is interrupted I close the connection
		db.close();
		console.log("Process stopped!");
		process.exit();
	});

});








