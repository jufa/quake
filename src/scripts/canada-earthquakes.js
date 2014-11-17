var quake = (function($){
    var dataSource = 'http://www.earthquakescanada.nrcan.gc.ca/api/earthquakes/latest/365d.json';
    var features = [];
    var quakeData; //json object with quake data from data.gc.ca
    var dateEarliest,dateLatest; //Date Object 
    var TIMESTAMP_MIN = -8640000000000000;
    var TIMESTAMP_MAX = 8640000000000000;
    var timestampSpan = 1*48*60*60*1000; //0.5 days in msec 
    /**
     * @brief pushes features onto the vecor layer of the 
     *        active that falll between the start and end timestamps
     * @param {startTimestamp}   UNIX timestamp format, if unspecified will uise earliest date possible
     * @param {endTimestamp}     UNIX timestamp format, if unspecified will uise latest date possible
     * @returns none;       updates vectorSource, dateEarliest, dateLatest app-level variables
     *
     **/
    function selectDataRange(startTimestamp, endTimestamp) {
        var first = Number.MAX_VALUE;
        var last = 0.0;
        if (isNaN(startTimestamp)) startTimestamp = TIMESTAMP_MIN;
        if (isNaN(endTimestamp)) endTimestamp = TIMESTAMP_MAX;
        if (vectorSource !== null) vectorSource.clear();
        features = [];
        var lon,lat;
        var quakeDate = 0.0;
        var count = 0;
        $.each( quakeData, function( key, val ) {
            if(val.geoJSON) {
                if (val.timestamp) {
                    quakeTimestamp = Number(val.timestamp); 
                    //check date range
                    if (quakeTimestamp > startTimestamp && quakeTimestamp < endTimestamp ) {
                        count++;
                        lat = val.geoJSON.coordinates[0];
                        lon = val.geoJSON.coordinates[1];
                        features.push(drawQuakeFeature(lon, lat, val.magnitude));
                    }
                } 
            }
        });

        vectorSource.addFeatures( features );
        //console.log("QUAKES: " + count + "F: "+dateEarliest+ "\tL: " + dateLatest);
    }
    
    /**
     *
     * @brief add unix timestamp key:value to json data from data.gc.ca
     *
     */
    function addTimestamps () {
        var d;
        var first = new Date(TIMESTAMP_MAX);
        var last = new Date(TIMESTAMP_MIN)//dates of first and last quake in data, set todate
        $.each( quakeData, function( key, val ) {
            if(val.geoJSON) {
                if (val.solution_id) {
                    quakeDate = val.solution_id; 
                    //parse solution date YYYYMMDD.HHMMSS (utc)
                    // to timestamp using Date(year, month, day, hours, minutes, seconds, milliseconds)
                    var YYYY =  Number(quakeDate.substring(0, 4));
                    var MM = Number(quakeDate.substring(4, 6)) - 1; //0-11 for jan-dec
                    var DD = Number(quakeDate.substring(6, 8));
                    var hh = Number(quakeDate.substring(9, 11));
                    var mm = Number(quakeDate.substring(11, 13));
                    var ss = Number(quakeDate.substring(9, 11));
                    var date = new Date(Date.UTC (YYYY,MM,DD,hh,mm,ss));
                    val.timestamp = date.getTime();
                    
                    if(date < first) first = date;
                    if(date > last) last = date;
                    
                    //verify UTC is sync'd:
                    //console.log(val.solution_id, YYYY,MM,DD,hh,mm,ss, date, val.timestamp, date.toUTCString());
                }
            } 
        });
        dateEarliest = first;
        dateLatest = last;
    }

    function parseData (data) {
        quakeData = data;
        addTimestamps();
        selectDataRange();
    }

    function getData(callback) {
        "use strict";
        $.getJSON(dataSource, function (data) {
            parseData(data);
            callback();
        });
    }

    function drawQuakeFeature(lon, lat, mag) {
        "use strict";
        var multiplier = 50000; //radius 1 = 1 metre
        var center = ol.proj.transform([lon, lat], 'EPSG:4326','EPSG:3857');
        var feature  = new ol.Feature({
          geometry: new ol.geom.Circle( center, mag*multiplier)
        });
        return feature;
    }


    var vectorSource = new ol.source.Vector();

    var vector = new ol.layer.Vector({
      title: 'Earthquakes',
      source: vectorSource
    });

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

    var initInterface = function() {
        $('#time').slider({
            min: Math.floor(dateEarliest),
            max: Math.floor(dateLatest),
            step:1,
            value: Math.floor(dateEarliest)
        });
        $('.slider-holder').css({'visibility':'visible'});
        $('#time').slider()
            .on('slide', function(ev) {
            handleTimeUpdate(ev.value);
          });

        $('#labelEarliest').html(dateEarliest.toUTCString());
        $('#labelLatest').html(dateLatest.toUTCString());
    };

    var handleTimeUpdate  = function (time) {
        selectDataRange(time-timestampSpan, time+timestampSpan);
    };

    getData(initInterface); //includes loading display


}($));



