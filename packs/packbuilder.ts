import * as path from "path";
import * as fs from "fs";

interface SerializableData {
  [key: string]: { } | null;
}

interface PackEntityData extends SerializableData {
  _id: string;
  name: string;
  type?: string;
  img?: string;
  data: SerializableData;
  flags: { [key: string]: SerializableData };
  permission: { default: 0 };
  items?: { img: string }[];
}

const throwPackError = (message: string) => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

class Compendium {
  name: string;
  packDir: string;
  data: PackEntityData[];

  static outDir = path.resolve(process.cwd(), "static/packs");
  static _namesToIds = new Map<string, Map<string, string>>();
  static _systemPackData = JSON.parse(
    fs.readFileSync("system.json", "utf-8")
  ).packs as { name: string, path: string }[];
  static _worldItemLinkPattern = new RegExp(
    /@(?:Item|JournalEntry|Actor)\[[^\]]+\]|@Compendium\[world\.[[^\]]+\]/
  );

  constructor(packDir: string, parsedData: unknown[]) {
    if (this._isPackData(parsedData)) {
      this.packDir = packDir;
      this.name = Compendium._systemPackData.find(
        (pack) => path.basename(pack.path) === path.basename(packDir)
      ).name;
      Compendium._namesToIds.set(this.name, new Map());
      const packMap = Compendium._namesToIds.get(this.name);

      parsedData.sort((a, b) => {
        if (a._id === b._id) {
          throwPackError(`_id collision in ${this.name}: ${a._id}`);
        }
        return a._id > b._id ? 1 : -1;
      });

      this.data = parsedData;

      for (const entityData of this.data) {
        // Populate Compendium._namesToIds for later conversion of compendium links
        packMap.set(entityData.name, entityData._id);

        // Check img paths
        if (typeof entityData.img === "string") {
          const imgPaths = [entityData.img ?? ""].concat(
            entityData.hasOwnProperty("items") ?
              entityData.items.map((itemData) => itemData.img ?? "") : []
          );
          const entityName = entityData.name;
          for (const imgPath of imgPaths) {
            if (imgPath.startsWith("data:image")) {
              throwPackError(`${entityName} (${this.name}) has base64-encoded image data: `
                             + `${imgPath.slice(0, 64)}...`);
            }

            const repoImgPath = path.resolve(
              process.cwd(), "static", decodeURIComponent(imgPath).replace("systems/pf2e/", "")
            );
            if (!imgPath.match(/^\/?icons\/svg/) && !fs.existsSync(repoImgPath)) {
              throwPackError(`${entityName} (${this.name}) has a broken image link: ${imgPath}`);
            }
          }
        }
      }

    } else {
      throwPackError(`Data supplied for ${this.name} does not resemble Foundry entity data.`);
    }
  }

  _finalize(entityData: PackEntityData) {
    // Replace all compendium entities linked by name to links by ID
    const stringified = JSON.stringify(entityData);
    const worldItemLink = Compendium._worldItemLinkPattern.exec(stringified);
    if (worldItemLink !== null) {
      throwPackError(`${entityData.name} (${this.name}) has a link to a world item: `
                  + `${worldItemLink[0]}`);
    }

    return JSON.stringify(entityData).replace(
      /@Compendium\[pf2e\.(?<packName>[^.]+)\.(?<entityName>[^\]]+)\]\{?/g,
      (match, packName: string, entityName: string) => {
        const namesToIds = Compendium._namesToIds.get(packName);
        if (namesToIds === undefined) {
          throwPackError(`${entityData.name} (${this.name}) has bad pack reference: ${match}`);
        }
        if (!match.endsWith("{")) {
          throwPackError(`${entityData.name} (${this.name}) has a link with no label: ${match}`);
        }

        const entityId: string | undefined = namesToIds.get(entityName);
        if (entityId === undefined ) {
          console.warn(`Warning: ${entityData.name} (${this.name}) has broken link to `
                       + `${entityName} (${packName}).`);
          return `@Compendium[pf2e.${packName}.${entityName}]{`;
        } else {
          return `@Compendium[pf2e.${packName}.${entityId}]{`;
        }
      }
    );
  }

  save(): number {
    fs.writeFileSync(
      path.resolve(Compendium.outDir, this.packDir),
      this.data.map((datum) => this._finalize(datum)).join("\n") + "\n"
    );
    console.log(`Pack "${this.name}" with ${this.data.length} entries built successfully.`);

    return this.data.length;
  }

  _isEntityData(entityData: any): entityData is PackEntityData {
    const checks = Object.entries({
      name: (data: any) => typeof data.name === "string",
      // type: (data: any) => typeof data.type === "string",
      flags: (data: any) => typeof data.flags === "object",
      permission: (data: any) =>
        data.permission !== undefined && JSON.stringify(data.permission) === '{"default":0}'
    });

    const failedChecks = checks.map(
      ([key, check]) => check(entityData) ? null : key
    ).filter((key) => key !== null);

    if (failedChecks.length > 0) {
      throwPackError(
        `${entityData.name} (${this.name}) has invalid or missing keys: ${failedChecks.join(", ")}`
      );
    }

    return true;
  }

  _isPackData(packData: any): packData is PackEntityData[] {
    return packData.every((entityData: any) => this._isEntityData(entityData));
  }

}

export function buildPacks(): void {
  const packsDataPath = path.resolve(process.cwd(), "packs/data");

  const packDirs = fs.readdirSync(packsDataPath);

  // ¡Aviso!
  // Loads all packs into memory for the sake of making all entity name/id mappings available
  const packs = packDirs.map((packDir) => {
    const filenames = fs.readdirSync(path.resolve(packsDataPath, packDir));
    const filePaths = filenames.map((filename) => path.resolve(packsDataPath, packDir, filename));
    const jsonData = filePaths.map((filePath) => {
      const jsonString = fs.readFileSync(filePath, "utf-8");
      try {
        return JSON.parse(jsonString) as unknown;
      } catch (error) {
        throwPackError(`File ${filePath} could not be parsed: ${error.message}`);
      }
    });

    return new Compendium(packDir, jsonData);
  });

  const entityCounts = packs.map((pack) => pack.save());
  const total = entityCounts.reduce(
    (runningTotal, entityCount) => runningTotal + entityCount, 0
  );

  if (entityCounts.length > 0) {
    console.log(`Created ${entityCounts.length} packs with ${total} entities.`);
  } else {
    throwPackError("No data available to build packs.");
  }
}

buildPacks();
