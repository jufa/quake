var quake = (function($){
    var dataSource = 'http://www.earthquakescanada.nrcan.gc.ca/api/earthquakes/latest/365d.json';
    var features = [];
    var quakeData; //json object with quake data from data.gc.ca
    var dateEarliest,dateLatest; //Date Object 
    var TIMESTAMP_MIN = -8640000000000000;
    var TIMESTAMP_MAX = 8640000000000000;
    var timestampSpan = 1*48*60*60*1000; //0.5 days in msec 
    var scrubber;//scrubber control ref
    var vectorSource = new ol.source.Vector();
    var quakeOpacity = 0.9;//opacity of quake indicator circles
    var colours = ["#66CCFF", "#66FFFF", "#66FFCC", "#CCFF66", "#FFCC00", "#FF6600"]; //to map to magnitudes 1 - 5.9 and higher see: http://coolmaxhot.com/graphics/hex-color-palette.htm
    var vector,raster; //refs to map layers
    var map; //OL map ref;
    
    /**
     * @brief pushes features onto the vecor layer of the 
     *        active that falll between the start and end timestamps
     * @param {hex}   "#XXYYZZ"
     * @param {opacity} 0.0-1.0   
     * @returns string: 'rgba(r,g,b,a)'
     * @reference http://jsfiddle.net/ekinertac/3Evx5/1/
     *
     **/
    function hexToRgba (hex, opacity) {
        if(!hex || !opacity) return;
        hex = hex.replace('#','');
        r = parseInt(hex.substring(0,2), 16);
        g = parseInt(hex.substring(2,4), 16);
        b = parseInt(hex.substring(4,6), 16)

        result = 'rgba('+r+','+g+','+b+','+opacity+')';
        return result;
    }



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
                if (val.timestamp && val.magnitude) {
                    quakeTimestamp = Number(val.timestamp); 
                    //check date range
                    if (quakeTimestamp > startTimestamp && quakeTimestamp < endTimestamp ) {
                        count++;
                        lat = val.geoJSON.coordinates[0];
                        lon = val.geoJSON.coordinates[1];
                        var feature = drawQuakeFeature(lon, lat, val.magnitude);
                        //add some userdata
                        feature.quakedata = {};
                        feature.quakedata.magnitude = val.magnitude; //in the MN mag scale
                        feature.quakedata.description = val.location.en; //description of location
                        feature.quakedata.depth = val.depth; //in km
                        
                        features.push(feature);
                    }
                } 
            }
        });
        
        $('#labelEarliest').html(new Date(startTimestamp).toUTCString().substring(0,17));
        $('#labelLatest').html('');
        
        
        vectorSource.addFeatures( features );
    }
    
    /**
     *
     * @brief add unix timestamp key:value to json data from data.gc.ca
     *
     */
    function addTimestamps () {
        var d;
        var first = new Date(TIMESTAMP_MAX);
        var last = new Date(TIMESTAMP_MIN);//dates of first and last quake in data, set todate
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

    /**
     * @brief: generates a OL map feature for spec's quake data
     * @param {lon} OL longitude float
     * @param {lat} OL lattitude float
     * @param {mag} standard magnitude float for quake
     * @return OL feature object
     *
     */
    function drawQuakeFeature(lon, lat, mag) {
        "use strict";
        var colour = magColour(mag);
        var rgba = hexToRgba(colour, quakeOpacity);
        var multiplier = 50000; //radius 1 = 1 metre
        var center = ol.proj.transform([lon, lat], 'EPSG:4326','EPSG:3857');
        var style = new ol.style.Style({
            fill: new ol.style.Fill({
                color: rgba
            }),
        });

        var feature  = new ol.Feature({
          geometry: new ol.geom.Circle( center, mag*multiplier)
        });
        feature.setStyle (style);
        return feature;
    }
    
    var mapInteractions = 
      ol.interaction.defaults().extend([
          new ol.interaction.Select({
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({
                  color: '#666666'
                })
              })
            })
          ]);
    

    /**
     * @brief: initialize the openlayers map
     * @required: layer sources created
     */
    var setupMap = function() {
        vector = new ol.layer.Vector({
          title: 'Earthquakes',
          source: vectorSource
        });

        raster = new ol.layer.Tile({
          source: new ol.source.OSM()
        });

        map = new ol.Map({
          layers: [raster,vector],
          target: 'map',
          renderer: 'canvas', // Force the renderer to be used
          view: new ol.View({
            center: ol.proj.transform([-125, 55], 'EPSG:4326','EPSG:3857'),
            zoom: 5
          }),
          interactions: mapInteractions
         
        });
        
        map.on('click', function(evt) {
        displayQuakeInfo(evt.pixel);
        });
    };
    
    /**
     * @brief: show the information about user selected quakes
     * @{pixel} x,y coord as reported by the OL map event
     */
    var displayQuakeInfo = function(pixel){
        var features = [];
        map.forEachFeatureAtPixel(pixel, function(feature, layer) {
            features.push(feature);
        });
        if (features.length > 0) {
            var i;
            var details="";
            var colour;
            var max = features.length;
            for (i = 0; i < features.length; i++) {
                    colour = magColour(features[i].quakedata.magnitude);
                    details+='<span style="font-size:20px;color:'+colour+'">Mag: '+features[i].quakedata.magnitude+' Depth: '+features[i].quakedata.depth+'km</span><br/>'+features[i].quakedata.description+'<br/>'
            }
            $('#info').html(details);
        } else {
            $('#info').html('&nbsp;');
        }
    };
    
     /**
     * @brief: return the string "#XXYYZZ" palette colour for the magnitude
     */
    var magColour = function (mag) {
         mag = Math.round(mag);
        if( mag >= colours.length) mag = colours.length-1;
        var hexString = colours[mag];
        return hexString;
    }
    
    /**
     * @brief: initialize the slider control
     */
    var setupSlider = function () {
        $('#time').slider({
            min: Math.floor(dateEarliest),
            max: Math.floor(dateLatest),
            step:1000,
            value: Math.floor(dateEarliest)
        });
        
        $('.slider-holder').css({'visibility':'visible'});
        
        //interaction listener:
        $('#time').slider()
            .on('slide', function(ev) {
            handleTimeUpdate(ev.value);
          });
        
    }
    
    
    /**
     * @brief: initialize the scrubber control
     * @reference: https://github.com/desmosinc/scrubber
     */
    var setupScrubber = function () {
        scrubber = new ScrubberView();
        
        $('.scrubber-control').append(scrubber.elt);
        scrubber.min(Math.floor(dateEarliest));
        scrubber.max(Math.floor(dateLatest));
        scrubber.step(1000);
        
        //$('.scrubber-control').css({'visibility':'visible'});
        
        //interaction listener:
        scrubber.onValueChanged = function (value) {
            handleTimeUpdate(scrubber.value());
        };
        
    }
    
    
    
    /**
     * @brief: init header text with start and end dates of quake data
     */
    var setupHeader = function(){   
        $('#labelEarliest').html(dateEarliest.toUTCString()+" to");
        $('#labelLatest').html(dateLatest.toUTCString());
    }
    
    /**
     * @brief:show / hide loader
     */
    var hideLoader = function() {
        $('#loading').fadeOut();
    }
    var showLoader = function() {
        $('#loading').show();
    }
    
    /**
     * @brief: entry point to  initialize the interface
     */
    var initInterface = function() {
        hideLoader();
        setupMap();
        setupScrubber();//setupSlider();
        setupHeader();
        var startTime = Math.floor((dateEarliest.getTime() + dateLatest.getTime())*0.5);
        //$('#time').slider('setValue',startTime);
        scrubber.value(startTime);
        handleTimeUpdate (startTime);
        
    };

    var handleTimeUpdate  = function (time) {
        selectDataRange(time-timestampSpan, time+timestampSpan);
    };

    /**
     * @brief: document resize handler
     */
    $(window).resize( function() {
        //most things play nicely already, but not the bootstrap slider, so let's reinit that:
         location.reload(); //because this is a tech demo, for now we will reload.TODO: fix bootsrap slider
    });

    
    /**
     * @brief: app startup
     */
    getData(initInterface); //includes loading display


}($));



