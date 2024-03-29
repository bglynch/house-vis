let map;
let markers = [];
let luasStationMarkers = [], dartStationMarkers = [];
// var bounds = new google.maps.LatLngBounds();

let ndx;
let dimLat, dimLng, dimId, dimPostcode, dimBER, dimPrice, dimBeds, dimArea, dimGarden, dimParking, dimPropType, dimFloorArea, dimFloorVsPrice, dimAddress;
let idGrouping;

// == load the data == /
d3.json('static/js/data.json')
  .then(function (data) {

    // remove property with 
    let filteredData = data.filter(function (value, index, arr) {
      return !(value.propertyType == "site" || value.priceType == "on-application")
    })

    // Modify the dataset
    filteredData.forEach(function (d) {
      d.price = +d.price;
      d.bedrooms = +d.bedrooms
      d.longitude = +d.longitude;
      d.latitude = +d.latitude;
      if (d.berRating == null) { d.berRating = "N/A" }
      if (d.berRating == "SINo666of2006exempt") { d.berRating = "X" }
    });

    // == choose color scheme for the charts
    dc.config.defaultColors(d3.schemeDark2);

    // == crossfilter the data
    ndx = crossfilter(filteredData);
    let all = ndx.groupAll();

    // == dimensions
    dimLat = ndx.dimension(function (p) { return p.latitude; });
    dimLng = ndx.dimension(function (p) { return p.longitude; });
    dimId = ndx.dimension(function (p, i) { return i; });
    dimPostcode = ndx.dimension(function (d) { return d.postcode });
    dimPrice = ndx.dimension(function (d) { return d.price });
    dimBER = ndx.dimension(function (d) { return d.berRating });
    dimBeds = ndx.dimension(function (d) { return d.bedrooms });
    dimArea = ndx.dimension(function (d) { return d.area });
    dimGarden = ndx.dimension(function (d) { return d.hasGarden });
    dimParking = ndx.dimension(function (d) { return d.hasParking });
    dimPropType = ndx.dimension(function (d) { return d.propertyType });
    dimFloorArea = ndx.dimension(function (d) { return d.floorArea });
    dimFloorVsPrice = ndx.dimension(function (d) { return [d.floorArea, d.price] });
    dimAddress = ndx.dimension(function (d) { return d.address });

    // == groups
    idGrouping = dimId.group(function (id) { return id; });

    // == create the charts
    // updateChartsOnMapZoom()

    num_availHouses(ndx, all)
    bar_askingPrice(ndx, dimPrice)
    // slider_askingPrice(ndx);
    bar_berRating(ndx, dimBER);
    bar_bedrooms(ndx, dimBeds);
    row_areas(ndx, dimArea);
    bar_garden(ndx, dimGarden);
    bar_parking(ndx, dimParking);
    row_propertyType(ndx, dimPropType);
    scatter_priceVsFloorArea(ndx, dimFloorArea, dimFloorVsPrice);
    pie_postcode(ndx, dimPostcode);
    cbox_postcode(ndx, dimPostcode);
    searchBox(ndx, dimAddress);
    maxPriceSearchBox(ndx, dimPrice);

    initMap(filteredData)
    updateMapOnChartFilters()

    dc.renderAll();
  })

function match_parent_width(chart) {
  return chart.selectAll()._parents[0].clientWidth;
}
function remove_empty_bins(source_group) {
  return {
    all: function () {
      return source_group.all().filter(function (d) {
        return d.value !== 0; // if integers only
      });
    }
  };
}
function remove_empty_bins2(source_group) {
  return {
    all: function () {
      return source_group.all().filter(function (d) {
        return d.value.count !== 0; // if integers only
      });
    }
  };
}

// ========================================================================= //
//  Functions to create the charts
// ========================================================================= // 

function num_availHouses(ndx, group) {
  dc.dataCount('.dc-data-count')
    .crossfilter(ndx)
    .groupAll(group)
    .transitionDuration(500);
}

function bar_askingPrice(ndx, dim) {
  let group = dim.group();
  let chart = dc.barChart('#bar_askPrice');
  let min = dim.bottom(1)[0].price * 0.9;
  let max = dim.top(1)[0].price * 1.1;

  chart
    .dimension(dim)
    .group(group)
    .width(chart.selectAll()._parents[0].parentElement.clientWidth)
    .height(100)
    .x(d3.scaleLinear().domain([0, max]))
    .brushOn(true)
    .elasticY(true);

  chart.xAxis().tickValues([0, min, max * 0.25, max * 0.5, max * 0.75, max]);
  chart.yAxis().tickValues([0]);


  let housePrices = ndx.groupAll().reduce(
    // adds to the object
    function (p, v) {
      p.count++;
      p.total += v.price;
      p.average = p.total / p.count;
      p.dict[v.adId] = v.price;
      p.min = Math.min(...Object.values(p.dict));
      p.max = Math.max(...Object.values(p.dict));
      p.med = median(Object.values(p.dict))
      return p;
    },

    // removes from the  object
    function (p, v) {
      p.count--;
      if (p.count == 0) {
        p.total = 0;
        p.average = 0;
        p.min = 0;
        p.med = 0;
      }
      else {
        p.total -= v.price;
        p.average = p.total / p.count;
        delete p.dict[v.adId];
        p.min = Math.min(...Object.values(p.dict))
        p.max = Math.max(...Object.values(p.dict))
        p.med = median(Object.values(p.dict))
      }
      return p;
    },
    function () {
      return { count: 0, total: 0, average: 0, min: 0, dict: {} };
    }
  );

  let minValue = dc.numberDisplay('.number_minPrice');
  let maxValue = dc.numberDisplay('.number_maxPrice');
  let avgValue = dc.numberDisplay('.number_avgPrice');
  let medValue = dc.numberDisplay('.number_medPrice');

  minValue.valueAccessor(function (d) {
    if (d.count == 0) {
      return 0;
    }
    else {
      return d.min;
    }
  }).group(housePrices);

  maxValue.valueAccessor(function (d) {
    if (d.count == 0) {
      return 0;
    }
    else {
      return d.max;
    }
  }).group(housePrices);

  avgValue.valueAccessor(function (d) {
    if (d.count == 0) {
      return 0;
    }
    else {
      return d.average;
    }
  }).group(housePrices);

  medValue.valueAccessor(function (d) {
    if (d.count == 0) {
      return 0;
    }
    else {
      return d.med;
    }
  }).group(housePrices);


}

function bar_berRating(ndx, dim) {
  // let dim = ndx.dimension(function (d) { return d.berRating });
  let group = dim.group();
  let chart = dc.barChart('#bar_berRating');

  chart
    .dimension(dim)
    .group(group)
    .width(chart.selectAll()._parents[0].parentElement.clientWidth)
    .height(150)
    .elasticY(true)
    .colors(d3.scaleOrdinal()
      .domain(["A", "B", "C", "D", "E", "F", "G", "X", "N"])
      .range(["#06a651", "#51b847", "#bed730", "#fff300", "#fdb912", "#f37021", "#ed1c24", "#333333", "#9d9898"])
    )
    .colorAccessor(function (d) {
      if (d.key.includes("X")) { return "X" }
      else if (d.key.includes("N")) { return "N" }
      else if (d.key.includes("A")) { return "A" }
      else if (d.key.includes("B")) { return "B" }
      else if (d.key.includes("C")) { return "C" }
      else if (d.key.includes("D")) { return "D" }
      else if (d.key.includes("E")) { return "E" }
      else if (d.key.includes("F")) { return "F" }
      return "G";
    })
    .x(d3.scaleBand())
    .xUnits(dc.units.ordinal)
    ;

  chart.yAxisLabel("No. of Houses")
}

function bar_bedrooms(ndx, dim) {
  let chart = dc.barChart('#bar_beds');

  chart
    .dimension(dim)
    .group(dim.group())
    .width(chart.selectAll()._parents[0].parentElement.clientWidth)
    .height(150)
    .elasticY(true)
    .x(d3.scaleBand())
    .brushOn(true)
    .xUnits(dc.units.ordinal)
    ;
}

function row_areas(ndx, dim) {
  // let dim = ndx.dimension(function (d) { return d.area });
  // let group = dim.group();
  let chart = dc.rowChart('#row_areas');

  let housePrices = dim.group().reduce(
    // adds to the object
    function (p, v) {
      p.count++;
      p.total += v.price;
      p.average = p.total / p.count;
      p.dict[v.adId] = v.price;
      p.min = Math.min(...Object.values(p.dict));
      p.max = Math.max(...Object.values(p.dict));
      p.med = median(Object.values(p.dict))
      return p;
    },

    // removes from the  object
    function (p, v) {
      p.count--;
      if (p.count == 0) {
        p.total = 0;
        p.average = 0;
        p.min = 0;
        p.med = 0;
      }
      else {
        p.total -= v.price;
        p.average = p.total / p.count;
        delete p.dict[v.adId];
        p.min = Math.min(...Object.values(p.dict))
        p.max = Math.max(...Object.values(p.dict))
        p.med = median(Object.values(p.dict))
      }
      return p;
    },
    function () {
      return { count: 0, total: 0, average: 0, min: 0, dict: {} };
    }
  );

  chart
    .dimension(dim)
    .group(remove_empty_bins2(housePrices))
    .width(chart.selectAll()._parents[0].parentElement.clientWidth)
    .height(300)
    .elasticX(true)
    .valueAccessor(function (p) { return p.value.count; })
    .title(function (p) {
      if (p.value.med < 1000000) {
        return "Median: €" + numberFormatter(p.value.med);
      }
      else {
        return "Median: €" + numberFormatter(p.value.med, 2);
      }
    })
    .renderTitleLabel(true)
    .xAxis().ticks(4)
    ;

}

function bar_garden(ndx, dim) {
  let chart = dc.barChart('#bar_garden');

  chart
    .dimension(dim)
    .group(dim.group())
    .width(chart.selectAll()._parents[0].parentElement.clientWidth)
    .height(150)
    .elasticY(true)
    .x(d3.scaleBand())
    .xUnits(dc.units.ordinal)
    ;
}

function bar_parking(ndx, dim) {
  let chart = dc.barChart('#bar_parking');

  chart
    .dimension(dim)
    .group(dim.group())
    .width(chart.selectAll()._parents[0].parentElement.clientWidth)
    .height(150)
    .elasticY(true)
    .x(d3.scaleBand())
    .xUnits(dc.units.ordinal)
    ;
}

function row_propertyType(ndx, dim) {
  let chart = dc.rowChart('#row_propertyType');

  chart
    .dimension(dim)
    .group(remove_empty_bins(dim.group()))
    .width(chart.selectAll()._parents[0].parentElement.clientWidth)
    .height(225)
    .elasticX(true)
    .title(data => {
      return `${data.value}`; // or your custom value accessor
    })
    .renderTitleLabel(true)
    .xAxis().ticks(4);
}

function scatter_priceVsFloorArea(ndx, dim01, dim02) {
  var maxArea = dim01.top(1)[0].floorArea;

  let chart = dc.scatterPlot("#scatter_PriceVFloorArea");

  chart
    .dimension(dim02)
    .group(remove_empty_bins(dim02.group()))
    .width(chart.selectAll()._parents[0].parentElement.clientWidth)
    .height(400)
    .x(d3.scaleLinear().domain([0, maxArea + 0.1 * maxArea]))
    .yAxisLabel("Asking Price")
    .xAxisLabel("Surface Area (m2)")
    .rescale(true)
    .margins({ top: 10, right: 50, bottom: 60, left: 80 });
}

function pie_postcode(ndx, dim) {
  let pieChart = dc.pieChart('#pie_postcode');

  pieChart
    .width(200)
    .height(200)
    .dimension(dim)
    .group(dim.group())
    .ordering(dc.pluck('postcode'))
    .legend(
      dc.htmlLegend().container('#legend_postcode')
        .horizontal(true)
        .highlightSelected(true)
    )
    ;
}

function cbox_postcode(ndx, dim) {
  let cboxChart = dc.cboxMenu('#cbox_postcode');

  cboxChart
    .dimension(dim)
    .group(dim.group())
    .multiple(true)
    .controlsUseVisibility(true);
}

function searchBox(ndx, dim) {
  let chart = dc.textFilterWidget('#searchBox');

  chart
    .dimension(dim)
    .placeHolder(' Search by Address');
}

function maxPriceSearchBox(ndx, dim) {
  let chart = dc.textFilterWidget('#maxPriceSearchBox');

  chart
    .dimension(dim)
    .filterFunctionFactory(function (query) {
      query = query;
      return function (d) {
        return d <= +query;
      }
    })
    .transitionDelay(2000)
    .placeHolder(' Enter Max Price');
  ;
}


// ========================================================================= //
//  Functions relating to the Google Map
// ========================================================================= // 
let drawLayer;

function initMap(data) {
  google.maps.visualRefresh = false;

  var myLatlng = new google.maps.LatLng(53.345, -6.267);
  var mapOptions = {
    zoom: 13,
    center: myLatlng,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: true,
    panControl: false,
    styles: [
      {
        "elementType": "geometry",
        "stylers": [
          {
            "color": "#f5f5f5"
          }
        ]
      },
      {
        "elementType": "labels.icon",
        "stylers": [
          {
            "visibility": "off"
          }
        ]
      },
      {
        "elementType": "labels.text.fill",
        "stylers": [
          {
            "color": "#616161"
          }
        ]
      },
      {
        "elementType": "labels.text.stroke",
        "stylers": [
          {
            "color": "#f5f5f5"
          }
        ]
      },
      {
        "featureType": "administrative.land_parcel",
        "elementType": "labels.text.fill",
        "stylers": [
          {
            "color": "#bdbdbd"
          }
        ]
      },
      {
        "featureType": "poi",
        "elementType": "geometry",
        "stylers": [
          {
            "color": "#eeeeee"
          }
        ]
      },
      {
        "featureType": "poi",
        "elementType": "labels.text.fill",
        "stylers": [
          {
            "color": "#757575"
          }
        ]
      },
      {
        "featureType": "poi.business",
        "stylers": [
          {
            "visibility": "off"
          }
        ]
      },
      {
        "featureType": "poi.park",
        "elementType": "geometry",
        "stylers": [
          {
            "color": "#e5e5e5"
          }
        ]
      },
      {
        "featureType": "poi.park",
        "elementType": "geometry.fill",
        "stylers": [
          {
            "color": "#89be98"
          }
        ]
      },
      {
        "featureType": "poi.park",
        "elementType": "labels.text",
        "stylers": [
          {
            "visibility": "off"
          }
        ]
      },
      {
        "featureType": "poi.park",
        "elementType": "labels.text.fill",
        "stylers": [
          {
            "color": "#9e9e9e"
          }
        ]
      },
      {
        "featureType": "poi.school",
        "elementType": "geometry.fill",
        "stylers": [
          {
            "color": "#f9b5b5"
          }
        ]
      },
      {
        "featureType": "poi.school",
        "elementType": "labels.icon",
        "stylers": [
          {
            "color": "#f9b5b5"
          },
          {
            "visibility": "on"
          }
        ]
      },
      {
        "featureType": "road",
        "elementType": "geometry",
        "stylers": [
          {
            "color": "#ffffff"
          }
        ]
      },
      {
        "featureType": "road.arterial",
        "elementType": "geometry.fill",
        "stylers": [
          {
            "color": "#ffffff"
          },
          {
            "saturation": -5
          }
        ]
      },
      {
        "featureType": "road.arterial",
        "elementType": "labels.text.fill",
        "stylers": [
          {
            "color": "#757575"
          }
        ]
      },
      {
        "featureType": "road.highway",
        "elementType": "geometry",
        "stylers": [
          {
            "color": "#dadada"
          }
        ]
      },
      {
        "featureType": "road.highway",
        "elementType": "geometry.fill",
        "stylers": [
          {
            "color": "#fecf0f"
          }
        ]
      },
      {
        "featureType": "road.highway",
        "elementType": "labels.text.fill",
        "stylers": [
          {
            "color": "#616161"
          }
        ]
      },
      {
        "featureType": "road.local",
        "elementType": "geometry.fill",
        "stylers": [
          {
            "color": "#ebebeb"
          }
        ]
      },
      {
        "featureType": "road.local",
        "elementType": "labels.text.fill",
        "stylers": [
          {
            "color": "#9e9e9e"
          }
        ]
      },
      {
        "featureType": "transit.line",
        "elementType": "geometry",
        "stylers": [
          {
            "color": "#e5e5e5"
          }
        ]
      },
      {
        "featureType": "transit.line",
        "elementType": "geometry.fill",
        "stylers": [
          {
            "color": "#212121"
          }
        ]
      },
      {
        "featureType": "transit.line",
        "elementType": "geometry.stroke",
        "stylers": [
          {
            "color": "#212121"
          }
        ]
      },
      {
        "featureType": "transit.station",
        "elementType": "geometry",
        "stylers": [
          {
            "color": "#eeeeee"
          }
        ]
      },
      {
        "featureType": "transit.station",
        "elementType": "geometry.fill",
        "stylers": [
          {
            "color": "#ff7e79"
          }
        ]
      },
      {
        "featureType": "transit.station.rail",
        "elementType": "geometry.fill",
        "stylers": [
          {
            "color": "#ff2600"
          }
        ]
      },
      {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [
          {
            "color": "#c9c9c9"
          }
        ]
      },
      {
        "featureType": "water",
        "elementType": "geometry.fill",
        "stylers": [
          {
            "color": "#76d6ff"
          }
        ]
      },
      {
        "featureType": "water",
        "elementType": "labels.text.fill",
        "stylers": [
          {
            "color": "#9e9e9e"
          }
        ]
      }
    ]
  }; // end mapOptions


  var transitLayer = new google.maps.TransitLayer();
  map = new google.maps.Map(document.getElementById('map'), mapOptions);

  transitLayer.setMap(map);


  // create array of markers from points and add them to the map
  for (var i = 0; i < data.length; i++) {
    var d = data[i];

    let markerLabel = "";
    if (d.propertyType == "apartment") { markerLabel = "A" }

    markers[i] = new google.maps.Marker({
      position: new google.maps.LatLng(d.latitude, d.longitude),
      map: map,
      title: 'marker ' + i,
      icon: createMapIcon(d),
      label: markerLabel,
    });
    let marker = markers[i];
    marker.data = d;

    google.maps.event.addListener(marker, 'mouseover', function () { console.log("hello mouseover"); });

    let infowindow = new google.maps.InfoWindow({ content: "default" });
    marker.addListener('click', function () {
      infowindow.setContent(createMapPopup(marker.data))
      infowindow.open(map, marker);
    });
    map.addListener('click', function () {
      infowindow.close(map, marker);
    });
  }

} // end initMap

function updateMapOnChartFilters() {
  dc.chartRegistry.list().forEach(function (chart) {
    chart.on('pretransition', function () {
      updateMarkers();
      zoomeExtends();
    });
  });
}

function updateMarkers() {
  var pointIds = idGrouping.all();
  for (var i = 0; i < pointIds.length; i++) {
    var pointId = pointIds[i];
    markers[pointId.key].setVisible(pointId.value > 0);
  }
}

function createMapIcon(d) {
  let symcolor;
  let pathz;
  let fillColor;
  if (d.propertyType == "apartment") {
    symcolor = "black";
    // pathz = "M22-48h-44v43h16l6 5 6-5h16z";
    pathz = google.maps.SymbolPath.CIRCLE;
    fillColor = "red"
  }
  else {
    symcolor = "black";
    // pathz = "M0-48c-9.8 0-17.7 7.8-17.7 17.4 0 15.5 17.7 30.6 17.7 30.6s17.7-15.4 17.7-30.6c0-9.6-7.9-17.4-17.7-17.4z";
    pathz = google.maps.SymbolPath.CIRCLE;
    fillColor = "limegreen";
  }

  return {
    path: pathz,
    strokeColor: symcolor,
    strokeWeight: 1,
    fillColor: fillColor,
    fillOpacity: .8,
    scale: 10
  }
}

function createMapPopup(d) {
  let popup =
    `<div class="card" style="width: 18rem;">
        <img class="card-img-top" src="${d.photoLink}" alt="Card image cap">
    <div class="card-body">
      <h5 class="card-title">${d.address}</h5>
      <p class="card-text"><i class="fas fa-euro-sign"></i>: ${d.price}</p>
      <p class="card-text"><i class="fas fa-bed"></i>: ${d.bedrooms}</p>
      <p class="card-text"><i class="fas fa-bath"></i>: ${d.bathrooms}</p>
      <p class="card-text"><i class="fas fa-home"></i>: ${formatNumber(d.floorArea)}</p>
      <a href="${d.url}" target="_blank" class="btn btn-primary">View On Daft</a>
    </div>
  </div>`;

  return popup;
}

function zoomeExtends() {
  if (markers.length > 0) {
    let north = dimLat.top(1)[0].latitude
    let south = dimLat.bottom(1)[0].latitude
    let west = dimLng.bottom(1)[0].longitude
    let east = dimLng.top(1)[0].longitude

    let sw = new google.maps.LatLng({ lat: south, lng: west });
    let ne = new google.maps.LatLng({ lat: north, lng: east });
    let bounds = new google.maps.LatLngBounds(sw, ne);
    map.fitBounds(bounds);
  }
}


// ========================================================================= //
//  Add additional data markers to the map
// ========================================================================= // 

// https://stackoverflow.com/questions/39106230/style-multiple-geojson-files-with-the-google-maps-javascript-api-v3-data-layer/39107656
$.getJSON("./static/data/luas_stations.geojson", function (luasData) {
  for (var i = 0; i < luasData.features.length; i++) {
    let d = luasData.features[i];
    let latitude = d.geometry.coordinates[1];
    let longitude = d.geometry.coordinates[0];

    let image = {
      url: 'https://mt.google.com/vt/icon/name=icons/onion/SHARED-mymaps-container_4x.png,icons/onion/1718-tram-overhead_4x.png&highlight=673AB7,ff000000&scale=1.0',
      size: new google.maps.Size(32, 32),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(16, 16)
    };
    luasStationMarkers[i] = new google.maps.Marker({
      position: new google.maps.LatLng(latitude, longitude),
      map: map,
      icon: image
    });
  }
});

$.getJSON("./static/data/dart_stations.geojson", function (dartData) {
  for (var i = 0; i < dartData.features.length; i++) {
    let d = dartData.features[i];
    let latitude = d.geometry.coordinates[1];
    let longitude = d.geometry.coordinates[0];

    let image = {
      url: 'https://mt.google.com/vt/icon/name=icons/onion/SHARED-mymaps-container_4x.png,icons/onion/1716-train_4x.png&highlight=558B2F,ff000000&scale=1.0',
      size: new google.maps.Size(32, 32),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(16, 16)
    };
    dartStationMarkers[i] = new google.maps.Marker({
      position: new google.maps.LatLng(latitude, longitude),
      map: map,
      icon: image
    });
  }
});

// remove markers
function setMapOnAll(map, dataMarkers) {
  for (var i = 0; i < dataMarkers.length; i++) {
    dataMarkers[i].setMap(map);
  }
}
// Removes the markers from the map, but keeps them in the array.
function clearMarkers() {
  setMapOnAll(null);
}

// Shows any markers currently in the array.
function showMarkers() {
  setMapOnAll(map);
}

function toggleMarkers(dataMarkers) {
  if (dataMarkers[0].map == null) {
    setMapOnAll(map, dataMarkers);
  }
  else {
    setMapOnAll(null, dataMarkers);
  }
}

function highlightButton(e) {
  if (e.srcElement.classList.contains('active')) {
    e.srcElement.classList.remove('active')
  }
  else {
    e.srcElement.classList.add('active')
  }

}


// ========================================================================= //
//  General functions
// ========================================================================= // 
const symbols = [
  { value: 1, symbol: '' },
  { value: 1e3, symbol: 'k' },
  { value: 1e6, symbol: 'M' }
];

function numberFormatter(num, digits) {
  const numToCheck = Math.abs(num);
  for (let i = symbols.length - 1; i >= 0; i--) {
    if (numToCheck >= symbols[i].value) {
      const newNumber = (num / symbols[i].value).toFixed(digits);
      return `${newNumber}${symbols[i].symbol}`;
    }
  }
  return '0';
}

const median = arr => {
  const mid = Math.floor(arr.length / 2),
    nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

function formatNumber(num) {
  if (num != null) {
    let parsedNum = num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
    return parsedNum + " m2"
  }
  else {
    return "Floor Area Not Available"
  }

}




/**
function slider_askingPrice(ndx){
  let dim = ndx.dimension(function (d) { return d.price })
  let group = dim.group();
  // var filterChart = dc.barChart("#errorbar");


  topLikes = dim.top(1)[0].price;
  bottomLikes = dim.bottom(1)[0].price;

  $(document).ready(function () {

    document.getElementById("start").value = bottomLikes;
    document.getElementById("end").value = topLikes;


    $("#valueSlider").slider({
        range: true,
        min: bottomLikes,
        max: topLikes,
        step: 10000,
        values: [bottomLikes, topLikes],
        slide: function (event, ui) {
            $("#start").val(ui.values[0]);
            $("#end").val(ui.values[1]);
            if (document.getElementById("start").value != "") { start = document.getElementById("start").value; };
            if (document.getElementById("end").value != "") { end = document.getElementById("end").value; };
            dim.filterRange([start, end]);
            dc.redrawAll();
            if ((ui.values[0] + 0.1) >= ui.values[1]) { return false; }
        }

    });
});


filterChart.width(350).height(90)
    .dimension(dim)
    .group(group)
    .transitionDuration(500)
    .elasticX(true)
    .elasticY(true)
    .x(d3.scaleOrdinal())
    .xUnits(dc.units.ordinal)
    .colors(["orange"])
    .yAxis().ticks(5);

}
 */

/**
function updateChartsOnMapZoom() {
    google.maps.event.addListener(map, 'bounds_changed', function () {
        var bounds = this.getBounds();
        var northEast = bounds.getNorthEast();
        var southWest = bounds.getSouthWest();

        dimLng.filterRange([southWest.lng(), northEast.lng()]);
        dimLat.filterRange([southWest.lat(), northEast.lat()]);

        dc.redrawAll();
    });
}
 **/
