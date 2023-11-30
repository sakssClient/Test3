import mongoose, { Model, Schema } from "mongoose";

const userOrgModel = new Schema({
    name: {
        type: Schema.Types.String,
        require: true,
    },
    projects: {
        type: [Schema.Types.ObjectId],
    },
    score: {
        type: Schema.Types.Number,
        default: 0,
    },
});

const model = mongoose.model("userOrgModel", userOrgModel);
export default model;
