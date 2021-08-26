import * as fs from "fs-extra";
import * as path from "path";
import { populateFoundryUtilFunctions } from "../../tests/fixtures/foundryshim";
import { ActorSourcePF2e } from "@actor/data";
import { ItemSourcePF2e } from "@item/data";
import { MigrationBase } from "@module/migration/base";
import { MigrationRunnerBase } from "@module/migration/runner/base";
import { Migration643HazardLevel } from "@module/migration/migrations/643-hazard-level";
import { Migration644SpellcastingCategory } from "@module/migration/migrations/644-spellcasting-category";
import { Migration646UpdateInlineLinks } from "@module/migration/migrations/646-update-inline-links";
import { Migration647FixPCSenses } from "@module/migration/migrations/647-fix-pc-senses";
import { Migration648RemoveInvestedProperty } from "@module/migration/migrations/648-remove-invested-property";
import { Migration649FocusToActor } from "@module/migration/migrations/649-focus-to-actor";
import { Migration650StringifyWeaponProperties } from "@module/migration/migrations/650-stringify-weapon-properties";
import { Migration651EphemeralFocusPool } from "@module/migration/migrations/651-ephemeral-focus-pool";
import { Migration652KillHalcyonTradition } from "@module/migration/migrations/652-kill-halcyon-tradition";
import { Migration653AEstoREs } from "@module/migration/migrations/653-aes-to-res";
import { Migration654ActionTypeAndCount } from "@module/migration/migrations/654-action-type-count";
import { Migration655CreatureTokenSizes } from "@module/migration/migrations/655-creature-token-sizes";
import { Migration656OtherFocusPoolSources } from "@module/migration/migrations/656-other-focus-pool-sources";
import { Migration657RemoveSetProperty } from "@module/migration/migrations/657-remove-set-property";

const migrations: MigrationBase[] = [
    new Migration643HazardLevel(),
    new Migration644SpellcastingCategory(),
    new Migration646UpdateInlineLinks(),
    new Migration647FixPCSenses(),
    new Migration648RemoveInvestedProperty(),
    new Migration649FocusToActor(),
    new Migration650StringifyWeaponProperties(),
    new Migration651EphemeralFocusPool(),
    new Migration652KillHalcyonTradition(),
    new Migration653AEstoREs(),
    new Migration654ActionTypeAndCount(),
    new Migration655CreatureTokenSizes(),
    new Migration656OtherFocusPoolSources(),
    new Migration657RemoveSetProperty(),
];

global.deepClone = function (original: any): any {
    // Simple types
    if (typeof original !== "object" || original === null) return original;

    // Arrays
    if (Array.isArray(original)) return original.map(deepClone);

    // Dates
    if (original instanceof Date) return new Date(original);

    // Unsupported advanced objects
    if ("constructor" in original && original["constructor"] !== Object) return original;

    // Other objects
    const clone: Record<string, unknown> = {};
    for (const k of Object.keys(original)) {
        clone[k] = deepClone(original[k]);
    }
    return clone;
};

const packsDataPath = path.resolve(process.cwd(), "packs/data");

type CompendiumSource = CompendiumDocument["data"]["_source"];

const actorTypes = ["character", "npc", "hazard", "loot", "familiar", "vehicle"];
const itemTypes = [
    "backpack",
    "treasure",
    "weapon",
    "armor",
    "kit",
    "melee",
    "consumable",
    "equipment",
    "ancestry",
    "background",
    "class",
    "feat",
    "lore",
    "martial",
    "action",
    "spell",
    "spellcastingEntry",
    "status",
    "condition",
    "effect",
];

const isActorData = (docSource: CompendiumSource): docSource is ActorSourcePF2e => {
    return "type" in docSource && actorTypes.includes(docSource.type);
};
const isItemData = (docSource: CompendiumSource): docSource is ItemSourcePF2e => {
    return "type" in docSource && itemTypes.includes(docSource.type);
};
const isMacroData = (docSource: CompendiumSource): docSource is foundry.data.MacroSource => {
    return "type" in docSource && ["chat", "script"].includes(docSource.type);
};
const isTableData = (docSource: CompendiumSource): docSource is foundry.data.RollTableSource => {
    return "results" in docSource && Array.isArray(docSource.results);
};

function JSONstringifyOrder(obj: object): string {
    const allKeys: Set<string> = new Set();
    const idKeys: string[] = [];
    JSON.stringify(obj, (key, value) => {
        if (/^[a-z0-9]{20,}$/g.test(key)) {
            idKeys.push(key);
        } else {
            allKeys.add(key);
        }

        return value;
    });
    const sortedKeys = Array.from(allKeys).sort().concat(idKeys);

    const newJson = JSON.stringify(obj, sortedKeys, 4);
    return `${newJson}\n`;
}

async function getAllFiles(): Promise<string[]> {
    const allEntries: string[] = [];
    const packs = fs.readdirSync(packsDataPath);
    for (const pack of packs) {
        console.log(`Collecting data for '${pack}'`);

        let packFiles: string[];
        try {
            // Create an array of files in the ./packs/data/[packname].db/ directory
            packFiles = fs.readdirSync(path.resolve(packsDataPath, pack));
        } catch (e) {
            console.error(e.message);
            return [];
        }

        for (const fileName of packFiles) {
            allEntries.push(path.resolve(packsDataPath, pack, fileName));
        }
    }

    return allEntries;
}

async function migrate() {
    const allEntries = await getAllFiles();

    const migrationRunner = new MigrationRunnerBase(migrations);

    for (const filePath of allEntries) {
        const content = await fs.readFile(filePath, { encoding: "utf-8" });

        let source: ActorSourcePF2e | ItemSourcePF2e | foundry.data.MacroSource | foundry.data.RollTableSource;
        try {
            // Parse file content
            source = JSON.parse(content);
        } catch (e) {
            throw { message: `File ${filePath} could not be parsed. Error: ${e.message}` };
        }

        // skip journal entries, rollable tables, and macros
        const updated = await (async (): Promise<
            ActorSourcePF2e | ItemSourcePF2e | foundry.data.MacroSource | foundry.data.RollTableSource
        > => {
            try {
                if (isActorData(source)) {
                    const updatedActor = await migrationRunner.getUpdatedActor(source, migrationRunner.migrations);
                    delete (updatedActor.data as { schema?: unknown }).schema;
                    for (const updatedItem of updatedActor.items) {
                        delete (updatedItem.data as { schema?: unknown }).schema;
                    }
                    return updatedActor;
                } else if (isItemData(source)) {
                    const updatedItem = await migrationRunner.getUpdatedItem(source, migrationRunner.migrations);
                    delete (updatedItem.data as { schema?: unknown }).schema;
                    return updatedItem;
                } else if (isMacroData(source)) {
                    return await migrationRunner.getUpdatedMacro(source, migrationRunner.migrations);
                } else if (isTableData(source)) {
                    return await migrationRunner.getUpdatedTable(source, migrationRunner.migrations);
                } else {
                    return source;
                }
            } catch (error) {
                throw Error(`Error while trying to edit ${filePath}: ${error.message}`);
            }
        })();

        const origData = JSONstringifyOrder(source);
        const outData = JSONstringifyOrder(updated);

        if (outData !== origData) {
            console.log(`${filePath} is different. writing`);
            try {
                await fs.writeFile(filePath, outData);
            } catch (e) {
                throw { message: `File ${filePath} could not be parsed. Error: ${e.message}` };
            }
        }
    }
}

populateFoundryUtilFunctions();

migrate().catch((err) => console.error(err));
