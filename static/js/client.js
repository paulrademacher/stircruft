var NUM_PLAYERS = 2;
var SCV = "scv";
var MARINE = "marine";
var MARAUDER = "marauder";
var COMMAND_CENTER = "cc";
var BARRACKS = "barracks";
var BUNKER = "bunker";
var NUM_SCVS = 6;
var ACTION_MAKEBUILDING = "makebuilding";
var ACTION_MAKEUNIT = "makeunit";
var MAX_BUILD_QUEUE = 5;
var gPlayerNum = 0;
var gTime = 0;
var timeIncrement = 1.2;

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
    this.name = "Command Center";
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
  this.playerNum = playerNum;
  this.x = x;
  this.y = y;
  this.ready = false;

  this.canCollect = false;
  this.movingX = -1;
  this.movingY = -1;
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
  } else if (this.type == MARINE) {
    this.name = "Marine";
    this.health = 50;
    this.mineralCost = 50;
    this.icon = "m";
    this.supply = 1;
    this.buildTime = 25;
  } else if (this.type == MARAUDER) {
    this.name = "Marauder";
    this.health = 125;
    this.mineralCost = 100;
    this.gasCost = 25;
    this.icon = "M";
    this.supply = 2;
    this.buildTime = 30;
  }
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
}

Tile.prototype.clearUnits = function() {
  this.units = [[], []];
};

function Map(numRows, numCols) {
  this.numRows = numRows;
  this.numCols = numCols;
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
  var p1BaseTile = this.getTile(numRows - 1, numCols - 1);
  p0BaseTile.minerals = 1500;
  p0BaseTile.gas = 800
  p0BaseTile.playerState[0].hasBase = true;

  p1BaseTile.minerals = 1500;
  p1BaseTile.gas = 800;
  p1BaseTile.playerState[1].hasBase = true;

  gPlayers.push(new Player(0, 0, 0));
  gPlayers.push(new Player(1, numRows - 1, numCols - 1));
  gCurrPlayer = gPlayers[gPlayerNum];
}

Map.prototype.getTile = function(row, col) {
  return this.rows[row][col];
};

Map.prototype.toString = function() {
  for (var i = 0; i < gMap.numRows; i++) {
    for (var j = 0; j < gMap.numCols; j++) {
      var tile = gMap.getTile(i, j);
      tile.clearUnits();
    }
  }

  for (var i = 0; i < 2; i++) {
    gPlayers[i].units.forEach(function(unit) {
      var tile = gMap.getTile(unit.x, unit.y);
      tile.units[i].push(unit);
    });
  }

  var out = "";
  for (var i = 0; i < gMap.numRows; i++) {
    for (var j = 0; j < gMap.numCols; j++) {
      var tile = gMap.getTile(i, j);
      var classes = "";
      if (tile.playerState[0].hasBase) {
        classes += "p0base ";
      }
      if (tile.playerState[1].hasBase) {
        classes += "p1base ";
      }
      if (j == 0) {
        classes += "clear ";
      }

      out += "<div class='tile " + classes + "'>";

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
    out += "<br>";
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
        var meta = new Unit(createsType, 0, 0, 0);
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

var gMap = new Map(7, 7);

var gBuildingMetas = {};
gBuildingMetas[COMMAND_CENTER] = new BuildingMeta(COMMAND_CENTER);
gBuildingMetas[BUNKER] = new BuildingMeta(BUNKER);
gBuildingMetas[BARRACKS] = new BuildingMeta(BARRACKS);

var gBuildingsUnderConstruction = [];
var gRefreshBuildingsRender = true;  // Will redraw the buildings render.
var gRefreshUnitsRender = true;  // Will redraw the units render.
var gBuildButtons = [];

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
  }
}

function newAction(type, playerNum, p1, p2, p3, p4, p5, p6) {
  execAction(new Action(type, playerNum, p1, p2, p3, p4, p5, p6));
}

$(function() {
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

  newAction(ACTION_MAKEBUILDING, 0, COMMAND_CENTER, gPlayers[0].x, gPlayers[0].y,
            true /* immediate */, -1, -1);
  newAction(ACTION_MAKEBUILDING, 1, COMMAND_CENTER, gPlayers[1].x, gPlayers[1].y,
            true /* immediate */, -1, -1);

  render();
  setInterval(tick, 70);
});
