import Log from "../src/log";

const openAPI = require('../src/index.ts');

/**
 * 专为公司前端而设计的代码生成器
 */
const gen = async () => {

    let service = ['auth', 'baas', 'docshare', 'did', 'generator', 'governance']
    for (let i = 0; i < service.length; i++) {
        Log(`😘正在生成${service[i]}服务`)
        await openAPI.generateService({
            schemaPath: `http://192.168.2.141:18001/${service[i]}/v3/api-docs`,
            serversPath: `./casll/${service[i]}`,
            requestLibrary: 'axios',
            requestImportStatement: 'import { request } from "@/utils/http"',
        });
    }
};
gen();
