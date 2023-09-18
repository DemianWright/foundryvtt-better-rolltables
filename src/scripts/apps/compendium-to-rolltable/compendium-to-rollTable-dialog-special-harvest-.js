import { CONSTANTS } from "../../constants/constants";
import { BRTCONFIG } from "../../core/config";
import { debug } from "../../lib";
import { CompendiumToRollTableDialog } from "./compendium-to-rollTable-dialog";

/**
 * @href https://gist.github.com/crazycalya/0cd20cd12b1a344d21302a794cb229ff
 * @href https://gist.github.com/p4535992/3151778781055a6f68281a0bfd8da1a2
 * @href https://www.reddit.com/r/FoundryVTT/comments/11lbjln/converting_a_compendium_into_a_rollable_table/
 */
export class CompendiumToRollTableSpecialHarvestDialog {
  constructor(allCompendiums, itemTypes) {
    // super(allCompendiums, itemTypes);
    let compendium = allCompendiums[0];

    let msg = compendium.metadata.label;

    ui.notifications.info(game.i18n.format(`${BRTCONFIG.NAMESPACE}.api.msg.startRolltableGeneration`, msg));
    const document = this.fromCompendium(compendium);
    ui.notifications.info(game.i18n.format(`${BRTCONFIG.NAMESPACE}.api.msg.rolltableGenerationFinished`, msg));
    return document;
  }

  /**
   * Group an array of objects by a specified property.
   * @param {Array<T>} array - The array of objects to group.
   * @param {string} property - The property to group the objects by.
   * @returns {Object} An object where the keys are the unique values of the specified property and the values are arrays of objects with that property value.
   * @template T
   *
   * @example
   * const arr = [{type:"A"}, {type:"A"}, {type:"B"}];
   * const result = groupBy(arr, "type");
   * console.log(result); // Output: { A: [{type: "A"}, {type: "A"}], B: [{type: "B"}] }
   */
  _groupBy(array, property) {
    return array.reduce((memo, x) => {
      memo[x[property]] ||= [];
      memo[x[property]].push(x);
      return memo;
    }, {});
  }

  _convertToSkillDenomination(skillValue) {
    if (!skillValue) {
      return "";
    }
    const skillValueToCheck = String(skillValue).toLowerCase().trim();

    const r = this.skillMap[skillValueToCheck];
    return r;
  }

  /**
   * @override
   * @param {*} customFilters
   * @param {*} nameFilters
   * @param {*} selectedItems
   * @param {*} selectedSpellLevels
   * @param {*} selectedRarities
   * @param {*} weightPredicate
   * @param {*} compendium
   * @param {*} options
   * @returns
   */
  async fromCompendium(compendium, options = {}) {
    // Ported from Foundry's existing RollTable.fromFolder()
    const results = await compendium.index.map((e, i) => {
      console.log("Compendium Item:");
      console.log(e);
      console.log("Compendium Index:");
      console.log(i);

      const dcValue = getProperty(e, `system.description.chat`);
      const skillValue = getProperty(e, `system.description.unidentified`);

      const skillDenom = this._convertToSkillDenomination(skillValue);

      // https://foundryvtt.com/api/v8/data.TableResultData.html
      // _id	string The _id which uniquely identifies this TableResult embedded document
      // type	string	<optional> A result sub-type from CONST.TABLE_RESULT_TYPES (COMPENDIUM: 2, DOCUMENT: 1, TEXT: 0)
      // text	string	<optional> The text which describes the table result
      // img	string	<optional> An image file url that represents the table result
      // collection	string	<optional> A named collection from which this result is drawn
      // resultId	string	<optional> The _id of a Document within the collection this result references
      // weight	number	<optional> The probabilistic weight of this result relative to other results
      // range	Array.<number>	<optional> A length 2 array of ascending integers which defines the range of dice roll totals which produce this drawn result
      // drawn	boolean	<optional> false Has this result already been drawn (without replacement)
      // flags	object	<optional> {} An object of optional key/value flags
      return {
        text: e.name,
        type: CONST.TABLE_RESULT_TYPES.COMPENDIUM,
        collection: compendium.type,
        resultId: e.id ? e.id : e._id,
        img: e.thumbnail || e.img || CONFIG.RollTable.resultIcon,
        weight: 1,
        range: [i + 1, i + 1],
        documentCollection: `${compendium.metadata.packageName}.${compendium.metadata.name}`,
        drawn: false,
        flags: {
          [`${CONSTANTS.MODULE_ID}`]: {
            [`${CONSTANTS.FLAGS.RESULTS_FORMULA_KEY_FORMULA}`]: 1,
            [`${CONSTANTS.FLAGS.HARVEST_DC_VALUE_KEY}`]: dcValue ?? 0,
            [`${CONSTANTS.FLAGS.HARVEST_SKILL_VALUE_KEY}`]: skillDenom ?? "",
          },
        },
      };
    });
    return await this.createCompendiumFromData(compendium.metadata.label, results, `1d${results.length}`, options);
  }

  /**
   * @override
   * @param {*} compendiumName
   * @param {*} results
   * @param {*} formula
   * @param {*} options
   */
  async createCompendiumFromData(compendiumName, results, formula, options = {}) {
    const resultsGroupedBySystemOrigin = this._groupBy(results, `system.source`);
    const documents = [];

    for (const [key, values] of Object.entries(resultsGroupedBySystemOrigin)) {
      //options.renderSheet = options.renderSheet ?? true;
      const document = await RollTable.create(
        {
          name: "Better Harvester | " + key + " RollTable",
          description: `A random table created from the contents of the ${compendiumName} compendium filter for the system source value '${key}'.`,
          results: values,
          formula: formula ?? `1d${value.length}`,
          flags: {
            [`${CONSTANTS.MODULE_ID}`]: {
              [`${CONSTANTS.FLAGS.TABLE_TYPE_KEY}`]: CONSTANTS.TABLE_TYPE_HARVEST,
            },
          },
        },
        options
      );
      documents.push(document);
    }
    return documents;
  }

  skillMap = new Map([
    ["acrobatics", "acr"],
    ["animal handling", "ani"],
    ["arcana", "arc"],
    ["athletics", "ath"],
    ["deception", "dec"],
    ["history", "his"],
    ["insight", "ins"],
    ["investigation", "inv"],
    ["intimidation", "itm"],
    ["medicine", "med"],
    ["nature", "nat"],
    ["persuasion", "per"],
    ["perception", "prc"],
    ["performance", "prf"],
    ["religion", "rel"],
    ["sleight of Hand", "slt"],
    ["stealth", "ste"],
    ["survival", "sur"],
  ]);
}
