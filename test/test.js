const openAPI = require('../dist/index');
const {OperationObject} = require("openapi3-ts");
const gen = async () => {
    // 正常命名文件和请求函数
    // await openAPI.generateService({
    //     schemaPath: `${__dirname}/example-files/swagger-get-method-params-convert-obj.json`,
    //     serversPath: './servers/name/normal',
    //     isCamelCase: false,
    // });

    let service = ['auth', 'baas', 'docshare', 'did', 'generator', 'governance']
    console.log('service', service)

    for (let i = 0; i < service.length; i++) {
        await openAPI.generateService({
            schemaPath: `http://192.168.2.141:18001/${service[i]}/v3/api-docs`,
            serversPath: `./servers/${service[i]}`,
            isCamelCase: false,
            requestImportStatement: 'import { request } from "@/utils/http"',
        });
    }
};
gen();
