import { CONSTANTS } from "../constants/constants.js";
import { debug, error, warn } from "../lib.js";

export class BRTBetterHelpers {
  /**
   * when dropping a link entity on a rolltable if the drop is a tableResult, we assign the dropped entity to that result table.
   * If the drop happens in another part of the tableview we create a new table result
   * @param {event} event
   * @param {RollTable} table the rolltable the event is called on
   */
  static async dropEventOnTable(event, table) {
    // console.log("EVENT ", event);
    try {
      JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (err) {
      error(`no entity dropped`, false, err);
      return;
    }

    const targetName = event.target.name;

    let resultIndex = -1;
    /** dropping on a table result line the target will be results.2.type, results.2.collection, results.2.text */
    const isString = targetName && typeof targetName.startsWith === "function";

    /** brt.x.formula is the input text field added by brt to have 1 formula added per table row */
    if (isString && (targetName.startsWith("results.") || targetName.startsWith("brt."))) {
      const splitString = targetName.split(".");
      if (splitString.length > 1) {
        resultIndex = Number(splitString[1]);
      }
    }

    const resultTableData = {};
    if (resultIndex >= 0) {
      resultTableData._id = table.results[resultIndex]._id;
    }

    if (resultTableData._id) {
      table.updateEmbeddedDocuments("TableResult", [resultTableData]);
    } else {
      /** create a new embedded entity if we dropped the entity on the sheet but not on a specific result */
      const lastTableResult = table.results[table.results.length - 1];
      if (lastTableResult) {
        const rangeLenght = lastTableResult.range[1] - lastTableResult.range[0];
        resultTableData.weight = lastTableResult.weight;
        resultTableData.range = [lastTableResult.range[1], lastTableResult.range[1] + rangeLenght];
      } else {
        resultTableData.weight = 1;
        resultTableData.range = [1, 1];
      }
      table.createEmbeddedDocuments("TableResult", [resultTableData]);
    }
  }

  static async tryRoll(rollFormula) {
    try {
      const qtFormula = String(rollFormula);
      if (qtFormula == null || qtFormula === "" || qtFormula === "1") {
        return 1;
      } else {
        try {
          const qt = (await new Roll(qtFormula).roll({ async: true })).total || 1;
          return qt;
        } catch (e) {
          debug(e.message, false, e);
          const qtRoll = Roll.create(qtFormula);
          const qt = (await qtRoll.evaluate({ async: true })).total || 1;
          return qt;
        }
      }
    } catch (e) {
      error(e.message, false, e);
      return 1;
    }
  }

  /**
   * we can provide a formula on how many times we roll on the table.
   * @returns {Number} how many times to roll on this table
   */
  static async rollsAmount(table) {
    const tableType = table.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.TABLE_TYPE_KEY);
    if (tableType === CONSTANTS.TABLE_TYPE_BETTER) {
      const rollFormula = table.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.GENERIC_AMOUNT_KEY);
      return await BRTBetterHelpers.tryRoll(rollFormula);
    } else if (tableType === CONSTANTS.TABLE_TYPE_LOOT) {
      const rollFormula = table.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.LOOT_AMOUNT_KEY);
      return await BRTBetterHelpers.tryRoll(rollFormula);
    } else if (tableType === CONSTANTS.TABLE_TYPE_HARVEST) {
      const rollFormula = table.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.HARVEST_AMOUNT_KEY);
      return await BRTBetterHelpers.tryRoll(rollFormula);
    } else {
      return 1;
    }
  }

  static async retrieveDocumentFromResultOnlyUuid(result, throwError) {
    return BRTBetterHelpers.retrieveDocumentFromResult(result, throwError, true);
  }

  static async retrieveDocumentFromResult(result, throwError, onlyUuid = false) {
    let findDocument = null;
    let docUuid = getProperty(result, `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_UUID}`);
    if (docUuid) {
      if (onlyUuid) {
        findDocument = fromUuidSync(docUuid);
      } else {
        findDocument = await fromUuid(docUuid);
      }
    }
    if (!findDocument) {
      if (result.type === CONST.TABLE_RESULT_TYPES.COMPENDIUM) {
        // Compendium.world.prodottifiniti.Item.cGvOfBMe8XQjL8ra
        let compendium = game.packs.get(`${result.documentCollection}`);
        if (!compendium) {
          if (throwError) {
            throw error(`Compendium ${result.documentCollection} was not found`);
          } else {
            warn(`Compendium ${result.documentCollection} was not found`);
            return null;
          }
        }
        if (onlyUuid) {
          findDocument = compendium?.contents.find((m) => m.id === `${result.documentId}`);
        } else {
          findDocument = (await compendium?.getDocuments()).find((m) => m.id === `${result.documentId}`);
        }
        // let findDocument = compendium.contents.find((m) => m.id === `${result.documentId}`);
        if (!findDocument) {
          if (throwError) {
            throw error(`The "${result.documentId}" document was not found in Compendium ${result.documentCollection}`);
          } else {
            warn(`The "${result.documentId}" document was not found in Compendium ${result.documentCollection}`);
            return null;
          }
        }
      } else if (result.type === CONST.TABLE_RESULT_TYPES.DOCUMENT) {
        let collection = game.collections.get(result.documentCollection);
        if (!collection) {
          if (throwError) {
            throw error(`Collection ${result.documentCollection} was not found`);
          } else {
            warn(`Collection ${result.documentCollection} was not found`);
            return null;
          }
        }
        if (collection) {
          if (onlyUuid) {
            findDocument = collection.contents.find((m) => m.id === `${result.documentId}`);
          } else {
            findDocument = collection.contents.find((m) => m.id === `${result.documentId}`);
            // findDocument = (await collection.getDocuments()).find((m) => m.id === `${result.documentId}`);
          }
          // let findDocument = compendium.contents.find((m) => m.id === `${result.documentId}`);
          if (!findDocument) {
            if (throwError) {
              throw error(
                `The "${result.documentId}" document was not found in collection ${result.documentCollection}`
              );
            } else {
              warn(`The "${result.documentId}" document was not found in collection ${result.documentCollection}`);
              return null;
            }
          }
        } else {
          findDocument = fromUuid(`${result.documentName}.${result.documentId}`); // Actor.KjoEEN077oSC4WG4
          if (!findDocument) {
            if (throwError) {
              throw error(
                `The "${result.documentId}" document was not found in collection ${result.documentName}.${result.documentId}`
              );
            } else {
              warn(
                `The "${result.documentId}" document was not found in collection ${result.documentName}.${result.documentId}`
              );
              return null;
            }
          }
        }
      }
    }
    if (!findDocument) {
      warn(
        `The uuid can be retrieved only from result type '${CONST.TABLE_RESULT_TYPES.COMPENDIUM}' or '${CONST.TABLE_RESULT_TYPES.DOCUMENT}'`
      );
      findDocument = null;
    }
    return findDocument;
  }

  static async updateTableResult(resultToUpdate) {
    let isUpdate = false;
    // , noFlag = false
    let result = resultToUpdate.toObject(false);
    result.isText = result.type === CONST.TABLE_RESULT_TYPES.TEXT;
    result.isDocument = result.type === CONST.TABLE_RESULT_TYPES.DOCUMENT;
    result.isCompendium = result.type === CONST.TABLE_RESULT_TYPES.COMPENDIUM;
    result.img = result.icon || result.img || CONFIG.RollTable.resultIcon;
    result.text = TextEditor.decodeHTML(result.text);
    const resultDoc = await BRTBetterHelpers.retrieveDocumentFromResultOnlyUuid(result, false);
    result.uuid = resultDoc?.uuid ?? "";
    // grab the formula
    // result.qtFormula = getProperty(result, `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.}`;
    if (result.isDocument || result.isCompendium) {
      const currentUuid = getProperty(result, `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_UUID}`);
      const currentOriginalName = getProperty(
        result,
        `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_ORIGINAL_NAME}`
      );
      const currentCustomName = getProperty(
        result,
        `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_CUSTOM_NAME}`
      );
      const currentOriginalIcon = getProperty(
        result,
        `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_ORIGINAL_ICON}`
      );
      const currentCustomIcon = getProperty(
        result,
        `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_CUSTOM_ICON}`
      );

      if (result.uuid && (!currentUuid || currentUuid !== result.uuid)) {
        setProperty(result, `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_UUID}`, result.uuid);
        // if (noFlag) {
        //   setProperty(result, `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_UUID}`, result.uuid);
        // } else {
        //   await result.setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.GENERIC_RESULT_UUID, result.uuid);
        // }
        isUpdate = true;
      }
      if (
        result.text &&
        currentOriginalName !== result.text &&
        currentCustomName &&
        currentCustomName !== result.text
      ) {
        setProperty(
          result,
          `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_ORIGINAL_NAME}`,
          result.text
        );
        // if (noFlag) {
        //   setProperty(
        //     result,
        //     `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_ORIGINAL_NAME}`,
        //     result.text
        //   );
        // } else {
        //   await result.setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.GENERIC_RESULT_ORIGINAL_NAME, result.text);
        // }
        isUpdate = true;
      }
      if (result.text && !currentCustomName) {
        setProperty(result, `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_CUSTOM_NAME}`, result.text);
        // if (noFlag) {
        //   setProperty(
        //     result,
        //     `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_CUSTOM_NAME}`,
        //     result.text
        //   );
        // } else {
        //   await result.setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.GENERIC_RESULT_CUSTOM_NAME, result.text);
        // }
        isUpdate = true;
      }

      if (result.img && currentOriginalIcon !== result.img && currentCustomIcon && currentCustomIcon !== result.img) {
        setProperty(result, `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_ORIGINAL_ICON}`, result.img);
        // if (noFlag) {
        //   setProperty(
        //     result,
        //     `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_ORIGINAL_ICON}`,
        //     result.img
        //   );
        // } else {
        //   await result.setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.GENERIC_RESULT_ORIGINAL_ICON, result.img);
        // }
        isUpdate = true;
      }
      if (result.img && !currentCustomIcon) {
        setProperty(result, `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_CUSTOM_ICON}`, result.img);
        // if (noFlag) {
        //   setProperty(
        //     result,
        //     `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAGS.GENERIC_RESULT_CUSTOM_ICON}`,
        //     result.img
        //   );
        // } else {
        //   await result.setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAGS.GENERIC_RESULT_CUSTOM_ICON, result.img);
        // }
        isUpdate = true;
      }
      if (result.documentCollection === "JournalEntry") {
        if (result.uuid) {
          result.isJournal = true;
          const journalEntry = await fromUuid(result.uuid);
          if (journalEntry?.pages.size > 0) {
            const sortedArray = journalEntry.pages.contents.sort((a, b) => a.sort - b.sort);
            const journalPages = [];
            journalPages.push({
              uuid: "",
              name: "",
            });
            for (const page of sortedArray) {
              journalPages.push({
                uuid: page.uuid,
                name: page.name,
              });
            }
            result.journalPages = journalPages;
          } else {
            result.journalPages = [];
          }
        }
      }
    }
    return {
      result: result,
      isUpdate: isUpdate,
    };
  }
}
