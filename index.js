const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { GraphQLClient } = require('graphql-request');

const host = 'https://bim-portal-prod.modeloapp.com';
const [appToken, modelPath] = process.argv.splice(2);

(async () => {
    // 1. decode username & password from apiKey
    // 2. get graphql token by login api
    // 3. call uploadModel API get upload url
    // 4. upload model files to upload urls
    // 5. call uploadModelSuccess API
    const [username, password] = Buffer.from(appToken, 'base64').toString().split(',');
    const filename = path.basename(modelPath);
    const loginRes = await axios.post(`${host}/login`, {
        username,
        password,
    });
    const { token } = loginRes.data;
    const gql = new GraphQLClient(
        `${host}/graphql`,
        {
            headers: {
                'x-access-token': token,
            },
        },
    );
    const userQuery = `
        query{
            user{
                projects{
                    modelFolder{
                        id
                    }
                }
            }
        }`;
    const userData = await gql.request(userQuery);
    const folderId = userData.user.projects[0].modelFolder.id;
    const uploadModelQuery = `
            mutation{
                uploadModel(folderId:${folderId},name:"${filename}",filenames:"${filename}"){
                id
                uploadUrls{
                    url
                    }
                }
            }`;
    const uploadModelData = await gql.request(uploadModelQuery);
    console.log('going to upload model: ', filename, uploadModelData);
    const uploadUrl = uploadModelData.uploadModel.uploadUrls[0].url;
    const modelId = uploadModelData.uploadModel.id;
    const bytes = fs.statSync(modelPath).size;
    const readStream = fs.createReadStream(modelPath);
    const uploadFilenamesDone = await axios.put(uploadUrl, readStream, {
        headers: {
            // 'Content-Type': 'multipart',
            'Access-Control-Allow-Origin': '*',
            'x-amz-acl': 'public-read',
            'Content-Length': bytes,
        },
    });
    const uploadModelSuccessMutation = `
            mutation{
                uploadModelSuccess(id: "${modelId}"){
                id
                name
                status
                }
            }`;
    const successData = await gql.request(uploadModelSuccessMutation);
    console.log('upload success: ', successData);
})();
