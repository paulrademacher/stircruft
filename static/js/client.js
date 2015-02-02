var NUM_PLAYERS = 2;
var SCV = "scv";
var MARINE = "marine";
var MARAUDER = "marauder";
var COMMAND_CENTER = "cc";
var BARRACKS = "barracks";
var BUNKER = "bunker";
var NUM_SCVS = 5;
var ACTION_MAKEBUILDING = "makebuilding";
var ACTION_MAKEUNIT = "makeunit";
var gPlayerNum = 0;

function randomId() {
  return ("" + Math.random() + "" + Math.random()).replace(/0./g, "");
}

function Button(label, mineralCost, gasCost, func) {
  this.label = label;
  this.func = func;
  this.mineralCost = mineralCost;
  this.gasCost = gasCost;
  this.id = randomId();
}

Button.prototype.to$ = function() {
  var button = $("<button>").text(this.label).click(this.func).attr("id", this.id).
    data("mineralCost", this.mineralCost).
    data("gasCost", this.gasCost).
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
  } else if (type == BARRACKS) {
    this.name = "Barracks";
    this.health = 800;
    this.mineralCost = 150;
    this.creates = [MARINE, MARAUDER];
  } else if (type == BUNKER) {
    this.name = "Bunker";
    this.health = 200;
    this.mineralCost = 100;
  }
}

function Building(type, playerNum, x, y) {
  this.id = randomId();
  this.type = type;
  this.x = x;
  this.y = y;
  this.playerNum = playerNum;

  var buildingMeta = gBuildingMetas[type];
  this.health = buildingMeta.health;

  if (type == BUNKER) {
    gPlayers[playerNum].supplyMax += 8;
  }
}

function Unit(type, playerNum, x, y) {
  this.type = type;
  this.playerNum = playerNum;
  this.x = x;
  this.y = y;

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
  } else if (this.type == MARINE) {
    this.name = "Marine";
    this.health = 50;
    this.mineralCost = 50;
  } else if (this.type == MARAUDER) {
    this.name = "Marauder";
    this.health = 125;
    this.mineralCost = 100;
    this.gasCost = 25;
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
  this.supplyUsed = 5;
  this.units = [];
  this.buildings = [];

  for (var i = 0; i < NUM_SCVS; i++) {
    this.units.push(new Unit(SCV, playerNum, x, y));
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
  this.gasRate = 1;

  this.playerState = [new TilePlayerState(), new TilePlayerState()];
}

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
      out += "<span class='tile " + classes + "'>" + tile.minerals + "/" + tile.gas  + "</span>";
    }
    out += "<br>";
  }
  return out;
};

Map.prototype.render = function($el) {
  $el.html(this.toString());
};

function tick() {
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
    var unitString = "M:" + gPlayers[i].minerals + " G:" + gPlayers[i].gas + " ";
    unitString += "<BR>" + JSON.stringify(gPlayers[i].getUnitTypeCount());
    $("#units" + i).html(unitString);
  }

  if (gRefreshBuildingsRender) {
    $("#buildings").html("");
    gCurrPlayer.buildings.forEach(function(building) {
      $("#buildings").append(building.type);
      gBuildingMetas[building.type].creates.forEach(function(createsType) {
        var meta = new Unit(createsType, 0, 0, 0);
        var button = new Button(meta.name, meta.mineralCost, meta.gasCost,
             function(meta) {
               newAction(ACTION_MAKEUNIT, gPlayerNum, createsType,
                         gCurrPlayer.x, gCurrPlayer.y, -1, -1, -1);
             });
        $("#buildings").append(button.to$());
      });
      $("#buildings").append("<br>");
    });
    gRefreshBuildingsRender = false;
  }

  if (gRefreshUnitsRender) {
    $("#units").html("");
    gCurrPlayer.units.forEach(function(unit) {
      $("#units").append(unit.type);
      $("#units").append("<BR>");
    });
    gRefreshUnitsRender = false;
  }

  $(".costButton").each(function(index, el) {
    var $el = $(el);
    if (gCurrPlayer.minerals >= $el.data("mineralCost") && gCurrPlayer.gas >= $el.data("gasCost")) {
      $el.prop("disabled", false);
    } else {
      $el.prop("disabled", true);
    }
  });

}

var gMap = new Map(10, 8);

var gBuildingMetas = {};
gBuildingMetas[COMMAND_CENTER] = new BuildingMeta(COMMAND_CENTER);
gBuildingMetas[BUNKER] = new BuildingMeta(BUNKER);
gBuildingMetas[BARRACKS] = new BuildingMeta(BARRACKS);

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
    var building = new Building(buildingType, action.playerNum, x, y);
    player.buildings.push(building);
    if (action.playerNum == gPlayerNum) {
      gRefreshBuildingsRender = true;
    }
    player.minerals -= gBuildingMetas[buildingType].mineralCost;
    player.gas -= gBuildingMetas[buildingType].gasCost;
  } else if (action.type == ACTION_MAKEUNIT) {
    var unitType = action.p1;
    var x = action.p2;
    var y = action.p3;
    var unit = new Unit(unitType, action.playerNum, x, y);
    gPlayers[action.playerNum].units.push(unit);
    if (action.playerNum == gPlayerNum) {
      gRefreshUnitsRender = true;
    }
    player.minerals -= unit.mineralCost;
    player.gas -= unit.gasCost;
  }
}

function newAction(type, playerNum, p1, p2, p3, p4, p5, p6) {
  execAction(new Action(type, playerNum, p1, p2, p3, p4, p5, p6));
}

$(function() {
  $("#build").html("");
  for (var key in gBuildingMetas) {
    var meta = gBuildingMetas[key];
    console.log(meta.type);

    var button = new Button(meta.name, meta.mineralCost, meta.gasCost,
          function(meta) {
            newAction(ACTION_MAKEBUILDING, gPlayerNum, meta.type,
                      gCurrPlayer.x, gCurrPlayer.y, -1, -1, -1);
          }.bind(this, meta));

    gBuildButtons.push(button);
    $("#build").append(button.to$());
  }

  newAction(ACTION_MAKEBUILDING, 0, COMMAND_CENTER, gPlayers[0].x, gPlayers[0].y, -1, -1, -1);
  newAction(ACTION_MAKEBUILDING, 1, COMMAND_CENTER, gPlayers[1].x, gPlayers[1].y, -1, -1, -1);

  render();
  setInterval(tick, 250);
});
