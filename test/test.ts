import Log from "../src/log";

const openAPI = require('../src/index.ts');

const gen = async () => {
    //测试自定义模板路径
    // Log("😘正在测试自定义模版路径")
    // await openAPI.generateService({
    //     schemaPath: `${__dirname}/openapi-doc/openapi.json`,
    //     serversPath: './test/gen/custom',
    //     requestLibrary: 'custom',
    //     customServicePath: 'test/custom-service-template'
    // });

    //测试umi模版
    Log("😘正在测试umi模版")
    await openAPI.generateService({
        schemaPath: `${__dirname}/openapi-doc/openapi.json`,
        serversPath: './test/gen/umi',
        requestLibrary: 'umi',
        customServicePath: 'test/custom-service-template'
    });

    //测试axios模版
    Log("😘正在测试axios模版")
    await openAPI.generateService({
        schemaPath: `${__dirname}/openapi-doc/openapi.json`,
        serversPath: './test/gen/axios',
        requestLibrary: 'axios',
        customServicePath: 'test/custom-service-template',
    });
}
gen()
