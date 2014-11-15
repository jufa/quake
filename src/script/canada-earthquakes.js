var dataSource = 'http://www.earthquakescanada.nrcan.gc.ca/api/earthquakes/latest/365d.json';
var features = [];
var quakeData; //json object with quake data from data.gc.ca
var timestampEarliest = 0.0;
var timestampLatest = 0.0; //date range for found data

function getData (callback) {

		$.getJSON(dataSource, function(data){
			parseData(data);
			callback();
		})
		
	}
	
function drawQuakeFeature(lon, lat, mag) {
		var multiplier = 50000; //radius 1 = 1 metre
		var center = ol.proj.transform([lon, lat], 'EPSG:4326','EPSG:3857');
		var feature  = new ol.Feature({
		  geometry: new ol.geom.Circle( center, mag*multiplier)
		});
		return feature;
	}
	
	
function parseData (data){
		quakeData = data;
		selectDataRange();
	}
	
/**
 * 
 * @param {startDate} 	string formatted as 20141113.201700 or YYYYMMDD.HHMMSS (utc)
 *						(note how handy this format is for quick date comparison, 
 *						 just don't try and find a time interval with it!)
 * @param {endDate} 	string formatted as 20141113.201700 or YYYYMMDD.HHMMSS (utc)
 * @returns none; 		updates vectorSource, timestampEarliest, timestampLatest app-level variables
 *
 **/
function selectDataRange(startDate, endDate) {
	first = Number.MAX_VALUE;
	last = 0.0;
	if (isNaN(startDate)) startDate = 0.0;
	if (isNaN(endDate)) endDate = Number.MAX_VALUE;
	if (vectorSource != null) vectorSource.clear();
	features = [];
	var lon,lat;
	var quakeDate = 0.0;
	var count = 0;
	$.each( quakeData, function( key, val ) {
		if(val.geoJSON) {
			if (val.solution_id) {
				quakeDate = Number(val.solution_id); 
				//console.log(quakeDate);
				if(quakeDate < first) first = quakeDate;
				if(quakeDate > last) last = quakeDate;
				//check date range:
				if (quakeDate > startDate && quakeDate < endDate ) {
					count++;
					lat = val.geoJSON.coordinates[0];
					lon = val.geoJSON.coordinates[1];
					features.push(drawQuakeFeature(lon, lat, val.magnitude));
				}
			} 
			
		}
	});
	
	vectorSource.addFeatures( features );
	
	timestampEarliest = first;
	timestampLatest = last;
	console.log("QUAKES: " + count + "F: "+timestampEarliest+"\tL: "+timestampLatest);
	}

var vectorSource = new ol.source.Vector();

var vector = new ol.layer.Vector({
  title: 'Earthquakes',
  source: vectorSource
})

var raster = new ol.layer.Tile({
  source: new ol.source.OSM()
});

var map = new ol.Map({
  layers: [raster,vector],
  target: 'map',
  renderer: 'canvas', // Force the renderer to be used
  view: new ol.View({
    center: ol.proj.transform([-75, 55], 'EPSG:4326','EPSG:3857'),
    zoom: 2
  })
});

var initInterface = function(){
	console.log("QUAKES: F: "+timestampEarliest+"\tL: "+timestampLatest);

	$('#time').slider({
		min: Math.floor(timestampEarliest),
		max: Math.floor(timestampLatest),
		step:1,
		value: Math.floor(timestampEarliest)
	});
	$('#time').slider()
		.on('slide', function(ev){
		handleTimeUpdate(ev.value)
		
	  });
	  
	$('#labelEarliest').html(Math.floor(timestampEarliest));
	$('#labelLatest').html(Math.floor(timestampLatest));
}

var handleTimeUpdate  = function (time) {
	console.log(features);
	selectDataRange(time-1.0, time+1.0);
}

getData(initInterface); //includes loading display



