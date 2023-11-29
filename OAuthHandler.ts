import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { NextFunction, Response, Request } from "express";
import jwt, { Secret } from "jsonwebtoken";
import clientProjModel from "../models/clientProjModel";
import { getGitHubUserData } from "../utils/gihubAPICollections";

// Consts
const clientId = <string>(<unknown>process.env.GITHUB_CLIENT_ID);
const clientSecret = <string>(<unknown>process.env.GITHUB_CLIENT_SECRET);

// Code

const makeNewClient = async (authToken: string) => {
    const currUserDetails = await getGitHubUserData(authToken);
    const userName = currUserDetails.login;
    const isPresent = await clientProjModel.findOne({ clientGithubUserName: userName });
    if (!isPresent) {
        const newUser = await clientProjModel.create({
            clientGithubUserName: userName,
            clientAuthToken: authToken,
            projects: [],
        });
        if (newUser) {
            console.log("New Client Genrated Successfully");
        }
    }
    return;
};

export const authTokenHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const requestToken = req.query.code;
        console.log(requestToken);
        axios({
            method: "POST",
            url: `https://github.com/login/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&code=${requestToken}`,
            headers: {
                accept: "application/json",
            },
        }).then((result) => {
            const authToken = result.data.access_token;
            const token = jwt.sign(
                {
                    exp: Math.floor(Date.now() / 1000) + 60 * 60,
                    data: authToken,
                },
                <Secret>(<unknown>process.env.JWT_SECRET)
            );
            makeNewClient(authToken).then(() => {
                res.cookie("token", token);
                return res.status(200).redirect(`/user/listUserRepo`);
            });
        });
    } catch (err) {
        console.log("Error in github oauth login");
        return res.status(500);
    }
};
