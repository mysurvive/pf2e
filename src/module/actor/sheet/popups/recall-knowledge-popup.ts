import { CreatureIdentificationData } from "@module/recall-knowledge.ts";
import { localizeList } from "@util";

export class RecallKnowledgePopup extends Application {
    #identificationData: CreatureIdentificationData;

    constructor(options: Partial<ApplicationOptions>, data: CreatureIdentificationData) {
        super(options);
        this.#identificationData = data;
    }

    static override get defaultOptions(): ApplicationOptions {
        return {
            ...super.defaultOptions,
            id: "recall-knowledge-breakdown",
            classes: [],
            title: game.i18n.localize("PF2E.RecallKnowledge.BreakdownTitle"),
            template: "systems/pf2e/templates/actors/recall-knowledge.hbs",
            width: 600,
        };
    }

    override async getData(): Promise<PopupData> {
        const identificationData = this.#identificationData;

        return {
            standard: {
                label: localizeList(
                    identificationData.skills.map((s) => game.i18n.localize(CONFIG.PF2E.skills[s].label)),
                ),
                attempts: this.#padAttempts(identificationData.standard.progression),
            },
            loreEasy: this.#padAttempts(identificationData.lore[0].progression),
            loreVeryEasy: this.#padAttempts(identificationData.lore[1].progression),
        };
    }

    #padAttempts(attempts: number[]): string[] {
        const result = attempts.map((a) => a.toString());
        for (let i = result.length; i < 6; i++) {
            result.push("-");
        }
        return result;
    }
}

interface PopupData {
    standard: { label: string; attempts: string[] };
    loreEasy: string[];
    loreVeryEasy: string[];
}
