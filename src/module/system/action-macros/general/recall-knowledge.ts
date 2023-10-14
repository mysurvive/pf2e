import {
    SingleCheckAction,
    SingleCheckActionUseOptions,
    SingleCheckActionVariant,
    SingleCheckActionVariantData,
} from "@actor/actions/single-check.ts";
import { CheckResultCallback, SkillActionOptions } from "../types.ts";
import { ActionMacroHelpers } from "../helpers.ts";
import { ModifierPF2e, createAttributeModifier } from "@actor/modifiers.ts";
import { getSelectedOrOwnActors } from "@util/token-actor-utils.ts";
import { CharacterPF2e } from "@actor";
//import { creatureIdentificationDCs } from "@module/recall-knowledge.ts";
//import { CheckDC } from "@system/degree-of-success.ts";

function recallKnowledge(options: SkillActionOptions): void {
    if (!options?.skill) {
        ui.notifications.warn("");
        return;
    }
    const replaceableAttributes = ["dex", "con", "str", "cha"];
    const actor = getSelectedOrOwnActors(["character"], true);
    const { skill: slug } = options;
    const statistic = actor[0].getStatistic(slug);

    // const target = options.event?.target ?? null;
    //const identifyDCs = target === typeof NPCPF2e ? creatureIdentificationDCs(target) : null;
    console.log(options.event);
    const rollOptions = ["action:recall-knowledge", `action:recall-knowledge:${slug}`];

    const attributeModifier = createAttributeModifier({
        actor: actor[0] as CharacterPF2e,
        attribute: "int",
        domains: ["int-based", "recall-knowledge"],
    });
    attributeModifier.force = true;

    const modifiers: ModifierPF2e[] = [];
    replaceableAttributes.includes(statistic?.attribute as string) && !statistic?.lore
        ? modifiers.push(attributeModifier)
        : null;

    ActionMacroHelpers.simpleRollActionCheck({
        actors: options.actors,
        actionGlyph: options.glyph,
        title: "",
        checkContext: (opts) => ActionMacroHelpers.defaultCheckContext(opts, { modifiers, rollOptions, slug }),
        traits: ["concentrate", "secret"],
        event: options.event,
        callback: options.callback,
        difficultyClass: options.difficultyClass,
        extraNotes: (selector: string) => [
            ActionMacroHelpers.note(selector, "", "criticalSuccess"),
            ActionMacroHelpers.note(selector, "", "success"),
            ActionMacroHelpers.note(selector, "", "failure"),
            ActionMacroHelpers.note(selector, "", "criticalFailure"),
        ],
    }).catch((error: Error) => {
        ui.notifications.error(error.message);
        throw error;
    });
}

class RecallKnowledgeActionActionVariant extends SingleCheckActionVariant {
    override async use(
        options: Partial<SingleCheckActionUseOptions> & { statistic: string }
    ): Promise<CheckResultCallback[]> {
        if (!options.statistic) {
            throw new Error("We in here");
        }
        const rollOption = `action:recall-knowledge:${options.statistic}`;
        options.rollOptions ??= [];
        if (!options.rollOptions.includes(rollOption)) {
            options.rollOptions.push(rollOption);
        }
        return super.use(options);
    }
}

class RecallKnowledgeAction extends SingleCheckAction {
    constructor() {
        super({
            cost: 1,
            description: "",
            name: "",
            notes: [
                { outcome: ["criticalSuccess"], text: "" },
                { outcome: ["success"], text: "" },
                { outcome: ["failure"], text: "" },
                { outcome: ["criticalFailure"], text: "" },
            ],
            rollOptions: ["action:recall-knowledge"],
            slug: "recall-knowledge",
            statistic: "",
            traits: ["concentrate", "secret"],
        });
    }
    protected override toActionVariant(data?: SingleCheckActionVariantData): SingleCheckActionVariant {
        return new RecallKnowledgeActionActionVariant(this, data);
    }
}

/*
interface RecallKnowledgeActionOptions extends SkillActionOptions {
    mode?: "creature-identification" | "recall-knowledge";
    difficultyClass?: CheckDC;
}*/

const action = new RecallKnowledgeAction();

export { recallKnowledge as legacy, action };
