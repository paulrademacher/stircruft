var NUM_PLAYERS = 2;
var NUM_ROWS = 9;
var NUM_COLS = 11;
var TILE_WIDTH = 80;
var TILE_HEIGHT = 46;
var SCV = "scv";
var MARINE = "marine";
var MARAUDER = "marauder";
var COMMAND_CENTER = "cc";
var BARRACKS = "barracks";
var BUNKER = "bunker";
var NUM_SCVS = 6;
var ACTION_MAKEBUILDING = "makebuilding";
var ACTION_MAKEUNIT = "makeunit";
var ACTION_SELECT = "select";
var ACTION_SELECT_ALL_ARMY = "selectallarmy";
var ACTION_UNSELECT_ALL = "unselectall";
var ACTION_ATTACK = "attack";
var ACTION_MOVE = "move";
var ACTION_ATTACKMOVE = "attackmove";
var ACTION_HOLD = "hold";
var ACTION_STOP = "stop";
var ACTION_ATTACK_MAIN_BASE = "attackmainbase";
var MAX_BUILD_QUEUE = 5;

var gSmoothIcons = false;
var gDrawSegments = false;
var gPlayerNum = 0;
var gTime = 0;
var timeIncrement = 3.7;
var GOAL_MOVE = "move";
var GOAL_ATTACK = "attack";
var GOAL_ATTACKMOVE = "attackmove";
var GOAL_HOLD = "hold";
var GOAL_STOP = "stop";


function randomId() {
  return ("" + Math.random() + "" + Math.random()).replace(/0./g, "");
}

function getTime() {
  return gTime;
}

function getPercentDone(timeStart, timeEnd) {
  return Math.round((getTime() - timeStart) / (timeEnd - timeStart) * 100) / 100;
}

function makePercentDoneString(timeStart, timeEnd) {
  var percentDone = getPercentDone(timeStart, timeEnd);
  var heightPx = Math.ceil(percentDone * 20) + "px";
  var topPx = Math.ceil(((1.0 - percentDone) * 20) - 2) + "px";
//  return "<span class='progresspercent'>" + ("" + percentDone).replace("0.", ".") + "</span>";
  return "<div class='progressverticalcontainer'><span class='progressverticalbar' style='height: "+ heightPx +";top:"+ topPx +"''>&nbsp;</span></div>";
}

function Segment(x0, y0, x1, y1) {
  this.x0 = x0;
  this.y0 = y0;
  this.x1 = x1;
  this.y1 = y1;

  this.diffX = x1 - x0;
  this.diffY = y1 - y0;
  this.length = Math.sqrt(this.diffX*this.diffX + this.diffY*this.diffY);

  if (this.length != 0) {
    this.unitVecX = this.diffX / this.length;
    this.unitVecY = this.diffY / this.length;
  }
}

Segment.prototype.advance = function(x, y, distance) {
  return {"x": x + this.unitVecX * distance,
          "y": y + this.unitVecY * distance};
}

Segment.prototype.pointByDistance = function(distance) {
  return {"x": this.x0 + this.unitVecX * distance,
          "y": this.y0 + this.unitVecY * distance};
}

function Path() {
  this.segments = [];
  this.distanceTravelled = 0;
  this.previousSegmentIndex = -1;
  this.x = 0;
  this.y = 0;
  this.totalLength = 0;
}

Path.prototype.addWaypoint = function(x, y) {
  if (this.segments.length == 0) {
    console.log("ERROR: Adding waypoint to empty path");
    return;
  }
  var lastSegment = this.segments[this.segments.length - 1];
  this.addSegment(lastSegment.x1, lastSegment.y1, x, y);
}

Path.prototype.addSegment = function(x0, y0, x1, y1) {
  var segment = new Segment(x0, y0, x1, y1);
  this.segments.push(segment);

  this.totalLength += segment.length;

  if (this.segments.length == 1) {
    // First segment added.
    this.x = x0;
    this.y = y0;
  }
}

Path.prototype.advance = function(distance) {
  this.distanceTravelled += distance;
  var result = this.pointByDistance(this.distanceTravelled);

  if (result.segmentIndex != this.previousSegmentIndex) {
    /* Clamp first point to segment origin whenever we cross segments.
       Then we don't skip corners.
     */
    result.x = this.segments[result.segmentIndex].x0;
    result.y = this.segments[result.segmentIndex].y0;
    console.log("JUMP");
    console.log(result.x, result.y);


  }
  this.previousSegmentIndex = result.segmentIndex;
  return result;
}

Path.prototype.pointByDistance = function(distance) {
  // Get segment number.
  var totalSoFar = 0;
  for (var i = 0; i < this.segments.length; i++) {
    if (distance < totalSoFar + this.segments[i].length) {
      break;
    }
    totalSoFar += this.segments[i].length;
  }
  console.log("SEGMENT:", i);

  if (i == this.segments.length) {
    // Distance is past end of path.
    var lastSegment = this.segments[this.segments.length - 1];
    return {"x": lastSegment.x1,
            "y": lastSegment.y1,
            "segmentIndex": this.segments.length - 1,
            "done": true};
  }

  var distanceOnSegment = distance - totalSoFar;
  var point = this.segments[i].pointByDistance(distanceOnSegment);
  return {"x": point.x,
          "y": point.y,
          "segmentIndex": i,
          "done": false};
}

function Button(label, mineralCost, gasCost, supply, buildingParent, func) {
  this.label = label;
  this.func = func;
  this.mineralCost = mineralCost;
  this.gasCost = gasCost;
  this.supply = supply;
  this.buildingParent = buildingParent;
  this.id = randomId();
}

Button.prototype.to$ = function() {
  var button = $("<button>").text(this.label).mousedown(this.func).attr("id", this.id).
    data("mineralCost", this.mineralCost).
    data("gasCost", this.gasCost).
    data("supply", this.supply).
    data("buildingParent", this.buildingParent).
    addClass("costButton");
  return button;
}

function BuildingMeta(type) {
  this.type = type;
  this.creates = [];
  this.gasCost = 0;

  if (type == COMMAND_CENTER) {
    this.name = "Cmd Center";
    this.health = 1500;
    this.mineralCost = 400;
    this.creates = [SCV];
    this.buildTime = 100;
  } else if (type == BARRACKS) {
    this.name = "Barracks";
    this.health = 800;
    this.mineralCost = 150;
    this.creates = [MARINE, MARAUDER];
    this.buildTime = 65;
  } else if (type == BUNKER) {
    this.name = "Bunker";
    this.health = 200;
    this.mineralCost = 100;
    this.buildTime = 40;
  }
}

function Building(type, playerNum, x, y) {
  this.id = randomId();
  this.type = type;
  this.x = x;
  this.y = y;
  this.playerNum = playerNum;

  this.constructionTimeStart = -1;
  this.constructionTimeEnd = -1;

  this.spawnTimeStart = -1;
  this.spawnTimeEnd = -1;
  this.spawnUnit = null;
  this.spawnUnitQueue = [];

  var buildingMeta = gBuildingMetas[type];
  this.health = buildingMeta.health;
}

Building.prototype.pullFromSpawnQueue = function() {
  if (this.spawnUnitQueue.length > 0 && !this.spawnUnit) {
    var unit = this.spawnUnitQueue.shift();
    this.spawnTimeStart = getTime();
    this.spawnTimeEnd = this.spawnTimeStart + unit.buildTime;
    this.spawnUnit = unit;
  }
}

Building.prototype.checkSpawnStatus = function() {
  this.pullFromSpawnQueue();

  if (this.spawnTimeEnd != -1 && getTime() >= this.spawnTimeEnd) {

    gPlayers[this.playerNum].units.push(this.spawnUnit);
    if (this.playerNum == gPlayerNum) {
      gRefreshUnitsRender = true;
    }

    this.spawnTimeStart = -1;
    this.spawnTimeEnd = -1;
    this.spawnUnit = null;
  }

  this.pullFromSpawnQueue();
};

Building.prototype.checkBuildStatus = function() {
  if (this.constructionTimeEnd != -1 && getTime() >= this.constructionTimeEnd) {
    gRefreshBuildingsRender = true;

    if (this.type == BUNKER) {
      gPlayers[this.playerNum].supplyMax += 8;
    }

    this.constructionTimeStart = -1;
    this.constructionTimeEnd = -1;
  }
};

function Unit(type, playerNum, x, y) {
  this.type = type;
  this.playerNum = playerNum;  // Will be zero for meta-units.
  this.x = x;
  this.y = y;
  this.xFloat = x;
  this.yFloat = y;
  this.ready = false;

  this.canCollect = false;
  this.path = null;
  this.gasCost = 0;

  if (this.type == SCV) {
    this.name = "SCV";
    this.health = 50;
    this.mineralCost = 50;
    this.canCollect = true;
    this.collect(x, y);
    this.icon = "s";
    this.supply = 1;
    this.buildTime = 17;
    this.speed = 2.8125;
  } else if (this.type == MARINE) {
    this.name = "Marine";
    this.health = 50;
    this.mineralCost = 50;
    this.icon = "m";
    this.supply = 1;
    this.buildTime = 25;
    this.speed = 2.25;
  } else if (this.type == MARAUDER) {
    this.name = "Marauder";
    this.health = 125;
    this.mineralCost = 100;
    this.gasCost = 25;
    this.icon = "M";
    this.supply = 2;
    this.buildTime = 30;
    this.speed = 2.25;
  }

  if (this.playerNum != -1) {  // Ignore meta units.
    this.sprite = $("<div>").addClass("sprite").html("<img>" + this.icon + "<span class='count'></span>");
    $("#sprite_anchor").append(this.sprite);
    this.sprite.hide();
  }
}

Unit.prototype.show = function() {
  this.sprite.show();
}

Unit.prototype.hide = function() {
  this.sprite.hide();
}

Unit.prototype.collect = function() {
  if (!this.canCollect) {
    console.log("WHY U COLLECT WITH WRONG UNIT? " + this.type);
    return;
  }
  this.goToNearestBase();
  this.collectingX = this.x;
  this.collectingY = this.y;
  this.collectingWhat = "mineral";
}

Unit.prototype.goToNearestBase = function() {
}

Unit.prototype.stopCollecting = function() {
  this.collectingX = -1;
  this.collectingY = -1;
}

function Player(playerNum, x, y) {
  this.playerNum = playerNum;
  this.x = x;
  this.y = y;

  this.minerals = 400;  // One cc.
  this.gas = 0;
  this.supplyMax = 11;
  this.supplyUsed = 6;
  this.units = [];
  this.buildings = [];

  for (var i = 0; i < NUM_SCVS; i++) {
    var scv = new Unit(SCV, playerNum, x, y);
    this.units.push(scv);

    if (i == NUM_SCVS - 1) {
      scv.collectingWhat = "gas";
    }
  }
}

Player.prototype.getUnitTypeCount = function() {
  var unitTypeCount = {};
  this.units.forEach(function(unit) {
    if (unitTypeCount[unit.type]) {
      unitTypeCount[unit.type]++;
    } else {
      unitTypeCount[unit.type] = 1;
    }
  });
  return unitTypeCount;
}

var gPlayers = [];
var gCurrPlayer = undefined;

function TilePlayerState() {
  this.hasBase = false;
}

function Tile() {
  this.minerals = 0;
  this.gas = 0;
  this.mineralRate = 1;
  this.gasRate = .25;

  this.playerState = [new TilePlayerState(), new TilePlayerState()];
  this.fogged = false;
  this.unfoggedByNeighbor = false;
}

Tile.prototype.clearUnits = function() {
  this.units = [[], []];
};

function Map(numCols, numRows) {
  this.numCols = numCols;
  this.numRows = numRows;
  this.rows = [];

  for (var i = 0; i < numRows; i++) {
    var row = []
    this.rows.push(row);
    for (var j = 0; j < numCols; j++) {
      var tile = new Tile();
      row.push(tile);
    }
  }

  var p0BaseTile = this.getTile(0, 0);
  var p1BaseTile = this.getTile(numCols - 1, numRows - 1);
  p0BaseTile.minerals = 1500;
  p0BaseTile.gas = 800
  p0BaseTile.playerState[0].hasBase = true;

  p1BaseTile.minerals = 1500;
  p1BaseTile.gas = 800;
  p1BaseTile.playerState[1].hasBase = true;

  gPlayers.push(new Player(0, 0, 0));
  gPlayers.push(new Player(1, numCols - 1, numRows - 1));
  gCurrPlayer = gPlayers[gPlayerNum];
}

Map.prototype.getTile = function(col, row) {
  try {
    return this.rows[row][col];
  } catch (e) {
    return null;
    //console.log(e, col, row, "rows.length=" + this.rows.length);
  }
};

Map.prototype.toString = function() {
  for (var i = 0; i < gMap.numRows; i++) {
    for (var j = 0; j < gMap.numCols; j++) {
      var tile = gMap.getTile(j, i);
      tile.clearUnits();
    }
  }

  for (var i = 0; i < 2; i++) {
    gPlayers[i].units.forEach(function(unit) {
      var tile = gMap.getTile(unit.x, unit.y);
      tile.units[i].push(unit);
    });
  }

  // First pass fogging.
  for (var row = 0; row < gMap.numRows; row++) {
    for (var col = 0; col < gMap.numCols; col++) {
      var tile = gMap.getTile(col, row);
      tile.unfoggedByNeighbor = false;
      if (tile.units[0].length > 0) {
        tile.fogged = false;
      } else {
        tile.fogged = true;
      }
    }
  }

  // Neighbor pass fogging.
  for (var row = 0; row < gMap.numRows; row++) {
    for (var col = 0; col < gMap.numCols; col++) {
      var tile00 = gMap.getTile(col-1, row-1);
      var tile10 = gMap.getTile(col,   row-1);
      var tile20 = gMap.getTile(col+1, row-1);
      var tile01 = gMap.getTile(col-1, row);
      var tile =   gMap.getTile(col,   row);
      var tile21 = gMap.getTile(col+1, row);
      var tile02 = gMap.getTile(col-1, row+1);
      var tile12 = gMap.getTile(col,   row+1);
      var tile22 = gMap.getTile(col+1, row+1);
      if (!tile.fogged) {
        if (tile00) { tile00.unfoggedByNeighbor = true; }
        if (tile10) { tile10.unfoggedByNeighbor = true; }
        if (tile20) { tile20.unfoggedByNeighbor = true; }
        if (tile01) { tile01.unfoggedByNeighbor = true; }
        if (tile21) { tile21.unfoggedByNeighbor = true; }
        if (tile02) { tile02.unfoggedByNeighbor = true; }
        if (tile12) { tile12.unfoggedByNeighbor = true; }
        if (tile22) { tile22.unfoggedByNeighbor = true; }
      }
    }
  }
  for (var row = 0; row < gMap.numRows; row++) {
    for (var col = 0; col < gMap.numCols; col++) {
      var tile = gMap.getTile(col, row);
      if (tile.unfoggedByNeighbor) {
        tile.fogged = false;
      }
    }
  }

  var out = "";
  for (var row = 0; row < gMap.numRows; row++) {
    for (var col = 0; col < gMap.numCols; col++) {
      var tile = gMap.getTile(col, row);
      var classes = "";
      if (tile.playerState[0].hasBase) {
        classes += "p0base ";
      }
      if (tile.playerState[1].hasBase) {
        classes += "p1base ";
      }
      if (col == 0) {
        classes += "clear ";
      }

      if ((col + row) % 2 == 0) {
        classes += tile.fogged ? "lighttilefog " : "lighttile ";
      } else {
        classes += tile.fogged ? "darktilefog " : "darktile ";
      }

      if (col == 0) {
        classes += "lefttile ";
      }
      if (col == gMap.numCols - 1) {
        classes += "righttile ";
      }
      if (row == 0) {
        classes += "toptile ";
      }
      if (row == gMap.numRows - 1) {
        classes += "bottomtile ";
      }

      out += "<div id='tile" + col + "_" + row + "' class='tile " + classes + "'>";

      if (tile.minerals > 0 || tile.gas > 0) {
        out += tile.minerals + "/" + Math.round(tile.gas);
      }

      for (var p = 0; p < 2; p++) {
        if (tile.units[p].length > p) {
          out += "<div class='p" + p + "color'>";

          var unitCount = {};

          tile.units[p].forEach(function(unit) {
            unitCount[unit.icon] = unitCount[unit.icon] + 1 || 1;
          });

          for (var key in unitCount) {
            out += key + unitCount[key] + " ";
          }
          out += "</div>";
        }
      }

      out += "</div>";
    }
  }
  return out;
};

Map.prototype.render = function($el) {
  $el.html(this.toString());
};

function tick() {
  gTime += timeIncrement;
  $("#clock").html(parseInt(gTime));

  for (var i = 0; i < NUM_PLAYERS; i++) {
    var player = gPlayers[i];
    player.buildings.forEach(function(building) {
      building.checkBuildStatus();
      building.checkSpawnStatus();
    });
  }

  for (var i = 0; i < NUM_PLAYERS; i++) {
    var player = gPlayers[i];
    var units = player.units;
    for (var j = 0; j < units.length; j++) {
      var unit = units[j];
      if (unit.type == SCV &&
          unit.collectingX == unit.x && unit.collectingY == unit.y) {
        var tile = gMap.getTile(unit.x, unit.y);
        if (unit.collectingWhat == "mineral") {
          if (tile.minerals > 0) {
            var amountTaken = tile.minerals >= tile.mineralRate ? tile.mineralRate : tile.minerals;
            tile.minerals -= amountTaken;
            player.minerals += amountTaken;
          }
        } else {  // Gas
          if (tile.gas > 0) {
            var amountTaken = tile.gas >= tile.gasRate ? tile.gasRate : tile.gas;
            tile.gas -= amountTaken;
            player.gas += amountTaken;
          }
        }
      }
    }
  }

  render();
}

function render() {
  gMap.render($("#map"));

  for (var i = 0; i < NUM_PLAYERS; i++) {
    var unitString = "Minerals:" + gPlayers[i].minerals +
      " Gas:" + parseInt(gPlayers[i].gas) + " ";
    unitString += "Supply: " + gPlayers[i].supplyUsed + "/" + gPlayers[i].supplyMax + " ";
    unitString += "<BR>" + JSON.stringify(gPlayers[i].getUnitTypeCount());
    $("#units" + i).html(unitString);
  }

  // Advance moving units.
  var map = $("#map");

  gCanvas.clear();
  var segmentsDrawn = {};
  for (var i = 0; i < NUM_PLAYERS; i++) {
    gPlayers[i].units.forEach(function(unit) {
      if (unit.path) {
        var advance = unit.path.advance(unit.speed * .1);
        unit.xFloat = advance.x;
        unit.yFloat = advance.y;
        unit.x = Math.floor(unit.xFloat);
        unit.y = Math.floor(unit.yFloat);
        var left = Math.round(unit.xFloat * TILE_WIDTH) + "px";
        var top = Math.round(unit.yFloat * TILE_HEIGHT) + "px";

        if (gSmoothIcons) {
          unit.sprite.css("left", left);
          unit.sprite.css("top", top);
          unit.sprite.show();
        }

        if (gDrawSegments) {
          unit.path.segments.forEach(function(seg) {
            var segmentString = "" + seg.x0 + ":" + seg.y0 + ":" + seg.x1 + ":" + seg.y1;
            if (!(segmentString in segmentsDrawn)) {
              segmentsDrawn[segmentString] = 1;
              gCanvas.path(["M", seg.x0 * TILE_WIDTH + TILE_WIDTH/2,
                            seg.y0 * TILE_HEIGHT + TILE_HEIGHT/2,
                            "L", seg.x1 * TILE_WIDTH + TILE_WIDTH/2,
                            seg.y1 * TILE_HEIGHT + TILE_HEIGHT/2]).
                attr({"stroke-opacity": 0.25});
            }
          });
        }

        if (advance.done) {
          unit.path = null;
        }
      } else {
        unit.sprite.hide();
      }
    });
  }

  if (gRefreshBuildingsRender || true) {
    $("#buildings").html("");
    gCurrPlayer.buildings.forEach(function(building) {
      $("#buildings").append(building.type + " ");
      var underConstruction = building.constructionTimeEnd != -1;
      if (underConstruction) {
        $("#buildings").
          append(" " + makePercentDoneString(building.constructionTimeStart,
                                            building.constructionTimeEnd));
      }
      gBuildingMetas[building.type].creates.forEach(function(createsType) {
        var meta = new Unit(createsType, -1, 0, 0);
        if (!underConstruction) {
          var button = new Button(meta.icon, meta.mineralCost, meta.gasCost,
                                  meta.supply, building,
             function(meta) {
               newAction(ACTION_MAKEUNIT, gPlayerNum, building, createsType,
                         gCurrPlayer.x, gCurrPlayer.y, -1, -1);
             });
          $("#buildings").append(button.to$());
        }
      });

      if (building.spawnTimeEnd != -1) {
        var percentString = makePercentDoneString(building.spawnTimeStart,
                                                  building.spawnTimeEnd);
        var queueString = "";
        for (var i = 0; i < building.spawnUnitQueue.length; i++) {
          queueString += building.spawnUnitQueue[i].icon;
        }
        $("#buildings").append(" " + percentString + " " +
                               building.spawnUnit.icon + queueString)
      }

      $("#buildings").append("<br>");
    });
    gRefreshBuildingsRender = false;
  }

  if (gRefreshUnitsRender) {
    $("#units").html("");
    gCurrPlayer.units.forEach(function(unit) {
      $("#units").append(unit.type);
      $("#units").append(" ");
    });
    gRefreshUnitsRender = false;
  }

  $(".costButton").each(function(index, el) {
    var $el = $(el);
    var buildingParent = $el.data("buildingParent");

    if (gCurrPlayer.minerals >= $el.data("mineralCost") && gCurrPlayer.gas >= $el.data("gasCost")
       && gCurrPlayer.supplyUsed + $el.data("supply") <= gCurrPlayer.supplyMax
        && (!buildingParent || buildingParent.spawnUnitQueue.length < 5)
       ) {
      $el.prop("disabled", false);
    } else {
      $el.prop("disabled", true);
    }
  });

}

var gMap = new Map(NUM_COLS, NUM_ROWS);

var gBuildingMetas = {};
gBuildingMetas[COMMAND_CENTER] = new BuildingMeta(COMMAND_CENTER);
gBuildingMetas[BUNKER] = new BuildingMeta(BUNKER);
gBuildingMetas[BARRACKS] = new BuildingMeta(BARRACKS);

var gBuildingsUnderConstruction = [];
var gRefreshBuildingsRender = true;  // Will redraw the buildings render.
var gRefreshUnitsRender = true;  // Will redraw the units render.
var gBuildButtons = [];
var gSelection = [];
var gCanvas = null;


function Action(type, playerNum, p1, p2, p3, p4, p5, p6) {
  this.type = type;
  this.playerNum = playerNum;
  this.p1 = p1;
  this.p2 = p2;
  this.p3 = p3;
  this.p4 = p4;
  this.p5 = p5;
  this.p6 = p6;
}

function execAction(action) {
  var player = gPlayers[action.playerNum];

  if (action.type == ACTION_MAKEBUILDING) {
    var buildingType = action.p1;
    var x = action.p2;
    var y = action.p3;
    var immediate = action.p4;
    var building = new Building(buildingType, action.playerNum, x, y);
    player.buildings.push(building);
    if (action.playerNum == gPlayerNum) {
      gRefreshBuildingsRender = true;
    }

    if (!immediate) {
      building.constructionTimeStart = getTime();
      building.constructionTimeEnd = building.constructionTimeStart +
        gBuildingMetas[buildingType].buildTime;
    }

    player.minerals -= gBuildingMetas[buildingType].mineralCost;
    player.gas -= gBuildingMetas[buildingType].gasCost;
  } else if (action.type == ACTION_MAKEUNIT) {
    var building = action.p1;
    var unitType = action.p2;
    var x = action.p3;
    var y = action.p4;
    var unit = new Unit(unitType, action.playerNum, x, y);

    building.spawnUnitQueue.push(unit);

    player.minerals -= unit.mineralCost;
    player.gas -= unit.gasCost;
    player.supplyUsed += unit.supply;
  } else if (action.type == ACTION_SELECT_ALL_ARMY) {
    gSelection = [];
    gCurrPlayer.units.forEach(function(unit) {
      if (unit.type != SCV) {
        gSelection.push(unit);
      }
    });
  } else if (action.type == ACTION_UNSELECT_ALL) {
    gSelection = [];
  } else if (action.type == ACTION_SELECT) {
    var unit = action.p1;
    gSelection = [unit];
  } else if (action.type == ACTION_ATTACK_MAIN_BASE) {
    console.log("attack main base selection:", gSelection);

    gSelection.forEach(function(unit) {
      var targetX = gPlayers[1-gPlayerNum].x;
      var targetY = gPlayers[1-gPlayerNum].y;

      var path = new Path();
      path.addSegment(unit.xFloat, unit.yFloat, targetX, targetY);
//      path.addWaypoint(targetX, targetY);
      unit.path = path;
    });
  } else if (action.type == ACTION_ATTACK) {
  } else if (action.type == ACTION_MOVE) {
  } else if (action.type == ACTION_ATTACKMOVE) {
  } else if (action.type == ACTION_STOP) {
  } else if (action.type == ACTION_HOLD) {
  }
}

function newAction(type, playerNum, p1, p2, p3, p4, p5, p6) {
  execAction(new Action(type, playerNum, p1, p2, p3, p4, p5, p6));
}

$(function() {
  gCanvas = Raphael(0, 0, NUM_COLS * TILE_WIDTH, NUM_ROWS * TILE_HEIGHT);

  $("#build").html("");
  for (var key in gBuildingMetas) {
    var meta = gBuildingMetas[key];
    var button = new Button(meta.name, meta.mineralCost, meta.gasCost,
                            0 /* supply */, null,
          function(meta) {
            newAction(ACTION_MAKEBUILDING, gPlayerNum, meta.type,
                      gCurrPlayer.x, gCurrPlayer.y, false /* not immediate */,
                      -1, -1);
          }.bind(this, meta));

    gBuildButtons.push(button);
    $("#build").append(button.to$());
  }

  var button = new Button("Attack main base",
                          0 /* mineralCost */, 0 /* gasCost */,
                          0 /* supply */, null,
          function(meta) {
            newAction(ACTION_SELECT_ALL_ARMY, gPlayerNum, 0, 0, 0, null, -1, -1);
            newAction(ACTION_ATTACK_MAIN_BASE, gPlayerNum, 0, 0, 0, null, -1, -1); // TODO: coords
          }.bind(this, meta));
  $("#tactics").append(button.to$());

  newAction(ACTION_MAKEBUILDING, 0, COMMAND_CENTER, gPlayers[0].x, gPlayers[0].y,
            true /* immediate */, -1, -1);
  newAction(ACTION_MAKEBUILDING, 1, COMMAND_CENTER, gPlayers[1].x, gPlayers[1].y,
            true /* immediate */, -1, -1);

  render();
  setInterval(tick, 70);
});
