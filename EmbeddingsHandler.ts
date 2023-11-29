import dotenv from "dotenv";
dotenv.config();
import { MilvusClient, RowData } from "@zilliz/milvus2-sdk-node";
import { Response, Request } from "express";
import { genrateEmbeddings } from "../utils/genrateEmbeddings";
import { blobContentReader, fileFilter, getGitHubUserData } from "../utils/gihubAPICollections";
import projectAuthModel from "../models/projectAuthKeyModel";

// Constants
const vectorClusterAddress = <string>(<unknown>process.env["VECTOR_CLUSTER_ENDPOINT"]);
const vectorClusterAPIKey = <string>(<unknown>process.env["VECTOR_CLUSTER_ENDPOINT_API_KEY"]);
const collectionName = "ContinuousEvaluation";

const updateEmbeddings = async (data: any) => {
    const res = await new MilvusClient({
        address: vectorClusterAddress,
        token: vectorClusterAPIKey,
    }).upsert({
        collection_name: collectionName,
        data: data,
    });
    console.log(`File ${data.project_id__file_name} updated successfully`);
};

const newEmbeddings = async (data: any) => {
    const res = await new MilvusClient({
        address: vectorClusterAddress,
        token: vectorClusterAPIKey,
    }).insert({
        collection_name: collectionName,
        data: data,
    });
    console.log(`File ${data.project_id__file_name} inserted successfully`);
};

const deleteEmbeddings = async (fileName: any) => {
    const res = await new MilvusClient({
        address: vectorClusterAddress,
        token: vectorClusterAPIKey,
    }).delete({
        collection_name: collectionName,
        ids: [fileName],
    });
    console.log(`File ${fileName} deleted successfully`);
};

const compareAndEmbedFiles = async (authToken: string, project_id: string, compare_url: string) => {
    const currProjectName = compare_url.split("/").slice(4, 6); // [username,reponame];
    const currProjDetails = await projectAuthModel.findOne({
        projectName: `${currProjectName[0]}/${currProjectName[1]}`,
    });
    if (currProjDetails) {
        const { modifiedFiles, newFiles, removedFiles } = await fileFilter(
            currProjDetails?.authToken as string,
            compare_url
        );
        const modifiedData = await Promise.all(
            modifiedFiles.map(async (ele) => {
                if (ele.changes >= 5) {
                    const text = await blobContentReader(authToken, ele.contents_url);
                    return {
                        project_id__file_name: `${project_id}/${ele.filename}`,
                        code_or_req: true,
                        embedding_vectors: await genrateEmbeddings(`${ele.file_name}\n${text}`),
                    };
                }
            })
        );
        const addedData = await Promise.all(
            newFiles.map(async (ele) => {
                const text = await blobContentReader(authToken, ele.contents_url);
                return {
                    project_id__file_name: `${project_id}/${ele.filename}`,
                    code_or_req: true,
                    embedding_vectors: await genrateEmbeddings(`${ele.file_name}\n${text}`),
                };
            })
        );
        const removedData = await Promise.all(
            removedFiles.map(async (ele) => {
                return `${project_id}/${ele.filename}`;
            })
        );
        if (modifiedData.length > 0) {
            console.log(modifiedData);
            await updateEmbeddings(modifiedData);
        }
        if (addedData.length > 0) {
            console.log(addedData);
            await newEmbeddings(addedData);
        }
        if (removedFiles.length > 0) {
            console.log(removedFiles);
            deleteEmbeddings(removedData);
        }
    }
    return;
};

export const compareAndUpdateEmbeddingsHandler = async (req: Request, res: Response) => {
    let compare_url: string = req.body.repository.compare_url;
    const compare: string = req.body.compare;
    const base_head = compare.split("/");
    compare_url = compare_url.replace("{base}...{head}", base_head[base_head.length - 1]);
    const currProject = await projectAuthModel.findOne({
        projectName: req.body.repository.full_name,
    });
    if (currProject?.authToken) {
        await compareAndEmbedFiles(currProject.authToken, currProject._id.toString(), compare_url);
        return res.send({ Link: compare_url });
    }
    return res.send({ Error: "Project does not exist" });
};
