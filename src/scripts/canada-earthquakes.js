var quake = (function($){
    var dataSource = 'http://www.earthquakescanada.nrcan.gc.ca/api/earthquakes/latest/365d.json';
    var features = [];
    var quakeData; //json object with quake data from data.gc.ca
    var dateEarliest,dateLatest; //Date Object 
    var TIMESTAMP_MIN = -8640000000000000;
    var TIMESTAMP_MAX = 8640000000000000;
    var timestampSpan = 1*10*24*60*60*1000; //2 days in msec 
    var scrubber;//scrubber control ref
    var vectorSource = new ol.source.Vector();
    var mapInteractions; //object containing the ol map interaction objects. i.e. what happens visually to feature styles when a user interacts with a feature.
    var quakeOpacity = 0.9;//opacity of quake indicator circles
    var colours = ["#66CCFF", "#66FFFF", "#66FFCC", "#CCFF66", "#FFCC00", "#FF6600"]; //to map to magnitudes 1 - 5.9 and higher see: http://coolmaxhot.com/graphics/hex-color-palette.htm
    var playbackIntervalTimer; //creference to timer used in doing animated callback
    var playheadTimestamp; //the current playback date;
    var playheadStep; //timestep in msec for playhead to advance in an nimation frame;
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
    function selectDataRange(startTimestamp, endTimestamp, marginTime) {
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
                    if (quakeTimestamp > startTimestamp - marginTime * 0 && quakeTimestamp < endTimestamp + marginTime ) {
                        count++;
                        
                        //determn facdeout opacity if in 'marginal' bounds of time range (i.e. gentle fade)
                        var err = 1.0;
                        var opacity = quakeOpacity;
                        /* quakes don't fade in, but if they did, we would include this:
                        if(startTimestamp > quakeTimestamp ) {
                            err = (startTimestamp - quakeTimestamp) / marginTime;
                        }
                        */
                        if(endTimestamp < quakeTimestamp ) {
                            err = (quakeTimestamp - endTimestamp) / marginTime;
                        }
                        opacity = opacity * err;
                        lat = val.geoJSON.coordinates[0];
                        lon = val.geoJSON.coordinates[1];
                        var feature = drawQuakeFeature(lon, lat, val.magnitude, opacity);
                        //add some userdata
                        feature.quakedata = {};
                        feature.quakedata.magnitude = val.magnitude; //in the MN mag scale
                        feature.quakedata.description = "";
                        if(val.location) {
                            feature.quakedata.description = val.location.en; //description of location 
                        }
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
    function drawQuakeFeature(lon, lat, mag, opacity) {
        "use strict";
        var colour = magColour(mag);
        var rgba = hexToRgba(colour, opacity);
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
    
    var hideQuakeInfo = function() {
        $('#info').html('');
    }
        
    
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
     * @brief:show / hide loader
     */
    var hideLoader = function() {
        $('#loading').fadeOut();
    }
    var showLoader = function() {
        $('#loading').show();
    }
    

    
    /**
     * @brief: called primarily by scrubber interaction to change the data show to new timestamps bounds
     * @param {time} integer unix timestamp
     * @usesglobal {timestampSpan}
     */
    var handleTimeUpdate  = function (time) {
        hideQuakeInfo(); //invalidated anyways
        selectDataRange(time, time, timestampSpan);
    };

    
    /**
     * @brief: playback feature
     * @param {startTS} starting unix timestamp, clamped to earliest if OOR
     * @param {endTS} ending unix timestamp, clamped to latest if OOR
     * @param {fps} int frames per second to animate
     * @param {step} timestep between animation callbacks, in msec, 50000000 noy unreasonable
     * @writes module param {playbackStartTimestamp, playbackEndTimestamp}
     * @reads module param {dateEarliest, dateLatest}
     * @TODO: use promises inistead of callbacks
     * @TODO: put this in a module or fork the  scrubber git project to add this functionality
     *
     */
    var playbackStart = function(startTS, endTS, fps, step) {
        //verify date timestamp ranges:
        if (step != NaN) playheadStep = step;
        if (startTS != NaN) {
            (startTS < dateEarliest.getTime()) ? playbackStartTimestamp = dateEarliest.getTime() : playbackStartTimestamp = startTS;
            playheadTimestamp = playbackStartTimestamp;
        }
        if (endTS != NaN) {
            (endTS > dateLatest.getTime()) ? playbackEndTimestamp = dateLatest.getTime() : playbackEndTimestamp = endTS;
        }
        playbackStop();
        playbackIntervalTimer = setInterval(playbackAnimationCallback, 1000.0 / fps);
        
    }
        
    var playbackStop = function(){
        try {
            clearInterval(playbackIntervalTimer);
        } catch(err) {
            //timer did not exist;
        }    
    }

    var playbackAnimationCallback = function() {
        //selectDataRange(playheadTimestamp, playheadTimestamp, timestampSpan);
        playheadTimestamp += playheadStep;
        scrubber.value(playheadTimestamp)
        if(playheadTimestamp > playbackEndTimestamp) playbackStop();
    }

    
    /**
     * @brief: document resize handler
     */
    $(window).resize( function() {
 
    });
    
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
        
        $('.scrubber-control').on('mousedown', function(){ 
            playbackStop(); 
        }); //stop autoscrub 
        
        //and for touich:
        document.addEventListener('touchstart', touchListener, false);
        
    }
    
    /**
     * @brief: handles initial touch user interaction with whole app area
     */
    var touchListener = function(evt) {
        playbackStop();
        document.removeEventListener('touchstart', touchListener);
    }
    
    
    
    /**
     * @brief: init header text with start and end dates of quake data
     */
    var setupHeader = function(){   
        $('#labelEarliest').html(dateEarliest.toUTCString()+" to");
        $('#labelLatest').html(dateLatest.toUTCString());
    }
    


    /**
     * @brief: initialize the openlayers map
     * @required: layer sources created
     */
    var setupMap = function() {
        
        mapInteractions = 
          ol.interaction.defaults().extend([
              new ol.interaction.Select({
                style: new ol.style.Style({
                    stroke: new ol.style.Stroke({
                      color: '#666666'
                    })
                  })
                })
              ]);
        
        
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
            center: ol.proj.transform([-95, 55], 'EPSG:4326','EPSG:3857'),
            zoom: 3
          }),
          interactions: mapInteractions
         
        });
        
        map.on('click', function(evt) {
        displayQuakeInfo(evt.pixel);
        });
    };
    
    
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
        playbackStart(dateEarliest.getTime(), dateLatest.getTime(), 24, 50000000);
        
    };
    

    
    /**
     * @brief: app startup
     */
    getData(initInterface); //includes loading display


}($));



