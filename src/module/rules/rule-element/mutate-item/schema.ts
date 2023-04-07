import { StringField } from "types/foundry/common/data/fields.mjs";
import { ModelPropsFromSchema } from "types/foundry/common/data/fields.mjs";

const { fields } = foundry.data;

class ItemMutationField extends fields.SchemaField<ItemMutationSchema,
    SourceFromSchema<ItemMutationSchema>,
    ModelPropsFromSchema<ItemMutationSchema>,
    true,
    false,
    false>{
    constructor() {
        super(
            {
                key: new fields.StringField({ required: true, initial: undefined }),
                value: new ItemMutationValueField()
            }
        )
    }
}

class ItemMutationValueField extends fields.DataField<
    string | number | boolean | object | null,
    string | number | boolean | object | null,
    true,
    true,
    false> {
    constructor() {
        super({ required: true, nullable: true, initial: undefined })
    }

    protected _cast(value: unknown): unknown {
        return value;
    }

    protected override _validateType(value: unknown): boolean {
        return ["boolean", "number", "object", "string"].includes(typeof value)
    }
}

type ItemMutationSchema = {
    key: StringField<string, string, true, false, false>;
    value: ItemMutationValueField;
}

type ItemMutationData = ModelPropsFromSchema<ItemMutationSchema>


export { ItemMutationValueField, ItemMutationField, ItemMutationData }