import { ItemSourcePF2e } from "@item/data";
import { ItemMutationData } from "./schema";

function validateMutation(source: ItemSourcePF2e, mutation: ItemMutationData): asserts mutation is ItemMutationData {
    const { value } = mutation;
    console.log(value)
    console.log(source)

}

function applyMutations(itemSource: ItemSourcePF2e, mutations: ItemMutationData[]): void {
    for (const mutation of mutations) {
        validateMutation(itemSource, mutation);

        const { value } = mutation;
        console.log(value)
    }
}

export { applyMutations }