import { CONSTANTS } from "../constants/constants.js";
import { BRTBetterHelpers } from "../better/brt-helper.js";
import { BRTUtils } from "./utils.js";
import { BetterRollTable } from "./brt-table.js";
import { isEmptyObject } from "../lib.js";

export class BetterResults {
  constructor(tableResults) {
    this.results = [];
    this.currencyData = { cp: 0, ep: 0, gp: 0, pp: 0, sp: 0 };
    this.tableResults = tableResults;
  }

  async buildResults(table) {
    const currencyString = table.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.LOOT_CURRENCY_STRING_KEY);
    this.currencyData = await this._generateCurrency(currencyString);

    for (let i = 0; i < this.tableResults?.length; i++) {
      const betterResults = await this._parseResult(this.tableResults[i]);
      // if a inner table is rolled, the result returned is undefined but the array this.tableResult is extended with the new results

      for (const r of betterResults) {
        this.results.push(r);
      }
    }
    return this.results;
  }

  getCurrencyData() {
    return this.currencyData;
  }

  async _parseResult(result) {
    const betterResults = [];
    if (result.type === CONST.TABLE_RESULT_TYPES.TEXT) {
      const textResults = result.text.split("|");

      for (let t of textResults) {
        // if the text is a currency, we process that first
        t = await this._processTextAsCurrency(t);
        t = await this._rollInlineDice(t);

        // eslint-disable-next-line no-useless-escape
        const regex = /(\s*[^\[@]*)@*(\w+)*\[([\w.,*+-\/\(\)]+)\]/g;
        let textString = t;
        const commands = [];
        let table;
        const betterResult = mergeObject({}, result.toObject(false));
        let matches;

        while ((matches = regex.exec(t)) !== null) {
          // matches[1] is undefined in case we are matching [tablename]
          // if we are matching @command[string] then matches[2] is the command and [3] is the arg inside []
          // console.log(`match 0: ${matches[0]}, 1: ${matches[1]}, 2: ${matches[2]}, 3: ${matches[3]}`);

          if (matches[1] !== undefined && matches[1].trim() !== "") {
            textString = matches[1];
          }
          // textString = matches[1] || textString; //the first match is the text outside [], a rollformula
          const commandName = matches[2];
          const innerTableName = matches[3];

          if (!commandName && innerTableName) {
            const out = BRTUtils.separateIdComendiumName(innerTableName);
            const tableName = out.nameOrId;
            const tableCompendiumName = out.compendiumName;

            if (tableCompendiumName) {
              table = await BRTUtils.findInCompendiumByName(tableCompendiumName, tableName);
            } else {
              table = game.tables.getName(tableName);
            }

            if (!table) {
              msg = game.i18n.format(NotTableByNameInPack, {
                tableName: tableName,
                packName: tableCompendiumName,
              });
              ui.notifications.warn(CONSTANTS.MODULE_ID + " | " + msg);
            }
            break;
          } else if (commandName) {
            commands.push({
              command: commandName.toLowerCase(),
              arg: matches[3],
            });
            if (commandName.toLowerCase() === "compendium") {
              betterResult.collection = matches[3];
            }
          }
        }

        // if a table definition is found, the textString is the rollFormula to be rolled on that table
        if (table) {
          const numberRolls = await BRTBetterHelpers.tryRoll(textString);
          const options = {
            rollsAmount: numberRolls,
          };
          const innerBrtTable = new BetterRollTable(table, options);
          await innerBrtTable.initialize();
          const innerResultsBrt = await innerBrtTable.betterRoll();

          const innerResults = innerResultsBrt?.results;

          // this.tableResults = this.tableResults.concat(innerResults);
          betterResults = betterResults.concat(innerResults);
        } else if (textString) {
          // if no table definition is found, the textString is the item name
          console.log(`results text ${textString.trim()} and commands ${commands}`);
          betterResult.img =
            result.thumbnail ?? result.img ?? CONFIG.RollTable.resultIcon ?? result.src ?? `icons/svg/d20-black.svg`;
          betterResult.text = textString.trim();
          // if there is command, then it's not a pure text but a generated item
          if (!commands || commands.length === 0) {
            betterResult.type = CONST.TABLE_RESULT_TYPES.TEXT;
          }
          betterResult.commands = commands;

          // PATCH 2023-10-04
          if (isEmptyObject(betterResult.flags)) {
            betterResult.flags = {};
          }
          mergeObject(betterResult.flags, result.flags);

          betterResults.push(betterResult);
        }
      }
    } else {
      const betterResult = mergeObject({}, result.toObject(false));
      betterResult.img = result.thumbnail || result.img || CONFIG.RollTable.resultIcon || `icons/svg/d20-black.svg`;
      betterResult.collection = result.documentCollection;
      betterResult.text = result.text;

      // PATCH 2023-10-04
      if (isEmptyObject(betterResult.flags)) {
        betterResult.flags = {};
      }
      mergeObject(betterResult.flags, result.flags);

      betterResults.push(betterResult);
    }

    return betterResults;
  }

  /**
   *
   * @param {String} tableText
   * @returns
   */
  async _processTextAsCurrency(tableText) {
    const regex = /{([^}]+)}/g;
    let matches;

    while ((matches = regex.exec(tableText)) != null) {
      this._addCurrency(await this._generateCurrency(matches[1]));
    }

    return tableText.replace(regex, "");
  }

  /**
   * Add given currency to existing currency
   *
   * @param {array} currencyData
   */
  _addCurrency(currencyData) {
    for (const key in currencyData) {
      this.currencyData[key] = (this.currencyData[key] || 0) + currencyData[key];
    }
  }

  /**
   *
   * @param {string} tableText
   * @returns
   */
  async _rollInlineDice(tableText) {
    const regex = /\[{2}(\w*[^\]])\]{2}/g;
    let matches;
    while ((matches = regex.exec(tableText)) != null) {
      tableText = tableText.replace(matches[0], await BRTBetterHelpers.tryRoll(matches[1]));
    }

    return tableText;
  }

  /**
   * Check given string and parse it against a regex to generate currency array
   *
   * @param {String} currencyString
   *
   * @returns
   */
  async _generateCurrency(currencyString) {
    const currenciesToAdd = {};
    if (currencyString) {
      const currenciesPieces = currencyString.split(",");
      for (const currency of currenciesPieces) {
        const match = /(.*)\[(.*?)\]/g.exec(currency); // capturing 2 groups, the formula and then the currency symbol in brakets []
        if (!match || match.length < 3) {
          let msg = game.i18n.format(`${CONSTANTS.MODULE_ID}.Strings.Warnings.CurrencyFormat`, {
            currencyString: currency,
          });
          ui.notifications.warn(CONSTANTS.MODULE_ID + " | " + msg);
          continue;
        }
        const rollFormula = match[1];
        const currencyString = match[2];
        const amount = await BRTBetterHelpers.tryRoll(rollFormula);

        currenciesToAdd[currencyString] = (currenciesToAdd[currencyString] || 0) + amount;
      }
    }
    return currenciesToAdd;
  }
}
