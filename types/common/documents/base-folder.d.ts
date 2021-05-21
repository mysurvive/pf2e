declare module foundry {
    module documents {
        /**
         * The Folder Document model.
         *
         * @param data Initial data from which to construct the document.
         * @property data The constructed data object for the document.
         */
        class BaseFolder extends abstract.Document {
            /** @override */
            static get schema(): new (...args: any[]) => data.FolderData;

            /** @override */
            static get metadata(): FolderMetadata;
        }

        interface BaseFolder {
            readonly data: data.FolderData<this>;
        }

        interface FolderMetadata extends abstract.DocumentMetadata {
            name: 'Folder';
            collection: 'folders';
            label: 'DOCUMENT.Folder';
            isPrimary: true;
            types: typeof CONST.FOLDER_ENTITY_TYPES;
        }
    }
}
