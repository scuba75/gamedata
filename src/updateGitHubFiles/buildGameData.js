'use strict'
const GithubClient = require('../githubClient')
const fs = require('fs')
const path = require('path')
const DATA_DIR = path.join(path.dirname(__dirname), 'data')
const gameDataFilesNeeded = ['equipment', 'relicTierDefinition', 'skill', 'statModSet', 'statProgression', 'table', 'units', 'xpTable']
const statEnumMap = require('./statEnumMap.json');
const statEnum = {};
const localizationMap = {};
for (const [key, value] of Object.entries(statEnumMap)) {
  if (value.tableKey) {
    statEnum[value.tableKey] = key;
  }
  if (value.nameKey) {
    localizationMap[value.nameKey] = key;
  }
}

const getDataFile = async(version, fileName)=>{
  try{
    let file = await fs.readFileSync(path.join(DATA_DIR, fileName))
    if(file){
      let obj = JSON.parse(file)
      if(obj?.version === version) return obj.data
    }
  }catch(e){

  }
}
const getDataFiles = async(version)=>{
  try{
    let data = {}, count = 0
    for(let i in gameDataFilesNeeded){
      let file = await getDataFile(version, gameDataFilesNeeded[i]+'.json')
      if(file?.length > 0){
        data[gameDataFilesNeeded[i]] = file
        count++
      }
    }
    if(count > 0 && count === +gameDataFilesNeeded.length) return data
  }catch(e){
    console.error(e);
  }
}
function getMasteryMultiplierName(primaryStatID, tags) {
  let primaryStats = {
    2: "strength",
    3: "agility",
    4: "intelligence"
  };
  let [role] = tags.filter( tag => /^role_(?!leader)[^_]+/.test(tag)); // select 'role' tag that isn't role_leader
  return `${primaryStats[ primaryStatID ]}_${role}_mastery`;
}
function buildGearData(equipmentList) {
  const data = {};

  equipmentList.forEach( gear => {
    const statList = gear.equipmentStat.stat;
    if (statList.length > 0) {
      data[ gear.id ] = { stats: {} };
      statList.forEach( stat => {
        data[ gear.id ].stats[ stat.unitStatId ] = +stat.unscaledDecimalValue;
      });
    }
  });

  return data;
}

function buildModSetData(statModSetList) {
  const data = {};

  statModSetList.forEach( set => {
    data[ set.id ] = {
      id: set.completeBonus.stat.unitStatId,
      count: set.setCount,
      value: +set.completeBonus.stat.unscaledDecimalValue
    };
  });

  return data;
}

function buildTableData(tableList, xpTableList) {
  const data = {cr: {}, gp: {}};

  parseTableList(tableList, data);
  parseXPTableList(xpTableList, data);

  return {
    crTables: data.cr,
    gpTables: data.gp
  };
}

function parseTableList(tableList, data) {
  const rarityEnum = {
    "ONE_STAR": 1,
    "TWO_STAR": 2,
    "THREE_STAR": 3,
    "FOUR_STAR": 4,
    "FIVE_STAR": 5,
    "SIX_STAR": 6,
    "SEVEN_STAR": 7
  };

  tableList.forEach( table => {
    let c, g;
    switch( table.id ) {
      case "galactic_power_modifier_per_ship_crew_size_table":
        data.gp.crewSizeFactor = {}
        table.row.forEach( row => {
          data.gp.crewSizeFactor[ row.key ] = +row.value;
        });
        break;
      case "crew_rating_per_unit_rarity":
        data.cr.crewRarityCR = {};
        table.row.forEach( row => {
          data.cr.crewRarityCR[ rarityEnum[row.key] ] = +row.value;
        });
        data.gp.unitRarityGP = data.cr.crewRarityCR; // used for both CR and GP
        break;
      case "crew_rating_per_gear_piece_at_tier":
        data.cr.gearPieceCR = {};
        table.row.forEach( row => {
          data.cr.gearPieceCR[ row.key.match(/TIER_0?(\d+)/)[1] ] = +row.value;
        });
        break;
      case "galactic_power_per_complete_gear_tier_table":
        data.gp.gearLevelGP = { 1: 0 }; // initialize with value of 0 for unit's at gear 1 (which have none 'complete')
        table.row.forEach( row => {
          // 'complete gear tier' is one less than current gear level, so increment key by one
          data.gp.gearLevelGP[ ++(row.key.match(/TIER_0?(\d+)/)[1]) ] = +row.value;
        });
        data.cr.gearLevelCR = data.gp.gearLevelGP; // used for both GP and CR
        break;
      case "galactic_power_per_tier_slot_table":
        g = data.gp.gearPieceGP = {};
        table.row.forEach( row => {
          let [ tier, slot ] = row.key.split(":");
          g[ tier ] = g[ tier ] || {}; // ensure table exists for this gear level
          g[ tier ][ --slot ] = +row.value; // decrement slot by 1 as .help uses 0-based indexing for slot (game table is 1-based)
        });
        break;
      case "crew_contribution_multiplier_per_rarity":
        data.cr.shipRarityFactor = {};
        table.row.forEach( row => {
          data.cr.shipRarityFactor[ rarityEnum[row.key] ] = +row.value;
        });
        data.gp.shipRarityFactor = data.cr.shipRarityFactor; // used for both CR and GP
        break;
      case "galactic_power_per_tagged_ability_level_table":
        g = data.gp.abilitySpecialGP = {};
        table.row.forEach( row => {
          g[ row.key ] = +row.value;
          // if ( row.key == "zeta" ) g[ row.key ] = +row.value;
          // else {
            // let [ , type, level] = row.key.match(/^(\w+)_\w+?(\d)?$/);
            // switch (type) {
              // case "contract":
                // g[ type ] = g[ type ] || {}; // ensure 'contract' table exists
                // g[ type ][ ++level || 1 ] = +row.value;
                // break;
              // case "reinforcement":
                // g[ "hardware" ] = g[ "hardware" ] || {1: 0}; // ensure 'hardware' table exists (and counts 0 xp for tier 1)
                // g[ "hardware" ][ ++level ] = +row.value;
                // break;
              // default:
                // console.error(`Unknown ability type '${row.key}' found.`);
            // }
          // }
        });
        break;
      case "crew_rating_per_mod_rarity_level_tier":
        c = data.cr.modRarityLevelCR = {};
        g = data.gp.modRarityLevelTierGP = {};
        table.row.forEach( row => {
          if ( row.key.slice(-1) == "0") { // only 'select' set 0, as set doesn't affect CR or GP
            let [ pips, level, tier, set ] = row.key.split(":");
            if ( +tier == 1) { // tier doesn't affect CR, so only save for tier 1
              c[ pips ] = c[ pips ] || {}; // ensure table exists for that rarity
              c[ pips ][ level ] = +row.value;
            }
            g[ pips ] = g[ pips ] || {}; // ensure rarity table exists
            g[ pips ][ level ] = g[ pips ][ level ] || {}; // ensure level table exists
            g[ pips ][ level ][ tier ] = +row.value;
          }
        });
        break;
      case "crew_rating_modifier_per_relic_tier":
        data.cr.relicTierLevelFactor = {};
        table.row.forEach( row => {
          data.cr.relicTierLevelFactor[ +row.key + 2 ] = +row.value; // relic tier enum is relic level + 2
        });
        break;
      case "crew_rating_per_relic_tier":
        data.cr.relicTierCR = {};
        table.row.forEach( row => {
          data.cr.relicTierCR[ +row.key + 2 ] = +row.value;
        });
        break;
      case "galactic_power_modifier_per_relic_tier":
        data.gp.relicTierLevelFactor = {};
        table.row.forEach( row => {
          data.gp.relicTierLevelFactor[ +row.key + 2 ] = +row.value; // relic tier enum is relic level + 2
        });
        break;
      case "galactic_power_per_relic_tier":
        data.gp.relicTierGP = {};
        table.row.forEach( row => {
          data.gp.relicTierGP[ +row.key + 2 ] = +row.value;
        });
        break;
      case "crew_rating_modifier_per_ability_crewless_ships":
        data.cr.crewlessAbilityFactor = {};
        table.row.forEach( row => {
          data.cr.crewlessAbilityFactor[ row.key ] = +row.value;
        });
        break;
      case "galactic_power_modifier_per_ability_crewless_ships":
        data.gp.crewlessAbilityFactor = {};
        table.row.forEach( row => {
          data.gp.crewlessAbilityFactor[ row.key ] = +row.value;
        });
        break;
      case (table.id.match(/_mastery/) || {}).input: // id matches itself only if it ends in _mastery
        // These are not actually CR or GP tables, but were placed in the 'crTables' section of gameData when first implemented.
        // Still placed there for backwards compatibility
        data.cr[ table.id ] = {};
        table.row.forEach( row => {
          data.cr[ table.id ][ statEnum[row.key] ] = +row.value;
        });
        break;
      default:
        return;
    }
  });
};

function parseXPTableList(xpTableList, data) {
  xpTableList.forEach( table => {
    let tempTable = {};
    if ( /^crew_rating/.test(table.id) || /^galactic_power/.test(table.id) ) {
      table.row.forEach( row => {
        tempTable[ ++row.index ] = row.xp;
      });
      switch ( table.id ) {
        // 'CR' tables appear to be for both CR and GP on characters
        // 'GP' tables specify ships, but are currently idendical to the 'CR' tables.
        case "crew_rating_per_unit_level":
          data.cr.unitLevelCR = tempTable;
          data.gp.unitLevelGP = tempTable;
          break;
        case "crew_rating_per_ability_level":
          data.cr.abilityLevelCR = tempTable;
          data.gp.abilityLevelGP = tempTable;
          break;
        case "galactic_power_per_ship_level_table":
          data.gp.shipLevelGP = tempTable;
          break;
        case "galactic_power_per_ship_ability_level_table":
          data.gp.shipAbilityLevelGP = tempTable;
          break;
        default:
          return;
      }
    }
  });
}

function parseSkills(skillList) {
  const skills = {};
  skillList.forEach( skill => {
    let s = {
      id: skill.id,
      maxTier: skill.tier.length + 1,
      powerOverrideTags: {},
      isZeta: skill.tier.slice(-1)[0].powerOverrideTag == "zeta"
    };
    skill.tier.forEach( (tier, i) => {
      if (tier.powerOverrideTag) {
        s.powerOverrideTags[ i+2 ] = tier.powerOverrideTag;
      }
    });
    skills[ skill.id ] = s;
  });

  return skills;
}

function buildUnitData(unitsList, skillList, statTables) {
  const skills = parseSkills(skillList);
  const baseList = [];
  const unitGMTables = {};

  let i = unitsList.length;
  while (--i) {
    const unit = unitsList[i];

    if (unit.obtainable && unit.obtainableTime === '0') {
      unitGMTables[ unit.baseId ] = unitGMTables[ unit.baseId ] || {}; // ensure unit's table exists
      unitGMTables[ unit.baseId ][ unit.rarity ] = statTables[ unit.statProgressionId ];

      if (unit.rarity === 1) {
        baseList.push(unit);
      }
    }
  }

  const data = {};

  baseList.forEach( unit => {
    if ( unit.combatType == 1 ) { // character
      const tierData = {};
      const relicData = {};
      unit.unitTier.forEach( gearTier => {
        tierData[ gearTier.tier ] = { gear: gearTier.equipmentSet, stats: {}}
        gearTier.baseStat.stat.forEach( stat => {
          tierData[ gearTier.tier ].stats[ stat.unitStatId ] = +stat.unscaledDecimalValue;
        });
      });
      unit.relicDefinition.relicTierDefinitionId.forEach( tier => {
        relicData[ +tier.slice(-2) + 2 ] = tier;
      });
      data[unit.baseId] = {
        combatType: 1,
        primaryStat: unit.primaryUnitStat,
        gearLvl: tierData,
        growthModifiers: unitGMTables[ unit.baseId ],
        skills: unit.skillReference.map( skill => skills[ skill.skillId ] ),
        relic: relicData,
        masteryModifierID: getMasteryMultiplierName(unit.primaryUnitStat, unit.categoryId)
      };
    } else { // ship
      const stats = {}
      unit.baseStat.stat.forEach( stat => {
        stats[ stat.unitStatId ] = +stat.unscaledDecimalValue;
      });
      let ship = {
        combatType: 2,
        primaryStat: unit.primaryUnitStat,
        stats: stats,
        growthModifiers: unitGMTables[ unit.baseId ],
        skills: unit.skillReference.map( skill => skills[ skill.skillId ] ),
        crewStats: statTables[ unit.crewContributionTableId ],
        crew: []
      };
      unit.crew.forEach( crew => {
        ship.crew.push( crew.unitId );
        crew.skillReference.forEach( s => ship.skills.push( skills[ s.skillId ] ) );
      });
      data[unit.baseId] = ship;
    }
  });

  return data;
}

function buildRelicData(relicList, statTables) {
  const data = {};
  relicList.forEach( relic => {
    data[ relic.id ] = { stats: {}, gms: statTables[ relic.relicStatTable ] };
    relic.stat.stat.forEach( stat => {
      data[ relic.id ].stats[ stat.unitStatId ] = +stat.unscaledDecimalValue;
    });
  });

  return data;
}

function buildStatProgressionList(statProgressionList) {
  const statTables = {};
  statProgressionList.forEach( table => {
    if ( /^stattable_/.test(table.id) ) {
      const tableData = {};
      table.stat.stat.forEach(stat => {
        tableData[ stat.unitStatId ] = +stat.unscaledDecimalValue;
      });
      statTables[ table.id ] = tableData;
    }
  });
  return statTables;
}

function isStringEqual(a, b) {
  return (a && b && (a.localeCompare(b) == 0));
}
const SaveFile2GitHub = async(data, fileName, commitMsg, sha)=>{
  try{
    let data64 = Buffer.from(JSON.stringify(data)).toString('base64')
    if(data64) return await GithubClient.pushFile(data64, fileName, commitMsg, sha)
  }catch(e){
    console.error(e);
  }
}

module.exports = async(version, versionObj = {}, files)=>{
  try{
    if(versionObj['gameData.json'] === version) return
    console.log('creating gameData.json for version '+version)
    let data = await getDataFiles(version)
    if(!data) return
    const gameData = {}
    const statTables = buildStatProgressionList(data.statProgression);

    gameData.modSetData = buildModSetData(data.statModSet);
    const {crTables, gpTables } = buildTableData(data.table, data.xpTable);
    gameData.crTables = crTables;
    gameData.gpTables = gpTables;

    gameData.gearData = buildGearData(data.equipment);
    gameData.relicData = buildRelicData(data.relicTierDefinition, statTables);
    gameData.unitData = buildUnitData(data.units, data.skill, statTables);
    if(Object.values(gameData)?.length === 6){
      await fs.writeFileSync(path.join(DATA_DIR, 'gameData.json'), JSON.stringify({version: version, data: gameData}))
      //const tempObj = {content: {sha: 'ldjfksdjl'}}
      const tempObj = await SaveFile2GitHub({version: version, data: gameData}, 'gameData.json', 'update to '+version, files?.find(x=>x?.name === 'gameData.json')?.sha)
      if(tempObj?.content?.sha){
        versionObj['gameData.json'] = version;
        console.log('Uploaded gameData.json to github')
      }else{
        if(!versionObj['gameData.json']) versionObj['gameData.json'] = 'failed';
        console.log('Error uploading gameData.json to github ...')
      }
    }
  }catch(e){
    console.error(e);
  }
}
